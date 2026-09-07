import type { CrossFitData } from './types'

// The dataset is served as a static file (copied to public/data/ by
// scripts/copy-data-to-public.mjs) so it never lands in the JS bundle.
// The URL is stable - no cache-busting - so the browser and Caddy handle
// caching via ETag/Last-Modified revalidation, which picks up the daily
// rebuild while serving 304s the rest of the time.
const DATA_URL = '/data/crossfit-data.json'

let pending: Promise<CrossFitData> | null = null

async function fetchData(): Promise<CrossFitData> {
  const res = await fetch(DATA_URL, { cache: 'default' })
  if (!res.ok) {
    throw new Error(`Data request failed (${res.status} ${res.statusText})`)
  }
  const data = (await res.json()) as CrossFitData
  // Sanity check so a truncated or wrong file fails loudly instead of
  // crashing deep inside the analysis pipeline.
  if (!data || !Array.isArray(data.searchIndex) || !data.overview) {
    throw new Error('Workout dataset is malformed or incomplete')
  }
  if (typeof window !== 'undefined') {
    console.log('[CrossFit] Data loaded:', {
      totalWorkouts: data.overview.total_workouts,
      searchIndexLen: data.searchIndex.length,
      hasMovementDisplay: !!data.movementDisplay,
    })
  }
  return data
}

// Single in-flight promise: StrictMode double-mounts and re-renders reuse the
// same request. A failed attempt clears the slot so Retry can refetch.
export function loadCrossFitData(): Promise<CrossFitData> {
  if (!pending) {
    pending = fetchData().catch((err: unknown) => {
      pending = null
      throw err
    })
  }
  return pending
}
