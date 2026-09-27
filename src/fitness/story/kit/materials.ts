import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

/* =========================================================================
   Engine-owned material factories (DESIGN.md B.9). Chapters compose these;
   they never write their own versions of the backdrop, pen, fill, glow,
   rim or surface materials. Every custom shader ends with the tone-mapping
   and colour-space chunks, so the same material is correct on the composer
   tiers (linear half-float target) and on LOW (direct to the canvas).
   ========================================================================= */

/** Shared uniforms the engine updates on resize / DPR change. */
export const engineUniforms = {
  uDpr: { value: 1 },
  /** canvas size in CSS px (LineMaterial resolution) */
  uResolution: { value: new THREE.Vector2(390, 796) },
}

export const lin = (hex: string) => new THREE.Color(hex)

/* ------------------------------ textures ------------------------------ */

let glowTex: THREE.CanvasTexture | null = null
/** 64 px radial gradient, made once by the engine (head sprite, halos, blob shadow). */
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  glowTex = new THREE.CanvasTexture(c)
  glowTex.colorSpace = THREE.NoColorSpace
  return glowTex
}

/* ------------------------------ backdrop ------------------------------ */

/** sRGB hex -> Vector3 of display-space components (0..1), for shader-side gamma math. */
export function srgb(hex: string): THREE.Vector3 {
  const h = hex.replace('#', '')
  return new THREE.Vector3(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255)
}

/**
 * The slate. All colour math happens in display (sRGB) space, exactly like the
 * CSS tokens it mirrors (--st-slate-top / --st-slate-bottom / --st-glow), and
 * converts to linear once at the end.
 */
export function makeBackdropMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: srgb('#0c1511') },
      uBottom: { value: srgb('#060809') },
      uGlow: { value: srgb('#0f2a1a') },
      uCenter: { value: new THREE.Vector2(0, 0.1) },
      uRadius: { value: 0.9 },
      uStrength: { value: 0.22 },
      uBoost: { value: 1 },
      uGrain: { value: 0.02 },
      uAspect: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4( position.xy, 0.9999, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform vec3 uGlow;
      uniform vec2 uCenter;
      uniform float uRadius;
      uniform float uStrength;
      uniform float uBoost;
      uniform float uGrain;
      uniform float uAspect;
      varying vec2 vUv;
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
      float vnoise( vec2 p ) {
        vec2 i = floor( p ); vec2 f = fract( p );
        vec2 u = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
      }
      vec3 toLinear( vec3 c ) {
        return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( vec3( 0.04045 ), c ) );
      }
      void main() {
        vec3 c = mix( uBottom, uTop, smoothstep( 0.0, 1.0, vUv.y ) );
        vec2 d = vUv * 2.0 - 1.0 - uCenter;
        d.x *= uAspect;
        float r = length( d ) / uRadius;
        c = mix( c, uGlow, clamp( exp( - r * r * 1.4 ) * uStrength * uBoost, 0.0, 1.0 ) );
        c += ( vnoise( gl_FragCoord.xy * 0.7 ) - 0.5 ) * uGrain;
        gl_FragColor = vec4( toLinear( max( c, vec3( 0.0 ) ) ), 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
  })
}

/* -------------------------------- pen --------------------------------- */

const penMaterials = new Set<LineMaterial>()

export interface PenMatOpts {
  color: string
  width: number
  dashed?: boolean
  dashSize?: number
  gapSize?: number
  vertexColors?: boolean
}

/**
 * The pen: LineMaterial with screen-pixel widths plus an onBeforeCompile
 * tweak: a per-segment arc attribute brightens the last stretch behind the
 * head toward the head colour (the tail glow), and uGain lifts the line for a
 * speaking element.
 */
export function makePenMaterial(o: PenMatOpts): LineMaterial {
  const m = new LineMaterial({
    color: new THREE.Color(o.color).getHex(),
    linewidth: o.width,
    worldUnits: false,
    dashed: !!o.dashed,
    dashSize: o.dashSize ?? 0.3,
    gapSize: o.gapSize ?? 0.22,
    vertexColors: !!o.vertexColors,
    transparent: true,
    depthWrite: false,
  })
  m.uniforms.resolution = engineUniforms.uResolution
  m.uniforms.uHead = { value: 1 }
  m.uniforms.uGlowLen = { value: 0.08 }
  m.uniforms.uGlowAmt = { value: 0 }
  m.uniforms.uGlow = { value: new THREE.Color('#f4ffe0').multiplyScalar(1.6) }
  m.uniforms.uGain = { value: 1 }
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'attribute vec2 instanceArc;\nvarying float vArc;\nvoid main() {\n\tvArc = ( position.y < 0.5 ) ? instanceArc.x : instanceArc.y;',
    )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform float uHead;\nuniform float uGlowLen;\nuniform float uGlowAmt;\nuniform vec3 uGlow;\nuniform float uGain;\nvarying float vArc;\nvoid main() {',
      )
      .replace(
        'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
        'float gk = uGlowAmt * smoothstep( uHead - uGlowLen, uHead, vArc );\n\t\t\tdiffuseColor.rgb = mix( diffuseColor.rgb * uGain, uGlow, gk );\n\t\t\tgl_FragColor = vec4( diffuseColor.rgb, alpha );',
      )
  }
  m.customProgramCacheKey = () => 'st-pen-1'
  penMaterials.add(m)
  const dispose = m.dispose.bind(m)
  m.dispose = () => {
    penMaterials.delete(m)
    dispose()
  }
  return m
}

