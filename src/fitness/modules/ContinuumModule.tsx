import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  BIOMARKERS,
  CONTINUUM_EXAMPLES,
  CONTINUUM_PROFILES,
  MODULE_COPY,
  PAL,
  markerValueAt,
  moduleByKey,
  spectrum,
  spectrumCss,
} from '../fitnessData'
import { clamp, lerp, prefersReducedMotion, smoothK } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, PresetButtons, ControlHead, Readout, Slider } from '../ui'

/* =========================================================================
   Module 05 - The Sickness, Wellness, Fitness Continuum.

   REDESIGN (2026-06-11): the coach found the old ten-parallel-lanes layout
   too crowded (labels stacked on top of each other, readable only from
   overhead) and disliked the auto-rotation. This rebuilds it as a RADIAL
   "fitness dial": the ten L1 biomarkers fan out as spokes around straight
   up, CENTER = sickness, RIM = fitness. Concentric zone bands (sick / well /
   fit thirds) read like a gauge; each marker's value rides its spoke as a
   glowing dot, and the ten dots are joined into a translucent radar polygon
   ("the person"). Pushing markers toward fitness inflates that shape toward
   the rim. A central orb + a sweeping arc + the state WORD (SICK / WELL /
   FIT / ROBUST) report the overall score. The dial faces the camera head-on
   (no orbiting needed) and the stage no longer auto-rotates.

   Per-frame morphing is done by mutating refs in useFrame; React state only
   holds the per-marker TARGET positions that the controls write.
   ========================================================================= */

const N = BIOMARKERS.length

/** Dial geometry (in the plane of the dial; world units). */
const R_RIM = 9.4 // radius of the fitness rim
const R_HUB = 0.7 // inner dead-zone radius around the sickness center
const FAN_DEG = 200 // total fan angle the ten spokes spread across
const TILT = -0.32 // small backward tilt (radians) so it reads as 3D, still head-on
const LABEL_GAP = 2.2 // how far past the rim each spoke label's anchor sits

/** Spoke index -> angle (radians) measured from +Y (straight up), spread
 *  symmetrically across the fan so the two end spokes never touch.            */
function spokeAngle(i: number): number {
  const half = (FAN_DEG * Math.PI) / 180 / 2
  const t = N <= 1 ? 0.5 : i / (N - 1)
  return lerp(-half, half, t)
}

/** Position 0..1 along a spoke -> radius from center. */
const radiusOf = (pos: number): number => lerp(R_HUB, R_RIM, clamp(pos, 0, 1))

/** Spoke angle + position -> [x, y] in the dial plane (y up, x right). */
function pointOn(i: number, pos: number): [number, number] {
  const a = spokeAngle(i)
  const r = radiusOf(pos)
  // angle measured from +Y, positive toward +X
  return [Math.sin(a) * r, Math.cos(a) * r]
}

interface StateWord {
  word: string
  css: string
  t: number
}

/** Overall mean toward fitness -> the patient's one-word state (L1 banding). */
function stateWord(avg: number): StateWord {
  if (avg < 0.33) return { word: 'SICK', css: PAL.sick, t: 0.0 }
  if (avg < 0.62) return { word: 'WELL', css: PAL.well, t: 0.5 }
  if (avg < 0.88) return { word: 'FIT', css: PAL.fit, t: 0.82 }
  return { word: 'ROBUST', css: PAL.robust, t: 1.0 }
}

/** Format an interpolated marker value with sensible precision for its unit. */
function fmtMarker(value: number, unit: string): string {
  const abs = Math.abs(value)
  let v: string
  if (unit === 'T-score' || unit === 'x BW deadlift') v = value.toFixed(2)
  else if (abs >= 100) v = Math.round(value).toString()
  else if (abs >= 10) v = value.toFixed(0)
  else v = value.toFixed(1)
  return `${v} ${unit}`
}

