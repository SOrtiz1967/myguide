export type GlyphKind =
  | 'in-range'
  | 'below'
  | 'above'
  | 'no-record'
  | 'in-progress'
  | 'no-goal'
  | 'future'
  | 'done'
  | 'planned'
  | 'unlogged'
  | 'cancelled'
  | 'none'

/**
 * Marcas del estado de un día. Cada estado tiene su propia forma: el color nunca es la única señal
 * (WCAG 1.4.1). Son decorativas: el texto o la etiqueta del control dicen el estado.
 */
export function Glyph({ kind, className = '' }: { kind: GlyphKind; className?: string }) {
  const common = {
    'aria-hidden': true as const,
    viewBox: '0 0 12 12',
    className: `size-3 shrink-0 ${className}`,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
  }
  switch (kind) {
    case 'in-range':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4" fill="currentColor" />
        </svg>
      )
    case 'below':
      return (
        <svg {...common}>
          <path d="M2 3.5h8L6 10z" fill="none" strokeLinejoin="round" />
        </svg>
      )
    case 'above':
      return (
        <svg {...common}>
          <path d="M2 8.5h8L6 2z" fill="currentColor" strokeLinejoin="round" />
        </svg>
      )
    case 'in-progress':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4" />
          <path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor" />
        </svg>
      )
    case 'no-record':
    case 'no-goal':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4" strokeDasharray="2 1.6" />
        </svg>
      )
    case 'done':
      return (
        <svg {...common}>
          <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" />
        </svg>
      )
    case 'planned':
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
        </svg>
      )
    case 'unlogged':
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="7" height="7" rx="1" strokeDasharray="2 1.6" />
        </svg>
      )
    case 'cancelled':
      return (
        <svg {...common}>
          <path d="M2.5 6h7" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="0.9" fill="currentColor" />
        </svg>
      )
  }
}
