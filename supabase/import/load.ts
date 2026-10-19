// T049 (spec 002, FR-013, FR-025 a FR-028): cargador del catálogo. Lo ejecuta el autor, no la aplicación.
//
//   deno run ... load.ts --source muestra|open-food-facts|usda-fdc [--input f] [--limit n] [--dry-run]
//
// Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor (nunca en `app/`).
import {
  applyCap,
  dedupeByCompleteness,
  type NormalizedFood,
  type SkipReason,
  validateFood,
} from './normalize.ts'

export const BATCH_SIZE = 500

export interface SourceInfo {
  license_name: string
  license_url: string
  attribution: string
}

export interface ImportBatchResult {
  created: number
  updated: number
  skipped: number
  skipped_reasons: Record<string, number>
}

/** Lo que el cargador necesita del servidor; en las pruebas se reemplaza por un doble. */
export interface ImportClient {
  getSource(slug: string): Promise<SourceInfo | null>
  importFoods(slug: string, items: NormalizedFood[]): Promise<ImportBatchResult>
  finishImport(slug: string, report: LoadReport): Promise<void>
}

export interface LoadOptions {
  source: string
  foods: NormalizedFood[]
  /** Tope de volumen: se quedan los más completos. */
  limit?: number
  /** Valida y cuenta sin escribir. */
  dryRun?: boolean
  batchSize?: number
  /** Omisiones ya contadas antes de llegar aquí (por ejemplo, al normalizar). */
  preSkipped?: Record<string, number>
  log?: (message: string) => void
}

export interface LoadReport {
  source: string
  dry_run: boolean
  received: number
  valid: number
  duplicates: number
  capped: number
  created: number
  updated: number
  skipped: number
  skipped_reasons: Record<string, number>
}

export class LoadError extends Error {
  readonly code: 'license_missing' | 'source_not_found' | 'batch_failed'

  constructor(code: LoadError['code'], message: string) {
    super(message)
    this.name = 'LoadError'
    this.code = code
  }
}

const add = (counts: Record<string, number>, reason: string, amount = 1) => {
  counts[reason] = (counts[reason] ?? 0) + amount
}

/** Quita de un texto cualquier valor secreto (la clave de servicio no debe aparecer en la salida). */
export function redact(text: string, secrets: string[]): string {
  let result = text
  for (const secret of secrets) {
    if (secret.length >= 4) result = result.split(secret).join('[oculto]')
  }
  return result
}

const hasText = (value: string | null | undefined) => (value ?? '').trim() !== ''

export async function loadFoods(client: ImportClient, options: LoadOptions): Promise<LoadReport> {
  const log = options.log ?? (() => {})
  const batchSize = options.batchSize ?? BATCH_SIZE

  const source = await client.getSource(options.source)
  if (!source) {
    throw new LoadError('source_not_found', `La fuente "${options.source}" no existe.`)
  }
  if (
    !hasText(source.license_name) || !hasText(source.license_url) || !hasText(source.attribution)
  ) {
    throw new LoadError(
      'license_missing',
      `La fuente "${options.source}" no tiene licencia y atribución registradas: no se carga (FR-013).`,
    )
  }

  const skippedReasons: Record<string, number> = { ...options.preSkipped }
  const valid: NormalizedFood[] = []
  for (const candidate of options.foods) {
    const result = validateFood(candidate)
    if (result.ok) valid.push(result.food)
    else add(skippedReasons, result.reason satisfies SkipReason)
  }

  const deduped = dedupeByCompleteness(valid)
  const selected = options.limit !== undefined
    ? applyCap(deduped.foods, options.limit)
    : deduped.foods
  const skippedBefore = Object.values(skippedReasons).reduce((sum, n) => sum + n, 0)

  const report: LoadReport = {
    source: options.source,
    dry_run: options.dryRun ?? false,
    received: options.foods.length,
    valid: selected.length,
    duplicates: deduped.duplicates,
    capped: options.limit !== undefined ? selected.length : 0,
    created: 0,
    updated: 0,
    skipped: skippedBefore,
    skipped_reasons: skippedReasons,
  }

  if (report.dry_run) {
    log(`Simulación: ${selected.length} alimentos válidos, ${skippedBefore} omitidos.`)
    return report
  }

  for (let start = 0; start < selected.length; start += batchSize) {
    const batch = selected.slice(start, start + batchSize)
    let result: ImportBatchResult
    try {
      result = await client.importFoods(options.source, batch)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new LoadError(
        'batch_failed',
        `El lote que empieza en ${start} falló y la carga se detuvo: ${detail}`,
      )
    }
    report.created += result.created
    report.updated += result.updated
    report.skipped += result.skipped
    for (const [reason, count] of Object.entries(result.skipped_reasons)) {
      add(report.skipped_reasons, reason, count)
    }
    log(`Lote ${Math.floor(start / batchSize) + 1}: ${start + batch.length}/${selected.length}`)
  }

  await client.finishImport(options.source, report)
  return report
}