/* ---------------------------------------------------------------------------
   makeLabel: renders crisp text onto a CanvasTexture sprite so no CDN font is
   loaded. Used for the zone band labels at the foot of the dial.
--------------------------------------------------------------------------- */
interface LabelOpts {
  fontPx?: number
  worldHeight?: number
  color?: string
  bg?: string
  weight?: number
  pad?: number
}

function makeLabelTexture(text: string, opts: LabelOpts): { texture: THREE.CanvasTexture; aspect: number } {
  const fontPx = opts.fontPx ?? 40
  const weight = opts.weight ?? 800
  const bg = opts.bg ?? 'rgba(7,10,14,0.72)'
  const pad = opts.pad ?? 0.42
  // Supersample (SS) on top of DPR for crisp text at any zoom on a phone.
  const ss = Math.min(3, (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) * 1.5)
  const measure = document.createElement('canvas').getContext('2d')!
  const font = `${weight} ${fontPx}px Poppins, system-ui, sans-serif`
  measure.font = font
  const textW = measure.measureText(text).width
  const padPx = fontPx * pad
  const w = Math.ceil(textW + padPx * 2)
  const h = Math.ceil(fontPx * 1.45 + padPx * 1.2)

  const cnv = document.createElement('canvas')
  cnv.width = Math.max(2, Math.round(w * ss))
  cnv.height = Math.max(2, Math.round(h * ss))
  const ctx = cnv.getContext('2d')!
  ctx.scale(ss, ss)

  // rounded pill background for maximum legibility
  const r = h * 0.34
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
  ctx.fill()
  // hairline edge to lift the pill off dark scenery
  ctx.lineWidth = Math.max(1, fontPx * 0.035)
  ctx.strokeStyle = 'rgba(238,243,246,0.16)'
  ctx.stroke()

  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = opts.color ?? '#eef3f6'
  ctx.fillText(text, w / 2, h / 2 + fontPx * 0.04)

  const texture = new THREE.CanvasTexture(cnv)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return { texture, aspect: w / h }
}

/** A billboard text label backed by a CanvasTexture sprite (self-contained). */
function SpriteLabel({
  text,
  worldHeight = 0.8,
  color,
  bg,
  fontPx = 40,
  weight = 800,
  renderOrder = 10,
}: {
  text: string
  worldHeight?: number
  color?: string
  bg?: string
  fontPx?: number
  weight?: number
  renderOrder?: number
}) {
  const { texture, aspect } = useMemo(
    () => makeLabelTexture(text, { fontPx, worldHeight, color, bg, weight }),
    [text, fontPx, worldHeight, color, bg, weight],
  )
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite scale={[worldHeight * aspect, worldHeight, 1]} renderOrder={renderOrder}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

/* ---------------------------------------------------------------------------
   The concentric zone-band texture: a radial sick -> well -> fit gradient on a
   ring, with faint divider arcs at the 1/3 and 2/3 boundaries. Drawn once and
   mapped onto a ring geometry that fills the dial face.
--------------------------------------------------------------------------- */
function useDialTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const size = 512
    const cnv = document.createElement('canvas')
    cnv.width = size
    cnv.height = size
    const ctx = cnv.getContext('2d')!
    const cx = size / 2
    const cy = size / 2
    const rOuter = size / 2

    // radial spectrum: center = sick (red), rim = fit (green)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter)
    grad.addColorStop(0, PAL.sick)
    grad.addColorStop(0.33, PAL.sick)
    grad.addColorStop(0.5, PAL.well)
    grad.addColorStop(0.66, PAL.well)
    grad.addColorStop(1, PAL.fit)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2)
    ctx.fill()

    // faint zone boundary rings at the 1/3 and 2/3 radii
    ctx.strokeStyle = 'rgba(7,10,14,0.4)'
    ctx.lineWidth = size * 0.006
    for (const f of [1 / 3, 2 / 3]) {
      ctx.beginPath()
      ctx.arc(cx, cy, rOuter * f, 0, Math.PI * 2)
      ctx.stroke()
    }

    const tex = new THREE.CanvasTexture(cnv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [])
}

