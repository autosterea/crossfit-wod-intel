import type { NarrationClip, StoryDef } from '../types'

/* =========================================================================
   Narration clips (DESIGN.md I.3.6, I.6.5). A story's clips come from its
   own StoryDef.narration (amendment H.72: the story's generated
   narration.gen.ts); a story without it has no clip, and no sound at all.
   Durations come ONLY from that build-time manifest; nothing here decodes to
   learn a length, so story timing stays deterministic.

   Nothing is fetched before the sound gesture. A response counts only if
   res.ok AND its content-type starts with audio/ (the SPA fallback answers a
   missing MP3 with index.html and a 200). Encoded bytes are kept for the
   current and next chapter; the DECODED window is beats [n-1, n+2]. Every
   decode is decodeAudioData(bytes.slice(0)): decodeAudioData detaches the
   buffer it is given (Chrome and WebKit), and a clip that left the window is
   decoded again from the kept bytes. A fetch or decode failure disarms that
   beat at once (it runs silent, one warning).
   ========================================================================= */

export type { NarrationClip }

/** The story's clip for a beat, or null (no narration, or this beat is not narrated). */
export const clipFor = (def: Pick<StoryDef, 'narration'> | null | undefined, beat: string): NarrationClip | null => def?.narration?.[beat] ?? null

/** The story has narration: it is the only thing that gives a story sound (H.72). */
export const isNarrated = (def: Pick<StoryDef, 'narration'> | null | undefined): boolean => !!def?.narration && Object.keys(def.narration).length > 0

/**
 * The level of a mono clip playing on BOTH channels reads 3.01 dB louder than the mono file (EBU R128
 * sums the channels' power), so the voice's -16 LUFS target on the stereo reference render needs a
 * clip gain of -16 - (clip LUFS + 3.01) dB, read from the manifest (amendment H.69). Clamped to
 * [-6, +2.5] dB; narration-check keeps it inside +/-3.5 dB and the peak after it at -2.0 dBTP or lower,
 * so the limiter never touches the voice alone (I.3.4).
 */
export const DUAL_MONO_DB = 3.01
export const clipGainDb = (clip: NarrationClip): number => Math.max(-6, Math.min(2.5, -16 - (clip.lufs + DUAL_MONO_DB)))
export const makeupFor = (clip: NarrationClip): number => Math.pow(10, clipGainDb(clip) / 20)

export const urlFor = (clip: NarrationClip): string => import.meta.env.BASE_URL + clip.file

type Bytes = ArrayBuffer | null

const warned = new Set<string>()
const warnOnce = (k: string, msg: string) => {
  if (warned.has(k)) return
  warned.add(k)
  console.warn('[audio] ' + msg)
}

/** Fetch bytes, validated. Shared by the phone and the offline render. */
const bytes = new Map<string, Promise<Bytes>>()
export function fetchClip(clip: NarrationClip): Promise<Bytes> {
  const hit = bytes.get(clip.file)
  if (hit) return hit
  const p = (async (): Promise<Bytes> => {
    try {
      const res = await fetch(urlFor(clip))
      const type = res.headers.get('content-type') || ''
      if (!res.ok || !type.startsWith('audio/')) {
        warnOnce(clip.file, `narration ${clip.file}: ${res.status} ${type || 'no content-type'}; the beat runs silent`)
        return null
      }
      return await res.arrayBuffer()
    } catch (err) {
      warnOnce(clip.file, `narration ${clip.file}: fetch failed (${err instanceof Error ? err.message : String(err)}); the beat runs silent`)
      return null
    }
  })()
  bytes.set(clip.file, p)
  return p
}

/** Drop kept bytes except these files (the current and next chapter). */
export function keepBytes(files: ReadonlySet<string>): void {
  for (const k of [...bytes.keys()]) if (!files.has(k)) bytes.delete(k)
}

export type ClipState = { s: 'none' } | { s: 'loading' } | { s: 'ready'; buf: AudioBuffer } | { s: 'failed' }

/** Decoded clips for one context. */
export class ClipCache {
  private ctx: BaseAudioContext
  private decoded = new Map<string, AudioBuffer>()
  private pending = new Map<string, Promise<AudioBuffer | null>>()
  private failed = new Set<string>()

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx
  }

  state(clip: NarrationClip): ClipState {
    const b = this.decoded.get(clip.file)
    if (b) return { s: 'ready', buf: b }
    if (this.failed.has(clip.file)) return { s: 'failed' }
    if (this.pending.has(clip.file)) return { s: 'loading' }
    return { s: 'none' }
  }

  /** Start fetching and decoding (no-op when ready, loading or failed). */
  load(clip: NarrationClip): Promise<AudioBuffer | null> {
    const b = this.decoded.get(clip.file)
    if (b) return Promise.resolve(b)
    if (this.failed.has(clip.file)) return Promise.resolve(null)
    const hit = this.pending.get(clip.file)
    if (hit) return hit
    const p = (async () => {
      const raw = await fetchClip(clip)
      if (!raw) {
        this.failed.add(clip.file)
        return null
      }
      try {
        const buf = await this.ctx.decodeAudioData(raw.slice(0))
        this.decoded.set(clip.file, buf)
        return buf
      } catch (err) {
        this.failed.add(clip.file)
        warnOnce('dec:' + clip.file, `narration ${clip.file}: decode failed (${err instanceof Error ? err.message : String(err)}); the beat runs silent`)
        return null
      } finally {
        this.pending.delete(clip.file)
      }
    })()
    this.pending.set(clip.file, p)
    return p
  }

  /** Keep decoded buffers only for these files (the [n-1, n+2] window). */
  retain(files: ReadonlySet<string>): void {
    for (const k of [...this.decoded.keys()]) if (!files.has(k)) this.decoded.delete(k)
  }
}