/* -------------------------------- fill -------------------------------- */

export type FillMode = 'gradient' | 'hatch' | 'solid'
const FILL_MODE: Record<FillMode, number> = { gradient: 0, hatch: 1, solid: 2 }

export interface FillMatOpts {
  /** per-vertex colour attribute `aColor` (several strips in one draw call) */
  vertexColors?: boolean
  /** additive blending: the fill reads as light on the slate (Capacity pour) */
  additive?: boolean
  /** per-vertex rim multiplier `aRimK` (AreaStrips: a different rim per strip) */
  rimScale?: boolean
}

/**
 * Area strips (B.9 "Fill"). alpha = mix(uLo, uHi, aT) x uOpacity, where aT is
 * 0 at the baseline and 1 at the data edge. Hatch mode draws 45 degree screen
 * stripes at uHi. uPow shapes the gradient (above 1: light gathers toward
 * the edge). The RIM (amendment H.20) is a thin HDR band of constant
 * world width uRimW just under the data edge: colour x (1 + uRim) there, so
 * bloom lifts the top edge of a luminous area into a glowing rim under the
 * crisp pen (L10). aH is the column height (top - bottom) per vertex.
 */
export function makeFillMaterial(color: string, mode: FillMode = 'gradient', o: FillMatOpts = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: lin(color) },
      uOpacity: { value: 1 },
      uReveal: { value: 1 },
      uLevel: { value: 1e6 },
      uMode: { value: FILL_MODE[mode] },
      uDpr: engineUniforms.uDpr,
      uLo: { value: 0.06 },
      uHi: { value: 0.5 },
      uRim: { value: 0 },
      uRimW: { value: 0.12 },
      uRimA: { value: 0.55 },
      uPow: { value: 1 },
    },
    defines: { ...(o.vertexColors ? { USE_ACOLOR: '' } : {}), ...(o.rimScale ? { USE_ARIM: '' } : {}) },
    vertexShader: /* glsl */ `
      attribute float aT;
      attribute float aU;
      attribute float aH;
      #ifdef USE_ACOLOR
      attribute vec3 aColor;
      varying vec3 vColor;
      #endif
      #ifdef USE_ARIM
      attribute float aRimK;
      varying float vRimK;
      #endif
      varying float vT;
      varying float vU;
      varying float vY;
      varying float vH;
      void main() {
        vT = aT; vU = aU; vY = position.y; vH = aH;
        #ifdef USE_ACOLOR
        vColor = aColor;
        #endif
        #ifdef USE_ARIM
        vRimK = aRimK;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uReveal;
      uniform float uLevel;
      uniform float uMode;
      uniform float uDpr;
      uniform float uLo;
      uniform float uHi;
      uniform float uRim;
      uniform float uRimW;
      uniform float uRimA;
      uniform float uPow;
      #ifdef USE_ACOLOR
      varying vec3 vColor;
      #endif
      #ifdef USE_ARIM
      varying float vRimK;
      #endif
      varying float vT;
      varying float vU;
      varying float vY;
      varying float vH;
      void main() {
        if ( vU > uReveal || vY > uLevel ) discard;
        #ifdef USE_ACOLOR
        vec3 col = vColor;
        #else
        vec3 col = uColor;
        #endif
        float a = mix( uLo, uHi, pow( vT, uPow ) );
        if ( uMode > 0.5 && uMode < 1.5 ) {
          float h = step( 0.5, fract( ( gl_FragCoord.x + gl_FragCoord.y ) / ( 7.0 * uDpr ) ) );
          a = uHi * h;
        } else if ( uMode > 1.5 ) {
          a = uHi;
        }
        float rimAmt = uRim;
        #ifdef USE_ARIM
        rimAmt *= vRimK;
        #endif
        if ( rimAmt > 0.0 ) {
          float depth = ( 1.0 - vT ) * vH;
          float band = exp( - depth / max( uRimW, 1e-4 ) );
          col *= 1.0 + rimAmt * band;
          // the hottest light whitens a little, like a real emitter
          col = mix( col, vec3( max( col.r, max( col.g, col.b ) ) ), 0.3 * band );
          a = max( a, uRimA * band );
        }
        gl_FragColor = vec4( col, a * uOpacity );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
}

/* --------------------------- glow points ------------------------------ */

/** Additive round points with a hot core: pen heads and LOW-tier halos. Sizes in CSS px. */
export function makeGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uDpr: engineUniforms.uDpr },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      uniform float uDpr;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor; vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_PointSize = aSize * uDpr;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord * 2.0 - 1.0;
        float r = dot( d, d );
        if ( r > 1.0 ) discard;
        float k = exp( - r * 7.0 ) + exp( - r * 2.2 ) * 0.28;
        gl_FragColor = vec4( vColor * k, k * vAlpha );
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

/* ------------------------------- ripple ------------------------------- */

/**
 * An expanding ring (the "snap" accent when a measured dot lands, B.11):
 * one point sprite whose fragment draws a ring of radius aK in point space,
 * fading as it grows. HDR at the start so it blooms briefly. Size in CSS px.
 */
export function makeRingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uDpr: engineUniforms.uDpr },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aK;
      uniform float uDpr;
      varying vec3 vColor;
      varying float vK;
      void main() {
        vColor = aColor; vK = aK;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_PointSize = aSize * uDpr;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vK;
      void main() {
        vec2 d = gl_PointCoord * 2.0 - 1.0;
        float r = length( d );
        if ( r > 1.0 || vK <= 0.0 || vK >= 1.0 ) discard;
        float rad = mix( 0.18, 0.96, vK );
        float w = mix( 0.16, 0.05, vK );
        float ring = exp( - pow( ( r - rad ) / w, 2.0 ) );
        float fade = pow( 1.0 - vK, 1.6 );
        float heat = mix( 2.4, 1.0, vK );
        float a = ring * fade;
        gl_FragColor = vec4( vColor * heat * a, a );
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

/* ------------------------------- plates ------------------------------- */

/**
 * Glass row plates (a lineup, a leaderboard): rounded rectangles drawn from
 * a signed distance in one draw call. Per plate: fill and border colour +
 * alpha (vertex attributes), and a visibility factor from uniform uVis[i]
 * (max 16 plates), so plates appear one by one from T with no rebuild.
 */
export const PLATE_MAX = 16
export function makePlateMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uVis: { value: new Array(PLATE_MAX).fill(0) }, uDpr: engineUniforms.uDpr, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec2 aLocal;
      attribute vec3 aHalf;
      attribute vec4 aFill;
      attribute vec4 aLine;
      attribute float aIdx;
      uniform float uVis[${PLATE_MAX}];
      varying vec2 vLocal;
      varying vec3 vHalf;
      varying vec4 vFill;
      varying vec4 vLine;
      varying float vVis;
      void main() {
        vLocal = aLocal; vHalf = aHalf; vFill = aFill; vLine = aLine;
        vVis = uVis[ int( aIdx + 0.5 ) ];
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vLocal;
      varying vec3 vHalf;
      varying vec4 vFill;
      varying vec4 vLine;
      varying float vVis;
      void main() {
        if ( vVis <= 0.001 ) discard;
        // rounded-rect signed distance (world units); vHalf.z is the corner radius
        vec2 q = abs( vLocal ) - vHalf.xy + vHalf.z;
        float d = length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - vHalf.z;
        float px = max( fwidth( d ), 1e-5 );
        float inside = 1.0 - smoothstep( -px, px, d );
        float edge = 1.0 - smoothstep( 0.0, px * 1.25, abs( d + px * 0.5 ) );
        vec3 col = mix( vFill.rgb, vLine.rgb, edge );
        float a = max( vFill.a * inside, vLine.a * edge );
        gl_FragColor = vec4( col, a * vVis * uOpacity );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  })
}

/* ---------------------------- rimStandard ----------------------------- */

export interface RimOpts {
  color: string
  rim?: string
  rimStrength?: number
  metalness?: number
  roughness?: number
  emissive?: string
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
  vertexColors?: boolean
}

/** MeshStandardMaterial plus a fresnel rim added to emissive. */
export function makeRimStandard(o: RimOpts): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: o.color,
    metalness: o.metalness ?? 0.1,
    roughness: o.roughness ?? 0.45,
    emissive: o.emissive ?? o.color,
    emissiveIntensity: o.emissiveIntensity ?? 0.12,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    vertexColors: !!o.vertexColors,
  })
  const uRimColor = { value: lin(o.rim ?? '#91c640') }
  const uRimStrength = { value: o.rimStrength ?? 0.35 }
  m.userData.rim = { uRimColor, uRimStrength }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = uRimColor
    shader.uniforms.uRimStrength = uRimStrength
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uRimColor;\nuniform float uRimStrength;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\tfloat rimF = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 );\n\ttotalEmissiveRadiance += rimF * uRimStrength * uRimColor;',
      )
  }
  m.customProgramCacheKey = () => 'st-rim-1'
  return m
}

export const steelOpts: RimOpts = { color: '#9aa4a8', metalness: 0.95, roughness: 0.28, rim: '#91c640', rimStrength: 0.2, emissiveIntensity: 0 }
