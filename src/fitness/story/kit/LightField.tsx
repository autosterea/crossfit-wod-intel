import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { hash2 } from '../rng'
import { engineUniforms, lin } from './materials'
import type { ChartFrame } from './chartFrame'
import { PAL } from '../../fitnessData'

/* =========================================================================
   <LightField/> (DESIGN.md B.9, L9): constant-density light. One THREE.Points
   on a jittered stratified grid over the chart box, so the amount of light
   IS the amount of area. Curves enter as uniforms (128 samples in 32 vec4s,
   linearly interpolated in the shader; no float textures, iOS-safe).
     mode 0 POUR: a particle falls into its slot as the level reaches it.
     mode 1 SPILL / CONDENSE: inside A but not B falls, reddens and fades;
       inside B but not A condenses in amber; inside both turns chalk.
     mode 2 FLOW (amendment H.43; the Pathways river): three bands, A at the
       bottom, B, then C on top (curveA / curveB / curveC are band
       THICKNESSES in v units). Every mote keeps a fixed height h inside
       its band and drifts along time: u = fract(u0 + flow), flow =
       0.035 x A (the ambient clock). It is lit only while h is under its
       band's thickness at u, so the density per unit area is constant and
       the river thins exactly as power falls. `stack` (1 stacked, 0 apart),
       `lane` (each band's baseline, v units) and `thick` (height scale)
       morph the stack into lanes; `bandOn` floods each band in turn.
   Every visible property is a function of the uniforms, which are a pure
   function of T and A (or of the explore state).
   ========================================================================= */

/** Mote counts for the FLOW mode per tier (D.4): HIGH 6000, MEDIUM 3300, LOW 0 (the solid fills remain). */
export const FLOW_COUNT = { high: 6000, medium: 3300, low: 0 } as const

export const CURVE_SAMPLES = 128

/** Sample f(u) at 128 points for the curve uniforms. */
export function sampleCurve(f: (u: number) => number, out = new Float32Array(CURVE_SAMPLES)): Float32Array {
  for (let i = 0; i < CURVE_SAMPLES; i++) out[i] = f(i / (CURVE_SAMPLES - 1))
  return out
}

export interface LightFieldUniforms {
  mix: number
  level: number
  mode: 0 | 1 | 2
  hot: number
  opacity: number
  /** 0..1: settled light relaxes to a finer sparkle (default 0) */
  rest?: number
  /** FLOW: phase shift along u, normally 0.035 x A */
  flow?: number
  /** FLOW: per band (A, B, C) visibility 0..1: a band's motes appear once it has flooded */
  bandOn?: readonly [number, number, number]
  /** FLOW: per band baseline in v units (lanes); [0, 0, 0] when stacked */
  lane?: readonly [number, number, number]
  /** FLOW: 1 = bands stacked on each other, 0 = each on its own lane baseline */
  stack?: number
  /** FLOW: height scale applied to h and the stack offset (default 1) */
  thick?: number
}

export interface LightFieldProps {
  frame: ChartFrame
  count: number
  curveA: Float32Array
  curveB?: Float32Array
  /** FLOW: the third (top) band's thickness */
  curveC?: Float32Array
  /** called with story time T and the ambient clock A (L5) */
  uniforms: (T: number, A: number) => LightFieldUniforms
  /** FLOW: the three band colours, bottom to top (default the three energy systems, oxidative at the bottom) */
  bandColors?: readonly [string, string, string]
  /** FLOW: the largest band thickness in v units: each mote's h spans [0, hMax] (default vMax) */
  hMax?: number
  /** base colour of the lit area */
  color?: string
  z?: number
  renderOrder?: number
  sizePx?: number
  /** explore only: return live curves to repack this frame (null = unchanged) */
  liveCurves?: () => { a: Float32Array; b: Float32Array; c?: Float32Array } | null
}

