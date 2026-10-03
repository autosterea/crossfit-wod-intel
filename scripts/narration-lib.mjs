// Shared helpers for the narration scripts (DESIGN.md I.6.5, amendment H.72). A story is NARRATED when
// its folder holds a narration.json: the spoken script (one paragraph per beat, and the passage each one
// restates) and the public folder its clips live in. scripts/narration-manifest.mjs measures the clips
// and writes the story's narration.gen.ts, which its story.ts declares as StoryDef.narration;
// scripts/narration-check.mjs (the third gate of fitness-gate.mjs) fails whenever the text, the clip,
// the manifest and the StoryDef disagree. Beats are read from story.ts with the TypeScript compiler API;
// clips are measured with ffprobe / ffmpeg.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** Story folders: the /fitness lesson's chapters, then the MetFix course's modules. */
export const FITNESS_STORIES = join(ROOT, 'src', 'fitness', 'stories')
export const STORY_ROOTS = [FITNESS_STORIES, join(ROOT, 'src', 'metfix-lab', 'stories')]
export const PUBLIC = join(ROOT, 'public')
export const PUBLIC_NARR = join(PUBLIC, 'narration')
export const SPOKEN_FILE = join(ROOT, 'scripts', 'narration-spoken.json')
const slash = (p) => p.split('\\').join('/')
export const rel = (p) => slash(relative(ROOT, p))

/* ------------------------------ plan constants (mirror story/audio/plan.ts) ------------------------------ */
export const LEAD = 0.2
export const LEAD_FIRST = 0.35
export const BREATH = 0.65
export const PRE_ROLL = 0.15
/**
 * Gate 3: words / PACE_MAX <= speech <= words / PACE_MIN (seconds of speech = duration minus 0.24 s of
 * head and tail). The ceiling is 3.7 words/s, calibrated on the Charon audition the owner chose (its
 * paragraphs run 2.37 to 3.37 words/s); the spec draft said 2.9 (amendment H.69).
 */
export const PACE_MAX = 3.7
export const PACE_MIN = 2.0
/** Gate 4: no silence inside the speech longer than this. */
export const MAX_GAP = 0.8
/**
 * A narrated story may widen gate 4 in its narration.json ("gates": { "maxGap", "why" }), up to this:
 * paragraph narration (MetFix) breathes between sentences, as the owner's Charon audition does (0.82 s).
 * The duck still merges only gaps up to 0.8 s (DUCK_MERGE), so a longer break lifts the bed a little.
 */
export const MAX_GAP_CEIL = 1.6
/**
 * Level gates (amendment H.69). A mono clip plays on both channels, where it reads 3.01 dB louder than
 * the mono file, so the player applies a clip gain of TARGET_LUFS - (lufs + DUAL_MONO_DB) from the
 * manifest to put the voice at -16 LUFS on the stereo reference render. The gate keeps that gain small
 * (a clip needing more is a bad encode) and the clip's true peak after it at -2.0 dBTP or lower, so
 * the limiter only ever catches sums (I.3.4).
 */
export const TARGET_LUFS = -16
export const DUAL_MONO_DB = 3.01
export const MAX_MAKEUP_DB = 3.5
export const MAX_TP = -2.0
export const MAX_TP_AFTER_MAKEUP = -2.0

/* --------------------------------- words --------------------------------- */
// A port of norm() in voice/gen_batch.py, so generation and this check count the same words.
const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ')
const TENS = '_ _ twenty thirty forty fifty sixty seventy eighty ninety'.split(' ')
function numWords(n) {
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 === 0 ? '' : ' ' + ONES[n % 10])
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 === 0 ? '' : ' ' + numWords(n % 100))
  return String(n)
}
export function norm(s) {
  let t = s.toLowerCase().split('%').join(' percent ').split('&').join(' and ')
  t = t.replace(/\b(\d+)s\b/g, (m, d) => (Number(d) % 10 === 0 ? numWords(Number(d)).replace(/ty/g, 'ties') : m))
  t = t.replace(/\d+/g, (d) => ' ' + numWords(Number(d)) + ' ')
  t = t.replace(/[^a-z ]+/g, ' ')
  return t.split(/\s+/).filter(Boolean)
}

