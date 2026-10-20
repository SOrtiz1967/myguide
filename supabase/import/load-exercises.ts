// T043 (spec 005, FR-019, FR-031 a FR-035): cargador del catálogo de ejercicios. Lo ejecuta el autor, no la
// aplicación.
//
//   deno run ... load-exercises.ts --source free-exercise-db|myguide-base|muestra [--dry-run] [--sin-descripcion]
//
// Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor (nunca en `app/`).
import {
  extractFreeExerciseDb,
  FREE_EXERCISE_DB_FILE,
  FREE_EXERCISE_DB_SHA256,
  parseOverrides,
  parseTranslations,
} from './extract-exercises.ts'
import { BASE_FILE, extractBase, parseBase } from './extract-exercises-base.ts'
import { LoadError, redact, type ImportBatchResult, type SourceInfo } from './load.ts'
import {
  dedupeById,
  validateExercise,
  type Batch,
  type NormalizedExercise,
} from './normalize-exercises.ts'

export const BATCH_SIZE = 200

/** Lo que el cargador necesita del servidor; en las pruebas se reemplaza por un doble. */
export interface ExerciseImportClient {
  getSource(slug: string): Promise<SourceInfo | null>
  importExercises(
    slug: string,
    items: NormalizedExercise[],
    dropDescriptions: boolean,
  ): Promise<ImportBatchResult>
  finishImport(slug: string, report: ExerciseLoadReport): Promise<void>
}

export interface ExerciseLoadOptions {
  source: string
  exercises: readonly NormalizedExercise[]
  /** Valida y cuenta sin escribir. */
  dryRun?: boolean
  /** Carga los ejercicios sin su descripción y quita la que hubiera (research.md, Decisión 2). */
  dropDescriptions?: boolean
  batchSize?: number
  /** Omisiones ya contadas antes de llegar aquí (al normalizar). */
  preSkipped?: Record<string, number>
  log?: (message: string) => void
}

export interface ExerciseLoadReport {
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

const add = (counts: Record<string, number>, reason: string, amount = 1) => {
  counts[reason] = (counts[reason] ?? 0) + amount
}

const hasText = (value: string | null | undefined) => (value ?? '').trim() !== ''

export async function loadExercises(
  client: ExerciseImportClient,
  options: ExerciseLoadOptions,
): Promise<ExerciseLoadReport> {
  const log = options.log ?? (() => {})
  const batchSize = options.batchSize ?? BATCH_SIZE
  const drop = options.dropDescriptions ?? false

  const source = await client.getSource(options.source)
  if (!source) {
    throw new LoadError('source_not_found', `La fuente "${options.source}" no existe.`)
  }
  if (!hasText(source.license_name) || !hasText(source.license_url) || !hasText(source.attribution)) {
    throw new LoadError(
      'license_missing',
      `La fuente "${options.source}" no tiene licencia y atribución registradas: no se carga (FR-019).`,
    )
  }

  const skippedReasons: Record<string, number> = { ...options.preSkipped }
  const valid: NormalizedExercise[] = []
  for (const candidate of options.exercises) {
    const result = validateExercise(candidate)
    if (result.ok) valid.push(result.exercise)
    else add(skippedReasons, result.reason)
  }

  const deduped = dedupeById(valid)
  if (deduped.duplicates > 0) add(skippedReasons, 'duplicate_item', deduped.duplicates)
  // Con --sin-descripcion las descripciones ni siquiera viajan al servidor.
  const selected = drop
    ? deduped.exercises.map((e) => ({ ...e, description: null, description_status: null }))
    : deduped.exercises
  const skippedBefore = Object.values(skippedReasons).reduce((sum, n) => sum + n, 0)

  const report: ExerciseLoadReport = {
    source: options.source,
    dry_run: options.dryRun ?? false,
    received: options.exercises.length,
    valid: selected.length,
    duplicates: deduped.duplicates,
    capped: 0,
    created: 0,
    updated: 0,
    skipped: skippedBefore,
    skipped_reasons: skippedReasons,
  }

  if (report.dry_run) {
    log(`Simulación: ${selected.length} ejercicios válidos, ${skippedBefore} omitidos.`)
    return report
  }

  for (let start = 0; start < selected.length; start += batchSize) {
    const batch = selected.slice(start, start + batchSize)
    let result: ImportBatchResult
    try {
      result = await client.importExercises(options.source, batch, drop)
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

export function createExerciseServiceClient(
  url: string,
  serviceKey: string,
  fetchImpl: typeof fetch = fetch,
): ExerciseImportClient {
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
        `${base}/rest/v1/exercise_sources?slug=eq.${
          encodeURIComponent(slug)
        }&select=license_name,license_url,attribution`,
        { headers },
      )
      if (!response.ok) throw new Error(`getSource: ${response.status}`)
      const rows = (await response.json()) as SourceInfo[]
      return rows[0] ?? null
    },
    importExercises: (slug, items, drop) =>
      rpc<ImportBatchResult>('import_exercises', {
        source_slug: slug,
        items,
        drop_descriptions: drop,
      }),
    async finishImport(slug, report) {
      await rpc('finish_exercise_import', { source_slug: slug, report })
    },
  }
}

// ---- línea de comandos --------------------------------------------------------------------------------------

const OUT_DIR = 'supabase/import/out'
const SAMPLE_SOURCE = 'muestra-desarrollo-ejercicios'
const SAMPLE_FILE = 'supabase/import/data/ejercicios-muestra.ndjson'
const TRANSLATIONS_FILE = 'supabase/import/data/ejercicios-es.json'
const OVERRIDES_FILE = 'supabase/import/data/ejercicios-medicion.csv'

const SOURCES = ['free-exercise-db', 'myguide-base', 'muestra'] as const

export interface ExerciseFlags {
  source: (typeof SOURCES)[number]
  dryRun: boolean
  dropDescriptions: boolean
}

export function parseExerciseFlags(args: string[]): ExerciseFlags {
  let source = ''
  let dryRun = false
  let dropDescriptions = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--source') source = args[++i] ?? ''
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--sin-descripcion') dropDescriptions = true
    else throw new Error(`Opción desconocida: ${arg}`)
  }
  if (!(SOURCES as readonly string[]).includes(source)) {
    throw new Error('Indica --source free-exercise-db, myguide-base o muestra.')
  }
  return { source: source as ExerciseFlags['source'], dryRun, dropDescriptions }
}

