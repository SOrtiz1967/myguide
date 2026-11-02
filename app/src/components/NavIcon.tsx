export type NavIconName =
  | 'home'
  | 'calendar'
  | 'dumbbell'
  | 'meal'
  | 'more'
  | 'ruler'
  | 'camera'
  | 'pill'
  | 'food'
  | 'bolt'
  | 'steps'
  | 'target'
  | 'user'
  | 'shield'
  | 'trend'

const PATHS: Record<NavIconName, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  calendar: 'M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4',
  dumbbell: 'M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12',
  meal: 'M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3 3.7-3 7 0 2 1 3 3 3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  shield: 'M12 3 5 6v5.5c0 4.2 3 7.6 7 9.5 4-1.9 7-5.3 7-9.5V6zM9.5 12l2 2 3.5-4',
  trend: 'M4 19V5M4 19h16M7.5 15l3.5-4 3 2.5 4.5-6',
  ruler: 'M3 15 15 3l6 6L9 21zM7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  pill: 'M8.5 15.5 15.5 8.5M9 3.5a5 5 0 0 1 7.07 7.07l-5.5 5.5a5 5 0 0 1-7.07-7.07zM11.5 10l2.5 2.5',
  food: 'M12 7c-2-2.5-6-1.5-6 3 0 4 3 9 6 9s6-5 6-9c0-4.5-4-5.5-6-3zM12 7c0-2 .8-3 2-3.5',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  steps: 'M4 20h4v-5h4v-5h4V5h4',
  target:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
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
