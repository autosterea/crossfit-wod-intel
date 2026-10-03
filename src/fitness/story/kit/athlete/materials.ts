import * as THREE from 'three'
import { engineUniforms, lin, makeRimStandard } from '../materials'

/* =========================================================================
   The athlete's materials (story/kit/athlete), built on the engine's
   factories (B.9): the body is a dark ink solid lit by the procedural
   environment with a fresnel rim (makeRimStandard), and its contour is a
   pen: a chalk outline of constant SCREEN width drawn as an inverted hull
   (the back faces of the body pushed out along their normals in clip
   space), so the figure reads as a coach's chalk drawing that still has
   real 3D occlusion (the near arm draws over the trunk, the far leg sits
   behind the near one).

   Three passes per figure, in render order:
     1. depth prepass (no colour): the body's front surface only;
     2. fill (depth less-equal, pulled forward by a polygon offset): exactly
        one layer of the body, so a fade or a ghost tint never shows the
        limbs inside it;
     3. outline (the hull), dashed for a ghost.
   A depth bias moves a figure toward (+) or away from (-) the camera along
   each view ray without moving it on screen: an ideal ghost overlaid on
   the athlete can draw over it (front) or only where it differs (behind).
   Far-side parts (the limbs away from the camera) are dimmed a little in
   both passes, the illustrator's depth cue.

   Every shader guards its normalisations and never calls pow() on a
   varying without clamping (D3D11 NaN -> black frames under bloom).
   ========================================================================= */

export interface FigureUniforms {
  /** world units along each view ray: + toward the camera, - away */
  uBias: { value: number }
  /** the figure's centre and the direction toward the camera, in the figure's LOCAL space (for far-side dimming) */
  uCenter: { value: THREE.Vector3 }
  uCamDir: { value: THREE.Vector3 }
  /** 0..1 how much the far side darkens */
  uFarDim: { value: number }
  /** the figure's opacity (fades) */
  uOpacity: { value: number }
}

export function makeFigureUniforms(): FigureUniforms {
  return {
    uBias: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uCamDir: { value: new THREE.Vector3(0, 0, 1) },
    uFarDim: { value: 0.35 },
    uOpacity: { value: 1 },
  }
}

/** The vertex snippet: bias the view-space position along its ray, and the far-side measure. */
const BIAS_VERTEX = /* glsl */ `
  {
    float stL = length( mvPosition.xyz );
    mvPosition.xyz *= max( 0.05, 1.0 - uBias / max( stL, 1e-3 ) );
    gl_Position = projectionMatrix * mvPosition;
  }
  vStFar = dot( position - uCenter, uCamDir );
`

const FIG_VERTEX_HEAD = /* glsl */ `
uniform float uBias;
uniform vec3 uCenter;
uniform vec3 uCamDir;
varying float vStFar;
`

/* ------------------------------ prepass -------------------------------- */

/** Depth only: the figure's front surface (pass 1). */
export function makePrepassMaterial(u: FigureUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uBias: u.uBias, uCenter: u.uCenter, uCamDir: u.uCamDir },
    vertexShader: /* glsl */ `
      ${FIG_VERTEX_HEAD}
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
        ${BIAS_VERTEX}
      }
    `,
    fragmentShader: /* glsl */ `
      void main() { gl_FragColor = vec4( 0.0 ); }
    `,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
  })
}

/* ------------------------------ fill ----------------------------------- */

export interface FillOpts {
  /** the body's ink colour */
  color: string
  /** the fresnel rim colour and strength */
  rim: string
  rimStrength: number
  roughness?: number
  metalness?: number
  emissive?: number
}

/**
 * The solid body (pass 2): makeRimStandard (the engine's lit solid with a
 * fresnel rim) plus the figure bias, far-side dimming and opacity. Drawn
 * with depth less-equal against the prepass, so only the front layer shows.
 */
export function makeBodyFillMaterial(u: FigureUniforms, o: FillOpts): THREE.MeshStandardMaterial {
  const m = makeRimStandard({
    color: o.color,
    rim: o.rim,
    rimStrength: o.rimStrength,
    roughness: o.roughness ?? 0.58,
    metalness: o.metalness ?? 0.04,
    emissive: o.color,
    emissiveIntensity: o.emissive ?? 0.06,
    transparent: true,
  })
  const base = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    base.call(m, shader, renderer)
    shader.uniforms.uBias = u.uBias
    shader.uniforms.uCenter = u.uCenter
    shader.uniforms.uCamDir = u.uCamDir
    shader.uniforms.uFarDim = u.uFarDim
    shader.uniforms.uStOpacity = u.uOpacity
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', FIG_VERTEX_HEAD + 'void main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + BIAS_VERTEX)
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uFarDim;\nuniform float uStOpacity;\nvarying float vStFar;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        [
          'float stFar = smoothstep( 0.04, 0.3, - vStFar );',
          'outgoingLight *= 1.0 - uFarDim * stFar;',
          'diffuseColor.a *= uStOpacity;',
          '#include <opaque_fragment>',
        ].join('\n'),
      )
  }
  m.customProgramCacheKey = () => 'st-rim-1-athlete-fill'
  m.depthWrite = false
  m.depthFunc = THREE.LessEqualDepth
  m.polygonOffset = true
  m.polygonOffsetFactor = -1
  m.polygonOffsetUnits = -1
  return m
}

