import { useEffect, useState, useMemo } from 'react'
import '../games/games.css'
import ThemeToggle from '../components/ThemeToggle'

// Standalone /news page: a running-story CrossFit news feed. Served by the
// same SPA bundle (src/main.tsx branches /news* here, its own lazy chunk).
//
// The feed is FETCHED at runtime from /news-feed.json - it is generated on the
// VPS by a pipeline cron and is NOT bundled (it may legitimately 404 before the
// first run). Loading / empty / error states are all handled with a friendly,
// on-brand message. Visual language is borrowed from the Games Almanac
// (games.css): dark cards, green accents, the Anton/Barlow condensed display
// type.

interface NewsItem {
  id: string
  headline: string
  summary: string
  sourceName: string
  sourceUrl: string
  date: string
  publishedAt: string
  category: NewsCategory
  reliability: 'official' | 'high' | 'medium'
}

interface NewsFeed {
  generated: string
  sourceHealth?: { name: string; ok: boolean; lastSuccess: string }[]
  items: NewsItem[]
}

type NewsCategory =
  | 'semifinals'
  | 'qualification'
  | 'withdrawal'
  | 'athlete'
  | 'video'
  | 'schedule'
  | 'results'
  | 'other'

const CATEGORY_STYLE: Record<NewsCategory, { label: string; bg: string; fg: string }> = {
  semifinals: { label: 'Semifinals', bg: 'rgba(145,198,64,0.16)', fg: '#91C640' },
  qualification: { label: 'Qualification', bg: 'rgba(1,150,68,0.18)', fg: '#3fbf78' },
  withdrawal: { label: 'Withdrawal', bg: 'rgba(239,68,68,0.16)', fg: '#f87171' },
  athlete: { label: 'Athlete', bg: 'rgba(96,165,250,0.16)', fg: '#60a5fa' },
  video: { label: 'Video', bg: 'rgba(168,85,247,0.16)', fg: '#c084fc' },
  schedule: { label: 'Schedule', bg: 'rgba(245,158,11,0.16)', fg: '#f59e0b' },
  results: { label: 'Results', bg: 'rgba(245,158,11,0.2)', fg: '#fbbf24' },
  other: { label: 'News', bg: 'var(--panel-bg-2)', fg: 'var(--text-secondary)' },
}

const categoryStyle = (c: string) => CATEGORY_STYLE[c as NewsCategory] ?? CATEGORY_STYLE.other

/** Local YYYY-MM-DD for "today" so the pin matches the reader's calendar day. */
function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "3 minutes ago" / "2 hours ago" / "yesterday" / "Jun 11" from an ISO time. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Clock time within a day, e.g. "8:42 AM". */
function clockTime(iso: string): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  return t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** A YYYY-MM-DD date label: "Today", "Yesterday", or "Wednesday, June 11". */
function dateLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  const yest = new Date(`${today}T12:00:00`)
  yest.setDate(yest.getDate() - 1)
  if (date === `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`) {
    return 'Yesterday'
  }
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function TopBar() {
  return (
    <header className="games-topbar sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <a href="/news" className="flex items-center gap-2.5 shrink-0" aria-label="CrossFit Now home">
          <div className="w-8 h-8 rounded-full bg-white p-0.5 shrink-0">
            <img src="/pa-logo.png" alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="games-display text-lg text-[var(--text-primary)] leading-none mt-0.5">
            CrossFit <span className="text-[#91C640]">Now</span>
          </div>
        </a>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/games/2026"
            className="games-condensed hidden sm:block uppercase tracking-[0.1em] text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)] hover:border-[#91C640]/50 hover:text-[#91C640] transition-colors"
          >
            2026 Games Hub
          </a>
          <a
            href="/"
            className="games-condensed hidden sm:block uppercase tracking-[0.1em] text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)] hover:border-[#91C640]/50 hover:text-[#91C640] transition-colors"
          >
            WOD Intel
          </a>
          <ThemeToggle size="md" />
        </div>
      </div>
    </header>
  )
}

