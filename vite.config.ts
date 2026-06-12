import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite 8 uses Rolldown. Manual vendor splitting is done via Rolldown's native
// `output.codeSplitting.groups` API (exposed through `build.rolldownOptions`).
// (`manualChunks` and `advancedChunks` also work but are deprecated Rollup-compat
// shims; `codeSplitting` is the current, non-deprecated form Rolldown recommends.)
// Each group captures heavy third-party libraries into a long-lived, separately
// cacheable chunk so they fall out of the per-route lazy chunks and are shared.
//
// Groups are evaluated by `priority` (higher first); once a module is captured
// by a group it is removed from the lower-priority groups, so the more specific
// force-graph group claims its d3-force* / three-* deps before the broader
// `three` and `charts` groups run.
//
// Helper builds a regex that matches a package's own directory inside any
// node_modules path on either path separator, so nested/hoisted installs and
// Windows backslashes both match.
const pkg = (...names: string[]) =>
  new RegExp(`[\\\\/]node_modules[\\\\/](?:${names.join('|')})[\\\\/]`)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // react-force-graph-3d and the WebGL force-graph stack it drives,
              // plus the d3-force* / spatial-index deps that are specific to it
              // (claimed before the generic `charts` group can grab d3-*).
              name: 'forcegraph',
              priority: 40,
              test: pkg(
                'react-force-graph-3d',
                'react-kapsule',
                'kapsule',
                '3d-force-graph',
                'three-forcegraph',
                'three-render-objects',
                'd3-force-3d',
                'd3-force',
                'd3-octree',
                'd3-binarytree',
                'd3-quadtree',
                'd3-dispatch',
                'd3-timer',
                'd3-drag',
                'd3-zoom',
                'ngraph\\.[a-z]+',
                'accessor-fn',
                'data-joint',
                'float-tooltip',
                'index-array-by',
                'yarp',
              ),
            },
            {
              // three.js + the React Three Fiber renderer + drei helpers.
              name: 'three',
              priority: 30,
              test: pkg(
                'three',
                '@react-three[\\\\/]fiber',
                '@react-three[\\\\/]drei',
                '@react-three',
                'three-stdlib',
                'troika-three-text',
                'troika-three-utils',
                'troika-worker-utils',
                '@react-spring',
                '@use-gesture',
                'zustand',
                'react-reconciler',
                'its-fine',
                'scheduler',
                'suspend-react',
                'maath',
              ),
            },
            {
              // recharts and its d3 chart deps (bundled under victory-vendor),
              // plus the remaining standalone d3-* modules used by the app's viz.
              name: 'charts',
              priority: 20,
              test: pkg(
                'recharts',
                'victory-vendor',
                'react-smooth',
                'd3',
                'd3-array',
                'd3-axis',
                'd3-brush',
                'd3-chord',
                'd3-color',
                'd3-contour',
                'd3-delaunay',
                'd3-dsv',
                'd3-ease',
                'd3-fetch',
                'd3-format',
                'd3-geo',
                'd3-hierarchy',
                'd3-interpolate',
                'd3-path',
                'd3-polygon',
                'd3-random',
                'd3-scale',
                'd3-scale-chromatic',
                'd3-selection',
                'd3-shape',
                'd3-time',
                'd3-time-format',
                'd3-transition',
                'internmap',
                'decimal\\.js-light',
                'fast-equals',
                'eventemitter3',
              ),
            },
            {
              // framer-motion animation library.
              name: 'motion',
              priority: 10,
              test: pkg('framer-motion', 'motion-dom', 'motion-utils'),
            },
          ],
        },
      },
    },
  },
})