async function collect(flags: ExerciseFlags): Promise<{ slug: string; batch: Batch }> {
  if (flags.source === 'muestra') {
    const lines = (await Deno.readTextFile(SAMPLE_FILE)).split('\n').filter((l) => l.trim() !== '')
    const exercises = lines.map((line) => JSON.parse(line) as NormalizedExercise)
    return { slug: SAMPLE_SOURCE, batch: { exercises, skipped: {}, unmapped: {} } }
  }
  if (flags.source === 'myguide-base') {
    return { slug: 'myguide-base', batch: extractBase(parseBase(await Deno.readTextFile(BASE_FILE))) }
  }
  const batch = await extractFreeExerciseDb({
    bytes: await Deno.readFile(FREE_EXERCISE_DB_FILE),
    expectedSha256: FREE_EXERCISE_DB_SHA256,
    translations: parseTranslations(await Deno.readTextFile(TRANSLATIONS_FILE)),
    overrides: parseOverrides(await Deno.readTextFile(OVERRIDES_FILE)),
  })
  return { slug: 'free-exercise-db', batch }
}

async function main(args: string[]): Promise<number> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const secrets = key ? [key] : []
  const log = (message: string) => console.log(redact(message, secrets))
  try {
    const flags = parseExerciseFlags(args)
    if (!url || !key) {
      throw new Error(
        'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (se leen del archivo de entorno del servidor, nunca de app/).',
      )
    }
    const { slug, batch } = await collect(flags)
    log(`Ejercicios leídos de la fuente: ${batch.exercises.length}. Omitidos al leer: ${JSON.stringify(batch.skipped)}`)
    if (Object.keys(batch.unmapped).length > 0) {
      log(`Valores de la fuente sin equivalente en las listas: ${JSON.stringify(batch.unmapped)}`)
    }

    const report = await loadExercises(createExerciseServiceClient(url, key), {
      source: slug,
      exercises: batch.exercises,
      dryRun: flags.dryRun,
      dropDescriptions: flags.dropDescriptions,
      preSkipped: batch.skipped,
      log,
    })

    log(
      `${report.dry_run ? 'SIMULACIÓN' : 'CARGA TERMINADA'} (${slug}): creados ${report.created}, actualizados ${report.updated}, omitidos ${report.skipped}.`,
    )
    log(`Motivos de omisión: ${JSON.stringify(report.skipped_reasons)}`)
    try {
      await Deno.mkdir(OUT_DIR, { recursive: true })
      await Deno.writeTextFile(`${OUT_DIR}/informe-ejercicios-${slug}.json`, JSON.stringify(report, null, 2))
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
