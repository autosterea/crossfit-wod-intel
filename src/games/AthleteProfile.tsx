import { useEffect } from 'react'
import { athleteBySlug, countryFlag, youtubeEmbed, allAthletes2026, mediaForAthlete, youtubeThumb, VIDEO_KIND_LABEL } from './athletes2026'
import { useGamesStore } from './gamesStore'
import { track } from '../lib/track'
import AthleteAvatar from './AthleteAvatar'
import IntelProfile from './intel/IntelProfile'
import Live2026Performance from './Live2026Performance'
import type { GamesAthlete2026 } from '../types-games'

const ord = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th')

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-3 bg-[var(--panel-bg-2)] border border-[var(--panel-border-subtle)] text-center">
      <div className="games-display text-xl sm:text-2xl leading-none" style={{ color: accent ? '#91C640' : 'var(--text-primary)' }}>{value}</div>
      <div className="games-condensed text-[9.5px] uppercase tracking-[0.12em] text-[var(--text-muted)] mt-1">{label}</div>
    </div>
  )
}

function PathStep({ stage, value, sub, won }: { stage: string; value: string; sub?: string; won?: boolean }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl p-3 border" style={{ borderColor: won ? 'rgba(1,150,68,0.4)' : 'var(--panel-border)', background: won ? 'rgba(1,150,68,0.08)' : 'var(--panel-bg)' }}>
      <div className="games-condensed text-[10px] uppercase tracking-[0.12em] text-[#91C640]">{stage}</div>
      <div className="games-display text-lg text-[var(--text-primary)] leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10.5px] text-[var(--text-muted)] truncate">{sub}</div>}
    </div>
  )
}

