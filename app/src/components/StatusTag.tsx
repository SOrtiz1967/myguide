import { Glyph, type GlyphKind } from '../features/week/Glyph'

/** Estado dicho en texto y con una forma distinta: el color nunca es la única señal (Principio IV, WCAG 1.4.1). */
export function StatusTag({ kind, children }: { kind: GlyphKind; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Glyph kind={kind} />
      <span>{children}</span>
    </span>
  )
}
