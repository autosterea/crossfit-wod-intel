// Narration consistency gate (DESIGN.md I.6.5 d, owner decision O8, amendment H.72), run by
// scripts/fitness-gate.mjs:   node scripts/narration-check.mjs
// Voice and text can never drift. For every NARRATED story (a story folder with a narration.json, under
// src/fitness/stories or src/metfix-lab/stories) it FAILS when
//   - a beat of the story (story.ts, read with the TypeScript compiler API) has no narration text, or
//     narration.json narrates a beat id the story does not have (a renamed beat);
//   - the text has an em or en dash, or the beat does not name the passage its paragraph restates ("source");
//     since H.75 a /fitness chapter speaks its own explanatory paragraph, as a MetFix module does (H.72), so
//     no story's narration has to equal its caption body any more;
//   - public/<clips>/<beat>-<hash>.mp3 is missing, hash = first 10 hex of sha1(the text, whitespace
//     collapsed): an edited sentence fails here until its clip is regenerated;
//   - the story's narration.gen.ts is missing or stale (it is re-measured from the clips and compared
//     byte for byte), or story.ts does not declare it as StoryDef.narration (import narration from
//     './narration.gen');
//   - a clip is outside gate 3 (pace: words / 3.7 <= speech <= words / 2.0 s), gate 4 (an inner gap over
//     0.8 s; a MetFix story may widen it to at most 1.6 s with a reason, narration.json "gates") or the level gates (true peak above -2.0 dBTP, a clip gain -16 - (LUFS + 3.01) over 3.5 dB
//     either way, or a peak above -2.0 dBTP after it; H.69);
//   - (H.74, the build follows the voice) a beat's narration.json "sync" anchors do not resolve: no word
//     onsets for its current text and clip (narration.align.json, python scripts/narration-align.py), an
//     anchor's sentence index out of range, a phrase that is not in the text exactly once, t outside (0, 1]
//     or falling, anchor times not increasing, or a warped build that ends after the clip. A beat with an
//     alignment and no anchors stretches its build to its last sentence; "sync": [] keeps the designed rate.
// A story.ts that declares narration without a narration.json fails too. Clips no narrated story names
// are listed (dormant), never failed. Exit 1 on any failure.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  DUAL_MONO_DB,
  MAX_GAP,
  MAX_MAKEUP_DB,
  MAX_TP,
  MAX_TP_AFTER_MAKEUP,
  PACE_MAX,
  PACE_MIN,
  STORY_ROOTS,
  TARGET_LUFS,
  buildEntries,
  clipOf,
  declaredNarration,
  listAllClips,
  narratedStories,
  rel,
  renderGen,
} from './narration-lib.mjs'

let failures = 0
const fail = (m) => {
  failures++
  console.log('FAIL ' + m)
}
const unix = (s) => s.split('\r').join('')