/** How a caption with digits or symbols was spoken when /fitness spoke its captions (I.6.5 a); unused since H.75. */
export function loadSpoken() {
  if (!existsSync(SPOKEN_FILE)) return {}
  const j = JSON.parse(readFileSync(SPOKEN_FILE, 'utf8'))
  const out = {}
  for (const [k, v] of Object.entries(j)) if (!k.startsWith('_')) out[k] = v
  return out
}

/** Spoken text -> the clip hash: first 10 hex of sha1(text with whitespace collapsed and trimmed). */
export const collapse = (s) => s.replace(/\s+/g, ' ').trim()
export const hashText = (text) => createHash('sha1').update(collapse(text)).digest('hex').slice(0, 10)

/* ------------------------------ story.ts reader ------------------------------ */
// Only the default StoryDef's `beats` array is read, element by element, with the TypeScript compiler
// API: a regex keyed on `id:` and `body:` mis-keys a clip whenever another `id:` sits before a body.
const require = createRequire(join(ROOT, 'package.json'))
const ts = require('typescript')

function strOf(node, sf, consts) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isParenthesizedExpression(node)) return strOf(node.expression, sf, consts)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = strOf(node.left, sf, consts)
    const b = strOf(node.right, sf, consts)
    return a !== null && b !== null ? a + b : null
  }
  if (ts.isIdentifier(node) && consts.has(node.text)) return strOf(consts.get(node.text), sf, consts)
  return null
}
function numOf(node) {
  if (!node) return null
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text)
  return null
}
const unwrap = (n) => {
  while (n && (ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n) || ts.isParenthesizedExpression(n) || ts.isTypeAssertionExpression?.(n))) n = n.expression
  return n
}
function prop(obj, name) {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ((ts.isIdentifier(p.name) && p.name.text === name) || (ts.isStringLiteral(p.name) && p.name.text === name))) return unwrap(p.initializer)
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === name) return p.name
  }
  return null
}

/** The default StoryDef object literal of one story.ts, with its source file and top-level consts. */
function defaultStory(file) {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const consts = new Map()
  const imports = new Map()
  let defaultExpr = null
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) consts.set(d.name.text, unwrap(d.initializer))
    } else if (ts.isExportAssignment(st)) defaultExpr = unwrap(st.expression)
    else if (ts.isImportDeclaration(st) && st.importClause?.name && ts.isStringLiteral(st.moduleSpecifier)) imports.set(st.importClause.name.text, st.moduleSpecifier.text)
  }
  if (defaultExpr && ts.isIdentifier(defaultExpr)) defaultExpr = consts.get(defaultExpr.text) ?? null
  if (!defaultExpr || !ts.isObjectLiteralExpression(defaultExpr)) throw new Error(`${file}: no default StoryDef object literal`)
  return { sf, consts, imports, def: defaultExpr }
}

/** Beats of the default StoryDef of one story.ts: [{ id, title, body, build, sceneWords, signature }]. */
export function readBeats(file) {
  const { sf, consts, def } = defaultStory(file)
  let beats = prop(def, 'beats')
  if (beats && ts.isIdentifier(beats)) beats = consts.get(beats.text) ?? null
  if (!beats || !ts.isArrayLiteralExpression(beats)) throw new Error(`${file}: the default StoryDef has no beats array literal`)
  const out = []
  for (let el of beats.elements) {
    el = unwrap(el)
    if (ts.isIdentifier(el)) el = consts.get(el.text) ?? el
    if (!ts.isObjectLiteralExpression(el)) throw new Error(`${file}: beat ${out.length} is not an object literal`)
    const id = strOf(prop(el, 'id'), sf, consts)
    const title = strOf(prop(el, 'title'), sf, consts)
    const body = strOf(prop(el, 'body'), sf, consts)
    if (id === null || body === null || title === null) throw new Error(`${file}: beat ${out.length} has a non-literal id, title or body`)
    const sig = prop(el, 'signature')
    out.push({
      id,
      title,
      body,
      build: numOf(prop(el, 'build')) ?? 0,
      sceneWords: numOf(prop(el, 'sceneWords')) ?? 0,
      signature: !!sig && sig.kind === ts.SyntaxKind.TrueKeyword,
    })
  }
  return out
}

