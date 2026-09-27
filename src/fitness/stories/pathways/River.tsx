import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { hash2 } from '../../story/rng'
import { engineUniforms, lin } from '../../story/kit/materials'
import { CURVE_SAMPLES } from '../../story/kit/LightField'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { useSafeFrame } from '../../story/useSafeFrame'
import type { Tier } from '../../story/types'
import { BAND_COLORS, POWER_MAX } from './pathwaysMath'
import { FLOW_CURVES } from './geom'

/* =========================================================================
   The river (D.4 River, A.3 signature, L9), a local twin of the kit's
   LightField FLOW mode (engine request: promote it). Review r1: the kit's
   FLOW spreads every band's motes over the tallest band's height, so about
   one mote in five is ever lit and a phone frame showed sparse 1 px specks.
   Here:
     - each band owns its own height range [0, POWER_MAX[b]] and a share of
       the motes proportional to it, so the density per unit AREA is the
       same in all three bands (L9) and almost no mote is wasted;
     - a mote keeps its height h inside its band and drifts along time
       (u = fract(u0 + flow), flow = 0.035 x A, the ambient clock), lit
       only while h is under its band's thickness there: the river thins
       exactly as power falls;
     - each mote is a short comet streaming left to right (a hot head, a
       tail behind it), in the band colour lifted toward its rim tint,
       bright enough for bloom: a river of light, not speckle (H.20);
     - a dark mote (above its band's thickness) leaves the vertex shader
       after one curve read, so the river is cheap per frame.
   Every visible property is a function of the uniforms, which are a pure
   function of T and A (story) or of the damped explore state.
   ========================================================================= */

/** Mote counts per tier: LOW keeps the fills only (the river stays mounted, hidden, so no program links on a tier change). */
export const RIVER_COUNT: Record<Tier, number> = { high: 6000, medium: 4200, low: 4200 }

export interface RiverUniforms {
  /** phase shift along u: 0.035 x A */
  flow: number
  /** per band (bottom to top) visibility 0..1 */
  bandOn: readonly [number, number, number]
  /** per band baseline in v units (lanes) */
  lane: readonly [number, number, number]
  /** 1 stacked, 0 on the lane baselines */
  stack: number
  /** height scale (lanes) */
  thick: number
  /** per band height range in v units (explore Share grows it) */
  hMax?: readonly [number, number, number]
  /** 0..1 impact heat */
  hot: number
  opacity: number
}

const VERT = /* glsl */ `
  uniform vec4 uA[32];
  uniform vec4 uB[32];
  uniform vec4 uC[32];
  uniform float uX0;
  uniform float uW;
  uniform float uY0;
  uniform float uH;
  uniform float uZ;
  uniform float uLen;
  uniform float uDpr;
  uniform float uFlow;
  uniform vec3 uLane;
  uniform float uStack;
  uniform float uThick;
  uniform vec3 uBandOn;
  uniform vec3 uHMax;
  uniform vec3 uCol0;
  uniform vec3 uCol1;
  uniform vec3 uCol2;
  uniform float uHot;
  attribute vec4 aMote;
  attribute vec2 aSeed;
  varying vec3 vCol;
  varying float vAlpha;

  float pickA( int i ) { vec4 v = uA[ i / 4 ]; int c = i - ( i / 4 ) * 4; return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }
  float pickB( int i ) { vec4 v = uB[ i / 4 ]; int c = i - ( i / 4 ) * 4; return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }
  float pickC( int i ) { vec4 v = uC[ i / 4 ]; int c = i - ( i / 4 ) * 4; return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }
  float curveA( float u ) { float x = clamp( u, 0.0, 1.0 ) * 127.0; int i0 = int( floor( x ) ); int i1 = min( i0 + 1, 127 ); return mix( pickA( i0 ), pickA( i1 ), x - float( i0 ) ); }
  float curveB( float u ) { float x = clamp( u, 0.0, 1.0 ) * 127.0; int i0 = int( floor( x ) ); int i1 = min( i0 + 1, 127 ); return mix( pickB( i0 ), pickB( i1 ), x - float( i0 ) ); }
  float curveC( float u ) { float x = clamp( u, 0.0, 1.0 ) * 127.0; int i0 = int( floor( x ) ); int i1 = min( i0 + 1, 127 ); return mix( pickC( i0 ), pickC( i1 ), x - float( i0 ) ); }

  void main() {
    int b = int( aMote.z + 0.5 );
    float on = b == 0 ? uBandOn.x : b == 1 ? uBandOn.y : uBandOn.z;
    float hm = b == 0 ? uHMax.x : b == 1 ? uHMax.y : uHMax.z;
    float uu = fract( aMote.x + uFlow * ( 0.85 + 0.3 * aSeed.x ) );
    float h = aMote.y * hm;
    float alpha = 0.0;
    vec3 p = vec3( 0.0 );
    // most motes are dark at any moment (above their band's thickness there):
    // they leave after one curve read, so the river costs little per frame
    if ( on > 0.001 ) {
      float th = b == 0 ? curveA( uu ) : b == 1 ? curveB( uu ) : curveC( uu );
      if ( h < th ) {
        float below = b == 0 ? 0.0 : b == 1 ? curveA( uu ) : curveA( uu ) + curveB( uu );
        float lane = b == 0 ? uLane.x : b == 1 ? uLane.y : uLane.z;
        // soft at the band's edge and where u wraps, so no mote pops
        alpha = on * smoothstep( 0.0, 0.012, th - h ) * smoothstep( 0.0, 0.03, uu ) * ( 1.0 - smoothstep( 0.97, 1.0, uu ) );
        // a mote near the band's top edge is a little hotter (the rim gathers light)
        alpha *= 0.75 + 0.5 * smoothstep( 0.35, 1.0, h / max( th, 1e-4 ) );
        p = vec3( uX0 + uu * uW, uY0 + ( lane + ( uStack * below + h ) * uThick ) * uH, uZ );
      }
    }
    vec3 col = b == 0 ? uCol0 : b == 1 ? uCol1 : uCol2;
    // faster motes burn a little brighter: a hint of depth in a flat river
    vCol = col * ( 1.0 + uHot ) * ( 0.6 + 0.8 * aSeed.x );
    vAlpha = alpha;
    gl_Position = alpha > 0.002 ? projectionMatrix * modelViewMatrix * vec4( p, 1.0 ) : vec4( 2.0, 2.0, 2.0, 1.0 );
    gl_PointSize = alpha > 0.002 ? uLen * uDpr * ( 0.7 + 0.6 * aSeed.y ) : 0.0;
  }
`

const FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uCore;
  varying vec3 vCol;
  varying float vAlpha;
  void main() {
    if ( vAlpha < 0.002 ) discard;
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    d.y = - d.y;
    // the comet streams along time (L11: left to right): a along it, c across
    float a = d.x;
    float c = d.y;
    float w = uCore;
    float across = exp( - ( c * c ) / ( w * w ) );
    // a linear trail from the tail end (a = -1) to the head (a = 0.45), cut sharply ahead of the head
    float ramp = clamp( ( a + 1.0 ) / 1.45, 0.0, 1.0 );
    float fall = a > 0.45 ? exp( - ( ( a - 0.45 ) * ( a - 0.45 ) ) / 0.012 ) : 1.0;
    float tail = across * ramp * fall;
    float head = exp( - ( ( a - 0.45 ) * ( a - 0.45 ) ) / 0.02 - ( c * c ) / ( w * w * 0.5 ) );
    float k = 0.42 * tail * tail + 0.95 * head;
    if ( k < 0.004 ) discard;
    // the head whitens a little, like a real emitter
    vec3 col = mix( vCol, vec3( max( vCol.r, max( vCol.g, vCol.b ) ) ), 0.35 * head );
    gl_FragColor = vec4( col, min( 1.0, k ) * vAlpha * uOpacity );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function packCurve(src: Float32Array, dst: THREE.Vector4[]): void {
  for (let i = 0; i < 32; i++) dst[i].set(src[i * 4] ?? 0, src[i * 4 + 1] ?? 0, src[i * 4 + 2] ?? 0, src[i * 4 + 3] ?? 0)
}

/** The mote grid: per band a jittered stratified grid over (u, height fraction), sized to that band's height range. */
function buildGeometry(count: number, frame: ChartFrame): THREE.BufferGeometry {
  const total = POWER_MAX[0] + POWER_MAX[1] + POWER_MAX[2]
  const mote: number[] = []
  const seed: number[] = []
  let k = 0
  for (let b = 0; b < 3; b++) {
    const n = Math.max(1, Math.round((count * POWER_MAX[b]) / total))
    // the band's box in world units: FW wide, POWER_MAX[b] x FH tall
    const aspect = frame.FW / Math.max(1e-3, POWER_MAX[b] * frame.FH)
    const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)))
    const rows = Math.max(1, Math.ceil(n / cols))
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        mote.push((c + hash2(c + 31 * b, r * 7 + 1)) / cols, (r + hash2(c * 3 + 5, r + 97 * b)) / rows, b, 0)
        seed.push(hash2(k, 23), hash2(k, 51))
        k++
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(k * 3), 3))
  g.setAttribute('aMote', new THREE.BufferAttribute(new Float32Array(mote), 4))
  g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(seed), 2))
  return g
}

