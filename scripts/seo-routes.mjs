// Single source of truth for per-route SEO metadata + the sitemap.
// Plain ESM (no tsx / no new deps) so it runs in the VPS `npm run build`.
// Consumed by scripts/prerender.mjs and scripts/gen-sitemap.mjs.
//
// Hub / year / fitness copy is curated (grounded in games-data.json + the L1
// lesson). The 46 athlete descriptions are DERIVED from each athlete's own
// `storyline` (the same text already shown on their live page), sanitized of
// em/en dashes, so meta never introduces an unverified claim.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const DIR = dirname(fileURLToPath(import.meta.url))
const readJson = (p) => JSON.parse(readFileSync(resolve(DIR, p), 'utf8'))

export const SITE = 'https://wod.persistenceathletics.com'
const OG = `${SITE}/og.png`
const OG_GAMES = `${SITE}/og/games.png`
const OG_FITNESS = `${SITE}/og/fitness.png`

/** Strip em/en dashes (house rule), collapse whitespace. */
const clean = (s) => (s || '').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim()

/** Clip to <= n chars at a word boundary with an ellipsis. */
function clip(s, n = 155) {
  s = clean(s)
  if (s.length <= n) return s
  const cut = s.slice(0, n - 1)
  const at = cut.lastIndexOf(' ')
  return (at > 40 ? cut.slice(0, at) : cut).replace(/[,;:.\-\s]+$/, '') + '...'
}