/**
 * Where the default StoryDef's `narration` comes from: the module specifier of the default import it
 * names (e.g. './narration.gen'), 'inline' for anything else, or null when the story declares none.
 */
export function declaredNarration(file) {
  const { imports, def } = defaultStory(file)
  const n = prop(def, 'narration')
  if (!n) return null
  if (ts.isIdentifier(n) && imports.has(n.text)) return imports.get(n.text)
  return 'inline'
}

/* ------------------------------ narrated stories ------------------------------ */

/**
 * Every narrated story in this worktree, in folder order: { name, dir, storyFile, genFile, jsonFile,
 * alignFile, clips, script, align, beats, fitness, maxGap, gapWhy, error }. `align` is narration.align.json's
 * beats (each clip's word onsets, scripts/narration-align.py) or null. `clips` is the folder under public/ (and BASE_URL) its MP3s live
 * in, `script` the narration.json beats ({ [beatId]: { text, source } }), `beats` the story.ts beats and
 * `fitness` true for a /fitness chapter. Since H.75 every narrated story speaks its own explanatory paragraph per
 * beat (the MetFix rule of H.72), so a /fitness chapter may widen gate 4 with "gates" as a MetFix module may.
 * A folder with a narration.gen.ts but no narration.json comes back with an `error`.
 */
export function narratedStories() {
  const out = []
  for (const base of STORY_ROOTS) {
    if (!existsSync(base)) continue
    for (const n of readdirSync(base).sort()) {
      const dir = join(base, n)
      if (!statSync(dir).isDirectory()) continue
      const jsonFile = join(dir, 'narration.json')
      const genFile = join(dir, 'narration.gen.ts')
      const storyFile = join(dir, 'story.ts')
      if (!existsSync(jsonFile) && !existsSync(genFile)) continue
      const alignFile = join(dir, 'narration.align.json')
      const s = { name: rel(dir), dir, storyFile, genFile, jsonFile, alignFile, clips: '', script: {}, align: null, beats: [], fitness: base === FITNESS_STORIES, maxGap: MAX_GAP, gapWhy: '', error: null }
      try {
        if (!existsSync(jsonFile)) throw new Error('narration.gen.ts without narration.json')
        if (!existsSync(storyFile)) throw new Error('narration.json without story.ts')
        const j = JSON.parse(readFileSync(jsonFile, 'utf8'))
        if (typeof j.clips !== 'string' || !/^narration\/[a-z0-9/-]+$/.test(j.clips)) throw new Error('narration.json: "clips" must name a folder under public/narration, e.g. "narration/metfix/bayes"')
        if (!j.beats || typeof j.beats !== 'object') throw new Error('narration.json: no "beats" object')
        s.clips = j.clips
        s.script = j.beats
        if (j.gates !== undefined) {
          const g = j.gates
          if (!g || typeof g.maxGap !== 'number' || !(g.maxGap >= MAX_GAP && g.maxGap <= MAX_GAP_CEIL) || typeof g.why !== 'string' || !g.why.trim())
            throw new Error(`narration.json: "gates" must be { "maxGap": ${MAX_GAP} to ${MAX_GAP_CEIL}, "why": "<the reason>" }`)
          s.maxGap = g.maxGap
          s.gapWhy = g.why
        }
        if (existsSync(alignFile)) {
          const a = JSON.parse(readFileSync(alignFile, 'utf8'))
          if (!a.beats || typeof a.beats !== 'object') throw new Error('narration.align.json: no "beats" object (run python scripts/narration-align.py)')
          s.align = a.beats
        }
        s.beats = readBeats(storyFile)
      } catch (err) {
        s.error = err instanceof Error ? err.message : String(err)
      }
      out.push(s)
    }
  }
  return out
}

/** The clip a beat's text names: { hash, file (BASE_URL relative), path (on disk) }. */
export function clipOf(story, beatId, text) {
  const hash = hashText(text)
  const file = `${story.clips}/${beatId}-${hash}.mp3`
  return { hash, file, path: join(PUBLIC, file) }
}

/**
 * One narrated story's manifest entries, measured from its clips, in beat order. A beat without a script
 * entry or without its clip is skipped and listed in `missing` (the check fails on both).
 */
