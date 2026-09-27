import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { focus } from '../camera/focusRect'
import { useStoryStore } from '../store'
import { labelSetVersion, obstacleRects, registry, subscribeLabels, type LabelEntry } from './registry'
import { placeLabels, type PlaceInput } from './place'
import type { Dir, LabelSpec, Rect } from '../types'

/* =========================================================================
   The DOM label layer (DESIGN.md C.9, B.8). One absolutely positioned div
   over the canvas plus one SVG for leader lines. Nodes are created when the
   label SET changes; placement writes transforms and opacity through refs.
   ========================================================================= */

const GAP: Record<LabelSpec['tone'], number> = { tick: 6, name: 8, callout: 12, readout: 12, legend: 0 }
const PRI: Record<LabelSpec['tone'], number> = { tick: 30, name: 60, callout: 90, readout: 85, legend: 95 }

let fontsReady = false
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    fontsReady = true
    for (const e of registry.values()) e.measured = ''
  })
}

function LabelNode({ e }: { e: LabelEntry }) {
  const ref = useRef<HTMLDivElement>(null)
  const txt = useRef<HTMLSpanElement>(null)
  const { spec } = e
  useLayoutEffect(() => {
    e.el = ref.current
    e.txt = txt.current
    e.measured = ''
    e.opacity = -1
    e.x = -9999
    return () => {
      if (e.el === ref.current) {
        e.el = null
        e.txt = null
      }
    }
  }, [e])
  const style: React.CSSProperties & Record<string, string> = { '--c': spec.color ?? '#eef3f6' }
  return (
    <div
      ref={ref}
      className={`st-lbl st-lbl--${spec.tone}${spec.size === 'sm' ? ' st-lbl--sm' : ''}`}
      data-label={spec.id}
      style={style}
      aria-hidden="true"
    >
      {(spec.tone === 'name' || spec.tone === 'legend') && spec.dot !== false && <i className="st-lbl-dot" />}
      <span ref={txt} className="st-lbl-t" style={spec.minChars ? { minWidth: `${spec.minChars}ch` } : undefined}>
        {e.text}
      </span>
    </div>
  )
}

function LeaderLine({ e }: { e: LabelEntry }) {
  const ref = useRef<SVGLineElement>(null)
  useLayoutEffect(() => {
    e.leader = ref.current
    return () => {
      if (e.leader === ref.current) e.leader = null
    }
  }, [e])
  return <line ref={ref} x1={0} y1={0} x2={0} y2={0} style={{ opacity: 0 }} />
}

/** DOM side: re-renders only when the label set changes. */
export function LabelLayer() {
  useSyncExternalStore(subscribeLabels, labelSetVersion)
  const entries = [...registry.values()]
  return (
    <>
      <svg className="st-leaders" aria-hidden="true">
        {entries.filter((e) => e.spec.leader).map((e) => (
          <LeaderLine key={e.spec.id} e={e} />
        ))}
      </svg>
      <div className="st-labels" aria-hidden="true">
        {entries.map((e) => (
          <LabelNode key={e.spec.id} e={e} />
        ))}
      </div>
    </>
  )
}

function measure(e: LabelEntry): void {
  const el = e.el
  const t = e.txt
  if (!el || !t) return
  const key = e.text + '|' + (fontsReady ? 1 : 0) + '|' + focus.shell
  if (e.measured === key) return
  t.textContent = e.text
  e.w = el.offsetWidth
  e.h = el.offsetHeight
  if (e.spec.short) {
    t.textContent = e.spec.short
    e.shortW = el.offsetWidth
    t.textContent = e.short ? e.spec.short : e.text
  } else e.shortW = 0
  e.measured = key
}

const _v = new THREE.Vector3()
const _c = new THREE.Vector3()

