// T001 (spec 005, FR-019, FR-031): la copia fijada de free-exercise-db. Si el archivo cambia, la carga
// debe detenerse: la versión solo se sube a propósito, cambiando la constante y esta prueba.
import { assert, assertEquals } from '@std/assert'

export const FREE_EXERCISE_DB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
export const FREE_EXERCISE_DB_SHA256 =
  '5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf'
export const FREE_EXERCISE_DB_DIR = new URL('./data/fuentes/free-exercise-db/', import.meta.url)

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.test('la copia fijada de free-exercise-db tiene el SHA-256 registrado', async () => {
  const bytes = await Deno.readFile(new URL('exercises.json', FREE_EXERCISE_DB_DIR))
  assertEquals(await sha256(bytes), FREE_EXERCISE_DB_SHA256)
})

Deno.test('la copia fijada tiene 876 ejercicios con los campos que usa la carga', async () => {
  const items = JSON.parse(
    await Deno.readTextFile(new URL('exercises.json', FREE_EXERCISE_DB_DIR)),
  ) as Record<string, unknown>[]
  assertEquals(items.length, 876)
  for (const item of items) {
    assert(typeof item.id === 'string' && item.id.length > 0, 'id')
    assert(typeof item.name === 'string' && item.name.length > 0, `name de ${item.id}`)
    assert(typeof item.category === 'string', `category de ${item.id}`)
    assert(Array.isArray(item.primaryMuscles), `primaryMuscles de ${item.id}`)
    assert(Array.isArray(item.secondaryMuscles), `secondaryMuscles de ${item.id}`)
    assert(item.equipment === null || typeof item.equipment === 'string', `equipment de ${item.id}`)
    assert(Array.isArray(item.instructions), `instructions de ${item.id}`)
  }
})

Deno.test('trae su licencia (Unlicense) y la nota de procedencia', async () => {
  const license = await Deno.readTextFile(new URL('LICENSE.md', FREE_EXERCISE_DB_DIR))
  assert(/unlicense/i.test(license), 'LICENSE.md debe ser la Unlicense')
  const readme = await Deno.readTextFile(new URL('README.md', FREE_EXERCISE_DB_DIR))
  assert(readme.includes(FREE_EXERCISE_DB_COMMIT), 'README.md debe anotar el commit')
  assert(readme.includes(FREE_EXERCISE_DB_SHA256), 'README.md debe anotar el SHA-256')
})