export function buildEntries(story) {
  const entries = []
  const missing = []
  for (const b of story.beats) {
    const n = story.script[b.id]
    if (!n || typeof n.text !== 'string' || !n.text.trim()) {
      missing.push({ beat: b.id, why: 'no narration text in narration.json' })
      continue
    }
    const c = clipOf(story, b.id, n.text)
    if (!existsSync(c.path)) {
      missing.push({ beat: b.id, why: `no clip public/${c.file} for the current text (hash ${c.hash})` })
      continue
    }
    const dur = Math.round(ffprobeDuration(c.path) * 1000) / 1000
    const m = measure(c.path, dur)
    const sy = resolveSync(story, b, n, c.hash, dur)
    for (const p of sy.problems) missing.push({ beat: b.id, why: p, sync: true })
    entries.push({ beat: b.id, text: collapse(n.text), hash: c.hash, file: c.file, dur, speech: m.speech, words: norm(n.text).length, maxGap: m.maxGap, lufs: m.lufs, tp: m.tp, sync: sy.knots, syncInfo: sy.info })
  }
  return { entries, missing }
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const key = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : q(k))

/** The narration.gen.ts a story's entries produce (stable, so --check compares it byte for byte). */
export function renderGen(story, entries) {
  let imp = slash(relative(story.dir, join(ROOT, 'src', 'fitness', 'story', 'types')))
  if (!imp.startsWith('.')) imp = './' + imp
  const body = entries
    .map((e) =>
      [
        `  ${key(e.beat)}: {`,
        `    beat: ${q(e.beat)},`,
        `    text: ${q(e.text)},`,
        `    hash: ${q(e.hash)},`,
        `    file: ${q(e.file)},`,
        `    dur: ${e.dur},`,
        `    speech: [${e.speech.map(([a, b]) => `[${a}, ${b}]`).join(', ')}],`,
        `    words: ${e.words},`,
        `    maxGap: ${e.maxGap},`,
        `    lufs: ${e.lufs},`,
        `    tp: ${e.tp},`,
        `    sync: [${e.sync.map(([t, k]) => `[${t}, ${k}]`).join(', ')}],`,
        `  },`,
      ].join('\n'),
    )
    .join('\n')
  return `// GENERATED by scripts/narration-manifest.mjs from narration.json and public/${story.clips}/. Never edit
// by hand: change narration.json, regenerate the clips it names (the voice/ pipeline), copy them into
// public/${story.clips}/ and run \`node scripts/narration-manifest.mjs\` (DESIGN.md I.6.5, H.72).
import type { StoryNarration } from '${imp}'

const narration: StoryNarration = {
${body}
}

export default narration
`
}