interface SceneProps {
  /** Per-marker target position toward fitness, 0..1, in BIOMARKERS order. */
  targets: number[]
  /** Called each settle frame with the live (eased) positions + overall mean. */
  onLive: (positions: number[], avg: number) => void
}

/* ---------------------------------------------------------------------------
   One spoke: a thin guide line from hub to rim, the marker's glowing dot at
   radius = position, and a billboarded <Html> label at the outer end carrying
   the marker NAME + live VALUE. Labels fan around the arc so they never
   overlap; the dot + its color are driven imperatively in useFrame.
--------------------------------------------------------------------------- */
function MarkerSpoke({
  index,
  initPos,
  setDot,
  setMat,
}: {
  index: number
  initPos: number
  setDot: (index: number, g: THREE.Group | null) => void
  setMat: (index: number, mat: THREE.MeshStandardMaterial | null) => void
}) {
  const m = BIOMARKERS[index]
  const a = spokeAngle(index)
  const initCol = useMemo(() => {
    const [r, g, b] = spectrum(initPos)
    return new THREE.Color(r, g, b)
  }, [initPos])

  // Guide line geometry from hub to rim along this spoke.
  const lineGeom = useMemo(() => {
    const p0 = pointOn(index, 0)
    const p1 = pointOn(index, 1)
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([p0[0], p0[1], 0, p1[0], p1[1], 0], 3),
    )
    return g
  }, [index])
  useEffect(() => () => lineGeom.dispose(), [lineGeom])

  // Where the label sits: centered on an anchor just past the rim, fanned along
  // the spoke so the ten pills spread around the arc and never overlap.
  const [lx, ly] = pointOn(index, 1)
  const labelR = R_RIM + LABEL_GAP
  const labelX = Math.sin(a) * labelR
  const labelY = Math.cos(a) * labelR
  const initLabelCss = spectrumCss(initPos)

  const [dotX, dotY] = pointOn(index, initPos)

  return (
    <group>
      {/* spoke guide line */}
      <line>
        <primitive object={lineGeom} attach="geometry" />
        <lineBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </line>

      {/* tiny rim cap so the spoke reads as a tick on the fitness rim */}
      <mesh position={[lx, ly, 0]}>
        <circleGeometry args={[0.12, 18]} />
        <meshBasicMaterial color="#cdd8d2" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* the person's glowing dot, positioned/recolored each frame in useFrame */}
      <group
        ref={(g) => {
          setDot(index, g)
        }}
        position={[dotX, dotY, 0.12]}
      >
        {/* halo */}
        <mesh>
          <sphereGeometry args={[0.5, 22, 22]} />
          <meshBasicMaterial color={initCol} transparent opacity={0.16} toneMapped={false} depthWrite={false} />
        </mesh>
        {/* the marker sphere */}
        <mesh castShadow>
          <sphereGeometry args={[0.32, 28, 28]} />
          <meshStandardMaterial
            ref={(mat) => {
              setMat(index, mat)
            }}
            color={initCol}
            emissive={initCol}
            emissiveIntensity={0.6}
            roughness={0.3}
            metalness={0.18}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* marker NAME + live VALUE at the spoke's outer end. Styled to match the
          10-Physical-Skills SkillLabels gold standard: a rounded dark pill,
          1px border keyed to spectrum(position), a small colored dot, Barlow
          Condensed bold uppercase. Bigger + crisper than before; fanned so the
          ten pills never overlap. zIndexRange [20,0] keeps it below the panels. */}
      <Html
        position={[labelX, labelY, 0]}
        center
        distanceFactor={30}
        occlude={false}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[20, 0]}
      >
        <div
          data-marker-pill={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '6px 13px',
            borderRadius: 14,
            whiteSpace: 'nowrap',
            background: 'rgba(7, 10, 14, 0.92)',
            border: `1px solid ${initLabelCss}`,
            boxShadow: '0 3px 12px rgba(0,0,0,0.6)',
            fontFamily: '"Barlow Condensed", Poppins, sans-serif',
            color: PAL.chalk,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span
              data-marker-dot={index}
              style={{ width: 9, height: 9, borderRadius: '50%', background: initLabelCss, flex: 'none' }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {m.name}
            </span>
          </span>
          <span
            data-marker-value={index}
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              color: initLabelCss,
            }}
          >
            {fmtMarker(markerValueAt(m, initPos), m.unit)}
          </span>
        </div>
      </Html>
    </group>
  )
}

