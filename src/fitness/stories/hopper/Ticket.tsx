import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HOPPER_DOMAINS, PAL } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { SdfText } from '../../story/kit/SdfText'
import { Pen, PEN } from '../../story/kit/Pen'
import { bumpObstacles, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box } from '../../story/types'
import { ticketOutline, type World } from './layout'
import { boardAt, type Sched } from './timeline'

/* =========================================================================
   The ticket (DESIGN.md D.3, the one broadcast element kept besides the HUD):
   a plate in the DRAWN domain's colour with a notch in each short side (the
   drawn ball comes to rest in one), the kicker "DRAW N - DOMAIN" in Barlow
   Condensed SemiBold and the task name in Anton, both in ink. It flips like
   a split-flap card: the old face turns away edge-on, the new one turns in
   and snaps flat. In the H5 rain it shrinks to a small flick card that shows
   only the domain.

   SDF words are the only 3D text in this chapter (D.3 "SDF"). Every face is
   mounted at load (prewarm) and shown by opacity; nothing re-lays text per
   frame. The kicker's hyphen is a small ink bar: the self-hosted SDF glyph
   whitelist has no "-" (engine request), and troika must never fetch a
   fallback font.
   ========================================================================= */

const INK = PAL.ink
const LIGHT = '#e9ffc4'
const STORY_FACES = 5

