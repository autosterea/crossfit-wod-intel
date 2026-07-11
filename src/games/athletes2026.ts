import rawAthletes from '../data/games/athletes-2026.json'
import rawMedia from '../data/games/athletes-2026-media.json'
import type { Athletes2026Data, GamesAthlete2026, AthleteMedia, AthleteMediaMap } from '../types-games'

export const A2026: Athletes2026Data = rawAthletes as unknown as Athletes2026Data

export const allAthletes2026: GamesAthlete2026[] = [...A2026.men, ...A2026.women]
export const athleteBySlug = new Map(allAthletes2026.map((a) => [a.slug, a]))

/** Verified per-athlete media (videos + cited prep notes), keyed by slug. */
export const ATHLETE_MEDIA: AthleteMediaMap = rawMedia as unknown as AthleteMediaMap
export const mediaForAthlete = (slug: string): AthleteMedia | undefined => ATHLETE_MEDIA[slug]

/** YouTube thumbnail URL for a video id (no extra request to verify - the id
 *  is already oEmbed-confirmed when it reaches here). */
export const youtubeThumb = (videoId: string): string => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

/** Short human label for a video kind. */
export const VIDEO_KIND_LABEL: Record<string, string> = {
  interview: 'Interview',
  'road-to-games': 'Road to the Games',
  training: 'Training',
  feature: 'Feature',
  competition: 'Competition',
  podcast: 'Podcast',
  profile: 'Profile',
  other: 'Watch',
}

/** Country name -> ISO2 (for flag emoji) for the nations present in the field. */
const COUNTRY_ISO: Record<string, string> = {
  USA: 'US',
  'United States': 'US',
  Canada: 'CA',
  Australia: 'AU',
  'United Kingdom': 'GB',
  France: 'FR',
  Germany: 'DE',
  Finland: 'FI',
  Georgia: 'GE',
  Spain: 'ES',
  Brazil: 'BR',
  Chile: 'CL',
  'New Zealand': 'NZ',
  Switzerland: 'CH',
  Albania: 'AL',
  Italy: 'IT',
  Poland: 'PL',
  Ireland: 'IE',
  Russia: 'RU',
  Norway: 'NO',
  Iceland: 'IS',
}

export function countryFlag(country: string | null): string {
  if (!country) return ''
  const iso = COUNTRY_ISO[country]
  if (!iso) return ''
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)))
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

/** Stable color from a name, for monogram backgrounds. */
export function monogramColor(name: string): string {
  const palette = ['#019644', '#0e7a52', '#147a6e', '#1f6f8b', '#3a5f9e', '#5b4f9e', '#7a4a86', '#8b5a2b', '#6b7a2b']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

/** YouTube embed URL from a watch/share/shorts/youtu.be URL, else null. */
export function youtubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null
  const m =
    url.match(/[?&]v=([\w-]{6,})/) ||
    url.match(/youtu\.be\/([\w-]{6,})/) ||
    url.match(/\/shorts\/([\w-]{6,})/) ||
    url.match(/\/embed\/([\w-]{6,})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

export const FIELD_2026 = {
  total: 30,
  inPerson: 23,
  online: 7,
}