function ContinuumScene({ targets, onLive }: SceneProps) {
  const reduced = prefersReducedMotion()
  const dialTex = useDialTexture()
  useEffect(() => () => dialTex.dispose(), [dialTex])

  // Live (eased) positions, mutated in useFrame and read by refs only.
  const liveRef = useRef<number[]>(targets.slice())
  const targetRef = useRef<number[]>(targets.slice())
  // Snapshot of positions at mount, for the spokes' initial transforms/colors.
  const [initPositions] = useState<number[]>(() => targets.slice())
  const dotRefs = useRef<(THREE.Group | null)[]>(new Array<THREE.Group | null>(N).fill(null))
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>(
    new Array<THREE.MeshStandardMaterial | null>(N).fill(null),
  )

  // The radar polygon ("the person"): one BufferGeometry whose 10 vertices we
  // rewrite each frame to follow the eased dot positions.
  const polyGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((N + 1) * 3), 3))
    return g
  }, [])
  useEffect(() => () => polyGeom.dispose(), [polyGeom])
  const polyFillGeom = useMemo(() => {
    // a triangle-fan from the center (vertex 0) out to the N dot vertices
    // (1..N), so the closed shape fills with one translucent membrane.
    const g = new THREE.BufferGeometry()
    const verts = new Float32Array((N + 1) * 3) // center + N rim vertices
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    const idx: number[] = []
    for (let i = 1; i <= N; i++) {
      const a = i
      const b = i === N ? 1 : i + 1
      idx.push(0, a, b)
    }
    g.setIndex(idx)
    return g
  }, [])
  useEffect(() => () => polyFillGeom.dispose(), [polyFillGeom])

  // Aggregate orb + its word sprite + the sweeping score arc.
  const aggMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const aggHaloRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const arcMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const initAvg = useMemo(() => targets.reduce((s, v) => s + v, 0) / N, [targets])
  const [word, setWord] = useState<StateWord>(() => stateWord(initAvg))
  const wordRef = useRef<string>(word.word)

  // Keep the latest target array on a ref so useFrame always sees fresh values.
  useEffect(() => {
    targetRef.current = targets.slice()
    if (reduced) {
      liveRef.current = targets.slice()
    }
  }, [targets, reduced])

  const tmpCol = useMemo(() => new THREE.Color(), [])

  // The score arc: a sick->fit PROGRESS METER that reads LEFT to RIGHT (the way
  // CrossFit draws the continuum). A fixed full-fan ring is built ONCE; we
  // reveal a prefix of its segments each frame with setDrawRange (no per-frame
  // geometry allocation), and we recolor the whole arc by the live mean so it
  // ramps sick-red -> green as fitness rises.
  //
  // World angle (from +X) of spoke i is (pi/2 - spokeAngle(i)). The LEFT end of
  // the fan is spoke 0 (negative spoke angle -> larger world angle); the RIGHT
  // end is spoke N-1. To grow FROM THE LEFT and fill toward the right we start
  // the ring at the left spoke's world angle and sweep with a NEGATIVE length
  // (clockwise), so revealing a prefix of segments extends the bar rightward.
  const ARC_SEG = 120
  const arcGeom = useMemo(() => {
    const span = Math.abs(spokeAngle(N - 1) - spokeAngle(0))
    const thetaStart = Math.PI / 2 - spokeAngle(0) // world angle of the LEFT spoke
    const g = new THREE.RingGeometry(R_RIM + 0.45, R_RIM + 0.95, ARC_SEG, 1, thetaStart, -span)
    // start showing a prefix matching the initial mean (overwritten each frame)
    g.setDrawRange(0, Math.max(0, Math.round(ARC_SEG * initAvg)) * 6)
    return g
    // initAvg is the mount-time mean; the prefix is re-set every frame anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => arcGeom.dispose(), [arcGeom])

  // A faint full-length track behind the arc so the unfilled portion of the
  // meter is visible (the bar fills along this groove from left to right).
  const arcTrackGeom = useMemo(() => {
    const span = Math.abs(spokeAngle(N - 1) - spokeAngle(0))
    const thetaStart = Math.PI / 2 - spokeAngle(0)
    return new THREE.RingGeometry(R_RIM + 0.45, R_RIM + 0.95, ARC_SEG, 1, thetaStart, -span)
  }, [])
  useEffect(() => () => arcTrackGeom.dispose(), [arcTrackGeom])

  const setDot = (i: number, g: THREE.Group | null) => {
    dotRefs.current[i] = g
  }
  const setMat = (i: number, mat: THREE.MeshStandardMaterial | null) => {
    matRefs.current[i] = mat
  }

  useFrame((_, dt) => {
    const live = liveRef.current
    const tgt = targetRef.current
    const k = reduced ? 1 : smoothK(dt, 11)
    let sum = 0
    let moved = false

    const poly = polyGeom.getAttribute('position') as THREE.BufferAttribute
    const fill = polyFillGeom.getAttribute('position') as THREE.BufferAttribute

    for (let i = 0; i < N; i++) {
      const next = Math.abs(live[i] - tgt[i]) > 0.0015 ? lerp(live[i], tgt[i], k) : tgt[i]
      if (next !== live[i]) moved = true
      live[i] = next
      sum += next

      const [px, py] = pointOn(i, next)
      const dot = dotRefs.current[i]
      if (dot) {
        dot.position.x = px
        dot.position.y = py
      }
      const mat = matRefs.current[i]
      if (mat) {
        const [r, g, b] = spectrum(next)
        tmpCol.setRGB(r, g, b)
        mat.color.copy(tmpCol)
        mat.emissive.copy(tmpCol)
      }

      // radar outline vertex
      poly.setXYZ(i, px, py, 0.06)
      // fill fan vertex (index 0 is the center, set below)
      fill.setXYZ(i + 1, px, py, 0.04)
    }
    // close the outline polygon back to vertex 0
    poly.setXYZ(N, poly.getX(0), poly.getY(0), 0.06)
    poly.needsUpdate = true
    // fill center vertex (rim verts 1..N were written in the loop above)
    fill.setXYZ(0, 0, 0, 0.04)
    fill.needsUpdate = true

    const avg = sum / N
    const ac = spectrum(avg)

    // aggregate orb color + halo
    if (aggMatRef.current) {
      tmpCol.setRGB(ac[0], ac[1], ac[2])
      aggMatRef.current.color.copy(tmpCol)
      aggMatRef.current.emissive.copy(tmpCol)
    }
    if (aggHaloRef.current) {
      tmpCol.setRGB(ac[0], ac[1], ac[2])
      aggHaloRef.current.color.copy(tmpCol)
    }

    // the sweeping score arc: reveal a prefix of the fan ring proportional to
    // the overall score (more fitness -> longer, fuller arc). 6 indices/segment.
    if (arcMatRef.current) {
      const segs = Math.max(0, Math.round(ARC_SEG * avg))
      arcGeom.setDrawRange(0, segs * 6)
      tmpCol.setRGB(ac[0], ac[1], ac[2])
      arcMatRef.current.color.copy(tmpCol)
    }

    // Update the live numeric readouts + the pill's color accents via the DOM
    // (cheap, no React re-render). Value text, dot, and pill border all ramp
    // with each marker's position so the label color matches its dot on screen.
    if (moved || reduced) {
      for (let i = 0; i < N; i++) {
        const css = spectrumCss(live[i])
        const el = document.querySelector<HTMLElement>(`[data-marker-value="${i}"]`)
        if (el) {
          const m = BIOMARKERS[i]
          el.textContent = fmtMarker(markerValueAt(m, live[i]), m.unit)
          el.style.color = css
        }
        const dot = document.querySelector<HTMLElement>(`[data-marker-dot="${i}"]`)
        if (dot) dot.style.background = css
        const pill = document.querySelector<HTMLElement>(`[data-marker-pill="${i}"]`)
        if (pill) pill.style.borderColor = css
      }
      onLive(live.slice(), avg)
    }

    // Swap the aggregate WORD sprite when the band changes.
    const sw = stateWord(avg)
    if (sw.word !== wordRef.current) {
      wordRef.current = sw.word
      setWord(sw)
    }
  })

  // The continuum's three named zones, labeled on the concentric bands from
  // the inner third (SICKNESS) out to the rim (FITNESS). Placed straight DOWN
  // the dial center (the -Y gap below the 200-degree spoke fan) so they sit on
  // their band yet never collide with the fanned spoke pills above.
  const zoneLabels: { label: string; color: string; r: number }[] = [
    { label: 'SICKNESS', color: PAL.sick, r: R_HUB + (R_RIM - R_HUB) * (1 / 6) },
    { label: 'WELLNESS', color: PAL.well, r: R_HUB + (R_RIM - R_HUB) * 0.5 },
    { label: 'FITNESS', color: PAL.fit, r: R_HUB + (R_RIM - R_HUB) * (5 / 6) },
  ]

  return (
    <group>
      {/* dark grounding floor far below the dial */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -R_RIM - 1.4, -1.5]} receiveShadow>
        <planeGeometry args={[44, 30]} />
        <meshStandardMaterial color="#070d0a" roughness={1} metalness={0} />
      </mesh>

      {/* the whole dial, tilted slightly back so it reads as 3D but head-on */}
      <group position={[0, 0, 0]} rotation={[TILT, 0, 0]}>
        {/* the concentric zone-band face (radial sick->well->fit gradient) */}
        <mesh position={[0, 0, -0.05]} receiveShadow>
          <ringGeometry args={[R_HUB, R_RIM, 128, 1]} />
          <meshBasicMaterial map={dialTex} transparent opacity={0.9} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>

        {/* a faint metal back-plate ring for grounding the gauge */}
        <mesh position={[0, 0, -0.12]}>
          <ringGeometry args={[R_RIM, R_RIM + 0.4, 128, 1]} />
          <meshStandardMaterial color="#1c2a22" metalness={0.6} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>

        {/* the ten marker spokes (guide line + dot + fanned label) */}
        {BIOMARKERS.map((_, i) => (
          <MarkerSpoke key={i} index={i} initPos={initPositions[i]} setDot={setDot} setMat={setMat} />
        ))}

        {/* "the person": translucent radar polygon over the dots. Frustum
            culling off since we rewrite the vertices each frame (the cached
            bounding sphere would otherwise cull the inflated shape). */}
        <mesh frustumCulled={false}>
          <primitive object={polyFillGeom} attach="geometry" />
          <meshBasicMaterial
            color="#eef3f6"
            transparent
            opacity={0.12}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <lineLoop frustumCulled={false}>
          <primitive object={polyGeom} attach="geometry" />
          <lineBasicMaterial color="#eef3f6" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
        </lineLoop>

        {/* faint full-length groove behind the score meter */}
        <mesh position={[0, 0, 0.015]}>
          <primitive object={arcTrackGeom} attach="geometry" />
          <meshBasicMaterial
            color="#0b1310"
            transparent
            opacity={0.55}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* the sweeping score arc: grows from the LEFT (sick) and fills toward
            the RIGHT (fit), ramping sick-red -> green as overall fitness rises */}
        <mesh position={[0, 0, 0.02]}>
          <primitive object={arcGeom} attach="geometry" />
          <meshBasicMaterial
            ref={(mat) => {
              arcMatRef.current = mat
            }}
            color={spectrumCss(initAvg)}
            transparent
            opacity={0.9}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* the SICKNESS / WELLNESS / FITNESS zone labels, one per concentric
            band (inner -> outer), in the SkillLabels pill style so the
            sick -> well -> fit structure of the continuum is unmistakable. */}
        {zoneLabels.map((z) => (
          <Html
            key={z.label}
            position={[0, -z.r, 0.12]}
            center
            distanceFactor={30}
            occlude={false}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[20, 0]}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 15px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                background: 'rgba(7, 10, 14, 0.92)',
                border: `1px solid ${z.color}`,
                boxShadow: '0 3px 12px rgba(0,0,0,0.6)',
                fontFamily: '"Barlow Condensed", Poppins, sans-serif',
                fontWeight: 700,
                fontSize: 21,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: PAL.chalk,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: z.color, flex: 'none' }} />
              {z.label}
            </div>
          </Html>
        ))}

        {/* central aggregate readout orb (colored by the mean) */}
        <group position={[0, 0, 0.2]}>
          <mesh>
            <sphereGeometry args={[1.05, 24, 24]} />
            <meshBasicMaterial
              ref={(mat) => {
                aggHaloRef.current = mat
              }}
              color={word.css}
              transparent
              opacity={0.13}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          <mesh castShadow>
            <sphereGeometry args={[0.72, 32, 32]} />
            <meshStandardMaterial
              ref={(mat) => {
                aggMatRef.current = mat
              }}
              color={word.css}
              emissive={word.css}
              emissiveIntensity={0.62}
              roughness={0.28}
              metalness={0.2}
              toneMapped={false}
            />
          </mesh>
          {/* the state WORD floating just above the central orb */}
          <group position={[0, 1.55, 0.2]}>
            <SpriteLabel text={word.word} worldHeight={0.92} color={PAL.ink} bg={word.css} fontPx={54} />
          </group>
        </group>
      </group>

      {/* soft contact shadow grounding the installation */}
      <ContactShadows
        position={[0, -R_RIM - 1.35, -1.5]}
        scale={40}
        resolution={1024}
        blur={2.6}
        opacity={0.4}
        far={8}
        color="#000000"
      />
    </group>
  )
}

