// T041 (spec 005, FR-016, FR-035): las excepciones del tipo de medición cubren lo que la regla por categoría
// no resuelve, y ningún ejercicio de la fuente queda sin tipo.
import { assert, assertEquals } from '@std/assert'
import { parseOverrides } from './extract-exercises.ts'
import { measurementFor, type SourceExercise } from './normalize-exercises.ts'

const sources = JSON.parse(
  await Deno.readTextFile(new URL('./data/fuentes/free-exercise-db/exercises.json', import.meta.url)),
) as SourceExercise[]
const overrides = parseOverrides(
  await Deno.readTextFile(new URL('./data/ejercicios-medicion.csv', import.meta.url)),
)
const none = new Map()

Deno.test('ningún ejercicio de la fuente queda sin tipo de medición', () => {
  const missing = sources.filter((s) => measurementFor(s, overrides) === null).map((s) => s.id)
  assertEquals(missing, [])
})

Deno.test('cada excepción apunta a un ejercicio que existe en la fuente', () => {
  const ids = new Set(sources.map((s) => s.id))
  const unknown = [...overrides.keys()].filter((id) => !ids.has(id))
  assertEquals(unknown, [])
})

Deno.test('ninguna excepción es redundante: cada una cambia lo que daría la regla', () => {
  const redundant = sources
    .filter((s) => overrides.has(s.id) && measurementFor(s, none) === overrides.get(s.id))
    .map((s) => s.id)
  assertEquals(redundant, [])
})

Deno.test('el resultado cubre los cuatro tipos y los casos conocidos', () => {
  const byId = new Map(sources.map((s) => [s.id, measurementFor(s, overrides)]))
  const counts = new Map<string, number>()
  for (const type of byId.values()) counts.set(type!, (counts.get(type!) ?? 0) + 1)
  for (const type of ['reps_weight', 'reps_bodyweight', 'duration', 'distance_duration']) {
    assert((counts.get(type) ?? 0) > 0, `ningún ejercicio es de tipo ${type}`)
  }
  assertEquals(byId.get('Plank'), 'duration')
  assertEquals(byId.get('Running_Treadmill'), 'distance_duration')
  assertEquals(byId.get('Barbell_Squat'), 'reps_weight')
  assertEquals(byId.get('Pushups'), 'reps_bodyweight')
  assertEquals(byId.get('Farmers_Walk'), 'distance_duration')
  assertEquals(byId.get('Rope_Jumping'), 'duration')
  assertEquals(byId.get('Weighted_Pull_Ups'), 'reps_weight')
})
