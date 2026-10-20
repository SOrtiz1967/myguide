// T040 (spec 005): normalización y validación puras del catálogo de ejercicios
// (contracts/import-pipeline.md). Todo lo que entra a la base pasa por aquí. Un dato opcional ausente es
// `null` o `[]`, nunca un valor supuesto (FR-034).
import {
  EQUIPMENT,
  MAX_ALIAS,
  MAX_ALIASES,
  MAX_DESCRIPTION,
  MAX_NAME,
  MEASUREMENT_TYPES,
  MUSCLES,
  TEXT_STATUSES,
  type Equipment,
  type MeasurementType,
  type Muscle,
  type TextStatus,
} from './exercise-lists.ts'

/** Un ejercicio listo para `import_exercises`: los nombres de campos son los de la tabla `exercises`. */
export interface NormalizedExercise {
  source_item_id: string
  name: string
  name_status: TextStatus
  original_name: string | null
  aliases: string[]
  measurement_type: MeasurementType
  primary_muscles: Muscle[]
  secondary_muscles: Muscle[]
  equipment: Equipment | null
  description: string | null
  description_status: TextStatus | null
}

export type SkipReason =
  | 'no_translation'
  | 'no_measurement_type'
  | 'invalid_name'
  | 'invalid_aliases'
  | 'description_too_long'
  | 'duplicate_item'

/** Los valores de la fuente sin equivalente en las listas cerradas (se cuentan, no detienen la carga). */
export interface Unmapped {
  unmapped_muscle?: number
  unmapped_equipment?: number
}

export type Result =
  | { ok: true; exercise: NormalizedExercise; unmapped?: Unmapped }
  | { ok: false; reason: SkipReason }

/** Un ejercicio de `dist/exercises.json` de free-exercise-db. */
export interface SourceExercise {
  id: string
  name: string
  category: string
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
}

/** Una entrada de `ejercicios-es.json`. */
export interface Translation {
  nombre: string
  sinonimos: string[]
  pasos: string[]
  nombre_estado: TextStatus
  pasos_estado: TextStatus
}

/** Una entrada de `ejercicios-base.json` (fuente propia, ya en español). */
export interface BaseExercise {
  id: string
  nombre: string
  sinonimos: string[]
  tipo_medicion: string
  musculos_principales: string[]
  musculos_secundarios: string[]
  equipamiento: string | null
  descripcion: string | null
}

export type Overrides = ReadonlyMap<string, MeasurementType>

const isMuscle = (value: string): value is Muscle => (MUSCLES as readonly string[]).includes(value)
const isEquipment = (value: string): value is Equipment => (EQUIPMENT as readonly string[]).includes(value)
const isMeasurement = (value: string): value is MeasurementType =>
  (MEASUREMENT_TYPES as readonly string[]).includes(value)

const norm = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Los pasos, numerados y uno por línea, sin pasos vacíos. */
export function joinSteps(steps: readonly string[]): string {
  return steps
    .map((step) => step.trim())
    .filter((step) => step !== '')
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n')
}

/**
 * El tipo de medición de un ejercicio de free-exercise-db (research.md, Decisión 3): primero la excepción
 * de `ejercicios-medicion.csv`, si la hay; si no, la regla por categoría y equipamiento.
 */
export function measurementFor(source: SourceExercise, overrides: Overrides): MeasurementType | null {
  const override = overrides.get(source.id)
  if (override) return override
  switch (source.category) {
    case 'stretching':
    case 'cardio':
      return 'duration'
    case 'plyometrics':
      return 'reps_bodyweight'
    case 'strength':
    case 'powerlifting':
    case 'olympic weightlifting':
    case 'strongman':
      return source.equipment === 'body only' ? 'reps_bodyweight' : 'reps_weight'
    default:
      return null
  }
}

/** Valida lo que la base también impone, para dar un motivo claro y no detener el resto de la carga. */
export function validateExercise(exercise: NormalizedExercise): Result {
  const name = exercise.name.trim()
  if (name === '' || name.length > MAX_NAME) return { ok: false, reason: 'invalid_name' }
  if (exercise.description !== null && exercise.description.length > MAX_DESCRIPTION) {
    return { ok: false, reason: 'description_too_long' }
  }
  if (
    exercise.aliases.length > MAX_ALIASES ||
    exercise.aliases.some((alias) => alias.length < 1 || alias.length > MAX_ALIAS)
  ) {
    return { ok: false, reason: 'invalid_aliases' }
  }
  return { ok: true, exercise: { ...exercise, name } }
}

/** Alias sin vacíos ni repetidos (sin importar acentos) y sin el que es igual al nombre. */
function cleanAliases(aliases: readonly string[], name: string): string[] {
  const seen = new Set([norm(name)])
  const result: string[] = []
  for (const candidate of aliases) {
    const alias = candidate.trim()
    const key = norm(alias)
    if (alias === '' || seen.has(key)) continue
    seen.add(key)
    result.push(alias)
  }
  return result
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)]
}

