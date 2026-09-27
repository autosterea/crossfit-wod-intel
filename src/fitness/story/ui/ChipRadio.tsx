import { useRef } from 'react'

/* =========================================================================
   <ChipRadio/>: the explore chip row as a proper radiogroup (WAI-ARIA):
   one tab stop (roving tabindex on the checked chip), Left / Right and
   Up / Down move AND select, Home / End jump. The story's stepping keys
   ignore arrows inside [role=radiogroup] (gestures.ts), so arrows here never
   leave explore. 44 px chips, horizontal scroll with edge fades (B.4).
   ========================================================================= */

export interface ChipRadioProps<T extends string> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}

export function ChipRadio<T extends string>({ label, options, value, onChange, className }: ChipRadioProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const move = (to: number) => {
    const n = options.length
    const k = ((to % n) + n) % n
    onChange(options[k].value)
    const el = refs.current[k]
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    let to = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = idx + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = idx - 1
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = options.length - 1
    else return
    e.preventDefault()
    e.stopPropagation()
    move(to)
  }
  return (
    <div className={`st-chiprow${className ? ' ' + className : ''}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(r) => void (refs.current[i] = r)}
          type="button"
          role="radio"
          aria-checked={i === idx}
          tabIndex={i === idx ? 0 : -1}
          className={`st-chip st-chip--pick${i === idx ? ' is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
