// T048 (spec 002, FR-025, FR-029): respaldo del extractor de Open Food Facts. Recorre el volcado
// `jsonl.gz` por transmisión: no lo descomprime entero ni lo carga en memoria; solo guarda en memoria
// la línea que está leyendo. Conserva únicamente los productos de Argentina y descarta las imágenes.
import { textLines } from './ndjson.ts'
import type { OffProduct } from './normalize.ts'

const ARGENTINA = 'en:argentina'

/** Campos que se copian de cada producto (nada de imágenes ni de datos que no se usan). */
export function pickOffFields(raw: Record<string, unknown>): OffProduct {
  return {
    code: typeof raw.code === 'string' ? raw.code : String(raw.code ?? ''),
    product_name: str(raw.product_name),
    product_name_es: str(raw.product_name_es),
    generic_name: str(raw.generic_name),
    brands: str(raw.brands),
    quantity: str(raw.quantity),
    nutriments: raw.nutriments && typeof raw.nutriments === 'object'
      ? (raw.nutriments as Record<string, unknown>)
      : undefined,
    serving_size: str(raw.serving_size),
    serving_quantity:
      typeof raw.serving_quantity === 'number' || typeof raw.serving_quantity === 'string'
        ? raw.serving_quantity
        : undefined,
  }
}

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

export function isArgentine(raw: Record<string, unknown>): boolean {
  const tags = raw.countries_tags
  return Array.isArray(tags) && tags.includes(ARGENTINA)
}

export interface DumpStats {
  rows: number
  argentine: number
  malformed: number
}

/**
 * Productos de Argentina del volcado. `stats` se va completando mientras se recorre.
 * Una línea que no es JSON válido se cuenta y se ignora; no detiene la lectura.
 */
export async function* extractOffDump(
  source: ReadableStream<Uint8Array<ArrayBuffer>>,
  options: { gzip?: boolean; stats?: DumpStats } = {},
): AsyncGenerator<OffProduct> {
  const stats = options.stats ?? { rows: 0, argentine: 0, malformed: 0 }
  const bytes = options.gzip === false
    ? source
    : source.pipeThrough(new DecompressionStream('gzip'))
  const text = bytes.pipeThrough(new TextDecoderStream())
  for await (const line of textLines(text)) {
    if (line.trim() === '') continue
    stats.rows++
    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(line)
    } catch {
      stats.malformed++
      continue
    }
    if (!isArgentine(raw)) continue
    stats.argentine++
    yield pickOffFields(raw)
  }
}