const ONE3 = [1, 1, 1] as const

export function River({
  frame,
  tier,
  uniforms,
  liveCurves,
  z = 0.01,
  renderOrder = 40,
}: {
  frame: ChartFrame
  tier: Tier
  uniforms: (T: number, A: number) => RiverUniforms
  /** explore: curves to repack this frame (null = unchanged) */
  liveCurves?: () => readonly [Float32Array, Float32Array, Float32Array] | null
  z?: number
  renderOrder?: number
}) {
  const count = RIVER_COUNT[tier]
  const geometry = useMemo(() => buildGeometry(count, frame), [count, frame])
  // one material for the life of the chapter: a tier change swaps geometry only, never the program
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uA: { value: Array.from({ length: 32 }, () => new THREE.Vector4()) },
          uB: { value: Array.from({ length: 32 }, () => new THREE.Vector4()) },
          uC: { value: Array.from({ length: 32 }, () => new THREE.Vector4()) },
          uX0: { value: 0 },
          uW: { value: 1 },
          uY0: { value: 0 },
          uH: { value: 1 },
          uZ: { value: 0 },
          uLen: { value: 13 },
          uCore: { value: 0.22 },
          uDpr: engineUniforms.uDpr,
          uFlow: { value: 0 },
          uLane: { value: new THREE.Vector3() },
          uStack: { value: 1 },
          uThick: { value: 1 },
          uBandOn: { value: new THREE.Vector3(1, 1, 1) },
          uHMax: { value: new THREE.Vector3(POWER_MAX[0], POWER_MAX[1], POWER_MAX[2]) },
          // the band colour lifted toward its rim tint and into HDR, so bloom catches the heads
          uCol0: { value: lin(BAND_COLORS[0]).lerp(new THREE.Color(1, 1, 1), 0.18).multiplyScalar(1.3) },
          uCol1: { value: lin(BAND_COLORS[1]).lerp(new THREE.Color(1, 1, 1), 0.18).multiplyScalar(1.15) },
          uCol2: { value: lin(BAND_COLORS[2]).lerp(new THREE.Color(1, 1, 1), 0.18).multiplyScalar(1.55) },
          uHot: { value: 0 },
          uOpacity: { value: 1 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  const points = useMemo(() => {
    const p = new THREE.Points(geometry, material)
    p.frustumCulled = false
    p.renderOrder = renderOrder
    return p
  }, [geometry, material, renderOrder])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const u = material.uniforms
    packCurve(FLOW_CURVES[0], u.uA.value as THREE.Vector4[])
    packCurve(FLOW_CURVES[1], u.uB.value as THREE.Vector4[])
    packCurve(FLOW_CURVES[2], u.uC.value as THREE.Vector4[])
    u.uX0.value = frame.x0
    u.uW.value = frame.FW
    u.uY0.value = frame.y0
    u.uH.value = frame.FH
    u.uZ.value = z
  }, [material, frame, z])

  useSafeFrame(
    'pathways river',
    (T, A) => {
      const s = uniforms(T, A)
      // LOW renders the fills only (D.4): the river stays mounted but hidden
      points.visible = tier !== 'low' && s.opacity > 0.002
      if (!points.visible) return
      const u = material.uniforms
      const lc = liveCurves?.()
      if (lc) {
        packCurve(lc[0], u.uA.value as THREE.Vector4[])
        packCurve(lc[1], u.uB.value as THREE.Vector4[])
        packCurve(lc[2], u.uC.value as THREE.Vector4[])
      }
      u.uFlow.value = s.flow
      u.uHot.value = s.hot
      u.uOpacity.value = s.opacity
      u.uStack.value = s.stack
      u.uThick.value = s.thick
      const on = s.bandOn ?? ONE3
      ;(u.uBandOn.value as THREE.Vector3).set(on[0], on[1], on[2])
      ;(u.uLane.value as THREE.Vector3).set(s.lane[0], s.lane[1], s.lane[2])
      const hm = s.hMax ?? POWER_MAX
      ;(u.uHMax.value as THREE.Vector3).set(hm[0], hm[1], hm[2])
    },
    { hide: { current: points } },
  )

  return <primitive object={points} />
}

/** 128-sample curves (the uniform format), for explore's live repack. */
export const newCurve = () => new Float32Array(CURVE_SAMPLES)
