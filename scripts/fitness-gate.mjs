// Story-engine gates for the /fitness lesson (DESIGN.md C.15), run before every commit:
//   node scripts/fitness-gate.mjs
// 1. Scene-code grep gate over src/fitness/stories/** and src/fitness/story/kit/**:
//    no Math.random / performance.now / Date.now / <Trail / <Float / <Html / useDetectGPU /
//    Environment preset / ContactShadows / gridHelper / castShadow, and no useFrame with a
//    positive priority (it would take over rendering on the LOW tier).
// 2. Caption audit: every beat has a title <= 30 chars, a body <= 140, a non-empty source,
//    no em or en dashes, and at least 70% of the body's content words (4+ letters) appear
//    in the cited source text (fitnessData.ts exports + the module-file string table).
// Exit code 1 on any failure.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'fitness')
const normalize = (s) => s.split(String.fromCharCode(13)).join('')
let failures = 0
const fail = (msg) => {
  failures++
  console.log('FAIL ' + msg)
}

const walk = (d, out = []) => {
  if (!existsSync(d)) return out
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}

/* ---------------------------- 1. grep gate ---------------------------- */
const banned = [
  /Math\.random\s*\(/,
  /performance\.now\s*\(/,
  /Date\.now\s*\(/,
  /<Trail\b/,
  /<Float\b/,
  /<Html\b/,
  /useDetectGPU/,
  /Environment\s+preset/,
  /<Environment[^>]*\bpreset=/,
  /ContactShadows/,
  /gridHelper/,
  /castShadow/,
]
const sceneFiles = [...walk(join(root, 'stories')), ...walk(join(root, 'story', 'kit'))]
for (const f of sceneFiles) {
  const src = normalize(readFileSync(f, 'utf8'))
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const re of banned) if (re.test(code)) fail(`${f}: banned pattern ${re}`)
  // useFrame( ... , N) with N > 0
  let i = code.indexOf('useFrame(')
  while (i >= 0) {
    let depth = 0
    let j = i + 'useFrame'.length
    for (; j < code.length; j++) {
      const c = code[j]
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) break
      }
    }
    const call = code.slice(i, j + 1)
    const m = call.match(/,\s*(-?\d+(?:\.\d+)?)\s*\)$/)
    if (m && Number(m[1]) > 0) fail(`${f}: useFrame with positive priority ${m[1]}`)
    i = code.indexOf('useFrame(', j)
  }
}
console.log(`grep gate: ${sceneFiles.length} scene files checked`)