export default function AthleteProfile() {
  const route = useGamesStore((s) => s.route)
  const navigate = useGamesStore((s) => s.navigate)
  const a: GamesAthlete2026 | undefined = route.slug ? athleteBySlug.get(route.slug) : undefined

  useEffect(() => {
    if (route.slug) track('view_athlete', { athlete_slug: route.slug })
    // Set the tab title from the canonical name (keeps diacritics/casing that
    // slug-reconstruction drops, e.g. Bergrós Björnsdóttir).
    if (a?.name) document.title = `${a.name} - 2026 CrossFit Games | Persistence Athletics`
  }, [route.slug, a?.name])

  if (!a) {
    // Athlete is in the projection cohort (top-30 Open) but not yet in the
    // curated 2026 bio file (which holds the in-person qualifiers until the
    // field locks ~June 16). Render the data-grounded intel profile so the
    // page is useful and the leaderboard never links to a dead end.
    return (
      <div className="pt-6 max-w-3xl mx-auto">
        <button onClick={() => navigate({ view: 'intel', year: 2026 })} className="games-condensed text-[12px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] hover:text-[#91C640] mb-2">← Athlete Intelligence</button>
        {route.slug ? <IntelProfile slug={route.slug} showHeader /> : null}
      </div>
    )
  }

  const embed = youtubeEmbed(a.interviewUrl)
  const media = mediaForAthlete(a.slug)
  const sameDivision = allAthletes2026.filter((x) => x.division === a.division)
  const idx = sameDivision.findIndex((x) => x.slug === a.slug)
  const next = sameDivision[(idx + 1) % sameDivision.length]
  const semiWin = a.semifinalFinish2026 && /1st|won/i.test(a.semifinalFinish2026)
  const vitals = [
    a.age ? `${a.age} yrs` : null,
    a.heightCm ? `${Math.floor(Math.round(a.heightCm / 2.54) / 12)}'${Math.round(a.heightCm / 2.54) % 12}"` : null,
    a.weightKg ? `${Math.round(a.weightKg * 2.205)} lb` : null,
  ].filter(Boolean)

  return (
    <div className="pt-6 max-w-3xl mx-auto">
      <button onClick={() => navigate({ view: 'hub', year: 2026 })} className="games-condensed text-[12px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] hover:text-[#91C640] mb-4">← 2026 field</button>

      {/* Header */}
      <section className="cap-card overflow-hidden mb-5 games-rise games-rise-1">
        <div className="p-5 flex items-center gap-4" style={{ background: 'linear-gradient(120deg, rgba(1,150,68,0.12), transparent 70%)' }}>
          <AthleteAvatar athlete={a} size={96} rounded="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="games-display text-2xl sm:text-3xl text-[var(--text-primary)] leading-none">{a.name}</h1>
              {a.isFormerChampion && <span className="games-chip" style={{ background: 'rgba(245,158,11,0.18)', color: 'var(--accent-gold)' }}>🏆 Champion</span>}
              {a.isRookie && <span className="games-chip" style={{ background: 'rgba(96,165,250,0.16)', color: 'var(--accent-blue)' }}>Rookie</span>}
            </div>
            <div className="text-[13px] text-[var(--text-secondary)] mt-1">
              {countryFlag(a.country)} {a.country}{a.hometown ? ` · ${a.hometown}` : ''}
            </div>
            <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5">
              {[a.affiliate, ...vitals].filter(Boolean).join(' · ')}
            </div>
            {a.instagramHandle && (
              <a href={`https://instagram.com/${a.instagramHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-[#91C640] mt-0.5 inline-block">{a.instagramHandle}</a>
            )}
          </div>
        </div>
      </section>

      {/* LIVE 2026: per-event placings + rank-fluctuation line (top billing during Games week) */}
      <Live2026Performance slug={a.slug} />

      {/* Athlete Intelligence (competition-derived profile) - lead with the analysis */}
      <IntelProfile slug={a.slug} />

      {/* Storyline */}
      {a.storyline && (
        <section className="mb-5">
          <div className="games-condensed text-[10px] uppercase tracking-[0.16em] text-[#91C640] mb-1">The story</div>
          <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">{a.storyline}</p>
        </section>
      )}

      {/* Games history */}
      <section className="mb-5 grid grid-cols-3 gap-2.5">
        <Stat label="Games" value={a.gamesAppearances ? `${a.gamesAppearances}×` : a.isRookie || a.gamesAppearances === 0 ? 'Rookie' : '-'} />
        <Stat label="Best finish" value={a.bestGamesFinish ? a.bestGamesFinish.replace(/\s*\(.*\)/, '') : a.isRookie ? 'Debut' : '-'} accent />
        <Stat label="Since" value={a.firstGamesYear ? String(a.firstGamesYear) : a.isRookie ? '2026' : '-'} />
      </section>

      {/* Year-by-year Games history */}
      {a.finishes && a.finishes.length > 0 ? (
        <section className="mb-5">
          <div className="games-condensed text-[10px] uppercase tracking-[0.16em] text-[#91C640] mb-2">Every Games appearance</div>
          <div className="flex flex-wrap gap-1.5">
            {a.finishes.map((f) => {
              const win = f.place === 1 || f.place === '1'
              return (
                <span key={f.year} className="games-chip" style={{ background: win ? 'rgba(245,158,11,0.18)' : 'var(--panel-bg-2)', color: win ? '#f59e0b' : 'var(--text-secondary)' }}>
                  {f.year} · {typeof f.place === 'number' ? `${f.place}${ord(f.place)}` : f.place}{win ? ' 🏆' : ''}
                </span>
              )
            })}
          </div>
        </section>
      ) : a.isRookie ? (
        <p className="mb-5 text-[12.5px] text-[var(--text-muted)]">2026 will be {a.name.split(' ')[0]}'s first CrossFit Games as an individual.</p>
      ) : null}

      {/* Road to the Games */}
      <section className="mb-5">
        <div className="games-condensed text-[10px] uppercase tracking-[0.16em] text-[#91C640] mb-2">Road to San Jose</div>
        <div className="flex items-stretch gap-2">
          <PathStep stage="Open" value={a.openRank2026 ? `#${a.openRank2026}` : '-'} sub="worldwide" />
          <PathStep stage="Quarterfinal" value={a.qfRank2026 ? `#${a.qfRank2026}` : '-'} sub="worldwide" />
          <PathStep stage="Semifinal" value={a.semifinalFinish2026 ? a.semifinalFinish2026.replace(/\s*\(.*\)/, '') : a.semifinalEvent2026 ? 'Qualified' : '-'} sub={a.semifinalEvent2026 ?? undefined} won={!!semiWin} />
        </div>
        <p className="mt-2 text-[10.5px] text-[var(--text-muted)]">Semifinal results are within the athlete's own event (the ~10 Semifinals aren't comparable to each other).</p>
      </section>

      {/* Latest / road to the Games - verified, cited prep notes */}
      {media?.prepNotes && media.prepNotes.length > 0 && (
        <section className="mb-6">
          <div className="games-condensed text-[10px] uppercase tracking-[0.16em] text-[#91C640] mb-2">Latest, road to the Games</div>
          <ul className="space-y-2.5">
            {media.prepNotes.map((n, i) => (
              <li key={i} className="rounded-xl p-3.5 bg-[var(--panel-bg-2)] border border-[var(--panel-border-subtle)]">
                <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{n.text}</p>
                <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#91C640] hover:underline">
                  Source: <span className="truncate max-w-[240px] inline-block align-bottom">{n.sourceTitle}</span> ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Interview */}
      <section className="mb-6">
        <div className="games-condensed text-[10px] uppercase tracking-[0.16em] text-[#91C640] mb-2">Dave Castro interview</div>
        {embed ? (
          <div className="rounded-xl overflow-hidden border border-[var(--panel-border)]" style={{ aspectRatio: '16 / 9' }}>
            <iframe src={embed} title={`${a.name} interview`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        ) : a.interviewUrl ? (
          <a href={a.interviewUrl} target="_blank" rel="noopener noreferrer" className="cap-card flex items-center gap-3 p-4">
            <span className="text-2xl">🎙️</span>
            <span className="games-condensed text-[13px] font-semibold text-[#91C640]">Watch the interview →</span>
          </a>
        ) : (
          <div className="rounded-xl p-4 text-center border border-dashed" style={{ borderColor: 'var(--panel-border)' }}>
            <div className="text-2xl mb-1 opacity-50">🎙️</div>
            <div className="games-condensed text-[12px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Interview coming</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Castro is interviewing athletes as they qualify; this slot fills when {a.name.split(' ')[0]}'s drops.</div>
          </div>
        )}
      </section>

      {/* Watch - verified videos (oEmbed-confirmed real) */}
      {media?.videos && media.videos.length > 0 && (
        <section className="mb-6">
          <div className="games-condensed text-[10px] uppercase tracking-[0.16em] text-[#91C640] mb-2">Watch</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {media.videos.map((v) => (
              <a key={v.videoId} href={v.url} target="_blank" rel="noopener noreferrer" className="cap-card group overflow-hidden block">
                <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                  <img src={youtubeThumb(v.videoId)} alt={v.title} loading="lazy" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors">
                    <span className="w-11 h-11 rounded-full bg-black/65 flex items-center justify-center text-white text-base pl-0.5">▶</span>
                  </div>
                  <span className="absolute top-2 left-2 games-chip text-[9px]" style={{ background: 'rgba(1,150,68,0.9)', color: '#fff' }}>{VIDEO_KIND_LABEL[v.kind] ?? 'Watch'}</span>
                </div>
                <div className="p-2.5">
                  <div className="text-[12.5px] font-semibold text-[var(--text-primary)] leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</div>
                  <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 truncate">{v.channel}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Follow / profile links (always show the official CrossFit profile) */}
      {(a.crossfitAthleteId || (media?.links && media.links.length > 0)) && (
        <section className="mb-6 flex flex-wrap gap-2">
          {a.crossfitAthleteId && (
            <a key="cf-official" href={`https://games.crossfit.com/athlete/${a.crossfitAthleteId}`} target="_blank" rel="noopener noreferrer" className="games-chip" style={{ background: 'var(--panel-bg-2)', color: 'var(--text-secondary)', border: '1px solid var(--panel-border)' }}>
              Official CrossFit profile ↗
            </a>
          )}
          {media?.links?.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="games-chip" style={{ background: 'var(--panel-bg-2)', color: 'var(--text-secondary)', border: '1px solid var(--panel-border)' }}>
              {l.label} ↗
            </a>
          ))}
        </section>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button onClick={() => navigate({ view: 'capacity', year: 2026 })} className="games-condensed text-[12px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] hover:text-[#91C640]">Capacity Lab →</button>
        <button onClick={() => navigate({ view: 'athlete', year: 2026, slug: next.slug })} className="games-condensed text-[12px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] hover:text-[#91C640]">Next: {next.name} →</button>
      </div>
    </div>
  )
}
