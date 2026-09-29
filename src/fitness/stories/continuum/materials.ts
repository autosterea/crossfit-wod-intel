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
   the camera tilts (C4), shaded by DEPTH (darkest at the bottom of the pit),
   with contour lines at equal steps of depth: they bunch toward the centre
   where the wall is steepest, a topographic reading of the pit. C6
   brightens it x2 in the band between the WELL circle and the athlete
   polygon only (no new hue), then darkens the pit by 20%.

   Pit shadow: a slate overlay on the bowl, drawn over the spokes and rings
   and under the person, deepest at the centre: the spokes darken as they
   descend into the pit (C4 on).

   Word backing: a soft slate disc behind the SDF state word, so the word
   reads over the polygon of its own colour.

   Person: the radar polygon as a luminous membrane in spectrum(mean): faint
   at the centre, light gathered toward its edge (the area reads as an
   amount of light, as in Definition), riding the bowl surface.

   Light bands (C0 to C3): the station columns as soft additive bands of
   light with a crisp core, reaching the edges of the focus rect, opening a
   clean gap wherever a row's tick labels sit; and a spectrum glow under the
   hero lines. All sizes are in screen px (through the live camera scale).
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
        // shaded by depth: the bottom of the pit is the darkest
        float dq = q * q;
        float shade = mix( 1.0, 0.16, pow( dq, 0.75 ) );
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

        // contour lines at equal steps of depth (a topographic map of the pit)
        float g = dq * 9.0;
        float fw = max( fwidth( g ), 1e-4 );
        float iso = ( 1.0 - smoothstep( 0.0, fw * 1.2, abs( fract( g - 0.5 ) - 0.5 ) ) ) * step( uHub + 0.05, r ) * step( 0.02, dq );
        c = mix( c, toLinear( uChalk ) * mix( 0.95, 0.55, dq ), iso * uIso );
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

/** Where labels treat the outline as an obstacle between two dots (clear of the dots, so a value can sit beside its dot). */
export const OUTLINE_T = [0.3, 0.5, 0.7]

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
        float a = uLo + ( uHi - uLo ) * pow( clamp( vF, 0.0, 1.0 ), uGamma ); // MSAA edge samples extrapolate vF < 0: NaN on D3D11
        float rim = smoothstep( 0.86, 1.0, vF ) * uRim;
        // C6: inside the WELL circle the membrane steps aside (the pit darkens
        // alone); in the lit band beyond it the body of the fill thins, so
        // the band reads as the disc's own clean light, not green over amber.
        // The rim (the claim's crisp edge) keeps its light.
        float aa = max( fwidth( vR ), 1e-4 );
        float inside = 1.0 - smoothstep( uCutR - aa, uCutR + aa, vR );
        a *= 1.0 - uCut * ( inside + 0.72 * ( 1.0 - inside ) );
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

/* ----------------------------- pit shadow ------------------------------ */

