import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { focusRect } from '../camera/focusRect'
import { useStoryStore } from '../store'
import {
  LABEL_CAP,
  labelSetVersion,
  labelTextVersion,
  obstaclesVersion,
  rectObstacles,
  registry,
  subscribeLabels,
  worldObstacles,
  type LabelEntry,
} from './registry'
import { Placer, type PlaceInput } from './place'
import type { Dir, LabelSpec, Rect } from '../types'
import { reportOnce } from '../safe'

/* =========================================================================
   The DOM label layer (DESIGN.md C.9, B.8). One absolutely positioned div
   over the canvas plus one SVG for leader lines. Nodes are created when the
   label SET changes; placement writes transforms and opacity through refs.

   The placer runs only when something could have moved (C.9 / C.16): the
   camera matrices, story time, the focus rect, the label set, a label's
   text, the obstacles, a fade in progress, or explore mode (whose damped
   state is not on the clock). It allocates nothing per frame.
   ========================================================================= */

const GAP: Record<LabelSpec['tone'], number> = { tick: 6, name: 8, callout: 12, readout: 12, legend: 0 }
const PRI: Record<LabelSpec['tone'], number> = { tick: 30, name: 60, callout: 90, readout: 85, legend: 95 }
const REQUIRED_PRIORITY = 96