/** Canvas side: the placement loop at priority -80, after the camera director. */
export function LabelPlacer() {
  const camera = useThree((s) => s.camera)
  const inputs = useRef<PlaceInput[]>([])
  const live = useRef<LabelEntry[]>([])
  const cues = useRef<number[]>([])

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.1, dtRaw)
    const T = clock.T
    const layout = focus.layout
    const W = focus.W
    const H = focus.H
    const st = useStoryStore.getState()
    const snap = clock.held || st.reduced
    inputs.current.length = 0
    live.current.length = 0
    cues.current.length = 0
    camera.updateMatrixWorld()
    for (const e of registry.values()) {
      if (!e.el) continue
      const vis = e.spec.cue ? e.spec.cue(T) : 1
      if (vis <= 0.01) {
        if (e.opacity !== 0) {
          e.el.style.opacity = '0'
          e.opacity = 0
          if (e.leader) e.leader.style.opacity = '0'
        }
        e.visible = false
        continue
      }
      measure(e)
      let ax = 0
      let ay = 0
      let behind = false
      let pinned: { x: number; y: number } | null = null
      if (e.spec.pin) {
        pinned = { x: e.spec.pin === 'top-left' ? focus.x + 8 : focus.x + focus.w - 8 - e.w, y: focus.y + 8 }
      } else {
        const a = typeof e.spec.anchor === 'function' ? e.spec.anchor(T, layout) : e.spec.anchor
        _v.set(a[0], a[1], a[2])
        _c.copy(_v).applyMatrix4(camera.matrixWorldInverse)
        behind = _c.z > -0.01
        _v.project(camera)
        ax = ((_v.x + 1) / 2) * W
        ay = ((1 - _v.y) / 2) * H
      }
      if (behind) continue
      let cx: number | undefined
      let cy: number | undefined
      if (e.spec.prefer === 'radial' && e.spec.center) {
        _v.set(e.spec.center[0], e.spec.center[1], e.spec.center[2]).project(camera)
        cx = ((_v.x + 1) / 2) * W
        cy = ((1 - _v.y) / 2) * H
      }
      inputs.current.push({
        id: e.spec.id,
        ax,
        ay,
        w: e.w,
        h: e.h,
        shortW: e.shortW,
        gap: e.spec.gapPx ?? GAP[e.spec.tone],
        prefer: e.spec.prefer ?? (e.spec.tone === 'tick' ? 'S' : 'E'),
        cx,
        cy,
        priority: e.spec.priority ?? PRI[e.spec.tone],
        last: e.dir,
        leader: !!e.spec.leader,
        pinned,
        only: e.spec.only,
      })
      live.current.push(e)
      cues.current.push(vis)
    }
    const bounds: Rect = { x: focus.x + 8, y: focus.y + 8, w: focus.w - 16, h: focus.h - 16 }
    const res = placeLabels(inputs.current, bounds, obstacleRects())
    for (let i = 0; i < res.length; i++) {
      const r = res[i]
      const e = live.current[i]
      const el = e.el
      if (!el) continue
      const vis = cues.current[i]
      // fit fade in over 120 ms (snapped when held); a label that no longer fits hides at once
      const target = r.visible ? 1 : 0
      e.alpha = snap || !r.visible ? target : Math.min(1, e.alpha + dt / 0.12)
      e.visible = r.visible
      const op = Math.round(vis * e.alpha * 1000) / 1000
      if (r.visible) {
        const x = Math.round(r.x)
        const y = Math.round(r.y)
        if (x !== e.x || y !== e.y) {
          el.style.transform = `translate3d(${x}px, ${y}px, 0)`
          e.x = x
          e.y = y
        }
        e.rect = { x: r.x, y: r.y, w: r.w, h: r.h }
        if (r.dir !== e.dir) {
          const flip = r.dir === 'W' || r.dir === 'NW' || r.dir === 'SW'
          el.classList.toggle('is-flip', flip)
          e.dir = r.dir as Dir
        }
        if (r.short !== e.short && e.txt) {
          e.short = r.short
          e.txt.textContent = r.short ? e.spec.short ?? e.text : e.text
        }
      }
      const clipped = r.visible && (r.x < focus.x || r.y < focus.y || r.x + r.w > focus.x + focus.w || r.y + r.h > focus.y + focus.h)
      e.clipped = clipped
      if (op !== e.opacity) {
        el.style.opacity = String(r.visible ? op : 0)
        e.opacity = r.visible ? op : 0
      }
      if (e.leader) {
        if (r.visible && r.leader) {
          e.leader.setAttribute('x1', String(Math.round(r.leader.x1)))
          e.leader.setAttribute('y1', String(Math.round(r.leader.y1)))
          e.leader.setAttribute('x2', String(Math.round(r.leader.x2)))
          e.leader.setAttribute('y2', String(Math.round(r.leader.y2)))
          e.leader.style.opacity = String(0.5 * op)
        } else e.leader.style.opacity = '0'
      }
    }
  }, -80)
  return null
}

/** QA: placed rects, with overlaps among visible labels. */
export function labelsSnapshot() {
  const list = [...registry.values()].map((e) => ({
    id: e.spec.id,
    text: e.short ? e.spec.short ?? e.text : e.text,
    x: Math.round(e.rect.x),
    y: Math.round(e.rect.y),
    w: Math.round(e.rect.w),
    h: Math.round(e.rect.h),
    visible: e.visible && e.opacity > 0.01,
    opacity: e.opacity,
    clipped: e.clipped,
    overlaps: [] as string[],
  }))
  for (const a of list) {
    if (!a.visible) continue
    for (const b of list) {
      if (a === b || !b.visible) continue
      if (a.x < b.x + b.w - 2 && a.x + a.w > b.x + 2 && a.y < b.y + b.h - 2 && a.y + a.h > b.y + 2) a.overlaps.push(b.id)
    }
  }
  return list
}
