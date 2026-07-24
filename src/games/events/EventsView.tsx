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
  shortName?: string
  analysisSlug?: string
  day?: string
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
  // month-only dates ("2026-06") have no day - show "Jun 2026", not "Jun undefined"
  return day ? `${months[(m || 1) - 1]} ${day}` : `${months[(m || 1) - 1]} ${y}`
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
  // Numbered official events fill the 20-slot grid; everything else is a "revealed
  // programming element" (swimming, cycling, teased ideas) shown as context below.
  const byNum = useMemo(() => {
    const m = new Map<number, EventItem>()
    for (const e of D.items) if (e.num) m.set(e.num, e)
    return m
  }, [])
  const groups = useMemo(() => {
    const g: Record<Status, EventItem[]> = { confirmed: [], revealed: [], teased: [], rumored: [] }
    for (const e of D.items) if (!e.num) (g[e.status] ?? g.rumored).push(e)
    return g
  }, [])

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

      {/* NEXT UP - day-known events whose official numbers are pending (top billing so
          "what's tomorrow" is never buried in the sections below) */}
      {(() => {
        const upNext = D.items.filter((e) => e.day && !e.num)
        if (!upNext.length) return null
        const dayLabel = upNext[0].day
        return (
          <section className="mb-9">
            <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
              <h2 className="games-display text-2xl text-[var(--text-primary)]">Next up: {dayLabel}</h2>
              <span className="games-condensed text-[12px] uppercase tracking-[0.08em] text-[#91C640]">{upNext.length} events revealed</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {upNext.map((ev) => (
                <button
                  key={ev.name}
                  onClick={() => ev.analysisSlug && navigate({ view: 'analysis', year: 2026, slug: ev.analysisSlug })}
                  disabled={!ev.analysisSlug}
                  className="cap-card p-3.5 text-left"
                  style={{ borderColor: 'rgba(145,198,64,0.45)', cursor: ev.analysisSlug ? 'pointer' : 'default' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="games-display text-lg text-[var(--text-primary)] leading-tight">{ev.shortName ?? ev.name}</div>
                    <span className="games-chip shrink-0" style={{ background: 'rgba(1,150,68,0.16)', color: 'var(--accent-success)' }}>Confirmed</span>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-1 clamp-2">{ev.summary}</p>
                  {ev.analysisSlug && <div className="games-condensed text-[11px] text-[#91C640] mt-1.5 uppercase tracking-[0.08em]">Full breakdown &rarr;</div>}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">Official event numbers are announced on game day - these fill into the numbered grid below the moment they are.</p>
          </section>
        )
      })()}

      {/* THE 20 EVENTS - numbered slots, fill in as CrossFit releases them */}
      <section className="mb-9">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="games-display text-2xl text-[var(--text-primary)]">The 20 events</h2>
          <span className="games-condensed text-[12px] uppercase tracking-[0.08em] text-[#91C640]">{byNum.size} of 20 announced</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
            const ev = byNum.get(n)
            if (!ev) {
              return (
                <div key={n} className="rounded-xl p-3" style={{ border: '1px dashed var(--panel-border)' }}>
                  <div className="games-display text-lg text-[var(--text-muted)]">{n}</div>
                  <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5">To be revealed</div>
                </div>
              )
            }
            const clickable = !!ev.analysisSlug
            return (
              <button
                key={n}
                onClick={() => ev.analysisSlug && navigate({ view: 'analysis', year: 2026, slug: ev.analysisSlug })}
                disabled={!clickable}
                className="cap-card p-3 text-left"
                style={{ borderColor: 'rgba(145,198,64,0.45)', cursor: clickable ? 'pointer' : 'default' }}
              >
                <div className="games-display text-lg text-[#91C640]">{n}</div>
                <div className="text-[12.5px] font-semibold text-[var(--text-primary)] leading-tight mt-0.5">{ev.shortName ?? ev.name}</div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--accent-success)' }}>Confirmed{clickable ? ' · breakdown →' : ''}</div>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-3">CrossFit reveals the events over time. Announced events fill in here (tap for the full breakdown); the rest drop closer to and during the Games.</p>
      </section>

      {D.items.length === 0 ? (
        <Panel className="p-8 text-center">
          <div className="games-display text-xl text-[var(--text-primary)] mb-2">Tracking what gets revealed</div>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-md mx-auto">CrossFit has confirmed 20 events across 4 days. As specific tests, movements and equipment are announced, they land here with the source. Check back as the reveals roll out.</p>
        </Panel>
      ) : (
        <>
          <h2 className="games-display text-xl text-[var(--text-primary)] mb-1">Programming revealed so far</h2>
          <p className="text-[12px] text-[var(--text-muted)] mb-5">Confirmed and teased elements CrossFit has shown beyond the numbered events, each with its source.</p>
          {ORDER.map((st) =>
            groups[st].length ? (
              <section key={st} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="games-chip" style={{ background: STATUS_STYLE[st].bg, color: STATUS_STYLE[st].color }}>{STATUS_STYLE[st].label}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">{groups[st].length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
