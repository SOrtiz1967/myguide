// T042 (spec 005, FR-019, FR-031): la fuente propia `myguide-base` (obra del autor, CC0) es válida según el
// contrato de la carga, y sus identificadores son estables y únicos.
import { assert, assertEquals } from '@std/assert'
import { BASE_FILE, extractBase, parseBase } from './extract-exercises-base.ts'

const bases = parseBase(await Deno.readTextFile(BASE_FILE))

Deno.test('hay entre 15 y 30 ejercicios de resistencia, deporte y movilidad', () => {
  assert(bases.length >= 15 && bases.length <= 30, `hay ${bases.length}`)
})

Deno.test('todos se normalizan sin omisiones y con los textos originales', () => {
  const batch = extractBase(bases)
  assertEquals(batch.skipped, {})
  assertEquals(batch.exercises.length, bases.length)
  for (const exercise of batch.exercises) {
    assertEquals(exercise.name_status, 'original', exercise.source_item_id)
    assertEquals(exercise.original_name, null, exercise.source_item_id)
  }
})

Deno.test('los identificadores son únicos, estables y empiezan con «base-»', () => {
  const ids = bases.map((b) => b.id)
  assertEquals(new Set(ids).size, ids.length)
  for (const id of ids) assert(/^base-[a-z0-9-]+$/.test(id), `identificador inválido: ${id}`)
})

Deno.test('los nombres no se repiten (sin importar acentos ni mayúsculas)', () => {
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const names = bases.flatMap((b) => [b.nombre, ...b.sinonimos]).map(norm)
  assertEquals(new Set(names).size, names.length)
})

Deno.test('cubre la resistencia (tiempo y distancia) y no registra repeticiones ni peso', () => {
  const types = new Set(bases.map((b) => b.tipo_medicion))
  assert(types.has('duration') && types.has('distance_duration'))
  assert(!types.has('reps_weight') && !types.has('reps_bodyweight'))
})

Deno.test('cada ejercicio tiene una descripción breve en español', () => {
  for (const base of bases) {
    assert(base.descripcion !== null && base.descripcion.trim().length >= 20, `sin descripción: ${base.id}`)
    assert(base.descripcion.length <= 600, `descripción demasiado larga: ${base.id}`)
  }
})