/* ----------------------------- JSON-LD nodes ---------------------------- */
const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#org`,
  name: 'Persistence Athletics',
  url: 'https://www.persistenceathletics.com',
  logo: `${SITE}/persistence-logo.png`,
}
const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  url: `${SITE}/`,
  name: 'CrossFit WOD Intelligence',
  publisher: { '@id': `${SITE}/#org` },
}
/** Wrap page node(s) with the sitewide Organization + WebSite graph. */
const graph = (...nodes) => ({ '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, ...nodes] })

/* ----------------------------- static routes ---------------------------- */
const STATIC = [
  {
    path: '/',
    title: 'CrossFit WOD Intelligence | Persistence Athletics',
    description:
      'Explore 6,800+ CrossFit Workouts of the Day across 25 years. Data-science analysis of movements, energy systems, work capacity, and programming gaps.',
    ogType: 'website',
    image: OG,
    changefreq: 'daily',
    priority: 1.0,
    jsonLd: graph({
      '@type': 'WebApplication',
      name: 'CrossFit WOD Intelligence',
      url: `${SITE}/`,
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        '25 years of CrossFit programming analyzed: 80 movements, 6,800+ workouts, network science and 3D visualization.',
      author: { '@type': 'Person', name: 'Ravikant Dewangan' },
      publisher: { '@id': `${SITE}/#org` },
    }),
  },
  {
    path: '/games',
    title: 'CrossFit Games Almanac 2007-2025 | Persistence Athletics',
    description:
      'Nineteen years of CrossFit Games history. Every event, champion, movement and era from the Aromas ranch to the touring era, fully researched.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.9,
    jsonLd: graph({ '@type': 'CollectionPage', name: 'CrossFit Games Almanac', url: `${SITE}/games`, isPartOf: { '@id': `${SITE}/#website` } }),
  },
  {
    path: '/games/evolution',
    title: 'How the CrossFit Games Evolved | Persistence Athletics',
    description:
      'The data story of the Games: volume, modality blend, time domains, heavier barbells, leaving the stadium and new movements across 2007 to 2025.',
    ogType: 'article',
    image: OG_GAMES,
    priority: 0.7,
    jsonLd: graph({ '@type': 'CollectionPage', name: 'How the CrossFit Games Evolved', url: `${SITE}/games/evolution`, isPartOf: { '@id': `${SITE}/#website` } }),
  },
  {
    path: '/games/movements',
    title: 'CrossFit Games Movement Index | Persistence Athletics',
    description:
      'Every implement and skill ever tested at the CrossFit Games, with first-appearance years and frequency sparklines across all 19 editions.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.7,
    jsonLd: graph({ '@type': 'CollectionPage', name: 'CrossFit Games Movement Index', url: `${SITE}/games/movements`, isPartOf: { '@id': `${SITE}/#website` } }),
  },
  {
    path: '/games/lore',
    title: 'CrossFit Games Records and Champions | Persistence Athletics',
    description:
      'The record book: every champion, the dynasties, superlatives and benchmark WODs that crossed over from the whiteboard to the Games floor.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.7,
    jsonLd: graph({ '@type': 'CollectionPage', name: 'CrossFit Games Records and Champions', url: `${SITE}/games/lore`, isPartOf: { '@id': `${SITE}/#website` } }),
  },
  {
    path: '/games/capacity',
    title: 'Capacity Lab: CrossFit Games Analysis | Persistence Athletics',
    description:
      'Work capacity across broad time and modal domains, measured. Capacity scores, power-duration curves and fitness fingerprints for every Games top 10.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.8,
    jsonLd: graph({ '@type': 'CollectionPage', name: 'Capacity Lab', url: `${SITE}/games/capacity`, isPartOf: { '@id': `${SITE}/#website` } }),
  },
  {
    path: '/games/2026',
    title: '2026 CrossFit Games Hub: San Jose | Persistence Athletics',
    description:
      'The 2026 CrossFit Games, July 22-26 in San Jose (SAP Center arena days July 24-26). Countdown, the full field, athlete profiles and the road through Semifinals.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.9,
    jsonLd: graph({
      '@type': 'SportsEvent',
      name: '2026 CrossFit Games',
      sport: 'CrossFit',
      startDate: '2026-07-24',
      endDate: '2026-07-26',
      location: { '@type': 'Place', name: 'SAP Center', address: 'San Jose, California' },
      url: `${SITE}/games/2026`,
      organizer: { '@type': 'Organization', name: 'CrossFit, LLC' },
    }),
  },
  {
    path: '/games/2026/intel',
    title: 'Athlete Intelligence: 2026 CrossFit Games Projections | Persistence Athletics',
    description:
      'A data-grounded model of the 2026 CrossFit Games field. Projected leaderboard, 10 physical skills, energy systems and a what-if workout simulator, built from every official competition result.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.85,
    jsonLd: graph({ '@type': 'CollectionPage', name: 'Athlete Intelligence', url: `${SITE}/games/2026/intel`, isPartOf: { '@id': `${SITE}/#website` } }),
  },
  {
    path: '/games/cards',
    title: '2026 Games Athlete Card Studio | Persistence Athletics',
    description: 'Internal tool for building shareable 2026 CrossFit Games athlete cards in the Persistence Athletics layout.',
    ogType: 'website',
    image: OG_GAMES,
    noindex: true,
  },
  {
    path: '/news',
    title: 'CrossFit News and Results | Persistence Athletics',
    description:
      'Year-round CrossFit Games and competition news, updated daily. Qualifications, withdrawals, semifinal results and the road to the 2026 Games in one running feed.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.8,
    changefreq: 'daily',
    jsonLd: graph({
      '@type': 'CollectionPage',
      name: 'CrossFit News and Results',
      url: `${SITE}/news`,
      description: 'Year-round CrossFit Games and competition news, updated daily.',
      isPartOf: { '@id': `${SITE}/#website` },
    }),
  },
  {
    path: '/fitness',
    title: 'What Is Fitness? Interactive Lesson | Persistence Athletics',
    description:
      "An interactive 3D walk through Greg Glassman's What Is Fitness? essay and the CrossFit Level 1 Guide, in six teaching modules.",
    ogType: 'website',
    image: OG_FITNESS,
    priority: 0.8,
    jsonLd: graph({
      '@type': 'Course',
      name: 'What Is Fitness?',
      url: `${SITE}/fitness`,
      description: "An interactive lesson on Greg Glassman's definition of fitness and the CrossFit Level 1 Training Guide.",
      provider: { '@id': `${SITE}/#org` },
      inLanguage: 'en',
    }),
  },
]

/** The fitness lesson modules: slug -> [title, description]. */
const FITNESS = {
  skills: ['The 10 General Physical Skills | Persistence Athletics', 'You are as fit as you are competent across ten skills. Compare a balanced CrossFitter to twelve specialists on an interactive 3D radar.'],
  hopper: ['The Hopper Model | Persistence Athletics', 'Fitness is performing well at any task drawn at random. Pull from an infinite hopper and watch the generalist beat the specialists.'],
  pathways: ['The Three Metabolic Pathways | Persistence Athletics', 'Phosphagen, glycolytic and oxidative engines power every effort. Slide through duration and watch the dominant energy system change.'],
  definition: ['Work Capacity, Fitness Defined | Persistence Athletics', 'CrossFit defines fitness as work capacity across broad time and modal domains. Plot power against duration and measure the area under the curve.'],
  continuum: ['Sickness Wellness Fitness Continuum | Persistence Athletics', 'Nearly every health marker rides one continuum from sickness to fitness. Push them all toward fitness and health follows. Fitness is super-wellness.'],
  health: ['Work Capacity Across a Lifetime | Persistence Athletics', 'Add age to the fitness curve and the 3D solid is health. Sustaining high work capacity across a lifetime, not just living long, is true health.'],
}

/** Per-year curated copy (champions grounded in games-data.json). */
const YEARS = {
  2007: ['2007 CrossFit Games: Fitzgerald, Gentry | Persistence Athletics', 'The inaugural CrossFit Games at the Castro ranch in Aromas. James Fitzgerald and Jolie Gentry win the hopper, trail run and CrossFit Total.'],
  2008: ['2008 CrossFit Games: Khalipa, Matter | Persistence Athletics', 'Year two at the Aromas ranch. Jason Khalipa and Caity Matter take the titles as the field and event count grow on the dirt hillside.'],
  2009: ['2009 CrossFit Games: Salo, Wagner | Persistence Athletics', 'The last ranch Games in Aromas. Mikko Salo and Tanya Wagner win across eight events in the final year before the move to Carson.'],
  2010: ['2010 CrossFit Games: Holmberg, Clever | Persistence Athletics', 'The Games go stadium at the Home Depot Center in Carson. Graham Holmberg and Kristan Clever crown the first Carson-era champions.'],
  2011: ['2011 CrossFit Games: Froning, Thorisdottir | Persistence Athletics', 'The Open debuts and feeds Carson. Rich Froning and Annie Thorisdottir win their first titles at the Home Depot Center across ten events.'],
  2012: ['2012 CrossFit Games: Froning, Thorisdottir | Persistence Athletics', 'Back-to-back titles in Carson as Rich Froning and Annie Thorisdottir repeat across a 15-event Home Depot Center program.'],
  2013: ['2013 CrossFit Games: Froning, Briggs | Persistence Athletics', "Rich Froning takes a third straight title at the StubHub Center while Samantha Briggs wins the women's crown across twelve events in Carson."],
  2014: ['2014 CrossFit Games: Froning, Leblanc-Bazinet | Persistence Athletics', 'Rich Froning closes his run with a fourth straight title and Camille Leblanc-Bazinet wins, across 13 events at the StubHub Center in Carson.'],
  2015: ['2015 CrossFit Games: Smith, Davidsdottir | Persistence Athletics', 'A new era of champions in Carson. Ben Smith and Katrin Davidsdottir win their first titles across 13 events at the StubHub Center.'],
  2016: ['2016 CrossFit Games: Fraser, Davidsdottir | Persistence Athletics', 'The final Carson Games. Mat Fraser wins his first title and Katrin Davidsdottir repeats across 15 events at the StubHub Center.'],
  2017: ['2017 CrossFit Games: Fraser, Toomey | Persistence Athletics', "The Games move to Madison's Alliant Energy Center. Mat Fraser repeats and Tia-Clair Toomey wins the first of her titles across 13 events."],
  2018: ['2018 CrossFit Games: Fraser, Toomey | Persistence Athletics', 'Mat Fraser and Tia-Clair Toomey both repeat in Madison, taking the titles across a 14-event program at the Alliant Energy Center.'],
  2019: ['2019 CrossFit Games: Fraser, Toomey | Persistence Athletics', 'The cut-heavy Madison Games. Mat Fraser and Tia-Clair Toomey win again across twelve events at the Alliant Energy Center.'],
  2020: ['2020 CrossFit Games: Fraser, Toomey | Persistence Athletics', 'The two-stage pandemic Games return to the Aromas ranch. Mat Fraser caps his career and Tia-Clair Toomey wins across many events.'],
  2021: ['2021 CrossFit Games: Medeiros, Toomey | Persistence Athletics', 'Justin Medeiros wins his first title and Tia-Clair Toomey extends her streak back in Madison, across 15 events at the Alliant Energy Center.'],
  2022: ['2022 CrossFit Games: Medeiros, Toomey | Persistence Athletics', 'Justin Medeiros repeats and Tia-Clair Toomey wins again in Madison, across a 14-event program at the Alliant Energy Center.'],
  2023: ['2023 CrossFit Games: Adler, Horvath | Persistence Athletics', "New champions in Madison. Jeffrey Adler wins Canada's first men's title and Laura Horvath takes the women's crown across twelve events."],
  2024: ['2024 CrossFit Games: Sprague, Toomey-Orr | Persistence Athletics', "The touring era opens at Dickies Arena in Fort Worth. James Sprague wins the men's title and Tia-Clair Toomey-Orr the women's across ten events."],
  2025: ['2025 CrossFit Games: Hopper, Toomey-Orr | Persistence Athletics', "The Games head to Albany's MVP Arena. Jayson Hopper wins the men's title and Tia-Clair Toomey-Orr the women's across ten events."],
}

/** Build the full indexable route list. */
export function allRoutes() {
  const routes = [...STATIC]

  // Main WOD-app analysis tabs (now real indexable URLs; see src/appRouting.ts).
  const appTabs = readJson('../src/data/app-routes.json')
  for (const r of appTabs) {
    routes.push({
      path: '/' + r.slug,
      title: r.title,
      description: r.description,
      ogType: 'website',
      image: OG,
      priority: r.slug === 'todays-wod' ? 0.9 : 0.6,
      changefreq: r.slug === 'todays-wod' ? 'daily' : 'monthly',
      jsonLd: graph({
        '@type': 'WebPage',
        name: r.title.split(' | ')[0],
        url: SITE + '/' + r.slug,
        isPartOf: { '@id': SITE + '/#website' },
        description: r.description,
      }),
    })
  }

  // Fitness modules.
  for (const [slug, [title, description]] of Object.entries(FITNESS)) {
    routes.push({
      path: `/fitness/${slug}`,
      title,
      description,
      ogType: 'article',
      image: OG_FITNESS,
      priority: 0.7,
      jsonLd: graph({
        '@type': 'LearningResource',
        name: title.split(' | ')[0],
        url: `${SITE}/fitness/${slug}`,
        learningResourceType: 'Interactive lesson',
        inLanguage: 'en',
        isPartOf: { '@type': 'Course', name: 'What Is Fitness?', url: `${SITE}/fitness` },
        provider: { '@id': `${SITE}/#org` },
      }),
    })
  }

  // Games year pages (grounded in games-data.json years).
  let years = Object.keys(YEARS).map(Number)
  try {
    const G = readJson('../src/data/games-data.json')
    const dataYears = (G?.meta?.years || G?.years?.map?.((y) => y.year) || []).map(Number).filter(Boolean)
    if (dataYears.length) years = dataYears.filter((y) => YEARS[y])
  } catch { /* fall back to YEARS keys */ }
  for (const y of years) {
    if (!YEARS[y]) continue
    const [title, description] = YEARS[y]
    routes.push({
      path: `/games/${y}`,
      title,
      description,
      ogType: 'article',
      image: OG_GAMES,
      priority: 0.7,
      jsonLd: graph({
        '@type': 'SportsEvent',
        name: `${y} CrossFit Games`,
        sport: 'CrossFit',
        startDate: String(y),
        url: `${SITE}/games/${y}`,
        organizer: { '@type': 'Organization', name: 'CrossFit, LLC' },
      }),
    })
  }

  // 2026 athlete pages (description derived from each athlete's storyline).
  const A = readJson('../src/data/games/athletes-2026.json')
  const athletes = [...(A.men || []), ...(A.women || [])]
  for (const a of athletes) {
    if (!a.slug || !a.name) continue
    const portrait = resolve(DIR, `../public/athletes/${a.slug}.webp`)
    const hasPhoto = existsSync(portrait)
    const desc = a.storyline
      ? clip(`${a.name}, ${a.country}. ${a.storyline}`, 155)
      : clip(`${a.name}, ${a.country}. ${a.bestGamesFinish || 'CrossFit athlete'}. Profile and full Games history for the 2026 CrossFit Games.`, 155)
    const person = {
      '@type': 'Person',
      name: a.name,
      url: `${SITE}/games/2026/athlete/${a.slug}`,
      jobTitle: 'CrossFit athlete',
      nationality: a.country || undefined,
      homeLocation: a.hometown || undefined,
      affiliation: a.affiliate || undefined,
      image: hasPhoto ? `${SITE}/athletes/${a.slug}.webp` : undefined,
      sameAs: a.instagramHandle ? [`https://www.instagram.com/${String(a.instagramHandle).replace(/^@/, '')}/`] : undefined,
    }
    Object.keys(person).forEach((k) => person[k] === undefined && delete person[k])
    routes.push({
      path: `/games/2026/athlete/${a.slug}`,
      title: clean(`${a.name}: 2026 Games | Persistence Athletics`),
      description: desc,
      ogType: 'profile',
      image: hasPhoto ? `${SITE}/athletes/${a.slug}.webp` : OG_GAMES,
      imageW: hasPhoto ? 400 : 1200,
      imageH: hasPhoto ? 520 : 630,
      imageType: hasPhoto ? 'image/webp' : 'image/png',
      priority: 0.6,
      jsonLd: graph(person),
    })
  }

  // The 2026 Events tracker.
  routes.push({
    path: '/games/2026/events',
    title: 'The 20 Events: 2026 CrossFit Games Tracker | Persistence Athletics',
    description: 'The 2026 CrossFit Games will score 20 events across 4 days. Track every confirmed, revealed and teased event, movement and piece of equipment as the programming drops.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.7,
    changefreq: 'daily',
    jsonLd: graph({ '@type': 'CollectionPage', name: 'The 20 Events - 2026 CrossFit Games', url: `${SITE}/games/2026/events`, isPartOf: { '@id': `${SITE}/#website` } }),
  })

  // The Breakdown: analysis index + per-article pages (grounded in the model).
  routes.push({
    path: '/games/analysis',
    title: 'The Breakdown: 2026 CrossFit Games Analysis | Persistence Athletics',
    description: 'Data-grounded analysis of the 2026 CrossFit Games. Every read built from official competition results and the Persistence Athletics model.',
    ogType: 'website',
    image: OG_GAMES,
    priority: 0.7,
    changefreq: 'weekly',
    jsonLd: graph({ '@type': 'Blog', name: 'The Breakdown', url: `${SITE}/games/analysis`, isPartOf: { '@id': `${SITE}/#website` } }),
  })
  try {
    const posts = readJson('../src/data/games/analysis-posts.json')
    for (const post of posts) {
      if (!post.slug || !post.title) continue
      routes.push({
        path: `/games/analysis/${post.slug}`,
        title: clean(`${post.title} | The Breakdown`),
        description: clip(post.summary || post.dek || '', 155),
        ogType: 'article',
        image: OG_GAMES,
        priority: 0.6,
        changefreq: 'monthly',
        jsonLd: graph({
          '@type': 'Article',
          headline: post.title,
          url: `${SITE}/games/analysis/${post.slug}`,
          datePublished: post.date,
          author: { '@type': 'Person', name: post.author || 'Ravikant Dewangan' },
          publisher: { '@id': `${SITE}/#org` },
          description: post.summary || post.dek || '',
          isPartOf: { '@type': 'Blog', name: 'The Breakdown', url: `${SITE}/games/analysis` },
        }),
      })
    }
  } catch { /* posts optional */ }

  return routes
}