/** A ghost's tint (pass 2 for a ghost): a flat translucent colour, brighter toward the silhouette. */
export function makeGhostFillMaterial(u: FigureUniforms, color: string, alpha: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBias: u.uBias,
      uCenter: u.uCenter,
      uCamDir: u.uCamDir,
      uOpacity: u.uOpacity,
      uColor: { value: lin(color) },
      uAlpha: { value: alpha },
    },
    vertexShader: /* glsl */ `
      ${FIG_VERTEX_HEAD}
      varying vec3 vNv;
      varying vec3 vVp;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
        ${BIAS_VERTEX}
        vNv = normalMatrix * normal;
        vVp = - mvPosition.xyz;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      uniform float uOpacity;
      varying float vStFar;
      varying vec3 vNv;
      varying vec3 vVp;
      void main() {
        float ln = length( vNv );
        float lv = length( vVp );
        vec3 n = ln > 1e-6 ? vNv / ln : vec3( 0.0, 0.0, 1.0 );
        vec3 v = lv > 1e-6 ? vVp / lv : vec3( 0.0, 0.0, 1.0 );
        float f = clamp( 1.0 - abs( dot( n, v ) ), 0.0, 1.0 );
        float a = uAlpha * ( 0.55 + 0.45 * f * f ) * uOpacity;
        gl_FragColor = vec4( uColor, a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
}

/* ------------------------------ outline -------------------------------- */

export interface OutlineOpts {
  color: string
  /** CSS px */
  width: number
  /** a dashed outline (the comparison grammar, L8): screen-space checker dashes */
  dashed?: boolean
  /** dash cell in CSS px */
  dash?: number
}

/**
 * The pen contour (pass 3): the body's back faces pushed out along their
 * screen-space normal by `width` CSS px, in the outline colour. Constant
 * width at any distance, scale or DPR; occluded by the figure's own front
 * surface (the prepass), so interior lines appear only where one part
 * overlaps another.
 */
export function makeOutlineMaterial(u: FigureUniforms, o: OutlineOpts): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBias: u.uBias,
      uCenter: u.uCenter,
      uCamDir: u.uCamDir,
      uFarDim: u.uFarDim,
      uOpacity: u.uOpacity,
      uColor: { value: lin(o.color) },
      uGain: { value: 1 },
      uWidth: { value: o.width },
      uRes: engineUniforms.uResolution,
      uDpr: engineUniforms.uDpr,
      uDash: { value: o.dashed ? 1 : 0 },
      uDashPx: { value: o.dash ?? 5 },
    },
    vertexShader: /* glsl */ `
      ${FIG_VERTEX_HEAD}
      uniform float uWidth;
      uniform vec2 uRes;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        {
          float stL = length( mvPosition.xyz );
          mvPosition.xyz *= max( 0.05, 1.0 - uBias / max( stL, 1e-3 ) );
        }
        vStFar = dot( position - uCenter, uCamDir );
        vec3 nn = normalMatrix * normal;
        float nl = length( nn );
        vec3 nv = nl > 1e-6 ? nn / nl : vec3( 0.0, 0.0, 1.0 );
        vec4 c0 = projectionMatrix * mvPosition;
        vec4 c1 = projectionMatrix * vec4( mvPosition.xyz + nv * 0.01, 1.0 );
        float w0 = max( abs( c0.w ), 1e-4 );
        float w1 = max( abs( c1.w ), 1e-4 );
        vec2 res = max( uRes, vec2( 1.0 ) );
        vec2 d = ( c1.xy / w1 - c0.xy / w0 ) * res;
        float dl = length( d );
        vec2 dir = dl > 1e-5 ? d / dl : vec2( 0.0 );
        c0.xy += dir * ( uWidth / res ) * 2.0 * c0.w;
        gl_Position = c0;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uGain;
      uniform float uOpacity;
      uniform float uFarDim;
      uniform float uDpr;
      uniform float uDash;
      uniform float uDashPx;
      varying float vStFar;
      void main() {
        if ( uDash > 0.5 ) {
          vec2 q = floor( gl_FragCoord.xy / max( uDashPx * uDpr, 1.0 ) );
          if ( mod( q.x + q.y, 2.0 ) < 0.5 ) discard;
        }
        float stFar = smoothstep( 0.04, 0.3, - vStFar );
        vec3 col = uColor * uGain * ( 1.0 - 0.75 * uFarDim * stFar );
        gl_FragColor = vec4( col, uOpacity );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  })
}
