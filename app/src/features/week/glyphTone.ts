import type { GlyphKind } from './Glyph'

/** El color de la marca de calorías: azul en rango, ocre por encima, neutro en lo demás (nunca rojo ni verde). */
export function glyphTone(kind: GlyphKind): string {
  if (kind === 'in-range' || kind === 'done' || kind === 'in-progress') return 'text-accent'
  if (kind === 'above') return 'text-warn'
  return 'text-muted'
}
