import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { srgb } from '../../story/kit/materials'
import { N, STOP_WELL } from './continuumMath'
import { DEPTH, HUB, R, bowl, radiusOf, spokeAngle } from './layout'

/* =========================================================================
   The two surfaces this chapter draws itself (DESIGN.md D.6 "Dial phase",
   "Person"). Both end with the tone-mapping and colour-space chunks, like
   every kit shader, so they are correct on the composer tiers and on LOW.

   Zone disc: spectrum(p) at 16% alpha on the BOWL (the centre is DEPTH
   deeper), lit through its analytic normal so the pit reads as a pit once
   the camera tilts (C4), darker toward sickness, with faint contour lines
   every 0.1 of the continuum (a topographic reading of the depth). C6
   brightens it x2 in the band between the WELL circle and the athlete
   polygon only (no new hue), then darkens the pit by 20%.

   Person: the radar polygon as a luminous membrane in spectrum(mean): faint
   at the centre, light gathered toward its edge (the area reads as an
   amount of light, as in Definition), riding the bowl surface.
   ========================================================================= */

/* ------------------------------- disc --------------------------------- */

export const DISC_RINGS = 36
export const DISC_SEGS = 120

/** Polar grid from the centre to the rim; z follows the bowl. */
export function makeDiscGeometry(): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= DISC_RINGS; j++) {
    const r = (R * j) / DISC_RINGS
    for (let s = 0; s <= DISC_SEGS; s++) {
      const a = (s / DISC_SEGS) * Math.PI * 2
      pos.push(r * Math.cos(a), r * Math.sin(a), bowl(r))
    }
  }
  const row = DISC_SEGS + 1
  for (let j = 0; j < DISC_RINGS; j++) {
    for (let s = 0; s < DISC_SEGS; s++) {
      const a = j * row + s
      const b = a + 1
      const c = a + row
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

export interface DiscUniforms {
  uOpacity: { value: number }
  uAlpha: { value: number }
  uBand: { value: number }
  uPit: { value: number }
  uIso: { value: number }
  uPolyR: { value: number[] }
  uHot: { value: number }
}

export function makeDiscMaterial(): THREE.ShaderMaterial {
  const uniforms = {
    uOpacity: { value: 0 },
    uAlpha: { value: 0.12 },
    uBand: { value: 0 },
    uPit: { value: 0 },
    uIso: { value: 0.2 },
    uPolyR: { value: new Array<number>(N).fill(R) },
    uHot: { value: 1 },
    uR: { value: R },
    uHub: { value: HUB },
    uDepth: { value: DEPTH },
    uWellR: { value: radiusOf(STOP_WELL) },
    uSick: { value: srgb(PAL.sick) },
    uWell: { value: srgb(PAL.well) },
    uFit: { value: srgb(PAL.fit) },
    uChalk: { value: srgb(PAL.chalk) },
  }
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vXY;
      void main() {
        vXY = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uAlpha;
      uniform float uBand;
      uniform float uPit;
      uniform float uIso;
      uniform float uPolyR[ ${N} ];
      uniform float uHot;
      uniform float uR;
      uniform float uHub;
      uniform float uDepth;
      uniform float uWellR;
      uniform vec3 uSick;
      uniform vec3 uWell;
      uniform vec3 uFit;
      uniform vec3 uChalk;
      varying vec2 vXY;

      vec3 toLinear( vec3 c ) {
        return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) );
      }

      void main() {
        float r = length( vXY );
        float aa = max( fwidth( r ), 1e-4 );
        float edge = 1.0 - smoothstep( uR - aa, uR + aa, r );
        if ( edge <= 0.0 ) discard;
        float p = clamp( ( r - uHub ) / ( uR - uHub ), 0.0, 1.0 );
        // spectrum(p), interpolated in display space exactly like fitnessData.spectrum
        vec3 s = p < 0.5 ? mix( uSick, uWell, p / 0.5 ) : mix( uWell, uFit, ( p - 0.5 ) / 0.5 );
        vec3 col = toLinear( s );

        // the bowl's analytic normal, lit from above the camera: the far
        // (upper) wall of the pit faces down and darkens, the near wall lifts
        float q = 1.0 - min( r, uR ) / uR;
        float fp = 2.0 * uDepth * q / uR;
        vec2 dir = r > 1e-4 ? vXY / r : vec2( 0.0, 1.0 );
        vec3 n = normalize( vec3( -fp * dir, 1.0 ) );
        vec3 L = normalize( vec3( 0.15, 0.85, 0.5 ) );
        float lit = 0.34 + 0.95 * max( dot( n, L ), 0.0 );
        // darker and deeper toward sickness
        float shade = mix( 0.3, 1.0, smoothstep( 0.0, 0.8, r / uR ) );
        // C6: the pit darkens by 20% inside the WELL circle
        shade *= 1.0 - 0.2 * uPit * ( 1.0 - smoothstep( uWellR - 0.4, uWellR, r ) );

        // C6: the band between the WELL circle and the athlete polygon
        float sIdx = mod( ( 1.5707963 - atan( dir.y, dir.x ) ) / 0.62831853, ${N}.0 );
        float i0 = floor( sIdx );
        float i1 = mod( i0 + 1.0, ${N}.0 );
        float r0 = uR;
        float r1 = uR;
        for ( int k = 0; k < ${N}; k++ ) {
          if ( float( k ) == i0 ) r0 = uPolyR[ k ];
          if ( float( k ) == i1 ) r1 = uPolyR[ k ];
        }
        float a0 = 1.5707963 - i0 * 0.62831853;
        float a1 = a0 - 0.62831853;
        vec2 P0 = r0 * vec2( cos( a0 ), sin( a0 ) );
        vec2 P1 = r1 * vec2( cos( a1 ), sin( a1 ) );
        vec2 E = P1 - P0;
        float den = dir.x * E.y - dir.y * E.x;
        float rp = abs( den ) > 1e-5 ? ( P0.x * E.y - P0.y * E.x ) / den : uR;
        float band = smoothstep( uWellR - aa, uWellR + aa, r ) * ( 1.0 - smoothstep( rp - aa, rp + aa, r ) );

        float k = 1.0 + uBand * band;
        vec3 c = col * lit * shade * k * uHot;
        float a = uAlpha * k * ( 0.72 + 0.28 * p );

        // faint contour lines every 0.1 of the continuum (the depth, read as a map)
        float g = p * 10.0;
        float fw = max( fwidth( g ), 1e-4 );
        float iso = ( 1.0 - smoothstep( 0.0, fw * 1.1, abs( fract( g - 0.5 ) - 0.5 ) ) ) * step( uHub + 0.05, r ) * step( r, uR - 0.05 );
        c = mix( c, toLinear( uChalk ) * 0.9, iso * uIso );
        a = max( a, iso * uIso );

        gl_FragColor = vec4( c, a * edge * uOpacity );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  return m
}

/* ------------------------------ person -------------------------------- */

/** Sub-points per polygon edge (the outline and the membrane follow the bowl). */
export const EDGE_SUB = 6
export const RINGS = 7
export const OUTLINE_PTS = N * EDGE_SUB + 1

/**
 * The person's membrane: a triangle grid from the centre to the outline
 * (RINGS rings x N x EDGE_SUB edge points). Positions are rewritten from the
 * live dot positions; aF is the ring fraction (0 centre, 1 the edge).
 */
export function makePersonGeometry(): THREE.BufferGeometry {
  const E = N * EDGE_SUB
  const vcount = 1 + RINGS * E
  const pos = new Float32Array(vcount * 3)
  const f = new Float32Array(vcount)
  for (let j = 1; j <= RINGS; j++) for (let e = 0; e < E; e++) f[1 + (j - 1) * E + e] = j / RINGS
  const idx: number[] = []
  for (let e = 0; e < E; e++) idx.push(0, 1 + e, 1 + ((e + 1) % E))
  for (let j = 1; j < RINGS; j++) {
    for (let e = 0; e < E; e++) {
      const a = 1 + (j - 1) * E + e
      const b = 1 + (j - 1) * E + ((e + 1) % E)
      const c = a + E
      const d = b + E
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  const pa = new THREE.BufferAttribute(pos, 3)
  pa.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('position', pa)
  g.setAttribute('aF', new THREE.BufferAttribute(f, 1))
  g.setIndex(idx)
  return g
}

/** Write the outline (N x EDGE_SUB + 1 points, closed) for positions p[i], riding the bowl. */
export function writeOutline(p: ArrayLike<number>, out: Float32Array, lift = 0.03): void {
  let o = 0
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N
    const ra = radiusOf(p[i])
    const rb = radiusOf(p[j])
    const aa = spokeAngle(i)
    const ab = spokeAngle(j)
    const ax = ra * Math.cos(aa)
    const ay = ra * Math.sin(aa)
    const bx = rb * Math.cos(ab)
    const by = rb * Math.sin(ab)
    for (let e = 0; e < EDGE_SUB; e++) {
      const t = e / EDGE_SUB
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      out[o++] = x
      out[o++] = y
      out[o++] = bowl(Math.hypot(x, y)) + lift
    }
  }
  out[o++] = out[0]
  out[o++] = out[1]
  out[o++] = out[2]
}

/** Rewrite the membrane from an outline written by writeOutline. */
export function writeMembrane(outline: Float32Array, g: THREE.BufferGeometry, lift = 0.015): void {
  const pa = g.getAttribute('position') as THREE.BufferAttribute
  const a = pa.array as Float32Array
  const E = N * EDGE_SUB
  a[0] = 0
  a[1] = 0
  a[2] = bowl(0) + lift
  for (let j = 1; j <= RINGS; j++) {
    const f = j / RINGS
    for (let e = 0; e < E; e++) {
      const x = outline[e * 3] * f
      const y = outline[e * 3 + 1] * f
      const o = (1 + (j - 1) * E + e) * 3
      a[o] = x
      a[o + 1] = y
      a[o + 2] = bowl(Math.hypot(x, y)) + lift
    }
  }
  pa.needsUpdate = true
}

export function makePersonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(PAL.well) },
      uOpacity: { value: 0 },
      uLo: { value: 0.008 },
      uHi: { value: 0.1 },
      uGamma: { value: 2.4 },
      uRim: { value: 0.7 },
      uCut: { value: 0 },
      uCutR: { value: radiusOf(STOP_WELL) },
    },
    vertexShader: /* glsl */ `
      attribute float aF;
      varying float vF;
      varying float vR;
      void main() {
        vF = aF;
        vR = length( position.xy );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uLo;
      uniform float uHi;
      uniform float uGamma;
      uniform float uRim;
      uniform float uCut;
      uniform float uCutR;
      varying float vF;
      varying float vR;
      void main() {
        float a = uLo + ( uHi - uLo ) * pow( vF, uGamma );
        float rim = smoothstep( 0.86, 1.0, vF ) * uRim;
        // C6: inside the WELL circle the membrane steps aside, so the margin stays lit
        float aa = max( fwidth( vR ), 1e-4 );
        a *= 1.0 - uCut * ( 1.0 - smoothstep( uCutR - aa, uCutR + aa, vR ) );
        vec3 c = uColor * ( 1.0 + rim );
        gl_FragColor = vec4( c, ( a + 0.18 * rim ) * uOpacity );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}
