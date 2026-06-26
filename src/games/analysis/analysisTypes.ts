// Types for "The Breakdown" - data-grounded analysis articles.
// Content lives in src/data/games/analysis-posts.json. Every article is grounded
// in committed data (projection-2026.json etc.); tracesTo records the source.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'ranked'; title?: string; rows: { name: string; value: string; note?: string }[] }
  | { type: 'callout'; title?: string; text: string }

export interface AnalysisPost {
  slug: string
  title: string
  dek: string
  category: string
  date: string // YYYY-MM-DD
  author: string
  readMin: number
  summary: string // meta description
  blocks: Block[]
  sources: { label: string; url: string }[]
  tracesTo: string
}
