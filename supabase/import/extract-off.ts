// T047 (spec 002, FR-025): extractor de Open Food Facts por su API de búsqueda, filtrada a Argentina.
// Se identifica con un User-Agent, espera entre pedidos (ritmo cortés), reintenta ante límites del
// servidor, se puede reanudar desde una página y descarta las imágenes.
import { pickOffFields } from './extract-off-dump.ts'
import type { OffProduct } from './normalize.ts'

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/search'
const FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'generic_name',
  'brands',
  'quantity',
  'nutriments',
  'serving_size',
  'serving_quantity',
].join(',')

export interface OffApiOptions {
  fetch?: typeof fetch
  /** Identifica a la aplicación ante Open Food Facts. */
  userAgent: string
  pageSize?: number
  /** Primera página a pedir (para reanudar). */
  startPage?: number
  /** Cantidad máxima de páginas en esta corrida. */
  maxPages?: number
  /** Espera entre pedidos, en ms. */
  delayMs?: number
  /** Reintentos ante 429 o 5xx. */
  retries?: number
  sleep?: (ms: number) => Promise<void>
  /** Se llama al terminar cada página con la siguiente a pedir (para guardar el avance). */
  onPage?: (nextPage: number) => void
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function* extractOffApi(options: OffApiOptions): AsyncGenerator<OffProduct> {
  const request = options.fetch ?? fetch
  const sleep = options.sleep ?? wait
  const pageSize = options.pageSize ?? 100
  const delayMs = options.delayMs ?? 1000
  const retries = options.retries ?? 3
  const first = options.startPage ?? 1
  const last = first + (options.maxPages ?? 50) - 1

  for (let page = first; page <= last; page++) {
    const url =
      `${ENDPOINT}?countries_tags_en=argentina&fields=${FIELDS}&page_size=${pageSize}&page=${page}&sort_by=unique_scans_n`

    let products: Record<string, unknown>[] | null = null
    for (let attempt = 0; attempt <= retries && products === null; attempt++) {
      const response = await request(url, {
        headers: { 'User-Agent': options.userAgent, Accept: 'application/json' },
      })
      if (response.ok) {
        const body = (await response.json()) as { products?: Record<string, unknown>[] }
        products = body.products ?? []
      } else if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await response.body?.cancel()
        await sleep(delayMs * 2 ** (attempt + 1))
      } else {
        throw new Error(`Open Food Facts respondió ${response.status} en la página ${page}`)
      }
    }

    if (!products || products.length === 0) return
    for (const product of products) yield pickOffFields(product)
    options.onPage?.(page + 1)
    if (products.length < pageSize) return
    await sleep(delayMs)
  }
}
