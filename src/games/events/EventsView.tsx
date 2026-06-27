import { useMemo } from 'react'
import { useGamesStore } from '../gamesStore'
import { Panel } from '../ui'
import data from '../../data/games/events-2026.json'

type Status = 'confirmed' | 'revealed' | 'teased' | 'rumored'
interface EventItem {
  name: string
  status: Status
  kind: string
  summary: string
  source: { label: string; url: string }
  date?: string
  num?: number | null
}
interface EventsData {
  meta: { total: number; days: number; venue: string; city: string; dates: string; note: string; updated: string }
  items: EventItem[]
}

const D = data as EventsData

const STATUS_STYLE: Record<Status, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', color: 'var(--accent-success)', bg: 'rgba(1,150,68,0.16)' },
  revealed: { label: 'Revealed', color: '#91C640', bg: 'rgba(145,198,64,0.16)' },
  teased: { label: 'Teased', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.16)' },
  rumored: { label: 'Rumored', color: 'var(--text-tertiary)', bg: 'var(--panel-bg-2)' },
}
const ORDER: Status[] = ['confirmed', 'revealed', 'teased', 'rumored']

function fmtDate(d?: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[(m || 1) - 1]} ${day}`
}

function EventCard({ e }: { e: EventItem }) {
  const s = STATUS_STYLE[e.status]
  return (
    <div className="cap-card p-4">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="games-display text-lg text-[var(--text-primary)] leading-tight">{e.name}</h3>
        <span className="games-chip shrink-0" style={{ background: s.bg, color: s.color }}>{s.label}</span>
      </div>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-2">{e.summary}</p>
      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <a href={e.source.url} target="_blank" rel="noopener noreferrer" className="text-[#91C640] hover:underline truncate">{e.source.label}</a>
        {e.date && <span className="shrink-0">{fmtDate(e.date)}</span>}
      </div>
    </div>
  )
}

export default function EventsView() {
  const navigate = useGamesStore((s) => s.navigate)
  const groups = useMemo(() => {
    const g: Record<Status, EventItem[]> = { confirmed: [], revealed: [], teased: [], rumored: [] }
    for (const e of D.items) (g[e.status] ?? g.rumored).push(e)
    return g
  }, [])
  const confirmedCount = groups.confirmed.length + groups.revealed.length

  return (
    <div className="pt-6">
      <button onClick={() => navigate({ view: 'hub', year: 2026 })} className="games-condensed text-[12px] uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[#91C640] mb-4">&larr; 2026 Hub</button>

      <section className="cap-hero games-grain p-5 sm:p-8 mb-6">
        <div className="games-condensed text-[11px] uppercase tracking-[0.24em] text-[#91C640] mb-2">2026 CrossFit Games</div>
        <h1 className="games-display text-[12vw] sm:text-6xl cap-hero-ink leading-[0.9]">The <span className="text-[#91C640]">20 Events</span></h1>
        <p className="mt-3 cap-hero-dim text-[13px] leading-relaxed max-w-xl">{D.meta.note}</p>
        <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
          {[
            { v: String(D.meta.total), l: 'scored events' },
            { v: String(D.meta.days), l: 'days' },
            { v: `${D.meta.venue}`, l: D.meta.city },
            { v: D.meta.dates.replace(', 2026', ''), l: 'San Jose' },
          ].map((s) => (
            <div key={s.l}>
              <div className="games-display text-2xl sm:text-3xl cap-hero-ink leading-none">{s.v}</div>
              <div className="games-condensed text-[10px] uppercase tracking-[0.14em] text-[#91C640] mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {D.items.length === 0 ? (
        <Panel className="p-8 text-center">
          <div className="games-display text-xl text-[var(--text-primary)] mb-2">Tracking what gets revealed</div>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-md mx-auto">CrossFit has confirmed 20 events across 4 days. As specific tests, movements and equipment are announced, they land here with the source. Check back as the reveals roll out.</p>
        </Panel>
      ) : (
        <>
          <p className="text-[12px] text-[var(--text-muted)] mb-5">{confirmedCount} programming element{confirmedCount === 1 ? '' : 's'} revealed so far. The official numbered events drop closer to and during the Games.</p>
          {ORDER.map((st) =>
            groups[st].length ? (
              <section key={st} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="games-chip" style={{ background: STATUS_STYLE[st].bg, color: STATUS_STYLE[st].color }}>{STATUS_STYLE[st].label}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">{groups[st].length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {groups[st].map((e, i) => <EventCard key={e.name + i} e={e} />)}
                </div>
              </section>
            ) : null,
          )}
        </>
      )}

      <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed mt-6 max-w-2xl">
        Status key: <span className="text-[var(--accent-success)]">Confirmed</span> = officially announced by CrossFit; <span className="text-[#91C640]">Revealed</span> = shown or stated by CrossFit; <span className="text-[var(--accent-amber)]">Teased</span> = hinted, possibly misdirection; Rumored = reported but unconfirmed. Every item links to its source. Last updated {fmtDate(D.meta.updated)}.
      </p>
    </div>
  )
}
