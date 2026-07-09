// Lightweight GA4 custom-event helper. Sends to whatever gtag configs are live
// (see index.html). A safe no-op if analytics is blocked or absent - analytics
// must NEVER break the app.
export function track(event: string, params: Record<string, string | number | boolean> = {}): void {
  try {
    const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag
    if (typeof g === 'function') g('event', event, params)
  } catch {
    /* ignore */
  }
}
