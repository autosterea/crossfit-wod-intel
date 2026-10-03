// Build every narrated story's typed narration manifest (DESIGN.md I.6.5 c, amendment H.72):
//   node scripts/narration-manifest.mjs            writes <story>/narration.gen.ts for each <story>/narration.json
//   node scripts/narration-manifest.mjs --check    writes nothing; exit 1 if any file would change
// For each beat of the story (story.ts order) it takes the narration.json text, finds its clip
// public/<clips>/<beat>-<sha1(text)[0..10]>.mp3, reads the duration with ffprobe and, in one ffmpeg pass,
// the speech spans, longest inner gap, integrated loudness and true peak. Prints each story's sound-on
// runtime (I.6.4). Story timing never decodes audio at runtime: durations come from these files only (O3).
// It also resolves each beat's narration.json "sync" anchors against the clip's word onsets
// (narration.align.json) into the knots the build follows with sound on (amendment H.74).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { buildEntries, narratedStories, rel, renderGen, runtime } from './narration-lib.mjs'

const check = process.argv.includes('--check')
const quiet = process.argv.includes('--quiet')
const log = (...a) => {
  if (!quiet) console.log(...a)
}
const unix = (s) => s.split('\r').join('')

let stale = 0
let broken = 0
for (const story of narratedStories()) {
  if (story.error) {
    broken++
    console.log(`FAIL ${story.name}: ${story.error}`)
    continue
  }
  const { entries, missing } = buildEntries(story)
  for (const m of missing) {
    broken++
    console.log(`FAIL ${story.name}/${m.beat}: ${m.why}`)
  }
  const content = renderGen(story, entries)
  const r = runtime(story.beats, (b) => entries.find((e) => e.beat === b.id)?.dur ?? null, (b) => (entries.find((e) => e.beat === b.id)?.sync.length ?? 0) > 0)
  log(`${story.name.padEnd(42)} ${entries.length}/${story.beats.length} clips   sound off ${r.off.toFixed(1)} s   sound on ${r.on.toFixed(1)} s   (+${(r.on - r.off).toFixed(1)} s)`)
  const existing = existsSync(story.genFile) ? unix(readFileSync(story.genFile, 'utf8')) : ''
  const name = rel(story.genFile)
  if (existing === content) {
    log(`ok   ${name} is up to date (${entries.length} clips)`)
    continue
  }
  if (check) {
    stale++
    console.log(`FAIL ${name} is stale: run node scripts/narration-manifest.mjs`)
  } else {
    writeFileSync(story.genFile, content)
    log(`wrote ${name} (${entries.length} clips)`)
  }
}
process.exit(stale || broken ? 1 : 0)
