// T043 (spec 005): lectura de la fuente propia `myguide-base` (`ejercicios-base.json`), obra del autor del
// proyecto, ya escrita en español. Es estricta: una entrada mal formada no se ignora en silencio.
import { normalizeBaseExercises, type Batch, type BaseExercise } from './normalize-exercises.ts'

export const BASE_FILE = 'supabase/import/data/ejercicios-base.json'

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

export function parseBase(json: string): BaseExercise[] {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('ejercicios-base.json no es JSON válido.')
  }
  if (!Array.isArray(raw)) throw new Error('ejercicios-base.json debe ser una lista de ejercicios.')
  const seen = new Set<string>()
  return raw.map((entry, index) => {
    const e = entry as Record<string, unknown>
    const fail = (why: string): never => {
      throw new Error(`ejercicios-base.json, entrada ${index + 1}: ${why}.`)
    }
    if (typeof e?.id !== 'string' || e.id.trim() === '') fail('falta el identificador')
    const id = (e.id as string).trim()
    if (seen.has(id)) fail(`el identificador "${id}" está repetido`)
    seen.add(id)
    if (typeof e.nombre !== 'string') fail('falta el nombre')
    if (typeof e.tipo_medicion !== 'string') fail('falta el tipo de medición')
    if (!isStringArray(e.sinonimos)) fail('"sinonimos" debe ser una lista de textos')
    if (!isStringArray(e.musculos_principales)) fail('"musculos_principales" debe ser una lista de textos')
    if (!isStringArray(e.musculos_secundarios)) fail('"musculos_secundarios" debe ser una lista de textos')
    if (e.equipamiento !== null && typeof e.equipamiento !== 'string') fail('"equipamiento" debe ser un texto o null')
    if (e.descripcion !== null && typeof e.descripcion !== 'string') fail('"descripcion" debe ser un texto o null')
    return {
      id,
      nombre: e.nombre as string,
      sinonimos: e.sinonimos as string[],
      tipo_medicion: e.tipo_medicion as string,
      musculos_principales: e.musculos_principales as string[],
      musculos_secundarios: e.musculos_secundarios as string[],
      equipamiento: e.equipamiento as string | null,
      descripcion: e.descripcion as string | null,
    }
  })
}

export function extractBase(bases: readonly BaseExercise[]): Batch {
  return normalizeBaseExercises(bases)
}
