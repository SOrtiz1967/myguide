// Ayudantes de las pruebas e2e de la spec 005 (catálogo de ejercicios). Solo para el stack local.
//
// El texto viaja por la línea de comandos (docker exec + psql -c), que no admite bien acentos ni saltos de
// línea: por eso cada texto se envía en hexadecimal y la base lo decodifica con convert_from.
import { dbQuery } from './support'

const hex = (text: string) => Buffer.from(text, 'utf8').toString('hex')

/** Un texto SQL a partir de un texto cualquiera (acentos, comillas y saltos de línea incluidos). */
export const sqlText = (text: string | null): string =>
  text === null ? 'null' : `convert_from(decode('${hex(text)}', 'hex'), 'UTF8')`

const sqlTextArray = (items: readonly string[]): string =>
  items.length === 0 ? 'array[]::text[]' : `array[${items.map(sqlText).join(', ')}]::text[]`

export interface SeedExercise {
  /** Identificador de origen; en la base queda como `E2E-<id>`. */
  id: string
  name: string
  originalName?: string | null
  aliases?: string[]
  measurement?: 'reps_weight' | 'reps_bodyweight' | 'duration' | 'distance_duration'
  primary?: string[]
  secondary?: string[]
  equipment?: string | null
  description?: string | null
  nameStatus?: 'original' | 'machine_translated' | 'reviewed'
  descriptionStatus?: 'original' | 'machine_translated' | 'reviewed'
}

/** Ejercicios de catálogo de la fuente `free-exercise-db` (sembrada por la migración). */
export function seedCatalogExercises(exercises: SeedExercise[]): void {
  for (const e of exercises) {
    dbQuery(
      `select tests.create_catalog_exercise('free-exercise-db', 'E2E-${e.id}', ${sqlText(e.name)}, '${e.measurement ?? 'reps_weight'}', ${sqlText(e.originalName ?? null)}, ${sqlTextArray(e.aliases ?? [])}, ${sqlTextArray(e.primary ?? [])}, ${sqlTextArray(e.secondary ?? [])}, ${e.equipment ? `'${e.equipment}'` : 'null'}, ${sqlText(e.description ?? null)}, '${e.nameStatus ?? 'machine_translated'}', '${e.descriptionStatus ?? 'machine_translated'}')`,
    )
  }
}

/** Borra los ejercicios de corridas anteriores: los del catálogo sembrados y los propios con «e2e» en el nombre. */
export function clearSeededExercises(): void {
  dbQuery("delete from public.exercises where source_item_id like 'E2E-%' or name ilike '%e2e%'")
}

/** Un ejercicio propio de una cuenta (por su correo). Devuelve su id. */
export function seedOwnExercise(
  email: string,
  options: {
    name: string
    measurement?: SeedExercise['measurement']
    primary?: string[]
    equipment?: string | null
    description?: string | null
  },
): string {
  return dbQuery(
    `select tests.create_exercise((select id from auth.users where email = '${email}'), ${sqlText(options.name)}, '${options.measurement ?? 'reps_weight'}', ${sqlTextArray(options.primary ?? [])}, ${options.equipment ? `'${options.equipment}'` : 'null'}, ${sqlText(options.description ?? null)})`,
  )
}

/** Los ejercicios propios de la cuenta, del más viejo al más nuevo: `nombre|tipo`. */
export function ownExercises(email: string): string[] {
  const rows = dbQuery(
    `select name || '|' || measurement_type from public.exercises where user_id = (select id from auth.users where email = '${email}') order by created_at, name`,
  )
  return rows === '' ? [] : rows.split('\n')
}
