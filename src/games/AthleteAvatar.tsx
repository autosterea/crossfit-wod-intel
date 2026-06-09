import { useState } from 'react'
import { initials, monogramColor } from './athletes2026'
import type { GamesAthlete2026 } from '../types-games'

/**
 * Official CrossFit photo with a graceful monogram fallback (initials on a
 * stable per-athlete color). Falls back if the photo is missing or fails to load.
 */
export default function AthleteAvatar({
  athlete,
  size = 64,
  rounded = 'rounded-2xl',
  className = '',
}: {
  athlete: GamesAthlete2026
  size?: number
  rounded?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const showPhoto = athlete.photoUrl && !failed
  const fontSize = Math.round(size * 0.36)
  return (
    <div
      className={`${rounded} overflow-hidden shrink-0 flex items-center justify-center ${className}`}
      style={{ width: size, height: size, background: showPhoto ? 'var(--panel-bg-2)' : monogramColor(athlete.name) }}
    >
      {showPhoto ? (
        <img
          src={athlete.photoUrl ?? undefined}
          alt={athlete.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 22%' }}
        />
      ) : (
        <span className="games-display text-white" style={{ fontSize }}>
          {initials(athlete.name)}
        </span>
      )}
    </div>
  )
}