function NewsFooter() {
  return (
    <footer className="mt-16 mb-8 pt-6 border-t border-[var(--panel-border)] px-4">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white p-1 shrink-0">
            <img src="/pa-logo.png" alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              A{' '}
              <a href="https://persistenceathletics.com" target="_blank" rel="noopener noreferrer" className="text-[#91C640] hover:text-[#a8d35e]">
                Persistence Athletics
              </a>{' '}
              tool
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">Built by Ravikant Dewangan, Head Coach (MS S&amp;C, CCFT)</p>
          </div>
        </div>
        <div className="flex items-center justify-center flex-wrap gap-2 text-[10px] text-[var(--text-muted)]">
          <a href="/" className="hover:text-[var(--text-tertiary)] transition-colors">Daily WOD Intelligence</a>
          <span>|</span>
          <a href="/games" className="hover:text-[var(--text-tertiary)] transition-colors">Games Almanac</a>
          <span>|</span>
          <span>Platform by</span>
          <a href="https://autosterea.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-tertiary)] transition-colors">Autosterea</a>
        </div>
        <div className="text-[11px] sm:text-[10px] text-[var(--text-muted)] leading-relaxed max-w-xl mx-auto">
          <p>
            Headlines and summaries are aggregated from public CrossFit news sources; every item links out to its original publisher. CrossFit and the CrossFit Games are registered trademarks of CrossFit, LLC. This project is not affiliated with, endorsed by, or sponsored by CrossFit, LLC.
          </p>
        </div>
      </div>
    </footer>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-10 h-10 border-2 border-[#91C640]/30 border-t-[#91C640] rounded-full animate-spin" />
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-xl mx-auto text-center py-20 px-4 games-rise games-rise-1">
      <div className="games-display text-3xl text-[var(--text-primary)] mb-3">{title}</div>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{body}</p>
    </div>
  )
}

function ItemCard({ item, index }: { item: NewsItem; index: number }) {
  const cat = categoryStyle(item.category)
  const t = item.publishedAt || `${item.date}T12:00:00`
  return (
    <article className={`games-event-card p-4 sm:p-5 games-rise games-rise-${Math.min(index + 1, 5)}`}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="games-chip" style={{ background: cat.bg, color: cat.fg }}>
          {cat.label}
        </span>
        {item.reliability === 'official' && (
          <span className="games-chip" style={{ background: 'rgba(1,150,68,0.18)', color: '#3fbf78' }}>
            Official
          </span>
        )}
      </div>
      <h3 className="text-[15.5px] sm:text-base font-semibold leading-snug text-[var(--text-primary)]">
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#91C640] transition-colors">
          {item.headline}
        </a>
      </h3>
      {item.summary && (
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] mt-1.5">{item.summary}</p>
      )}
      <div className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] mt-3">
        {item.sourceName}
        {clockTime(t) ? <span className="mx-1.5 opacity-50">.</span> : null}
        {clockTime(t)}
      </div>
    </article>
  )
}

interface DateGroup {
  date: string
  label: string
  items: NewsItem[]
}

export default function NewsApp() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [feed, setFeed] = useState<NewsFeed | null>(null)

  useEffect(() => {
    document.title = 'CrossFit News and Results | Persistence Athletics'
    let cancelled = false
    // Cache-bust so a deployed feed update is seen on next visit without a
    // stale CDN/edge copy.
    fetch(`/news-feed.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`feed ${r.status}`)
        return r.json() as Promise<NewsFeed>
      })
      .then((data) => {
        if (cancelled) return
        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
          setFeed(data ?? null)
          setStatus('empty')
          return
        }
        setFeed(data)
        setStatus('ok')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const today = todayKey()

  const groups = useMemo<DateGroup[]>(() => {
    if (!feed?.items?.length) return []
    const byDate = new Map<string, NewsItem[]>()
    for (const it of feed.items) {
      const key = it.date || (it.publishedAt ? it.publishedAt.slice(0, 10) : 'unknown')
      const bucket = byDate.get(key)
      if (bucket) bucket.push(it)
      else byDate.set(key, [it])
    }
    const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)) // newest first
    return dates.map((date) => {
      const items = byDate.get(date)!.slice().sort((a, b) => {
        const ta = new Date(a.publishedAt || a.date).getTime() || 0
        const tb = new Date(b.publishedAt || b.date).getTime() || 0
        return tb - ta
      })
      return { date, label: dateLabel(date, today), items }
    })
  }, [feed, today])

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pb-8">
        {/* Page header */}
        <section className="pt-7 pb-5 games-rise games-rise-1">
          <div className="games-condensed text-[11px] uppercase tracking-[0.18em] text-[#91C640] mb-1">The Latest</div>
          <h1 className="games-display text-3xl sm:text-4xl text-[var(--text-primary)] leading-none">
            CrossFit, Right Now
          </h1>
          <p className="text-[13.5px] text-[var(--text-secondary)] mt-2 max-w-xl leading-relaxed">
            A running story of the CrossFit Games season: qualifications, withdrawals, results and the road to San Jose, gathered daily.
          </p>
          {status === 'ok' && feed?.generated && (
            <p className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] mt-3">
              Last updated {relativeTime(feed.generated)}
            </p>
          )}
        </section>

        {status === 'loading' && <Spinner />}

        {status === 'error' && (
          <Notice
            title="Feed warming up"
            body="The news desk is still firing up. Live headlines will appear here shortly. In the meantime, the 2026 Games Hub has the field and the road to San Jose."
          />
        )}

        {status === 'empty' && (
          <Notice
            title="Caught up"
            body="No new items right now. When CrossFit news breaks, it lands here. Check back soon, or head to the 2026 Games Hub for the bigger picture."
          />
        )}

        {status === 'ok' &&
          groups.map((g, gi) => (
            <section key={g.date} className="mb-7">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="games-display text-xl text-[var(--text-primary)] leading-none">{g.label}</h2>
                {g.date === today && (
                  <span className="games-chip" style={{ background: 'rgba(1,150,68,0.18)', color: '#3fbf78' }}>
                    Live
                  </span>
                )}
                <div className="flex-1 games-era-rule rounded-full opacity-60" />
              </div>
              {g.items.length === 0 ? (
                <p className="text-[13px] text-[var(--text-muted)] py-3">Caught up - no new items today.</p>
              ) : (
                <div className="space-y-3">
                  {g.items.map((it, i) => (
                    <ItemCard key={it.id} item={it} index={gi === 0 ? i : 0} />
                  ))}
                </div>
              )}
            </section>
          ))}
      </main>
      <NewsFooter />
    </div>
  )
}
