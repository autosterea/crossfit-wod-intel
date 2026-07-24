import { useEffect, useMemo } from 'react'
import { useGamesStore } from '../gamesStore'
import { Panel } from '../ui'
import { track } from '../../lib/track'
import postsData from '../../data/games/analysis-posts.json'
import eventsData from '../../data/games/events-2026.json'
import type { AnalysisPost, Block } from './analysisTypes'

const POSTS = (postsData as AnalysisPost[]).slice().sort((a, b) => (a.date < b.date ? 1 : -1))

// Reverse index: post slug -> the 2026 event it covers (for the "view this event" link)
type EventItem = { name: string; num?: number; shortName?: string; analysisSlug?: string }
const EVENT_BY_SLUG = new Map<string, EventItem>(
  ((eventsData as { items: EventItem[] }).items || []).filter((e) => e.analysisSlug).map((e) => [e.analysisSlug as string, e]),
)

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[(m || 1) - 1]} ${day}, ${y}`
}

/** Render **bold** spans inside body text (no markdown dependency). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="text-[var(--text-primary)] font-semibold">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'h2':
      return <h2 className="games-display text-2xl sm:text-3xl text-[var(--text-primary)] mt-8 mb-3 leading-tight">{block.text}</h2>
    case 'p':
      return <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] mb-4"><RichText text={block.text} /></p>
    case 'list':
      return (
        <ul className="mb-4 space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-[var(--text-secondary)]">
              <span className="text-[#91C640] mt-1.5 shrink-0">&bull;</span>
              <span><RichText text={it} /></span>
            </li>
          ))}
        </ul>
      )
    case 'ranked':
      return (
        <div className="my-5 rounded-xl overflow-hidden" style={{ border: '1px solid var(--panel-border)' }}>
          {block.title && (
            <div className="games-condensed text-[11px] uppercase tracking-[0.14em] text-[#91C640] px-4 py-2.5" style={{ background: 'var(--panel-bg-2)' }}>{block.title}</div>
          )}
          {block.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-[14px]" style={{ background: i % 2 ? 'transparent' : 'var(--panel-bg)', borderTop: i ? '1px solid var(--panel-border-subtle)' : 'none' }}>
              <span className="games-display text-[var(--text-tertiary)] w-6 text-center shrink-0">{i + 1}</span>
              <span className="font-semibold text-[var(--text-primary)] flex-1 min-w-0 truncate">{r.name}</span>
              {r.note && <span className="text-[12px] text-[var(--text-muted)] hidden sm:block text-right truncate max-w-[45%]">{r.note}</span>}
              <span className="games-condensed text-[#91C640] tabular-nums shrink-0 text-right">{r.value}</span>
            </div>
          ))}
        </div>
      )
    case 'callout':
      return (
        <div className="my-6 rounded-xl px-4 py-3.5" style={{ background: 'rgba(145,198,64,0.1)', border: '1px solid rgba(145,198,64,0.3)' }}>
          {block.title && <div className="games-condensed text-[11px] uppercase tracking-[0.12em] text-[#91C640] mb-1.5">{block.title}</div>}
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]"><RichText text={block.text} /></p>
        </div>
      )
    default:
      return null
  }
}

function ArticleCard({ p }: { p: AnalysisPost }) {
  const navigate = useGamesStore((s) => s.navigate)
  return (
    <button
      onClick={() => navigate({ view: 'analysis', year: 2026, slug: p.slug })}
      className="cap-card p-4 sm:p-5 text-left w-full flex flex-col h-full hover:border-[#91C640]/40 active:border-[#91C640]/60 active:scale-[0.99] transition-[transform,border-color]"
    >
      <div className="games-condensed text-[10.5px] uppercase tracking-[0.16em] text-[#91C640] mb-2">{p.category} &middot; {fmtDate(p.date)} &middot; {p.readMin} min</div>
      <h3 className="games-display text-xl sm:text-2xl text-[var(--text-primary)] leading-tight mb-2 clamp-3">{p.title}</h3>
      <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed clamp-2">{p.dek}</p>
      <div className="games-condensed text-[12px] text-[#91C640] mt-auto pt-3 uppercase tracking-[0.08em]">Read the breakdown &rarr;</div>
    </button>
  )
}

function Article({ post }: { post: AnalysisPost }) {
  const navigate = useGamesStore((s) => s.navigate)
  useEffect(() => {
    track('read_breakdown', { post_slug: post.slug, post_title: post.title, category: post.category })
  }, [post.slug, post.title, post.category])
  return (
    <article className="max-w-2xl mx-auto pt-6">
      <button onClick={() => navigate({ view: 'analysis', year: 2026 })} className="games-condensed text-[12px] uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[#91C640] mb-5">&larr; The Breakdown</button>
      <div className="games-condensed text-[11px] uppercase tracking-[0.16em] text-[#91C640] mb-2">{post.category} &middot; {fmtDate(post.date)} &middot; {post.readMin} min read</div>
      <h1 className="games-display text-3xl sm:text-5xl text-[var(--text-primary)] leading-[1.02] mb-3">{post.title}</h1>
      <p className="text-[16px] sm:text-[17px] text-[var(--text-secondary)] leading-relaxed mb-4">{post.dek}</p>
      <div className="text-[12px] text-[var(--text-muted)] mb-6 pb-6" style={{ borderBottom: '1px solid var(--panel-border)' }}>By {post.author} &middot; Persistence Athletics</div>
      <div>{post.blocks.map((b, i) => <BlockView key={i} block={b} />)}</div>
      {(post.sources?.length ?? 0) > 0 && (
        <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--panel-border)' }}>
          <div className="games-condensed text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-2">Sources</div>
          <ul className="space-y-1">
            {post.sources.map((s, i) => (
              <li key={i} className="text-[12.5px]"><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#91C640] hover:underline">{s.label}</a></li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {EVENT_BY_SLUG.has(post.slug) && (
          <button onClick={() => navigate({ view: 'events', year: 2026 })} className="games-condensed uppercase tracking-[0.1em] font-semibold text-[12px] px-4 py-2 rounded-lg bg-[#019644] text-white hover:bg-[#01a94d] transition-colors">
            {EVENT_BY_SLUG.get(post.slug)?.num ? `Event ${EVENT_BY_SLUG.get(post.slug)?.num}: ` : ''}{EVENT_BY_SLUG.get(post.slug)?.shortName || 'View this event'} &rarr;
          </button>
        )}
        <button onClick={() => navigate({ view: 'intel', year: 2026 })} className={`games-condensed uppercase tracking-[0.1em] font-semibold text-[12px] px-4 py-2 rounded-lg ${EVENT_BY_SLUG.has(post.slug) ? 'border text-[#91C640] hover:bg-[#91C640]/10' : 'bg-[#019644] text-white hover:bg-[#01a94d]'} transition-colors`} style={EVENT_BY_SLUG.has(post.slug) ? { borderColor: 'rgba(145,198,64,0.4)' } : undefined}>See the full model &rarr;</button>
        <button onClick={() => navigate({ view: 'capacity', year: 2026 })} className="games-condensed uppercase tracking-[0.1em] font-semibold text-[12px] px-4 py-2 rounded-lg border text-[#91C640] hover:bg-[#91C640]/10 transition-colors" style={{ borderColor: 'rgba(145,198,64,0.4)' }}>Capacity Lab</button>
      </div>
    </article>
  )
}

export default function AnalysisView() {
  const route = useGamesStore((s) => s.route)
  const post = useMemo(() => POSTS.find((p) => p.slug === route.slug), [route.slug])

  if (route.slug) {
    if (!post) {
      return (
        <div className="max-w-xl mx-auto text-center py-24 px-4">
          <div className="games-display text-2xl text-[var(--text-primary)] mb-2">Piece not found</div>
          <button onClick={() => useGamesStore.getState().navigate({ view: 'analysis', year: 2026 })} className="text-[#91C640] text-sm">&larr; Back to The Breakdown</button>
        </div>
      )
    }
    return <Article post={post} />
  }

  return (
    <div className="pt-6">
      <section className="cap-hero games-grain p-5 sm:p-8 mb-7">
        <div className="games-condensed text-[11px] uppercase tracking-[0.24em] text-[#91C640] mb-2">A Persistence Athletics publication</div>
        <h1 className="games-display text-[12vw] sm:text-6xl cap-hero-ink leading-[0.9]">The <span className="text-[#91C640]">Breakdown</span></h1>
        <p className="mt-3 cap-hero-dim text-[13.5px] leading-relaxed max-w-xl">
          Data-grounded analysis of the 2026 CrossFit Games. Every read is built from official competition results and our model. No takes without the numbers behind them.
        </p>
      </section>

      {POSTS.length === 0 ? (
        <Panel className="p-8 text-center">
          <div className="games-display text-xl text-[var(--text-primary)] mb-2">First pieces landing soon</div>
          <p className="text-[13px] text-[var(--text-secondary)]">The first breakdowns are being written from the model. Check back shortly.</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POSTS.map((p) => <ArticleCard key={p.slug} p={p} />)}
        </div>
      )}
    </div>
  )
}
