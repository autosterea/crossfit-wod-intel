import { useStore } from '../stores/useStore'

/**
 * Shared light/dark toggle used by the main app sidebar and the Games
 * Almanac top bar. Kept in its own file so the lazy /games chunk doesn't
 * pull in the data-heavy Sidebar.
 */
export default function ThemeToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const box = size === 'sm' ? 'w-7 h-7 rounded-md' : 'w-8 h-8 rounded-lg'
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`shrink-0 ${box} bg-[var(--panel-bg)] border border-[var(--panel-border)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[#91C640] hover:border-[#91C640]/40 transition-colors`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <svg className={icon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg className={icon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  )
}
