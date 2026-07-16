import type { ReactNode } from 'react'

/** The six interactive models that make up the "What Is Fitness?" lesson. */
export type ModuleKey = 'skills' | 'hopper' | 'pathways' | 'definition' | 'continuum' | 'health' | 'crossfit' | 'technique'

/** All routable views in the /fitness app (intro plus the six modules). */
export type FitnessView = 'intro' | ModuleKey

/** Static metadata for one module: drives nav, routing, and the intro grid. */
export interface ModuleMeta {
  key: ModuleKey
  slug: string
  num: string
  /** Full nav / page label. */
  label: string
  /** Short label for the cramped mobile nav. */
  mobileLabel?: string
  /** Long display title shown in the stage info panel. */
  title: string
  /** One-line hook for the intro grid. */
  blurb: string
  /** Accent color used on cards and the stage. */
  accent: string
}

/**
 * Props for the shared <LessonStage> hero harness. A module supplies the R3F
 * scene as `children`, the explanatory copy, and an optional interactive
 * `controls` panel. The harness owns the canvas, lighting, orbit controls,
 * and the responsive (desktop floating / mobile bottom-sheet) panel chrome.
 */
export interface LessonStageProps {
  children: ReactNode
  eyebrow: string
  title: string
  body: string
  controls?: ReactNode
  camera?: { position: [number, number, number]; fov?: number }
  target?: [number, number, number]
  autoRotate?: boolean
  autoRotateSpeed?: number
  minDistance?: number
  maxDistance?: number
  /** Cap how far the camera can tip below the horizon (radians from +Y). */
  maxPolarAngle?: number
  hint?: string
  /** Extra classes for the stage wrapper (e.g. height overrides). */
  className?: string
}
