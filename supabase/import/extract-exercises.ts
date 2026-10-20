// T043 (spec 005, FR-019, FR-031, FR-035): extractor de free-exercise-db y lectura de los archivos que
// mantiene el autor (traducciones y excepciones del tipo de medición).
//
// La copia de la fuente vive en el repositorio y se verifica contra su SHA-256 ANTES de leer su contenido:
// si no coincide, la carga se detiene (contracts/import-pipeline.md, Garantías).
import { parse as parseCsv } from '@std/csv'
import { MEASUREMENT_TYPES, TEXT_STATUSES, type MeasurementType, type TextStatus } from './exercise-lists.ts'
import {
  normalizeSourceExercises,
  type Batch,
  type NormalizedExercise,
  type Overrides,
  type SourceExercise,
  type Translation,
} from './normalize-exercises.ts'

/** La versión fijada de free-exercise-db (research.md, Decisión 8). */
export const FREE_EXERCISE_DB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
export const FREE_EXERCISE_DB_SHA256 =
  '5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf'
export const FREE_EXERCISE_DB_FILE = 'supabase/import/data/fuentes/free-exercise-db/exercises.json'

export class SourceHashMismatch extends Error {
  constructor(expected: string, actual: string) {
    super(
      `El archivo de la fuente no coincide con la versión fijada (SHA-256 esperado ${expected}, hallado ${actual}). ` +
        'Para subir de versión hay que cambiar a propósito el archivo, la constante y la prueba source_pin.test.ts.',
    )
    this.name = 'SourceHashMismatch'
  }
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

const isStatus = (value: unknown): value is TextStatus =>
  typeof value === 'string' && (TEXT_STATUSES as readonly string[]).includes(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/**
 * Lee `ejercicios-es.json`: un objeto con una entrada por identificador de origen. Es estricta: este
 * archivo lo edita el autor a mano y una entrada mal formada no puede ignorarse en silencio.
 */
export function parseTranslations(json: string): Map<string, Translation> {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('ejercicios-es.json no es JSON válido.')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('ejercicios-es.json debe ser un objeto con una entrada por identificador.')
  }
  const map = new Map<string, Translation>()
  for (const [id, entry] of Object.entries(raw)) {
    const e = entry as Record<string, unknown>
    const fail = (why: string): never => {
      throw new Error(`ejercicios-es.json, entrada "${id}": ${why}.`)
    }
    if (typeof e?.nombre !== 'string' || e.nombre.trim() === '') fail('falta el nombre')
    if (!isStringArray(e.sinonimos)) fail('"sinonimos" debe ser una lista de textos')
    if (!isStringArray(e.pasos)) fail('"pasos" debe ser una lista de textos')
    if (!isStatus(e.nombre_estado) || e.nombre_estado === 'original') {
      fail('"nombre_estado" debe ser machine_translated o reviewed')
    }
    if (!isStatus(e.pasos_estado) || e.pasos_estado === 'original') {
      fail('"pasos_estado" debe ser machine_translated o reviewed')
    }
    map.set(id, {
      nombre: (e.nombre as string).trim(),
      sinonimos: e.sinonimos as string[],
      pasos: e.pasos as string[],
      nombre_estado: e.nombre_estado as TextStatus,
      pasos_estado: e.pasos_estado as TextStatus,
    })
  }
  return map
}

/** Lee `ejercicios-medicion.csv` (`source_item_id,tipo,motivo`): las excepciones a la regla por categoría. */
export function parseOverrides(csv: string): Overrides {
  const map = new Map<string, MeasurementType>()
  if (csv.trim() === '') return map
  for (const row of parseCsv(csv, { skipFirstRow: true }) as Record<string, string>[]) {
    const id = (row.source_item_id ?? '').trim()
    const type = (row.tipo ?? '').trim()
    if (id === '') continue
    if (!(MEASUREMENT_TYPES as readonly string[]).includes(type)) {
      throw new Error(`ejercicios-medicion.csv, "${id}": el tipo "${type}" no es válido.`)
    }
    if (map.has(id)) throw new Error(`ejercicios-medicion.csv, "${id}": está repetido.`)
    map.set(id, type as MeasurementType)
  }
  return map
}

export interface ExtractOptions {
  bytes: Uint8Array<ArrayBuffer>
  expectedSha256: string
  translations: ReadonlyMap<string, Translation>
  overrides: Overrides
}

/** Verifica el SHA-256 de la copia fijada y normaliza sus ejercicios con las traducciones y excepciones. */
export async function extractFreeExerciseDb(options: ExtractOptions): Promise<Batch> {
  const actual = await sha256Hex(options.bytes)
  if (actual !== options.expectedSha256) throw new SourceHashMismatch(options.expectedSha256, actual)
  const sources = JSON.parse(new TextDecoder().decode(options.bytes)) as SourceExercise[]
  return normalizeSourceExercises(sources, options.translations, options.overrides)
}

/** Una línea de NDJSON por ejercicio, con los campos del contrato. */
export function toNdjson(exercises: readonly NormalizedExercise[]): string {
  return exercises.map((exercise) => JSON.stringify(exercise)).join('\n') + '\n'
}