/** The pit's shadow: slate, deepest at the centre, zero beyond about 0.64 R. uK is its strength. */
export function makePitMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uK: { value: 0 },
      uR: { value: R },
      uSlate: { value: srgb(PAL.ink) },
    },
    vertexShader: /* glsl */ `
      varying float vR;
      void main() {
        vR = length( position.xy );
        vec3 p = position;
        p.z += 0.03;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uK;
      uniform float uR;
      uniform vec3 uSlate;
      varying float vR;
      vec3 toLinear( vec3 c ) {
        return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) );
      }
      void main() {
        float x = 1.0 - smoothstep( 0.0, 0.64, vR / uR );
        float a = uK * pow( x, 1.25 ) * 0.78;
        if ( a <= 0.002 ) discard;
        gl_FragColor = vec4( toLinear( uSlate ), a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

/* ---------------------------- word backing ----------------------------- */

/** A soft slate ellipse on a unit quad (scaled to the word), alpha uOpacity at its core. */
export function makeBackingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uSlate: { value: srgb(PAL.ink) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uSlate;
      varying vec2 vUv;
      vec3 toLinear( vec3 c ) {
        return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) );
      }
      void main() {
        float d = length( vUv * 2.0 - 1.0 );
        float a = uOpacity * ( 1.0 - smoothstep( 0.3, 1.0, d ) );
        if ( a <= 0.002 ) discard;
        gl_FragColor = vec4( toLinear( uSlate ), a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
}

/* ---------------------------- light bands ------------------------------ */

/** Four station columns (kinds 0..3) and two hero-row glows (kinds 4, 5): one quad each, one draw call. */
export const BAND_QUADS = 6

export function makeLightBandsGeometry(): THREE.BufferGeometry {
  const pos = new Float32Array(BAND_QUADS * 4 * 3)
  const uv = new Float32Array(BAND_QUADS * 4 * 2)
  const kind = new Float32Array(BAND_QUADS * 4)
  const idx: number[] = []
  const corners = [-1, -1, 1, -1, 1, 1, -1, 1]
  for (let q = 0; q < BAND_QUADS; q++) {
    for (let c = 0; c < 4; c++) {
      const v = q * 4 + c
      uv[v * 2] = corners[c * 2]
      uv[v * 2 + 1] = corners[c * 2 + 1]
      kind[v] = q
    }
    const b = q * 4
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aUV', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('aK', new THREE.BufferAttribute(kind, 1))
  g.setIndex(idx)
  return g
}

export function makeLightBandsMaterial(): THREE.ShaderMaterial {
  const uniforms = {
    // column x (world), per station
    uColX: { value: new THREE.Vector4() },
    // column half width, world and px
    uHalfW: { value: 0.3 },
    uHalfPx: { value: 10 },
    // world y of the focus rect's bottom and top edges
    uBot: { value: -8 },
    uTop: { value: 8 },
    // the bright plateau between the drawn rows (world y)
    uLo: { value: 0 },
    uHi: { value: 0 },
    // per column: reach 0..1 (grows from the line out to the edges) and brightness
    uGrow: { value: new THREE.Vector4() },
    uAmp: { value: new THREE.Vector4() },
    // strength of the crisp core
    uCore: { value: 1 },
    // px per world unit (vertical), for the label gaps
    uPPU: { value: 30 },
    // the two featured rows (world y) and their tick labels (strength)
    uGapY: { value: new THREE.Vector2() },
    uGapS: { value: new THREE.Vector2() },
    // a gap below a row, px: its start, and its end per column (the elite tick is two lines on a phone)
    uGap0: { value: 7 },
    uGap1: { value: new THREE.Vector4(28, 28, 28, 28) },
    // hero-row glows: x0, x1, y, half height (world)
    uRowA: { value: new THREE.Vector4() },
    uRowB: { value: new THREE.Vector4() },
    // the rows' sickness and fitness ends (world x), for the spectrum
    uRowU: { value: new THREE.Vector2(-5, 5) },
    // hero-row glows: pen progress and brightness
    uRowP: { value: new THREE.Vector2() },
    uRowAmp: { value: new THREE.Vector2() },
    uSick: { value: srgb(PAL.sick) },
    uWell: { value: srgb(PAL.well) },
    uFit: { value: srgb(PAL.fit) },
  }
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec2 aUV;
      attribute float aK;
      uniform vec4 uColX;
      uniform float uHalfW;
      uniform float uBot;
      uniform float uTop;
      uniform vec4 uRowA;
      uniform vec4 uRowB;
      varying vec2 vUV;
      varying float vK;
      varying vec2 vW;
      void main() {
        vUV = aUV;
        vK = aK;
        vec3 p;
        if ( aK < 3.5 ) {
          float xc = aK < 0.5 ? uColX.x : ( aK < 1.5 ? uColX.y : ( aK < 2.5 ? uColX.z : uColX.w ) );
          p = vec3( xc + aUV.x * uHalfW, mix( uBot, uTop, aUV.y * 0.5 + 0.5 ), -0.03 );
        } else {
          vec4 r = aK < 4.5 ? uRowA : uRowB;
          p = vec3( mix( r.x, r.y, aUV.x * 0.5 + 0.5 ), r.z + aUV.y * r.w, -0.035 );
        }
        vW = p.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHalfPx;
      uniform float uBot;
      uniform float uTop;
      uniform float uLo;
      uniform float uHi;
      uniform vec4 uGrow;
      uniform vec4 uAmp;
      uniform float uCore;
      uniform float uPPU;
      uniform vec2 uGapY;
      uniform vec2 uGapS;
      uniform float uGap0;
      uniform vec4 uGap1;
      uniform vec2 uRowU;
      uniform vec2 uRowP;
      uniform vec2 uRowAmp;
      uniform vec3 uSick;
      uniform vec3 uWell;
      uniform vec3 uFit;
      varying vec2 vUV;
      varying float vK;
      varying vec2 vW;

      vec3 toLinear( vec3 c ) {
        return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) );
      }
      vec3 spectrumAt( float t ) {
        t = clamp( t, 0.0, 1.0 );
        return toLinear( t < 0.5 ? mix( uSick, uWell, t / 0.5 ) : mix( uWell, uFit, ( t - 0.5 ) / 0.5 ) );
      }
      // a clean gap in a column below a row, where its tick label sits (px below the row)
      float gapAt( float rowY, float strength, float g1 ) {
        float d = ( rowY - vW.y ) * uPPU;
        float g = smoothstep( uGap0 - 2.0, uGap0, d ) * ( 1.0 - smoothstep( g1, g1 + 2.0, d ) );
        return 1.0 - strength * g;
      }

      void main() {
        vec3 col;
        float a;
        if ( vK < 3.5 ) {
          float grow = vK < 0.5 ? uGrow.x : ( vK < 1.5 ? uGrow.y : ( vK < 2.5 ? uGrow.z : uGrow.w ) );
          float amp = vK < 0.5 ? uAmp.x : ( vK < 1.5 ? uAmp.y : ( vK < 2.5 ? uAmp.z : uAmp.w ) );
          float g1 = vK < 0.5 ? uGap1.x : ( vK < 1.5 ? uGap1.y : ( vK < 2.5 ? uGap1.z : uGap1.w ) );
          col = vK < 0.5 ? toLinear( uSick ) : ( vK < 1.5 ? toLinear( uWell ) : toLinear( uFit ) );
          if ( grow <= 0.001 || amp <= 0.001 ) discard;
          // across: a soft band of light and a crisp core about 1.5 px wide
          float ax = abs( vUV.x );
          float px = ax * uHalfPx;
          float glow = exp( -ax * ax * 3.2 ) * ( 1.0 - ax );
          float core = 1.0 - smoothstep( 0.35, 1.25, px );
          // along: full over the drawn rows, falling to nothing at the edges of the stage; it reaches out as it grows
          float s = 0.0;
          if ( vW.y > uHi ) s = ( vW.y - uHi ) / max( 0.001, uTop - uHi );
          else if ( vW.y < uLo ) s = ( uLo - vW.y ) / max( 0.001, uLo - uBot );
          s = clamp( s, 0.0, 1.0 );
          float reach = 1.0 - smoothstep( grow - 0.08, grow, s );
          float fall = pow( 1.0 - s, 1.35 );
          float v = fall * reach * gapAt( uGapY.x, uGapS.x, g1 ) * gapAt( uGapY.y, uGapS.y, g1 );
          a = amp * v * ( 0.2 * glow + 0.78 * core * uCore );
        } else {
          bool first = vK < 4.5;
          float prog = first ? uRowP.x : uRowP.y;
          float amp = first ? uRowAmp.x : uRowAmp.y;
          if ( amp <= 0.001 || prog <= 0.001 ) discard;
          float u = ( vW.x - uRowU.x ) / max( 0.001, uRowU.y - uRowU.x );
          col = spectrumAt( u );
          float ay = abs( vUV.y );
          float glow = exp( -ay * ay * 4.0 ) * ( 1.0 - ay );
          // revealed behind the pen head, with soft ends
          float head = 1.0 - smoothstep( prog - 0.015, prog + 0.02, u );
          float ends = smoothstep( -0.05, 0.0, u ) * ( 1.0 - smoothstep( 1.0, 1.05, u ) );
          a = amp * glow * head * ends * 0.26;
        }
        if ( a <= 0.0005 ) discard;
        gl_FragColor = vec4( col, a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })
}
