export type NavIconName = 'home' | 'calendar' | 'dumbbell' | 'meal' | 'more'

const PATHS: Record<NavIconName, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  calendar: 'M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4',
  dumbbell: 'M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12',
  meal: 'M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3 3.7-3 7 0 2 1 3 3 3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
}

/** Íconos de línea del menú: decorativos, el texto del enlace ya dice qué es. */
export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