/* --------------------------- 2. caption audit -------------------------- */
const data = normalize(readFileSync(join(root, 'fitnessData.ts'), 'utf8'))
const strConst = (name) => {
  const m = data.match(new RegExp(`export const ${name}\\s*=\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`))
  return m ? m[1].replace(/\\'/g, "'") : ''
}
const moduleCopy = (key) => {
  const start = data.indexOf(`  ${key}: {\n    eyebrow:`)
  if (start < 0) return ''
  const end = data.indexOf('\n  },', start)
  return data.slice(start, end)
}
const modulesBlock = data.slice(data.indexOf('export const MODULES'), data.indexOf('export const moduleByKey'))
const TABLE = {
  'HopperModule.leadMsg[1]': 'Across random draws, the generalist accumulates the most points.',
  'HopperModule.leadMsg[2]': 'Keep drawing. A specialist only leads while its own domain keeps coming up.',
  'HopperModule.readoutSub': 'Every competitor scores on this domain; totals accumulate',
  'PathwaysModule.note': 'Ribbon height is power output. Peak power order. Oxidative outlasts the others, it is not more powerful.',
  'DefinitionModule.note1': 'Power falls as duration grows. A specialist wins one zone; the generalist wins the area.',
  'DefinitionModule.note2':
    'Pick a specialist and the broad curve stays as a ghost. They beat the generalist in one zone and lose the area. P(t) = CP + W prime / t is the sustained tail.',
  'ContinuumModule.note': 'Center is sickness, the rim is fitness. Each marker rides its own spoke. Drag any marker outward and the profile becomes Custom.',
  'HealthModule.note': 'The amber slice is the fitness curve from model 04, at one age. Health is every slice you will ever live, stacked.',
  'HealthModule.readoutSub': 'The translucent solid IS this number: the whole volume under the surface.',
  'SkillsModule.legend': 'Trained (organic) Practiced (neural) Both',
  'IntroView.eyebrow': 'CrossFit Journal, October 2002',
  'IntroView.gridTitle': 'Six interactive models',
}
function sourceText(source) {
  let text = ''
  for (const k of Object.keys(TABLE)) if (source.includes(k)) text += ' ' + TABLE[k]
  for (const name of ['INTRO_TEXT', 'DEFINITION_TEXT', 'POWER_CONCEPT', 'HUNDRED_WORDS', 'CONTINUUM_EXAMPLES', 'HIERARCHY_RULE']) {
    if (source.includes(name)) text += ' ' + (strConst(name) || data.slice(data.indexOf(`export const ${name}`), data.indexOf(`export const ${name}`) + 1200))
  }
  const mc = source.match(/MODULE_COPY\.(\w+)/g) || []
  for (const m of mc) text += ' ' + moduleCopy(m.split('.')[1])
  if (/MODULES/.test(source)) text += ' ' + modulesBlock
  if (/fitnessData\.(\w+)/.test(source)) {
    for (const m of source.match(/fitnessData\.(\w+)/g)) {
      const n = m.split('.')[1]
      const at = data.indexOf(`export const ${n}`)
      if (at >= 0) text += ' ' + data.slice(at, at + 3000)
    }
  }
  return text.toLowerCase()
}
const words = (s) => (s.toLowerCase().match(/[a-z][a-z']{3,}/g) || []).map((w) => w.replace(/'s$/, ''))

const storyDir = join(root, 'stories')
let beatsChecked = 0
for (const f of walk(storyDir).filter((p) => /story\.ts$/.test(p))) {
  const src = normalize(readFileSync(f, 'utf8'))
  const re =/id:\s*'([^']+)',\s*title:\s*'((?:[^'\\]|\\.)*)',\s*body:\s*'((?:[^'\\]|\\.)*)',[\s\S]*?source:\s*'((?:[^'\\]|\\.)*)'/g
  let m
  while ((m = re.exec(src))) {
    beatsChecked++
    const [, id, title, body, source] = m
    const where = `${f.split(/[\\/]/).slice(-2).join('/')}#${id}`
    if (title.length > 30) fail(`${where}: title ${title.length} > 30 chars`)
    if (body.length > 140) fail(`${where}: body ${body.length} > 140 chars`)
    if (!source.trim()) fail(`${where}: empty source`)
    if (/[–—]/.test(title + body)) fail(`${where}: em or en dash`)
    const st = sourceText(source)
    const ws = words(body)
    const hit = ws.filter((w) => st.includes(w) || st.includes(w.replace(/s$/, '')) || st.includes(w.replace(/ing$/, '')))
    const cov = ws.length ? hit.length / ws.length : 1
    const miss = ws.filter((w) => !hit.includes(w))
    if (cov < 0.7) fail(`${where}: only ${Math.round(cov * 100)}% of content words found in "${source}" (missing: ${miss.join(', ')})`)
    else console.log(`ok   ${where.padEnd(34)} ${String(title.length).padStart(2)}/${String(body.length).padStart(3)} chars, ${Math.round(cov * 100)}% cited words${miss.length ? ' (not in source: ' + miss.join(', ') + ')' : ''}`)
  }
}
console.log(`caption audit: ${beatsChecked} beats checked`)
console.log(failures ? `${failures} failure(s)` : 'all gates passed')
process.exit(failures ? 1 : 0)
