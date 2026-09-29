import * as THREE from 'three'
import { Effect } from 'postprocessing'

/* =========================================================================
   Tone mapping (DESIGN.md decision 3 + amendment H.1). Khronos PBR Neutral
   compresses highlights with no hue shift, which is what the stage needs for
   bloom. Its toe (the `offset` term below 0.08) pulls #91C640 to
   (136, 193, 35), which fails the B.10 swatch test by 30 units in blue, so
   the engine uses Neutral WITHOUT the toe: colours below 0.76 pass through
   untouched (brand and PAL colours stay true), HDR highlights compress
   exactly as Neutral. Same curve on every tier: an Effect on the composer
   tiers, the renderer's CustomToneMapping on LOW.
   ========================================================================= */

export const NEUTRAL_NO_TOE_GLSL = /* glsl */ `
vec3 neutralNoToe( vec3 color ) {
  const float StartCompression = 0.8 - 0.04;
  const float Desaturation = 0.15;
  float peak = max( color.r, max( color.g, color.b ) );
  if ( peak < StartCompression ) return color;
  float d = 1. - StartCompression;
  float newPeak = 1. - d * d / ( peak + d - StartCompression );
  color *= newPeak / peak;
  float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
  return mix( color, vec3( newPeak ), g );
}
`

export class NeutralToneEffect extends Effect {
  constructor() {
    super(
      'NeutralToneEffect',
      /* glsl */ `
      ${NEUTRAL_NO_TOE_GLSL}
      void mainImage( const in vec4 inputColor, const in vec2 uv, out vec4 outputColor ) {
        outputColor = vec4( neutralNoToe( max( inputColor.rgb, vec3( 0.0 ) ) ), inputColor.a );
      }
    `,
    )
  }
}

let patched = false
/** Install the same curve as THREE.CustomToneMapping (used by the LOW tier renderer). */
export function installCustomToneMapping(): void {
  if (patched) return
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment
  const stub = 'vec3 CustomToneMapping( vec3 color ) { return color; }'
  if (chunk.includes(stub)) {
    THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(
      stub,
      `${NEUTRAL_NO_TOE_GLSL}\nvec3 CustomToneMapping( vec3 color ) { return neutralNoToe( color * toneMappingExposure ); }`,
    )
  }
  patched = true
}