// ---- cliente real (PostgREST con la clave de servicio) -----------------------------------------------

export function createServiceClient(
  url: string,
  serviceKey: string,
  fetchImpl: typeof fetch = fetch,
): ImportClient {
  const base = url.replace(/\/+$/, '')
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  async function rpc<T>(name: string, body: unknown): Promise<T> {
    const response = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`${name}: ${response.status} ${redact(text, [serviceKey])}`)
    return (text ? JSON.parse(text) : null) as T
  }

  return {
    async getSource(slug) {
      const response = await fetchImpl(
        `${base}/rest/v1/food_sources?slug=eq.${
          encodeURIComponent(slug)
        }&select=license_name,license_url,attribution`,
        { headers },
      )
      if (!response.ok) throw new Error(`getSource: ${response.status}`)
      const rows = (await response.json()) as SourceInfo[]
      return rows[0] ?? null
    },
    importFoods: (slug, items) =>
      rpc<ImportBatchResult>('import_foods', { source_slug: slug, items }),
    async finishImport(slug, report) {
      await rpc('finish_import', { source_slug: slug, report })
    },
  }
}

// ---- línea de comandos --------------------------------------------------------------------------------------

const DEFAULT_LIMIT = 100_000
const SAMPLE_SOURCE = 'muestra-desarrollo'
const OUT_DIR = 'supabase/import/out'

interface Flags {
  source: string
  input?: string
  dump?: string
  /** El volcado ya está descomprimido (NDJSON) en lugar de jsonl.gz. */
  plain: boolean
  foundation: string
  legacy: string
  translations: string
  limit: number
  dryRun: boolean
  maxPages: number
  reset: boolean
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = {
    source: '',
    foundation: `${OUT_DIR}/usda/foundation`,
    legacy: `${OUT_DIR}/usda/sr_legacy`,
    translations: 'supabase/import/data/usda-nombres-es.csv',
    limit: DEFAULT_LIMIT,
    dryRun: false,
    maxPages: 50,
    reset: false,
    plain: false,
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const value = () => args[++i] ?? ''
    if (arg === '--source') flags.source = value()
    else if (arg === '--input') flags.input = value()
    else if (arg === '--dump') flags.dump = value()
    else if (arg === '--foundation') flags.foundation = value()
    else if (arg === '--legacy') flags.legacy = value()
    else if (arg === '--translations') flags.translations = value()
    else if (arg === '--limit') flags.limit = Number(value())
    else if (arg === '--max-pages') flags.maxPages = Number(value())
    else if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--reset') flags.reset = true
    else if (arg === '--plain') flags.plain = true
    else throw new Error(`Opción desconocida: ${arg}`)
  }
  if (!['muestra', 'open-food-facts', 'usda-fdc'].includes(flags.source)) {
    throw new Error('Indica --source muestra, open-food-facts o usda-fdc.')
  }
  if (!Number.isFinite(flags.limit) || flags.limit < 0) throw new Error('--limit no es válido.')
  return flags
}