/** Every MP3 under public/narration: [{ dir, beat, hash, file (BASE_URL relative), path }]. */
export function listAllClips() {
  const out = []
  const walk = (d) => {
    if (!existsSync(d)) return
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else {
        const m = n.match(/^(.+)-([0-9a-f]{10})\.mp3$/)
        if (m) out.push({ dir: rel(d).replace(/^public\//, ''), beat: m[1], hash: m[2], file: rel(p).replace(/^public\//, ''), path: p })
      }
    }
  }
  walk(PUBLIC_NARR)
  return out
}

/* -------------------------- the engine's hold rule (C.3, H.40) -------------------------- */
const wc = (s) => s.split(/\s+/).filter(Boolean).length
export function holdFor(b) {
  const caption = 0.4 + 0.23 * (wc(b.title) + wc(b.body)) - b.build
  const scene = b.sceneWords ? 0.8 + 0.23 * b.sceneWords : 0
  const floor = b.signature ? 4 : 2
  return Math.max(2, Math.min(7, Math.max(caption, scene, floor)))
}

/**
 * Seconds from a chapter's loaded to its 'done', with and without sound (I.6.4). `synced(b)` is true when
 * the beat's build follows its voice (H.74): it then lasts its span.
 */
export function runtime(beats, clipDur, synced = () => false) {
  let off = 0
  let on = 0
  beats.forEach((b, i) => {
    const last = i === beats.length - 1
    const delay = i === 0 ? 0 : PRE_ROLL
    const base = delay + b.build + (last ? 0 : holdFor(b))
    off += base
    const dur = clipDur(b)
    const span = dur == null ? 0 : (i === 0 ? LEAD_FIRST : LEAD) + dur + BREATH
    on += dur != null && synced(b) ? span : Math.max(base, span)
  })
  return { off, on }
}

/* ------------------------------ sync (amendment H.74) ------------------------------ */
// narration.json may give a beat "sync": [[t, at, offset?], ...]: build t lands on `at`, a sentence index
// (0 = the paragraph's first sentence) or a phrase that occurs exactly once in the text, at its first word's
// onset in the clip (narration.align.json) plus `offset` seconds. Without "sync", a narrated beat with an
// alignment stretches its build to end at its last sentence's onset; "sync": [] keeps the designed rate.

/** A word for phrase matching: lower case, punctuation dropped (except inside numbers, 1.9% or 4,995). */
const tok = (w) => w.toLowerCase().replace(/[^a-z0-9%'.,-]/g, '').replace(/[.,]+$/, '').replace(/^[.,]+/, '')

/** Sentence starts (word indices) of a whitespace-split text: a sentence ends with a word ending . ? or ! */
export function sentenceStarts(words) {
  const out = [0]
  words.forEach((w, i) => {
    if (i < words.length - 1 && /[.?!]["')\]]*$/.test(w)) out.push(i + 1)
  })
  return out
}

/** Every word index where `phrase` starts in `words` (whole words, case and punctuation insensitive). */
export function phraseAt(words, phrase) {
  const p = collapse(phrase).split(' ').map(tok)
  const w = words.map(tok)
  const out = []
  for (let i = 0; i + p.length <= w.length; i++) if (p.every((x, k) => x === w[i + k])) out.push(i)
  return out
}

const r3s = (x) => Math.round(x * 1000) / 1000

/**
 * One beat's knots [t, clip seconds] and a printable account, from narration.json "sync" and the alignment.
 * Problems (each a narration-check failure): no alignment for this text and clip, an anchor that is not
 * [t, at, offset?], t outside (0, 1] or falling, a sentence index out of range, a phrase not found or
 * ambiguous, knot seconds not increasing (or before the clip), a build that ends after the clip.
 */
export function resolveSync(story, beat, n, hash, dur) {
  const problems = []
  const info = []
  const anchors = n.sync
  if (anchors !== undefined && !Array.isArray(anchors)) return { knots: [], problems: ['"sync" must be an array of [t, at, offset?]'], info }
  if (Array.isArray(anchors) && anchors.length === 0) return { knots: [], problems, info: ['designed rate ("sync": [])'] }
  const al = story.align?.[beat.id]
  if (!al) {
    if (anchors) problems.push('"sync" needs the clip\'s word onsets: run python scripts/narration-align.py')
    return { knots: [], problems, info: ['designed rate (no alignment)'] }
  }
  const words = collapse(n.text).split(' ')
  if (al.hash !== hash || !Array.isArray(al.words) || al.words.length !== words.length || al.words.some((x, i) => x[0] !== words[i])) {
    problems.push(`narration.align.json is for another text or clip (hash ${al.hash}, the clip is ${hash}): run python scripts/narration-align.py`)
    return { knots: [], problems, info }
  }
  const onset = (i) => al.words[i][1]
  const starts = sentenceStarts(words)
  const spec = anchors ?? [[1, starts.length - 1]]
  const knots = []
  for (const a of spec) {
    if (!Array.isArray(a) || a.length < 2 || a.length > 3 || typeof a[0] !== 'number' || (typeof a[1] !== 'number' && typeof a[1] !== 'string') || (a.length === 3 && typeof a[2] !== 'number')) {
      problems.push(`anchor ${JSON.stringify(a)} is not [t, sentence index or phrase, offset seconds?]`)
      continue
    }
    const [t, at, off = 0] = a
    let wi = -1
    let what = ''
    if (typeof at === 'number') {
      if (!Number.isInteger(at) || at < 0 || at >= starts.length) {
        problems.push(`anchor ${JSON.stringify(a)}: sentence ${at} is out of range (0 to ${starts.length - 1}: the paragraph has ${starts.length} sentences)`)
        continue
      }
      wi = starts[at]
      what = `sentence ${at} "${words.slice(wi, wi + 3).join(' ')}"`
    } else {
      const hits = phraseAt(words, at)
      if (hits.length !== 1) {
        problems.push(`anchor ${JSON.stringify(a)}: the phrase "${at}" occurs ${hits.length} times in the text (it must occur once)`)
        continue
      }
      wi = hits[0]
      what = `"${at}"`
    }
    if (!(t > 0 && t <= 1)) {
      problems.push(`anchor ${JSON.stringify(a)}: t must be in (0, 1]`)
      continue
    }
    const sec = r3s(onset(wi) + off)
    const prev = knots[knots.length - 1]
    if (prev && t < prev[0]) problems.push(`anchor ${JSON.stringify(a)}: t ${t} is below the previous anchor's ${prev[0]} (the build never goes back)`)
    if (prev && sec <= prev[1]) problems.push(`anchor ${JSON.stringify(a)}: at ${sec} s it is not after the previous anchor (${prev[1]} s)`)
    if (sec < 0) problems.push(`anchor ${JSON.stringify(a)}: at ${sec} s it is before the clip starts`)
    knots.push([t, sec])
    info.push(`${+t.toFixed(3)} at ${sec.toFixed(2)} s (${what}${off ? ` ${off > 0 ? '+' : ''}${off} s` : ''})`)
  }
  if (problems.length) return { knots: [], problems, info }
  // the build ends at its last knot when that reaches t = 1, else at the designed rate after it
  const last = knots[knots.length - 1]
  const end = r3s(last[1] + (1 - last[0]) * Math.max(0.1, beat.build))
  if (end > dur) {
    problems.push(`the build ends at ${end} s, after the clip (${dur} s): add a t = 1 anchor before the voice ends`)
    return { knots: [], problems, info }
  }
  // without anchors a build is only ever stretched, never sped up
  if (!anchors && end < PRE_ROLL - LEAD + beat.build) return { knots: [], problems, info: ['designed rate (the last sentence starts before the designed build ends)'] }
  info.push(`build ends ${end.toFixed(2)} s, ${(dur - end).toFixed(2)} s before the voice`)
  return { knots, problems, info }
}

/* ------------------------------ measuring ------------------------------ */

export function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  return Number(out.trim())
}

/**
 * One ffmpeg pass: silencedetect (-45 dB) and ebur128 (integrated loudness, true peak).
 * Silences are detected from 50 ms so the 120 ms head and tail are seen; inside the speech only
 * silences of 0.35 s or more split a span (I.3.3 holds the duck through shorter ones).
 */
export function measure(file, dur) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-45dB:d=0.05,ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' })
  const log = (r.stderr || '') + (r.stdout || '')
  const sil = []
  let open = null
  for (const line of log.split(/\r?\n/)) {
    let m = line.match(/silence_start: (-?[\d.]+)/)
    if (m) open = Math.max(0, Number(m[1]))
    m = line.match(/silence_end: (-?[\d.]+)/)
    if (m && open !== null) {
      sil.push([open, Number(m[1])])
      open = null
    }
  }
  if (open !== null) sil.push([open, dur])
  const summary = log.slice(log.lastIndexOf('Summary:'))
  const lufs = Number((summary.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1])
  const tp = Number((summary.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1])
  // speech = [0, dur] minus the head, the tail and every inner silence >= 0.35 s
  let s0 = 0
  let s1 = dur
  const inner = []
  for (const [a, b] of sil) {
    if (a <= 0.001) s0 = Math.max(s0, b)
    else if (b >= dur - 0.001) s1 = Math.min(s1, a)
    else inner.push([a, b])
  }
  const spans = []
  let cur = s0
  let maxGap = 0
  for (const [a, b] of inner) {
    if (a < s0 || b > s1) continue
    maxGap = Math.max(maxGap, b - a)
    if (b - a >= 0.35) {
      spans.push([cur, a])
      cur = b
    }
  }
  spans.push([cur, s1])
  const r3 = (x) => Math.round(x * 1000) / 1000
  return {
    speech: spans.filter(([a, b]) => b - a > 0.01).map(([a, b]) => [r3(a), r3(b)]),
    maxGap: r3(maxGap),
    lufs: Math.round(lufs * 10) / 10,
    tp: Math.round(tp * 10) / 10,
  }
}