/* ---------------------------- controls panel ---------------------------- */

type ProfileName = (typeof CONTINUUM_PROFILES)[number]['name'] | 'Custom'

function ContinuumControls({
  active,
  onPreset,
  sliders,
  onSlider,
  liveAvg,
  liveWord,
}: {
  active: ProfileName
  onPreset: (name: ProfileName) => void
  sliders: number[]
  onSlider: (index: number, value0to100: number) => void
  liveAvg: number
  liveWord: StateWord
}) {
  const presetNames: ProfileName[] = [...CONTINUUM_PROFILES.map((p) => p.name), 'Custom']
  const titleCase = liveWord.word[0] + liveWord.word.slice(1).toLowerCase()

  return (
    <div>
      <ControlHead>Patient markers</ControlHead>

      <Readout
        label="Overall state"
        value={titleCase}
        color={liveWord.css}
        sub={
          <>
            <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(liveAvg * 100)}</strong> / 100
            toward fitness
          </>
        }
      />

      <PresetButtons options={presetNames} value={active} onChange={onPreset} />

      <div style={{ fontSize: 11.5, color: PAL.muted, margin: '2px 0 12px', lineHeight: 1.5 }}>
        Center is sickness, the rim is fitness. Each marker rides its own spoke. Drag any marker outward and the profile
        becomes Custom.
      </div>

      {BIOMARKERS.map((m, i) => {
        const pos = sliders[i] / 100
        return (
          <Slider
            key={m.name}
            label={m.name}
            value={Math.round(sliders[i])}
            display={fmtMarker(markerValueAt(m, pos), m.unit)}
            min={0}
            max={100}
            step={1}
            dotColor={spectrumCss(pos)}
            onChange={(v) => onSlider(i, v)}
          />
        )
      })}

      <div
        style={{
          marginTop: 6,
          paddingTop: 10,
          borderTop: '1px solid rgba(238,243,246,0.1)',
          fontSize: 11,
          lineHeight: 1.55,
          color: '#c2ccc6',
        }}
      >
        <span style={{ color: PAL.yellowGreen, fontWeight: 600 }}>L1 example.</span> {CONTINUUM_EXAMPLES[0]}
      </div>
    </div>
  )
}

