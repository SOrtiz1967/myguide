/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Lee los tokens `--color-*` del tema de `src/index.css`. */
function tokens(): Record<string, string> {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
  const out: Record<string, string> = {}
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    const [, name, value] = match
    if (name && value) out[name] = value
  }
  return out
}

function luminance(hex: string): number {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function ratio(a: string, b: string): number {
  const [first, second] = [luminance(a), luminance(b)]
  const light = Math.max(first, second)
  const dark = Math.min(first, second)
  return (light + 0.05) / (dark + 0.05)
}

const t = tokens()
const color = (name: string): string => t[name] ?? ''

describe('contraste de los tokens del sistema (WCAG AA)', () => {
  // [texto, fondo]: el texto debe leerse con al menos 4,5:1.
  const textPairs: [string, string][] = [
    ['ink', 'bg'],
    ['ink', 'surface'],
    ['ink', 'surface-2'],
    ['muted', 'bg'],
    ['muted', 'surface'],
    ['muted', 'surface-2'],
    ['muted', 'surface-3'],
    ['accent-ink', 'accent'],
    ['accent', 'bg'],
    ['accent', 'surface'],
    ['accent-soft', 'bg'],
    ['tone-calorie-ink', 'tone-calorie'],
    ['tone-calorie-ink', 'tone-calorie-deep'],
    ['ink', 'tone-calorie'],
    ['tone-training-ink', 'tone-training'],
    ['tone-training-ink', 'tone-training-deep'],
    ['ink', 'tone-training'],
    ['tone-body-ink', 'tone-body'],
    ['tone-body-ink', 'tone-body-deep'],
    ['ink', 'tone-body'],
    ['danger', 'bg'],
    ['danger', 'surface'],
    ['success', 'bg'],
    ['success', 'surface'],
    ['warn', 'surface'],
    ['bg', 'ink'],
  ]
  it.each(textPairs)('%s sobre %s: 4,5:1 o más', (fg, bg) => {
    expect(ratio(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5)
  })

  // El contorno de un campo es el único indicio de dónde escribir: 3:1 contra su fondo y el del bloque.
  const edgePairs: [string, string][] = [
    ['line', 'bg'],
    ['line', 'surface'],
    ['line', 'tone-calorie'],
    ['line', 'tone-training'],
    ['line', 'tone-body'],
    // Spec 020: las marcas del gráfico del peso (punto, línea del promedio y punto activo) sobre la superficie.
    ['mark', 'surface'],
    ['accent', 'surface'],
    ['ink', 'surface'],
  ]
  it.each(edgePairs)('contorno %s sobre %s: 3:1 o más', (fg, bg) => {
    expect(ratio(color(fg), color(bg))).toBeGreaterThanOrEqual(3)
  })
})
