"""Word onsets for the clips of every narrated story (DESIGN.md I.6.5, amendment H.74).

    python scripts/narration-align.py [--story two-sciences] [--force]

For each beat of each narrated story (a story folder with a narration.json, under src/fitness/stories or
src/metfix-lab/stories) whose clip public/<clips>/<beat>-<hash>.mp3 exists, this FORCE-ALIGNS the beat's
narration text to its clip: CTC forced alignment (torchaudio.functional.forced_align) of the text, read
as it is spoken (digits as words: "4,995" is "four thousand nine hundred ninety five", "1.9%" is "one
point nine percent"), against the frame emissions of torchaudio's WAV2VEC2_ASR_BASE_960H. A known text is
aligned, never recognised, so there are no recognition errors, and onsets land within a frame or two
(20 ms frames). An onset inside a silence (ffmpeg silencedetect -45 dB, from 50 ms, the measure
narration-lib.mjs uses) moves to that silence's end. It writes <story>/narration.align.json:

    { "beats": { "<beat id>": { "hash": "<clip hash>", "words": [["Deduction:", 2.48, 2.98], ...] } } }

one entry per whitespace-separated word of the text, in order: [word, onset, end], seconds from the clip's
start. A beat whose entry already carries the current hash is kept (--force redoes it).
scripts/narration-manifest.mjs resolves narration.json "sync" anchors against these onsets into the knots
of narration.gen.ts; scripts/narration-check.mjs fails when a narrated beat has no alignment for its
current text, so the picture can never follow a stale voice.

Needs torch and torchaudio (the model downloads once, 360 MB, into the torch hub cache) and ffmpeg on PATH;
uses CUDA when available. Run it after new clips are copied into public/, then node scripts/narration-manifest.mjs.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import warnings

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORY_ROOTS = [os.path.join(ROOT, 'src', 'fitness', 'stories'), os.path.join(ROOT, 'src', 'metfix-lab', 'stories')]
PUBLIC = os.path.join(ROOT, 'public')
MODEL = 'WAV2VEC2_ASR_BASE_960H'

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = '_ _ twenty thirty forty fifty sixty seventy eighty ninety'.split()


def num_words(n):
    if n < 20:
        return [ONES[n]]
    if n < 100:
        return [TENS[n // 10]] + ([] if n % 10 == 0 else [ONES[n % 10]])
    if n < 1000:
        return [ONES[n // 100], 'hundred'] + ([] if n % 100 == 0 else num_words(n % 100))
    if n < 1000000:
        return num_words(n // 1000) + ['thousand'] + ([] if n % 1000 == 0 else num_words(n % 1000))
    raise ValueError(f'{n}: spell it out in the narration')


def spoken(word):
    """One written word as the words the voice says ("99,900," -> ninety nine thousand nine hundred)."""
    out = []
    for part in re.findall(r"[0-9][0-9,]*(?:\.[0-9]+)?%?|[a-z']+", word.lower()):
        if part[0].isdigit():
            pct = part.endswith('%')
            p = part.rstrip('%').rstrip(',')
            if '.' in p:
                a, b = p.split('.')
                out += num_words(int(a.replace(',', ''))) + ['point'] + [ONES[int(c)] for c in b]
            else:
                out += num_words(int(p.replace(',', '')))
            if pct:
                out.append('percent')
        else:
            part = part.strip("'")
            if part:
                out.append(part)
    return out


def collapse(s):
    return re.sub(r'\s+', ' ', s).strip()


def hash_text(text):
    return hashlib.sha1(collapse(text).encode('utf-8')).hexdigest()[:10]


def silences(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'silencedetect=noise=-45dB:d=0.05', '-f', 'null', '-'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    out, cur = [], None
    for line in (r.stderr or '').splitlines():
        m = re.search(r'silence_start: (-?[\d.]+)', line)
        if m:
            cur = max(0.0, float(m.group(1)))
        m = re.search(r'silence_end: (-?[\d.]+)', line)
        if m and cur is not None:
            out.append((cur, float(m.group(1))))
            cur = None
    return out


class Aligner:
    def __init__(self):
        import torch
        import torchaudio
        self.torch = torch
        self.F = torchaudio.functional
        self.dev = 'cuda' if torch.cuda.is_available() else 'cpu'
        bundle = getattr(torchaudio.pipelines, MODEL)
        self.model = bundle.get_model().to(self.dev).eval()
        self.ids = {c: i for i, c in enumerate(bundle.get_labels())}

    def words(self, path, text):
        import numpy as np
        torch = self.torch
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        wav = torch.from_numpy(np.frombuffer(raw, dtype=np.float32).copy()).unsqueeze(0).to(self.dev)
        with torch.inference_mode():
            em, _ = self.model(wav)
            em = torch.log_softmax(em, dim=-1)
        written = collapse(text).split(' ')
        chars, owner = [], []
        for wi, w in enumerate(written):
            sp = spoken(w)
            if not sp:
                raise RuntimeError(f'{path}: "{w}" has nothing to say')
            for sw in sp:
                if chars:
                    chars.append('|')
                    owner.append(-1)
                for c in sw.upper():
                    chars.append(c)
                    owner.append(wi)
        tgt = torch.tensor([[self.ids[c] for c in chars]], dtype=torch.int32, device=self.dev)
        al, sc = self.F.forced_align(em, tgt, blank=0)
        spans = self.F.merge_tokens(al[0], sc[0].exp())
        sec = wav.shape[1] / em.shape[1] / 16000
        on, off = {}, {}
        for s, o in zip(spans, owner):
            if o < 0:
                continue
            on.setdefault(o, s.start * sec)
            off[o] = s.end * sec
        return [[w, on[i], off[i]] for i, w in enumerate(written)]


def settle(words, sil):
    """An onset inside a silence moves to its end (the voice resumes there); onsets stay in order."""
    out = []
    prev = -1.0
    for word, start, end in words:
        onset = start
        for a, b in sil:
            if a <= onset < b:
                onset = b
                break
        onset = max(onset, prev + 0.02)
        prev = onset
        out.append([word, round(onset, 3), round(max(end, onset + 0.02), 3)])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--story', action='append', default=[])
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    warnings.filterwarnings('ignore')
    aligner = None
    for base in STORY_ROOTS:
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            d = os.path.join(base, name)
            jf = os.path.join(d, 'narration.json')
            if not os.path.isfile(jf) or (args.story and name not in args.story):
                continue
            j = json.load(open(jf, encoding='utf-8'))
            af = os.path.join(d, 'narration.align.json')
            old = json.load(open(af, encoding='utf-8')) if os.path.isfile(af) else {}
            beats = {}
            for bid, n in j['beats'].items():
                text = n['text']
                h = hash_text(text)
                path = os.path.join(PUBLIC, *f"{j['clips']}/{bid}-{h}.mp3".split('/'))
                prev = old.get('beats', {}).get(bid)
                if prev and prev.get('hash') == h and not args.force:
                    beats[bid] = prev
                    continue
                if not os.path.isfile(path):
                    print(f'skip {name}#{bid}: no clip {os.path.relpath(path, ROOT)}')
                    continue
                if aligner is None:
                    aligner = Aligner()
                words = settle(aligner.words(path, text), silences(path))
                beats[bid] = {'hash': h, 'words': words}
                print(f'aligned {name}#{bid} ({h}): {len(words)} words, {words[0][1]} to {words[-1][2]} s')
            about = f'GENERATED by scripts/narration-align.py ({MODEL} CTC forced alignment of narration.json to each clip). Never edit by hand. Per word, seconds from the clip start: [word, onset, end].'
            lines = ['{', f' "_about": {json.dumps(about)},', ' "beats": {']
            items = list(beats.items())
            for k, (bid, b) in enumerate(items):
                lines.append(f' {json.dumps(bid)}: {{ "hash": {json.dumps(b["hash"])}, "words": [')
                lines.append(',\n'.join('  ' + json.dumps(w) for w in b['words']))
                lines.append(' ] }' + (',' if k < len(items) - 1 else ''))
            lines += [' }', '}']
            with open(af, 'w', encoding='utf-8', newline='\n') as f:
                f.write('\n'.join(lines) + '\n')
            print(f'wrote {os.path.relpath(af, ROOT)}')


if __name__ == '__main__':
    sys.exit(main())
