/* The speaker glyphs (DESIGN.md I.5): 16 px, stroke 1.8, currentColor. */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const BODY = 'M2.2 6.1h2.4L8 3.2v9.6L4.6 9.9H2.2z'

/** Speaker with two waves (sound on; the chip's "turn it on"). `draw` animates the waves once. */
export function IconSoundOn({ draw = false }: { draw?: boolean }) {
  return (
    <svg {...base} className={draw ? 'st-snd-ic is-draw' : 'st-snd-ic'}>
      <path d={BODY} />
      <path className="st-snd-wave" d="M10.6 5.8a3.1 3.1 0 0 1 0 4.4" pathLength={1} />
      <path className="st-snd-wave st-snd-wave--2" d="M12.4 3.9a5.8 5.8 0 0 1 0 8.2" pathLength={1} />
    </svg>
  )
}

/** Speaker with a small x (sound off). */
export function IconSoundOff() {
  return (
    <svg {...base} className="st-snd-ic">
      <path d={BODY} />
      <path d="M10.8 6.2l3.4 3.6M14.2 6.2l-3.4 3.6" />
    </svg>
  )
}