const VERT = /* glsl */ `
  uniform vec4 uA[32];
  uniform vec4 uB[32];
  uniform float uLevel;
  uniform float uMix;
  uniform float uMode;
  uniform float uHot;
  uniform float uX0;
  uniform float uW;
  uniform float uY0;
  uniform float uH;
  uniform float uZ;
  uniform float uSize;
  uniform float uDpr;
  uniform vec3 uColA;
  uniform vec3 uColSpill;
  uniform vec3 uColCond;
  uniform vec3 uColChalk;
  uniform float uRest;
  uniform vec4 uC[32];
  uniform float uVMax;
  uniform float uHMax;
  uniform float uFlow;
  uniform vec3 uLane;
  uniform float uStack;
  uniform float uThick;
  uniform vec3 uBandOn;
  uniform vec3 uCol0;
  uniform vec3 uCol1;
  uniform vec3 uCol2;
  attribute vec2 aSlot;
  attribute vec4 aSeed;
  attribute float aBand;
  varying vec3 vCol;
  varying float vAlpha;
  varying float vTrail;

  float pickA( int i ) { vec4 v = uA[ i / 4 ]; int c = i - ( i / 4 ) * 4; return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }
  float pickB( int i ) { vec4 v = uB[ i / 4 ]; int c = i - ( i / 4 ) * 4; return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }
  float pickC( int i ) { vec4 v = uC[ i / 4 ]; int c = i - ( i / 4 ) * 4; return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }
  float curveC( float u ) {
    float x = clamp( u, 0.0, 1.0 ) * 127.0;
    int i0 = int( floor( x ) ); int i1 = min( i0 + 1, 127 );
    return mix( pickC( i0 ), pickC( i1 ), x - float( i0 ) );
  }
  float curveA( float u ) {
    float x = clamp( u, 0.0, 1.0 ) * 127.0;
    int i0 = int( floor( x ) ); int i1 = min( i0 + 1, 127 );
    return mix( pickA( i0 ), pickA( i1 ), x - float( i0 ) );
  }
  float curveB( float u ) {
    float x = clamp( u, 0.0, 1.0 ) * 127.0;
    int i0 = int( floor( x ) ); int i1 = min( i0 + 1, 127 );
    return mix( pickB( i0 ), pickB( i1 ), x - float( i0 ) );
  }

  void main() {
    float u = aSlot.x;
    float v = aSlot.y;
    float y = v;
    float alpha = 0.0;
    float trail = 0.0;
    vec3 col = uColA;
    float a = curveA( u );
    if ( uMode < 0.5 ) {
      // POUR
      if ( v < a ) {
        float lead = 0.12 * ( 0.55 + 0.9 * aSeed.x );
        float k = clamp( ( uLevel - v + lead ) / lead, 0.0, 1.0 );
        float e = 1.0 - pow( 1.0 - k, 3.0 );
        y = v + ( 1.0 - e ) * ( 0.35 + 0.25 * aSeed.y );
        alpha = smoothstep( 0.0, 0.25, k );
        // settled light relaxes to a fine sparkle so the fill carries the glow (H.20)
        alpha *= 1.0 - 0.4 * uRest * ( 0.5 + 0.5 * aSeed.z );
        col = uColA * ( 1.0 + uHot * ( 0.55 + 1.6 * ( 1.0 - k ) ) );
        trail = 0.5 * uHot * smoothstep( 0.1, 0.6, 1.0 - e );
      }
    } else if ( uMode > 1.5 ) {
      // FLOW: a mote keeps its height h inside its band and drifts along u
      int b = int( aBand + 0.5 );
      float uu = fract( u + uFlow * ( 0.85 + 0.3 * aSeed.y ) );
      float h = ( v / max( uVMax, 1e-4 ) ) * uHMax;
      float tA = curveA( uu );
      float tB = curveB( uu );
      float tC = curveC( uu );
      float th = b == 0 ? tA : b == 1 ? tB : tC;
      float below = b == 0 ? 0.0 : b == 1 ? tA : tA + tB;
      float lane = b == 0 ? uLane.x : b == 1 ? uLane.y : uLane.z;
      float on = b == 0 ? uBandOn.x : b == 1 ? uBandOn.y : uBandOn.z;
      col = b == 0 ? uCol0 : b == 1 ? uCol1 : uCol2;
      if ( h < th && on > 0.001 ) {
        y = lane + ( uStack * below + h ) * uThick;
        // soft at the band's edge and where u wraps, so no mote pops
        alpha = on * smoothstep( 0.0, 0.015, th - h ) * smoothstep( 0.0, 0.03, uu ) * ( 1.0 - smoothstep( 0.97, 1.0, uu ) );
        col *= 1.0 + uHot;
      }
      u = uu;
    } else {
      float b = curveB( u );
      bool inA = v < a;
      bool inB = v < b;
      float m = clamp( ( uMix - aSeed.y * 0.35 ) / 0.65, 0.0, 1.0 );
      if ( inA && inB ) {
        col = mix( uColA, uColChalk, m );
        alpha = mix( 1.0, 0.6, m );
      } else if ( inA ) {
        // spill: the light the specialist cannot hold falls out, streaking down
        float fall = m * m * m;
        y = v - fall * ( 0.45 + 0.55 * aSeed.z );
        col = mix( uColA, uColSpill * 1.6, smoothstep( 0.0, 0.3, m ) );
        alpha = 1.0 - smoothstep( 0.45, 1.0, m );
        trail = smoothstep( 0.08, 0.35, m ) * ( 1.0 - smoothstep( 0.8, 1.0, m ) );
      } else if ( inB ) {
        float e = 1.0 - pow( 1.0 - m, 3.0 );
        y = v + ( 1.0 - e ) * 0.1;
        col = uColCond * 2.1;
        alpha = e;
      }
    }
    vCol = col;
    vAlpha = alpha;
    vec3 p = vec3( uX0 + u * uW, uY0 + y * uH, uZ );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
    vTrail = trail;
    gl_PointSize = alpha > 0.002 ? uSize * uDpr * ( 0.85 + 0.3 * aSeed.w ) * ( 1.0 + 2.2 * trail ) : 0.0;
  }
`