let fontsReady = false
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    fontsReady = true
    for (const e of registry.values()) e.measured = ''
  })
  // A web font requested AFTER fonts.ready resolved (a label's own font face
  // is only fetched once a label using it renders) must re-measure too, or
  // pinned legends right-align on fallback-font widths.
  document.fonts.addEventListener?.('loadingdone', () => {
    for (const e of registry.values()) e.measured = ''
    labelTextVersion.v++
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
      {spec.badge && <b className="st-lbl-badge">{spec.badge}</b>}
      {(spec.tone === 'name' || spec.tone === 'legend') && spec.dot !== false && <i className="st-lbl-dot" />}
      {spec.swatches && (
        <span className="st-lbl-sw">
          {spec.swatches.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
        </span>
      )}
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

/**
 * Measure a label once per text (and shell / font state). Readouts with
 * `minChars` reserve their width, so a counting number re-measures only when
 * its length exceeds the reservation: no layout read per counted frame.
 */
function measure(e: LabelEntry): void {
  const el = e.el
  const t = e.txt
  if (!el || !t) return
  const mc = e.spec.minChars
  const textKey = mc && e.text.length <= mc ? '#' + mc : e.text
  const key = textKey + '|' + (fontsReady ? 1 : 0) + '|' + focusRect.shell
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

/** Write v into sig[k]; true when it changed. */
const put = (sig: Float64Array, k: number, v: number): boolean => {
  if (sig[k] === v) return false
  sig[k] = v
  return true
}

const _v = new THREE.Vector3()
const _c = new THREE.Vector3()

const newInput = (): PlaceInput => ({
  id: '',
  ax: 0,
  ay: 0,
  w: 0,
  h: 0,
  shortW: 0,
  gap: 0,
  prefer: 'E',
  cx: 0,
  cy: 0,
  priority: 0,
  last: null,
  leader: false,
  leaderAlways: false,
  pin: null,
  pinOrder: 0,
  only: undefined,
  sep: 0,
})

/** Project a world point to stage px into _v (x, y) and report whether it is in front. */
function projectPx(camera: THREE.Camera, x: number, y: number, z: number): boolean {
  _v.set(x, y, z)
  _c.copy(_v).applyMatrix4(camera.matrixWorldInverse)
  if (_c.z > -0.01) return false
  _v.project(camera)
  _v.x = ((_v.x + 1) / 2) * focusRect.W
  _v.y = ((1 - _v.y) / 2) * focusRect.H
  return true
}

/**
 * The union of the visible legend labels pinned top-right (stage px) and
 * their strongest opacity, for scene lines that must keep clear of the pinned
 * key's glass chips (kit/hudClip.ts). Updated on every placement pass.
 */
export const pinBox = { x: 0, y: 0, w: 0, h: 0, opacity: 0 }

/** Canvas side: the placement loop at priority -80, after the camera director. */
export function LabelPlacer() {
  const camera = useThree((s) => s.camera)
  const st = useRef({
    placer: new Placer(),
    inputs: [] as PlaceInput[],
    live: [] as LabelEntry[],
    cues: [] as number[],
    obs: [] as Rect[],
    bounds: { x: 0, y: 0, w: 0, h: 0 } as Rect,
    /** dirty-check signature */
    sig: new Float64Array(28),
    warnedLive: '',
    /** story time at the previous frame, and whether the last placement used side memory */
    lastT: Number.NaN,
    usedMemory: false,
  })

  const obsAt = (s: typeof st.current, n: number): Rect => {
    let r = s.obs[n]
    if (!r) {
      r = { x: 0, y: 0, w: 0, h: 0 }
      s.obs[n] = r
    }
    return r
  }

  useFrame((_, dtRaw) => {
    const s = st.current
    const dt = Math.min(0.1, dtRaw)
    const T = clock.T
    const layout = focusRect.layout
    const W = focusRect.W
    const H = focusRect.H
    const store = useStoryStore.getState()
    const mode = store.mode
    const snap = clock.held || store.reduced
    camera.updateMatrixWorld()

    // ---- dirty check: skip the whole placement when nothing can have moved
    const sig = s.sig
    const me = camera.matrixWorld.elements
    const pe = camera.projectionMatrix.elements
    let dirty = mode === 'explore'
    for (let k = 0; k < 16; k++) dirty = put(sig, k, me[k]) || dirty
    dirty = put(sig, 16, pe[0]) || dirty
    dirty = put(sig, 17, pe[5]) || dirty
    dirty = put(sig, 18, pe[8]) || dirty
    dirty = put(sig, 19, pe[9]) || dirty
    dirty = put(sig, 20, clock.version) || dirty
    dirty = put(sig, 21, focusRect.version) || dirty
    dirty = put(sig, 22, labelSetVersion()) || dirty
    dirty = put(sig, 23, labelTextVersion.v) || dirty
    dirty = put(sig, 24, obstaclesVersion()) || dirty
    dirty = put(sig, 25, fontsReady ? 1 : 0) || dirty
    dirty = put(sig, 26, W * 10000 + H) || dirty
    // Side memory (hysteresis, H.4) only while story time MOVES: it keeps a
    // label from flipping sides during a build or a scrub. When T comes to
    // rest, one memoryless pass lays the labels out as a pure function of T,
    // so a deep link, a seek and autoplay agree on every resting frame (H.51).
    const tMoving = T !== s.lastT
    s.lastT = T
    if (!tMoving && s.usedMemory) dirty = true
    // a fade in progress keeps placing until it settles
    for (const e of registry.values()) {
      if (e.visible && e.alpha < 1) {
        dirty = true
        break
      }
    }
    if (!dirty) return

    // ---- inputs. The placement fields of each spec (prefer, center, gapPx,
    // priority, only) are read here on every pass and never cached: chapters
    // may declare them as getters of story time (types.ts LabelSpec, H.53).
    let n = 0
    for (const e of registry.values()) {
      if (!e.el) continue
      const modeOk = e.mode === 'both' || e.mode === mode
      let vis = 0
      try {
        vis = modeOk ? (e.spec.cue ? e.spec.cue(T) : 1) : 0
      } catch (err) {
        reportOnce('label "' + e.spec.id + '" cue', err)
      }
      e.live = vis > 0.01
      if (!e.live) {
        if (e.opacity !== 0) {
          e.el.style.opacity = '0'
          e.opacity = 0
          if (e.leader) e.leader.style.opacity = '0'
        }
        e.visible = false
        e.requiredHidden = false
        continue
      }
      measure(e)
      let ax = 0
      let ay = 0
      if (!e.spec.pin) {
        let a: readonly [number, number, number]
        try {
          a = typeof e.spec.anchor === 'function' ? e.spec.anchor(T, layout) : e.spec.anchor
        } catch (err) {
          reportOnce('label "' + e.spec.id + '" anchor', err)
          e.visible = false
          continue
        }
        if (!projectPx(camera, a[0], a[1], a[2])) {
          e.visible = false
          continue
        }
        ax = _v.x
        ay = _v.y
      }
      let cx = ax
      let cy = ay + 1
      if (e.spec.prefer === 'radial' && e.spec.center) {
        if (projectPx(camera, e.spec.center[0], e.spec.center[1], e.spec.center[2])) {
          cx = _v.x
          cy = _v.y
        }
      }
      let inp = s.inputs[n]
      if (!inp) {
        inp = newInput()
        s.inputs[n] = inp
      }
      inp.id = e.spec.id
      inp.ax = ax
      inp.ay = ay
      inp.w = e.w
      inp.h = e.h
      inp.shortW = e.shortW
      inp.gap = e.spec.gapPx ?? GAP[e.spec.tone]
      inp.prefer = e.spec.prefer ?? (e.spec.tone === 'tick' ? 'S' : 'E')
      inp.cx = cx
      inp.cy = cy
      const pri = e.spec.priority ?? PRI[e.spec.tone]
      inp.priority = e.spec.required ? Math.max(REQUIRED_PRIORITY, pri) : pri
      inp.last = tMoving ? e.dir : null
      inp.leader = !!e.spec.leader
      inp.leaderAlways = e.spec.leader === 'always'
      inp.pin = e.spec.pin ?? null
      inp.pinOrder = e.spec.pinOrder ?? n
      inp.only = e.spec.only
      inp.sep = e.spec.sepPx ?? (e.spec.tone === 'tick' ? 6 : 0)
      s.live[n] = e
      s.cues[n] = vis
      n++
    }
    if (n > LABEL_CAP.live) {
      const key = String(store.def?.key) + ':' + clock.index
      if (s.warnedLive !== key) {
        s.warnedLive = key
        console.warn('[labels] ' + n + ' labels live at T ' + T.toFixed(2) + '; the cap is ' + LABEL_CAP.live + ' (C.9)')
      }
    }

    // ---- obstacles: DOM rects, then world boxes and points (projected now)
    let no = 0
    for (const fn of rectObstacles.values()) {
      const r = fn()
      if (!r || r.w <= 0 || r.h <= 0) continue
      const o = obsAt(s, no++)
      o.x = r.x
      o.y = r.y
      o.w = r.w
      o.h = r.h
    }
    // (forEach: no [key, value] entry array per obstacle per frame, C.16)
    worldObstacles.forEach(({ spec, buf }, oid) => {
      const m = spec.mode ?? 'story'
      if (m !== 'both' && m !== mode) return
      let box: ReturnType<NonNullable<typeof spec.box>> | undefined
      try {
        box = spec.box?.(T)
      } catch (err) {
        reportOnce('world obstacle "' + oid + '" box', err)
        box = null
      }
      if (box) {
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        for (let k = 0; k < 8; k++) {
          const px = box[k & 1 ? 1 : 0][0]
          const py = box[k & 2 ? 1 : 0][1]
          const pz = box[k & 4 ? 1 : 0][2]
          if (!projectPx(camera, px, py, pz)) continue
          x0 = Math.min(x0, _v.x)
          y0 = Math.min(y0, _v.y)
          x1 = Math.max(x1, _v.x)
          y1 = Math.max(y1, _v.y)
        }
        if (x1 > x0) {
          const pad = spec.padPx ?? 4
          const o = obsAt(s, no++)
          o.x = x0 - pad
          o.y = y0 - pad
          o.w = x1 - x0 + 2 * pad
          o.h = y1 - y0 + 2 * pad
        }
      }
      if (spec.points) {
        // buf holds exactly maxPoints points (default 64). Writing more (for
        // example out.set() with a longer curve) throws a RangeError: it is
        // caught here, reported once with the fix, and the obstacle is skipped.
        let cnt = 0
        try {
          cnt = Math.min(buf.length / 3, spec.points(T, buf))
        } catch (err) {
          reportOnce('world obstacle "' + oid + '" points (maxPoints is ' + buf.length / 3 + '; raise it if the chapter writes more)', err)
          cnt = 0
        }
        const rad = spec.radiusPx ?? 6
        for (let k = 0; k < cnt; k++) {
          if (!projectPx(camera, buf[k * 3], buf[k * 3 + 1], buf[k * 3 + 2])) continue
          const o = obsAt(s, no++)
          o.x = _v.x - rad
          o.y = _v.y - rad
          o.w = 2 * rad
          o.h = 2 * rad
        }
      }
    })

    s.usedMemory = tMoving
    const b = s.bounds
    b.x = focusRect.x + 8
    b.y = focusRect.y + 8
    b.w = focusRect.w - 16
    b.h = focusRect.h - 16
    const res = s.placer.place(s.inputs, n, b, s.obs, no)

    // ---- write
    for (let i = 0; i < n; i++) {
      const r = res[i]
      const e = s.live[i]
      const el = e.el
      if (!el) continue
      const vis = s.cues[i]
      // fit fade in over 120 ms (snapped when held); a label that no longer fits hides at once
      const target = r.visible ? 1 : 0
      e.alpha = snap || !r.visible ? target : Math.min(1, e.alpha + dt / 0.12)
      e.visible = r.visible
      e.requiredHidden = !!e.spec.required && !r.visible && vis > 0.5
      const op = Math.round(vis * e.alpha * 1000) / 1000
      if (r.visible) {
        const x = Math.round(r.x)
        const y = Math.round(r.y)
        if (x !== e.x || y !== e.y) {
          el.style.transform = `translate3d(${x}px, ${y}px, 0)`
          e.x = x
          e.y = y
        }
        e.rect.x = r.x
        e.rect.y = r.y
        e.rect.w = r.w
        e.rect.h = r.h
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
      e.clipped =
        r.visible &&
        (r.x < focusRect.x || r.y < focusRect.y || r.x + r.w > focusRect.x + focusRect.w || r.y + r.h > focusRect.y + focusRect.h)
      if (op !== e.opacity) {
        el.style.opacity = String(r.visible ? op : 0)
        e.opacity = r.visible ? op : 0
      }
      if (e.leader) {
        if (r.visible && r.hasLeader) {
          e.leader.setAttribute('x1', String(Math.round(r.x1)))
          e.leader.setAttribute('y1', String(Math.round(r.y1)))
          e.leader.setAttribute('x2', String(Math.round(r.x2)))
          e.leader.setAttribute('y2', String(Math.round(r.y2)))
          e.leader.style.opacity = String(0.55 * op)
        } else e.leader.style.opacity = '0'
      }
    }
    // the pinned top-right key, for lines that must stop before its chips
    let px0 = Infinity
    let py0 = Infinity
    let px1 = -Infinity
    let py1 = -Infinity
    let pop = 0
    for (let i = 0; i < n; i++) {
      const e = s.live[i]
      if (e.spec.pin !== 'top-right' || !e.visible || e.opacity <= 0.01) continue
      px0 = Math.min(px0, e.rect.x)
      py0 = Math.min(py0, e.rect.y)
      px1 = Math.max(px1, e.rect.x + e.rect.w)
      py1 = Math.max(py1, e.rect.y + e.rect.h)
      pop = Math.max(pop, e.opacity)
    }
    pinBox.opacity = pop
    if (pop > 0) {
      pinBox.x = px0
      pinBox.y = py0
      pinBox.w = px1 - px0
      pinBox.h = py1 - py0
    }
  }, -80)
  return null
}

/** QA: placed rects, with overlaps among visible labels and required labels that could not be placed. */
export function labelsSnapshot() {
  const list = [...registry.values()].map((e) => ({
    id: e.spec.id,
    tone: e.spec.tone,
    text: e.short ? e.spec.short ?? e.text : e.text,
    x: Math.round(e.rect.x),
    y: Math.round(e.rect.y),
    w: Math.round(e.rect.w),
    h: Math.round(e.rect.h),
    visible: e.visible && e.opacity > 0.01,
    opacity: e.opacity,
    clipped: e.clipped,
    live: e.live,
    required: !!e.spec.required,
    requiredHidden: e.requiredHidden,
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

/** QA: label counts against the caps (C.9, H.19). */
export function labelCounts() {
  let live = 0
  for (const e of registry.values()) if (e.live) live++
  return { registered: registry.size, live, cap: LABEL_CAP }
}