const stories = narratedStories()
const used = new Set()
let beats = 0
for (const s of stories) {
  if (s.error) {
    fail(`${s.name}: ${s.error}`)
    continue
  }
  const ids = new Set(s.beats.map((b) => b.id))
  for (const k of Object.keys(s.script)) if (!ids.has(k)) fail(`${s.name}: narration.json narrates "${k}", which is not a beat of story.ts (renamed?)`)
  for (const b of s.beats) {
    const n = s.script[b.id]
    const where = `${s.name}#${b.id}`
    if (!n || typeof n.text !== 'string' || !n.text.trim()) {
      fail(`${where}: no narration text (a narrated story narrates every beat)`)
      continue
    }
    if (/[\u2013\u2014]/.test(n.text + (n.source ?? ''))) fail(`${where}: em or en dash in the narration`)
    if (typeof n.source !== 'string' || !n.source.trim()) fail(`${where}: no "source" (the passage of the story's own text that this paragraph restates)`)
    const c = clipOf(s, b.id, n.text)
    used.add(c.file)
  }
  if (s.maxGap !== MAX_GAP) console.log(`note ${s.name}: gate 4 allows ${s.maxGap} s inside a clip (${s.gapWhy})`)
  const decl = existsSync(s.storyFile) ? declaredNarration(s.storyFile) : null
  if (decl !== './narration.gen') fail(`${s.name}/story.ts: declare the narration on the StoryDef (import narration from './narration.gen'; narration,)${decl ? `, found ${decl}` : ''}`)
  const { entries, missing } = buildEntries(s)
  for (const m of missing) if (m.why.startsWith('no clip')) fail(`${s.name}#${m.beat}: ${m.why}: the voice no longer says the text; regenerate the clip`)
  for (const m of missing) if (m.sync) fail(`${s.name}#${m.beat}: sync: ${m.why}`)
  if (!existsSync(s.genFile)) fail(`${rel(s.genFile)} is missing: run node scripts/narration-manifest.mjs`)
  else if (unix(readFileSync(s.genFile, 'utf8')) !== renderGen(s, entries)) fail(`${rel(s.genFile)} is stale (text, clip or measurement changed): run node scripts/narration-manifest.mjs`)
  for (const e of entries) {
    beats++
    const where = `${s.name}#${e.beat} (${e.hash})`
    const speech = e.dur - 0.24
    const lo = e.words / PACE_MAX
    const hi = e.words / PACE_MIN
    const makeup = TARGET_LUFS - (e.lufs + DUAL_MONO_DB)
    const problems = []
    if (speech < lo || speech > hi) problems.push(`pace: ${speech.toFixed(2)} s of speech for ${e.words} words, allowed ${lo.toFixed(2)} to ${hi.toFixed(2)} s (${(e.words / speech).toFixed(2)} words/s)`)
    if (e.maxGap > s.maxGap) problems.push(`gap: ${e.maxGap} s of silence inside the speech (max ${s.maxGap})`)
    if (e.tp > MAX_TP) problems.push(`true peak ${e.tp} dBTP (max ${MAX_TP})`)
    if (Math.abs(makeup) > MAX_MAKEUP_DB) problems.push(`loudness ${e.lufs} LUFS needs a clip gain of ${makeup.toFixed(1)} dB (max +/-${MAX_MAKEUP_DB}): re-encode it`)
    if (e.tp + makeup > MAX_TP_AFTER_MAKEUP) problems.push(`true peak ${(e.tp + makeup).toFixed(1)} dBTP after the clip gain (max ${MAX_TP_AFTER_MAKEUP})`)
    if (problems.length) fail(`${where}: ${problems.join('; ')}`)
    else
      console.log(
        `ok   ${where.padEnd(52)} ${e.dur.toFixed(2)} s, ${e.words} words, ${(e.words / speech).toFixed(2)} w/s, gap ${e.maxGap.toFixed(2)} s, ${e.lufs} LUFS (clip gain ${makeup >= 0 ? '+' : ''}${makeup.toFixed(1)} dB), ${e.tp} dBTP`,
      )
    if (e.syncInfo.length) console.log(`     sync ${e.syncInfo.join('; ')}`)
  }
}

// a story that declares narration must be a narrated story (its narration.json is the source)
const narratedDirs = new Set(stories.map((s) => s.dir))
for (const base of STORY_ROOTS) {
  if (!existsSync(base)) continue
  for (const n of readdirSync(base)) {
    const dir = join(base, n)
    const f = join(dir, 'story.ts')
    if (!statSync(dir).isDirectory() || !existsSync(f) || narratedDirs.has(dir)) continue
    let decl = null
    try {
      decl = declaredNarration(f)
    } catch {
      decl = null
    }
    if (decl) fail(`${rel(f)}: declares narration without a narration.json beside it`)
  }
}

// clips no narrated story names: stale ones in a narrated story's folder, dormant folders elsewhere
const clipDirs = new Set(stories.map((s) => s.clips))
const dormant = new Map()
for (const c of listAllClips()) {
  if (used.has(c.file)) continue
  if (clipDirs.has(c.dir)) console.log(`warn public/${c.file}: no beat's current text hashes to it (an old take: delete it)`)
  else dormant.set(c.dir, (dormant.get(c.dir) ?? 0) + 1)
}
for (const [d, k] of dormant) console.log(`note public/${d}: ${k} clips no story declares (dormant: no story plays them)`)

console.log(`narration check: ${stories.length} narrated ${stories.length === 1 ? 'story' : 'stories'}, ${beats} clips checked`)
console.log(failures ? `${failures} narration failure(s)` : 'narration: every narrated beat has its clip, in its manifest, inside the gates')
process.exit(failures ? 1 : 0)
