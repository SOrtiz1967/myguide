// T044 a T047 (spec 005, FR-020, FR-035): las traducciones de free-exercise-db al español.
//
// Tienen dos niveles de prueba:
//  1. la FORMA de las entradas que existan (siempre se verifica), y
//  2. la COBERTURA TOTAL (todo ejercicio de la fuente tiene su entrada), que se activa con la constante
//     TRADUCCION_COMPLETA cuando termina el último tramo, para que `test:import` no quede en rojo mientras
//     se traduce por partes.
import { assert, assertEquals } from '@std/assert'
import { parseTranslations } from './extract-exercises.ts'
import type { SourceExercise } from './normalize-exercises.ts'

/** Se pone en `true` al terminar el último tramo de la traducción (T047). */
const TRADUCCION_COMPLETA = true

/** Nombres que son idénticos en inglés y en español (préstamos o nombres propios). */
const SAME_AS_ENGLISH_OK = new Set<string>([])

const sources = JSON.parse(
  await Deno.readTextFile(new URL('./data/fuentes/free-exercise-db/exercises.json', import.meta.url)),
) as SourceExercise[]
const byId = new Map(sources.map((s) => [s.id, s]))
const translations = parseTranslations(
  await Deno.readTextFile(new URL('./data/ejercicios-es.json', import.meta.url)),
)

const norm = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

Deno.test('cada entrada corresponde a un ejercicio de la fuente', () => {
  const unknown = [...translations.keys()].filter((id) => !byId.has(id))
  assertEquals(unknown, [])
})

Deno.test('ningún nombre está vacío ni repite el nombre en inglés sin estar permitido', () => {
  const same = [...translations.entries()]
    .filter(([id, t]) => norm(t.nombre) === norm(byId.get(id)?.name ?? '') && !SAME_AS_ENGLISH_OK.has(id))
    .map(([id]) => id)
  assertEquals(same, [])
})

Deno.test('los nombres en español no se repiten entre ejercicios', () => {
  const owners = new Map<string, string[]>()
  for (const [id, t] of translations) {
    const key = norm(t.nombre)
    owners.set(key, [...(owners.get(key) ?? []), id])
  }
  const repeated = [...owners.entries()].filter(([, ids]) => ids.length > 1)
  assertEquals(repeated, [])
})

Deno.test('los nombres y los alias respetan los largos de la base', () => {
  for (const [id, t] of translations) {
    assert(t.nombre.length <= 120, `nombre demasiado largo: ${id}`)
    assert(t.sinonimos.length <= 10, `demasiados sinónimos: ${id}`)
    for (const alias of t.sinonimos) assert(alias.trim().length >= 1 && alias.length <= 80, `alias inválido en ${id}`)
  }
})

Deno.test('cada paso es un texto no vacío y la descripción cabe en la base', () => {
  for (const [id, t] of translations) {
    for (const paso of t.pasos) assert(paso.trim() !== '', `paso vacío en ${id}`)
    assert(t.pasos.join('\n').length <= 3900, `descripción demasiado larga en ${id}`)
  }
})

Deno.test('un ejercicio con pasos en la fuente trae sus pasos traducidos, y uno sin pasos no inventa', () => {
  for (const [id, t] of translations) {
    const steps = byId.get(id)?.instructions.length ?? 0
    if (steps > 0) assert(t.pasos.length > 0, `faltan los pasos de ${id}`)
    else assertEquals(t.pasos, [], `${id} no tiene pasos en la fuente`)
  }
})

Deno.test('no quedan frases enteras en inglés en los nombres ni en los pasos', () => {
  const english = /\b(the|your|with|and|until|then|from|back to|should|repeat)\b/i
  const suspicious: string[] = []
  for (const [id, t] of translations) {
    if (english.test(t.nombre) || t.pasos.some((p) => english.test(p))) suspicious.push(id)
  }
  assertEquals(suspicious, [])
})

Deno.test({
  name: 'COBERTURA TOTAL: todo ejercicio de la fuente tiene su traducción',
  ignore: !TRADUCCION_COMPLETA,
  fn: () => {
    const missing = sources.filter((s) => !translations.has(s.id)).map((s) => s.id)
    assertEquals(missing, [])
  },
})