/* ------------------------------- module --------------------------------- */

export default function ContinuumModule() {
  const meta = moduleByKey('continuum')
  const copy = MODULE_COPY.continuum

  // The default profile is "Average / well" (index 1), matching the source.
  const defaultProfile = CONTINUUM_PROFILES[1]
  const [active, setActive] = useState<ProfileName>(defaultProfile.name)

  // sliders[] holds 0..100 per marker; targets[] (0..1) drive the scene.
  const [sliders, setSliders] = useState<number[]>(() => defaultProfile.positions.map((p) => p * 100))
  const targets = useMemo(() => sliders.map((s) => clamp(s / 100, 0, 1)), [sliders])

  // Live readout state (updated from the scene, throttled to band/word changes).
  const initAvg = useMemo(() => targets.reduce((s, v) => s + v, 0) / N, [targets])
  const [liveAvg, setLiveAvg] = useState(initAvg)
  const [liveWord, setLiveWord] = useState<StateWord>(() => stateWord(initAvg))

  const applyPreset = (name: ProfileName) => {
    setActive(name)
    if (name === 'Custom') return
    const prof = CONTINUUM_PROFILES.find((p) => p.name === name)
    if (prof) setSliders(prof.positions.map((p) => p * 100))
  }

  const onSlider = (index: number, value: number) => {
    setActive('Custom')
    setSliders((prev) => {
      const next = prev.slice()
      next[index] = clamp(value, 0, 100)
      return next
    })
  }

  // Smooth, low-churn live readout: only re-render React when the rounded
  // score actually changes (the scene drives the 3D directly via refs).
  const lastScore = useRef(Math.round(initAvg * 100))
  const onLive = (_positions: number[], avg: number) => {
    const score = Math.round(avg * 100)
    if (score !== lastScore.current) {
      lastScore.current = score
      setLiveAvg(avg)
      setLiveWord(stateWord(avg))
    }
  }

  return (
    <ModulePage moduleKey="continuum">
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={copy.body}
        autoRotate={false}
        camera={{ position: [0, 1.6, 26], fov: 50 }}
        target={[0, 0.4, 0]}
        minDistance={15}
        maxDistance={40}
        maxPolarAngle={Math.PI / 1.7}
        hint="Drag to tilt the dial. Load a profile or drag any marker toward the fitness rim."
        controls={
          <ContinuumControls
            active={active}
            onPreset={applyPreset}
            sliders={sliders}
            onSlider={onSlider}
            liveAvg={liveAvg}
            liveWord={liveWord}
          />
        }
      >
        <ContinuumScene targets={targets} onLive={onLive} />
      </LessonStage>
    </ModulePage>
  )
}
