// Post-build SEO prerender. Runs after `vite build` (wired into npm run build).
// For each indexable route it takes the built dist/index.html and PATCHES the
// <head> (title, description, canonical, robots, OG, Twitter) + injects a
// JSON-LD <script>, writing dist/<route>/index.html. The <body> and all hashed
// asset <script>/<link> tags are left byte-identical, so the SPA hydrates
// exactly as before (Caddy's try_files serves {path}/index.html first).
//
// Also emits dist/sitemap.xml. No new dependencies (plain Node ESM).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { allRoutes, SITE } from './seo-routes.mjs'

const DIR = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(DIR, '../dist')
const INDEX = join(DIST, 'index.html')

const escAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const template = readFileSync(INDEX, 'utf8')

// Fail loudly if the build did not inject the SPA entry script: shipping
// prerendered pages without it would render blank pages.
if (!/<script[^>]+type="module"[^>]+src="\/assets\/[^"]+\.js"/.test(template)) {
  throw new Error('prerender: built dist/index.html has no module entry script - aborting (the SPA would not hydrate).')
}

const setTitle = (html, v) => html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escAttr(v)}</title>`)
const setMeta = (html, attr, key, v) => {
  const re = new RegExp(`(<meta ${attr}="${key.replace(/[:]/g, '\\$&')}" content=")[^"]*(")`)
  return html.replace(re, `$1${escAttr(v)}$2`)
}
const setName = (html, key, v) => setMeta(html, 'name', key, v)
const setProp = (html, key, v) => setMeta(html, 'property', key, v)
const setCanonical = (html, v) => html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escAttr(v)}$2`)

function buildHtml(route) {
  const url = SITE + (route.path === '/' ? '/' : route.path)
  const img = route.image || `${SITE}/og.png`
  let html = template
  html = setTitle(html, route.title)
  html = setName(html, 'description', route.description)
  html = setCanonical(html, url)
  html = setName(html, 'robots', route.noindex ? 'noindex, follow' : 'index, follow')
  html = setProp(html, 'og:title', route.title)
  html = setProp(html, 'og:description', route.description)
  html = setProp(html, 'og:type', route.ogType || 'website')
  html = setProp(html, 'og:url', url)
  html = setProp(html, 'og:image', img)
  html = setProp(html, 'og:image:width', String(route.imageW || 1200))
  html = setProp(html, 'og:image:height', String(route.imageH || 630))
  html = setProp(html, 'og:image:type', route.imageType || 'image/png')
  html = setName(html, 'twitter:title', route.title)
  html = setName(html, 'twitter:description', route.description)
  html = setName(html, 'twitter:image', img)
  if (route.jsonLd) {
    const ld = JSON.stringify(route.jsonLd).replace(/</g, '\\u003c')
    html = html.replace('</head>', `    <script type="application/ld+json">${ld}</script>\n  </head>`)
  }
  return html
}

const routes = allRoutes()
let written = 0
for (const route of routes) {
  const html = buildHtml(route)
  if (route.path === '/') {
    writeFileSync(INDEX, html) // overwrite root so the SPA-fallback file is correct too
  } else {
    const outDir = join(DIST, route.path)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'index.html'), html)
  }
  written++
}

// Sitemap (exclude noindex routes).
const today = new Date().toISOString().slice(0, 10)
const urls = routes
  .filter((r) => !r.noindex)
  .map((r) => {
    const loc = SITE + (r.path === '/' ? '/' : r.path)
    const cf = r.changefreq || 'monthly'
    const pr = (r.priority ?? 0.6).toFixed(1)
    return `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`
  })
  .join('\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
writeFileSync(join(DIST, 'sitemap.xml'), sitemap)

console.log(`prerender: wrote ${written} route HTML files + sitemap.xml (${routes.filter((r) => !r.noindex).length} urls)`)