async function collect(flags: Flags, log: (message: string) => void) {
  const preSkipped: Record<string, number> = {}
  const foods: NormalizedFood[] = []
  const skip = (reason: string) => (preSkipped[reason] = (preSkipped[reason] ?? 0) + 1)

  if (flags.source === 'muestra') {
    const { readNdjson } = await import('./ndjson.ts')
    const input = flags.input ?? 'supabase/import/data/muestra.ndjson'
    let malformed = 0
    for await (const food of readNdjson<NormalizedFood>(input, () => malformed++)) foods.push(food)
    if (malformed > 0) preSkipped.malformed_line = malformed
    return { slug: SAMPLE_SOURCE, foods, preSkipped }
  }

  if (flags.source === 'open-food-facts') {
    const { normalizeOffProduct } = await import('./normalize.ts')
    const consume = (product: Parameters<typeof normalizeOffProduct>[0]) => {
      const result = normalizeOffProduct(product)
      if (result.ok) foods.push(result.food)
      else skip(result.reason)
    }
    if (flags.dump) {
      const { extractOffDump } = await import('./extract-off-dump.ts')
      const stats = { rows: 0, argentine: 0, malformed: 0 }
      const file = await Deno.open(flags.dump)
      for await (const product of extractOffDump(file.readable, { stats, gzip: !flags.plain })) {
        consume(product)
        if (stats.argentine % 1000 === 0) {
          log(`Leídas ${stats.rows} filas, ${stats.argentine} de Argentina…`)
        }
      }
      log(
        `Volcado: ${stats.rows} filas, ${stats.argentine} de Argentina, ${stats.malformed} ilegibles.`,
      )
    } else {
      const { extractOffApi } = await import('./extract-off.ts')
      const progressFile = `${OUT_DIR}/off-progreso.json`
      let startPage = 1
      if (!flags.reset) {
        try {
          startPage =
            (JSON.parse(await Deno.readTextFile(progressFile)) as { nextPage: number }).nextPage
        } catch {
          // sin avance previo: se empieza desde la primera página
        }
      }
      const userAgent = Deno.env.get('OFF_USER_AGENT') ?? 'MyGuide/0.1 (proyecto personal)'
      for await (
        const product of extractOffApi({
          userAgent,
          startPage,
          maxPages: flags.maxPages,
          onPage: (next) => {
            log(`Página ${next - 1} leída.`)
            Deno.writeTextFile(progressFile, JSON.stringify({ nextPage: next })).catch(() => {})
          },
        })
      ) {
        consume(product)
      }
    }
    return { slug: 'open-food-facts', foods, preSkipped }
  }

  const { extractUsda, folderDataset, parseTranslations } = await import('./extract-usda.ts')
  const translations = parseTranslations(await Deno.readTextFile(flags.translations))
  log(`Traducciones disponibles: ${translations.size}.`)
  const extraction = await extractUsda(
    [
      folderDataset(flags.foundation, 'foundation_food'),
      folderDataset(flags.legacy, 'sr_legacy_food'),
    ],
    translations,
  )
  return { slug: 'usda-fdc', foods: extraction.foods, preSkipped: extraction.preSkipped }
}

async function main(args: string[]): Promise<number> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const secrets = key ? [key] : []
  const log = (message: string) => console.log(redact(message, secrets))
  try {
    const flags = parseFlags(args)
    if (!url || !key) {
      throw new Error(
        'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (se leen del archivo de entorno del servidor, nunca de app/).',
      )
    }
    const { slug, foods, preSkipped } = await collect(flags, log)
    log(
      `Alimentos leídos de la fuente: ${foods.length}. Omitidos al leer: ${
        JSON.stringify(preSkipped)
      }`,
    )

    const report = await loadFoods(createServiceClient(url, key), {
      source: slug,
      foods,
      limit: flags.limit,
      dryRun: flags.dryRun,
      preSkipped,
      log,
    })

    log(
      `${
        report.dry_run ? 'SIMULACIÓN' : 'CARGA TERMINADA'
      } (${slug}): creados ${report.created}, actualizados ${report.updated}, omitidos ${report.skipped}.`,
    )
    log(`Motivos de omisión: ${JSON.stringify(report.skipped_reasons)}`)
    try {
      await Deno.mkdir(OUT_DIR, { recursive: true })
      await Deno.writeTextFile(`${OUT_DIR}/informe-${slug}.json`, JSON.stringify(report, null, 2))
    } catch {
      // sin permiso de escritura: el informe igual se vio en pantalla
    }
    return 0
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(redact(`Error: ${detail}`, secrets))
    return 1
  }
}

if (import.meta.main) Deno.exit(await main(Deno.args))