const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vCol;
  varying float vAlpha;
  varying float vTrail;
  void main() {
    if ( vAlpha < 0.002 ) discard;
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    float r = dot( d, d );
    if ( r > 1.0 && vTrail < 0.01 ) discard;
    // a hot core with a soft skirt: reads as a point of light, not dust
    float k = exp( - r * 9.0 ) + 0.28 * exp( - r * 2.6 );
    vec3 c = mix( vCol, vec3( 1.0 ) * max( max( vCol.r, vCol.g ), vCol.b ), 0.3 * exp( - r * 16.0 ) );
    if ( vTrail > 0.01 ) {
      // a falling streak: the head at the centre, the tail trailing upward
      float sx = d.x / 0.22;
      float head = exp( - ( sx * sx + ( d.y * d.y ) / 0.03 ) );
      float tail = exp( - sx * sx ) * smoothstep( -1.0, 0.0, d.y ) * step( d.y, 0.0 ) * ( 0.55 + 0.45 * ( d.y + 1.0 ) );
      k = mix( k, head + 0.6 * tail, vTrail );
    }
    gl_FragColor = vec4( c * k, k * vAlpha * uOpacity );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const ONE3 = [1, 1, 1] as const
const ZERO3 = [0, 0, 0] as const

function packCurve(src: Float32Array, dst: THREE.Vector4[]): void {
  for (let i = 0; i < 32; i++) dst[i].set(src[i * 4] ?? 0, src[i * 4 + 1] ?? 0, src[i * 4 + 2] ?? 0, src[i * 4 + 3] ?? 0)
}

export function LightField({
  frame,
  count,
  curveA,
  curveB,
  curveC,
  uniforms,
  bandColors,
  hMax,
  color = PAL.yellowGreen,
  z = 0.02,
  renderOrder = 40,
  sizePx = 3,
  liveCurves,
}: LightFieldProps) {
  const geometry = useMemo(() => {
    const n = Math.max(1, Math.floor(count))
    const worldAspect = frame.FW / (frame.FH * frame.vMax)
    const cols = Math.max(1, Math.round(Math.sqrt(n * worldAspect)))
    const rows = Math.max(1, Math.ceil(n / cols))
    const slot = new Float32Array(cols * rows * 2)
    const seed = new Float32Array(cols * rows * 4)
    const pos = new Float32Array(cols * rows * 3)
    // FLOW: band per mote on a diagonal pattern, so each band gets a third of
    // every row and column (constant density per band)
    const band = new Float32Array(cols * rows)
    let k = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slot[k * 2] = (c + hash2(c, r * 7 + 1)) / cols
        slot[k * 2 + 1] = ((r + hash2(c * 3 + 5, r)) / rows) * frame.vMax
        seed[k * 4] = hash2(k, 11)
        seed[k * 4 + 1] = hash2(k, 23)
        seed[k * 4 + 2] = hash2(k, 37)
        seed[k * 4 + 3] = hash2(k, 51)
        band[k] = (c + r) % 3
        k++
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSlot', new THREE.BufferAttribute(slot, 2))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
    g.setAttribute('aBand', new THREE.BufferAttribute(band, 1))
    return g
  }, [count, frame])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uA: { value: Array.from({ length: 32 }, () => new THREE.Vector4()) },
          uB: { value: Array.from({ length: 32 }, () => new THREE.Vector4()) },
          uLevel: { value: 0 },
          uMix: { value: 0 },
          uMode: { value: 0 },
          uHot: { value: 0 },
          uRest: { value: 0 },
          uOpacity: { value: 1 },
          uX0: { value: 0 },
          uW: { value: 1 },
          uY0: { value: 0 },
          uH: { value: 1 },
          uZ: { value: 0 },
          uSize: { value: sizePx },
          uDpr: engineUniforms.uDpr,
          uColA: { value: lin(color) },
          uColSpill: { value: lin(PAL.sick) },
          uColCond: { value: lin(PAL.both) },
          uColChalk: { value: lin(PAL.chalk).multiplyScalar(0.85) },
          uC: { value: Array.from({ length: 32 }, () => new THREE.Vector4()) },
          uVMax: { value: 1 },
          uHMax: { value: 1 },
          uFlow: { value: 0 },
          uLane: { value: new THREE.Vector3() },
          uStack: { value: 1 },
          uThick: { value: 1 },
          uBandOn: { value: new THREE.Vector3(1, 1, 1) },
          uCol0: { value: lin(bandColors?.[0] ?? PAL.oxidative) },
          uCol1: { value: lin(bandColors?.[1] ?? PAL.glycolytic) },
          uCol2: { value: lin(bandColors?.[2] ?? PAL.phosphagen) },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, sizePx, bandColors?.[0], bandColors?.[1], bandColors?.[2]],
  )
  const points = useMemo(() => {
    const p = new THREE.Points(geometry, material)
    p.frustumCulled = false
    p.renderOrder = renderOrder
    return p
  }, [geometry, material, renderOrder])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  // curves and frame -> uniforms (not per frame)
  useEffect(() => {
    const u = material.uniforms
    packCurve(curveA, u.uA.value as THREE.Vector4[])
    packCurve(curveB ?? curveA, u.uB.value as THREE.Vector4[])
    packCurve(curveC ?? curveA, u.uC.value as THREE.Vector4[])
    u.uVMax.value = frame.vMax
    u.uHMax.value = hMax ?? frame.vMax
    u.uX0.value = frame.x0
    u.uW.value = frame.FW
    u.uY0.value = frame.y0
    u.uH.value = frame.FH
    u.uZ.value = z
  }, [material, curveA, curveB, curveC, frame, z, hMax])

  useFrame(() => {
    try {
      const s = uniforms(clock.T, clock.A)
      points.visible = s.opacity > 0.002
      if (!points.visible) return
      const u = material.uniforms
      const lc = liveCurves?.()
      if (lc) {
        packCurve(lc.a, u.uA.value as THREE.Vector4[])
        packCurve(lc.b, u.uB.value as THREE.Vector4[])
        if (lc.c) packCurve(lc.c, u.uC.value as THREE.Vector4[])
      }
      u.uLevel.value = s.level
      u.uMix.value = s.mix
      u.uMode.value = s.mode
      u.uHot.value = s.hot
      u.uRest.value = s.rest ?? 0
      u.uOpacity.value = s.opacity
      if (s.mode === 2) {
        u.uFlow.value = s.flow ?? 0
        const on = s.bandOn ?? ONE3
        const ln = s.lane ?? ZERO3
        ;(u.uBandOn.value as THREE.Vector3).set(on[0], on[1], on[2])
        ;(u.uLane.value as THREE.Vector3).set(ln[0], ln[1], ln[2])
        u.uStack.value = s.stack ?? 1
        u.uThick.value = s.thick ?? 1
      }
    } catch (err) {
      points.visible = false
      reportOnce('<LightField> callback', err)
    }
  })

  return <primitive object={points} />
}

/** Mark the curve uniforms dirty after mutating curveA / curveB in place. */
export function repackCurves(points: THREE.Points, a: Float32Array, b?: Float32Array): void {
  const m = points.material as THREE.ShaderMaterial
  packCurve(a, m.uniforms.uA.value as THREE.Vector4[])
  if (b) packCurve(b, m.uniforms.uB.value as THREE.Vector4[])
}
