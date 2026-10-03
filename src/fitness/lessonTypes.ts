/** The chapters of the "What Is Fitness?" lesson: the six models, then What Is CrossFit? (07) and Technique (08). */
export type ModuleKey = 'skills' | 'hopper' | 'pathways' | 'definition' | 'continuum' | 'health' | 'crossfit' | 'technique'

/** All routable views in the /fitness app (intro plus the chapters). */
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