const widths = new Map<string, number>()
const syncWidth = (key: string) => (m: THREE.Mesh) => {
  const info = (m as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo
  if (!info) return
  const [x0, , x1] = info.blockBounds
  widths.set(key, x1 - x0)
  bumpObstacles()
}

export interface TicketProps {
  w: World
  src: (T: number) => { s: Sched; X: number; story: boolean }
  /** overall light 0..1 (focus pull, the H6 step back) */
  vis: (T: number) => number
  /** 0 full ticket, 1 the small flick card */
  shrink: (T: number) => number
  /** H1: the pen traces the border once (progress, and its fade) */
  trace: (T: number) => number
  traceOut: (T: number) => number
  railLen: number
}

export function Ticket({ w, src, vis, shrink, trace, traceOut, railLen }: TicketProps) {
  const t = w.ticket
  const outline = useMemo(() => ticketOutline(t.w, t.h, t.notch), [t.w, t.h, t.notch])
  const plateGeo = useMemo(() => {
    const s = new THREE.Shape()
    for (let i = 0; i < outline.length / 3 - 1; i++) {
      const x = outline[i * 3]
      const y = outline[i * 3 + 1]
      if (i === 0) s.moveTo(x, y)
      else s.lineTo(x, y)
    }
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [outline])
  const plateMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.weightlifting, transparent: true, depthWrite: false, toneMapped: false }), [])
  const inkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: INK, transparent: true, depthWrite: false, toneMapped: false }), [])
  const barGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(() => () => plateGeo.dispose(), [plateGeo])
  useEffect(() => () => plateMat.dispose(), [plateMat])
  useEffect(() => () => inkMat.dispose(), [inkMat])
  useEffect(() => () => barGeo.dispose(), [barGeo])
  const colors = useMemo(() => HOPPER_DOMAINS.map((d) => new THREE.Color(d.color)), [])

  const group = useRef<THREE.Group>(null)
  const kicker = useRef<THREE.Group>(null)
  const hyphen = useRef<THREE.Mesh>(null)
  const drawG = useRef<(THREE.Group | null)[]>([])
  const domG = useRef<(THREE.Group | null)[]>([])

  // what the ticket shows at T: a pure function of T, cached per T, so the
  // plate (this component's frame) and every SdfText (their own frames) agree
  const cur = useRef({ T: NaN, X: NaN, v: -1, s: null as Sched | null, face: 0, dom: -1, task: -1, kind: 0, story: false, op: 0, turn: 0 })
  const info = (T: number) => {
    const { s, X, story } = src(T)
    const c = cur.current
    if (c.T === T && c.X === X && c.s === s && c.v === s.version) return c
    c.T = T
    c.X = X
    c.s = s
    c.v = s.version
    const b = boardAt(s, X, railLen)
    c.face = b.face
    c.turn = b.faceTurn
    c.op = vis(T)
    if (b.face > 0) {
      const d = b.face - 1
      c.dom = s.run.dom[d]
      c.task = c.dom * 5 + s.run.task[d]
      c.kind = s.kind[d]
      c.story = story && d < STORY_FACES && c.kind === 0
    }
    return c
  }

  const kickY = t.h / 2 - 0.1 - t.kick * 0.52
  const nameY = -0.2 * (t.h / 1.6)
  const gap = t.kick * 0.32
  const hy = { w: t.kick * 0.62, h: t.kick * 0.13 }

  useSafeFrame('hopper ticket', (T) => {
    const g = group.current
    if (!g) return
    const c = info(T)
    const op = c.op
    g.visible = c.face > 0 && op > 0.002
    if (!g.visible) return
    const d = c.face - 1
    const k = shrink(T)
    const sc = 1 - 0.2 * k
    g.scale.setScalar(sc)
    g.position.set(t.c[0], t.c[1] + 0.25 * k, t.c[2])
    g.rotation.x = c.turn
    plateMat.color.copy(colors[c.dom])
    plateMat.opacity = op
    inkMat.opacity = Math.min(1, op * 1.3)
    // kicker layout from the laid-out widths (troika block bounds)
    const kg = kicker.current
    if (kg) {
      const domKey = 'dom' + c.dom
      const wm = widths.get(domKey) ?? 0
      if (c.kind === 1) {
        // the flick card: the domain word alone, as large as the plate allows, centred
        const s2 = wm > 0 ? Math.min(1.6, (t.w - 2 * t.notch - 0.4) / wm) : 1.4
        kg.scale.setScalar(s2)
        kg.position.set((-wm / 2) * s2, 0, 0.02)
      } else {
        kg.scale.setScalar(1)
        kg.position.set(0, kickY, 0.02)
      }
      let x0 = -wm / 2
      if (c.story) {
        const wd = widths.get('draw' + d) ?? 0
        const total = wd + gap * 2 + hy.w + wm
        x0 = c.kind === 1 ? 0 : -total / 2
        const dg = drawG.current[d]
        if (dg) dg.position.set(x0, 0, 0)
        if (hyphen.current) {
          hyphen.current.position.set(x0 + wd + gap + hy.w / 2, t.kick * 0.05, 0.01)
          hyphen.current.visible = wd > 0
        }
        x0 += wd + gap * 2 + hy.w
      } else if (hyphen.current) hyphen.current.visible = false
      if (c.kind === 1) x0 = 0
      const mg = domG.current[c.dom]
      if (mg) mg.position.set(x0, 0, 0)
    }
  }, { hide: group })

  const textOp = (kind: 'draw' | 'dom' | 'task', i: number) => (T: number) => {
    const c = info(T)
    if (c.face === 0) return 0
    if (kind === 'draw') return c.story && c.face - 1 === i ? c.op : 0
    if (kind === 'dom') return c.dom === i ? c.op : 0
    return c.kind === 0 && c.task === i ? c.op : 0
  }

  // the ticket is a label obstacle (DOM labels never sit on it)
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      box: (T): Box | null => {
        const g = group.current
        if (!g || !g.visible) return null
        const k = 1 - 0.2 * shrink(T)
        return [
          [t.c[0] - (t.w / 2) * k, g.position.y - (t.h / 2) * k, t.c[2]],
          [t.c[0] + (t.w / 2) * k, g.position.y + (t.h / 2) * k, t.c[2]],
        ]
      },
      padPx: 4,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, shrink],
  )
  useWorldObstacle('hop-ticket', obstacle)

  return (
    <group ref={group}>
      <mesh geometry={plateGeo} material={inkMat} renderOrder={43} scale={[1 + 0.08 / t.w, 1 + 0.08 / t.h, 1]} position={[0, 0, -0.01]} />
      <mesh geometry={plateGeo} material={plateMat} renderOrder={44} />
      <group ref={kicker}>
        {Array.from({ length: STORY_FACES }, (_, i) => (
          <group key={'d' + i} ref={(el) => void (drawG.current[i] = el)}>
            <SdfText
              font="barlowSemi"
              text={`DRAW ${i + 1}`}
              size={t.kick}
              color={INK}
              anchorX="left"
              letterSpacing={0.06}
              position={[0, 0, 0.01]}
              opacity={textOp('draw', i)}
              renderOrder={46}
              onSync={syncWidth('draw' + i)}
            />
          </group>
        ))}
        <mesh ref={hyphen} geometry={barGeo} material={inkMat} renderOrder={46} scale={[hy.w, hy.h, 1]} />
        {HOPPER_DOMAINS.map((dm, i) => (
          <group key={dm.key} ref={(el) => void (domG.current[i] = el)}>
            <SdfText
              font="barlowSemi"
              text={dm.label.toUpperCase()}
              size={t.kick}
              color={INK}
              anchorX="left"
              letterSpacing={0.06}
              position={[0, 0, 0.01]}
              opacity={textOp('dom', i)}
              renderOrder={46}
              onSync={syncWidth('dom' + i)}
            />
          </group>
        ))}
      </group>
      {HOPPER_DOMAINS.flatMap((dm, i) =>
        dm.tasks.map((task, j) => (
          <SdfText
            key={dm.key + j}
            font="anton"
            text={task.toUpperCase()}
            size={t.name}
            maxWidth={Math.min(t.maxW, t.w - 2 * t.notch - 0.35)}
            lineHeight={0.98}
            color={INK}
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            letterSpacing={0.02}
            position={[0, nameY, 0.01]}
            opacity={textOp('task', i * 5 + j)}
            renderOrder={46}
          />
        )),
      )}
      <Pen points={outline} color={LIGHT} width={PEN.axis} head hot progress={trace} opacity={traceOut} gain={() => 1.3} renderOrder={47} />
    </group>
  )
}