/** Un ejercicio de free-exercise-db con su traducción. */
export function normalizeFreeExercise(
  source: SourceExercise,
  translation: Translation | undefined,
  overrides: Overrides,
): Result {
  if (!translation) return { ok: false, reason: 'no_translation' }
  if (source.instructions.length > 0 && translation.pasos.length === 0) {
    return { ok: false, reason: 'no_translation' }
  }
  const measurement = measurementFor(source, overrides)
  if (!measurement) return { ok: false, reason: 'no_measurement_type' }

  const unmapped: Unmapped = {}
  const count = (key: keyof Unmapped) => (unmapped[key] = (unmapped[key] ?? 0) + 1)

  const primary: Muscle[] = []
  for (const muscle of unique(source.primaryMuscles)) {
    if (isMuscle(muscle)) primary.push(muscle)
    else count('unmapped_muscle')
  }
  const secondary: Muscle[] = []
  for (const muscle of unique(source.secondaryMuscles)) {
    if (!isMuscle(muscle)) count('unmapped_muscle')
    else if (!primary.includes(muscle)) secondary.push(muscle)
  }
  let equipment: Equipment | null = null
  if (source.equipment !== null) {
    if (isEquipment(source.equipment)) equipment = source.equipment
    else count('unmapped_equipment')
  }

  const description = joinSteps(translation.pasos)
  const name = translation.nombre.trim()
  const result = validateExercise({
    source_item_id: source.id,
    name,
    name_status: translation.nombre_estado,
    original_name: source.name.trim() === '' ? null : source.name.trim(),
    aliases: cleanAliases(translation.sinonimos, name),
    measurement_type: measurement,
    primary_muscles: primary,
    secondary_muscles: secondary,
    equipment,
    description: description === '' ? null : description,
    description_status: description === '' ? null : translation.pasos_estado,
  })
  return result.ok && Object.keys(unmapped).length > 0 ? { ...result, unmapped } : result
}

/** Un ejercicio de la fuente propia `myguide-base`: ya está en español, así que sus textos son originales. */
export function normalizeBaseExercise(base: BaseExercise): Result {
  if (!isMeasurement(base.tipo_medicion)) return { ok: false, reason: 'no_measurement_type' }
  const name = base.nombre.trim()
  const primary = unique(base.musculos_principales).filter(isMuscle)
  const description = base.descripcion?.trim() ?? ''
  return validateExercise({
    source_item_id: base.id,
    name,
    name_status: 'original',
    original_name: null,
    aliases: cleanAliases(base.sinonimos, name),
    measurement_type: base.tipo_medicion,
    primary_muscles: primary,
    secondary_muscles: unique(base.musculos_secundarios)
      .filter(isMuscle)
      .filter((m) => !primary.includes(m)),
    equipment: base.equipamiento !== null && isEquipment(base.equipamiento) ? base.equipamiento : null,
    description: description === '' ? null : description,
    description_status: description === '' ? null : 'original',
  })
}

/** Un identificador repetido en la misma fuente: gana el primero. */
export function dedupeById(exercises: readonly NormalizedExercise[]): {
  exercises: NormalizedExercise[]
  duplicates: number
} {
  const seen = new Set<string>()
  const kept: NormalizedExercise[] = []
  for (const exercise of exercises) {
    if (seen.has(exercise.source_item_id)) continue
    seen.add(exercise.source_item_id)
    kept.push(exercise)
  }
  return { exercises: kept, duplicates: exercises.length - kept.length }
}

export interface Batch {
  exercises: NormalizedExercise[]
  /** Motivo → cantidad de ejercicios omitidos. */
  skipped: Record<string, number>
  /** Valores de la fuente sin equivalente: no omiten el ejercicio, solo se informan. */
  unmapped: Record<string, number>
}

function add(counter: Record<string, number>, key: string, amount = 1): void {
  counter[key] = (counter[key] ?? 0) + amount
}

/** Normaliza todos los ejercicios de free-exercise-db y arma el informe de lo omitido. */
export function normalizeSourceExercises(
  sources: readonly SourceExercise[],
  translations: ReadonlyMap<string, Translation>,
  overrides: Overrides,
): Batch {
  const valid: NormalizedExercise[] = []
  const skipped: Record<string, number> = {}
  const unmapped: Record<string, number> = {}
  for (const source of sources) {
    const result = normalizeFreeExercise(source, translations.get(source.id), overrides)
    if (!result.ok) {
      add(skipped, result.reason)
      continue
    }
    valid.push(result.exercise)
    for (const [key, amount] of Object.entries(result.unmapped ?? {})) add(unmapped, key, amount)
  }
  const deduped = dedupeById(valid)
  if (deduped.duplicates > 0) add(skipped, 'duplicate_item', deduped.duplicates)
  return { exercises: deduped.exercises, skipped, unmapped }
}

/** Normaliza los ejercicios de la fuente propia. */
export function normalizeBaseExercises(bases: readonly BaseExercise[]): Batch {
  const valid: NormalizedExercise[] = []
  const skipped: Record<string, number> = {}
  for (const base of bases) {
    const result = normalizeBaseExercise(base)
    if (result.ok) valid.push(result.exercise)
    else add(skipped, result.reason)
  }
  const deduped = dedupeById(valid)
  if (deduped.duplicates > 0) add(skipped, 'duplicate_item', deduped.duplicates)
  return { exercises: deduped.exercises, skipped, unmapped: {} }
}

export { TEXT_STATUSES }
