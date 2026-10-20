// T003 (spec 005): la muestra de desarrollo es válida según el contrato de la carga y cubre los casos
// que las pruebas y las pantallas necesitan.
import { assert, assertEquals } from '@std/assert'
import {
  EQUIPMENT,
  MAX_ALIAS,
  MAX_ALIASES,
  MAX_DESCRIPTION,
  MAX_NAME,
  MEASUREMENT_TYPES,
  MUSCLES,
  TEXT_STATUSES,
} from './exercise-lists.ts'

interface Row {
  source_item_id: string
  name: string
  name_status: string
  original_name: string | null
  aliases: string[]
  measurement_type: string
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string | null
  description: string | null
  description_status: string | null
}

const rows: Row[] = (await Deno.readTextFile(new URL('./data/ejercicios-muestra.ndjson', import.meta.url)))
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line))

const KEYS = [
  'source_item_id',
  'name',
  'name_status',
  'original_name',
  'aliases',
  'measurement_type',
  'primary_muscles',
  'secondary_muscles',
  'equipment',
  'description',
  'description_status',
].sort()

Deno.test('la muestra tiene unos 30 ejercicios con identificadores únicos', () => {
  assert(rows.length >= 28 && rows.length <= 36, `hay ${rows.length}`)
  assertEquals(new Set(rows.map((r) => r.source_item_id)).size, rows.length)
})

Deno.test('cada línea cumple el formato del contrato y las listas cerradas', () => {
  for (const r of rows) {
    const where = r.source_item_id
    assertEquals(Object.keys(r).sort(), KEYS, where)
    assert(r.name.trim() === r.name && r.name.length >= 1 && r.name.length <= MAX_NAME, `nombre de ${where}`)
    assert((TEXT_STATUSES as readonly string[]).includes(r.name_status), `name_status de ${where}`)
    assert((MEASUREMENT_TYPES as readonly string[]).includes(r.measurement_type), `tipo de ${where}`)
    assert(r.aliases.length <= MAX_ALIASES, `alias de ${where}`)
    for (const alias of r.aliases) {
      assert(alias.length >= 1 && alias.length <= MAX_ALIAS && alias !== r.name, `alias de ${where}`)
    }
    for (const m of [...r.primary_muscles, ...r.secondary_muscles]) {
      assert((MUSCLES as readonly string[]).includes(m), `músculo ${m} de ${where}`)
    }
    assertEquals(
      r.primary_muscles.filter((m) => r.secondary_muscles.includes(m)),
      [],
      `músculos repetidos en ${where}`,
    )
    assert(r.equipment === null || (EQUIPMENT as readonly string[]).includes(r.equipment), `equipamiento de ${where}`)
    // la descripción y su estado van juntos
    assertEquals(r.description === null, r.description_status === null, `descripción de ${where}`)
    if (r.description !== null) {
      assert(r.description.length <= MAX_DESCRIPTION, `largo de la descripción de ${where}`)
      assert((TEXT_STATUSES as readonly string[]).includes(r.description_status!), `estado de ${where}`)
    }
    // un nombre original solo lo traen los importados traducidos
    if (r.name_status === 'original') assertEquals(r.original_name, null, `original_name de ${where}`)
  }
})

Deno.test('la muestra cubre los casos que usan las pruebas y las pantallas', () => {
  for (const type of MEASUREMENT_TYPES) {
    assert(rows.some((r) => r.measurement_type === type), `falta el tipo ${type}`)
  }
  assert(rows.some((r) => r.equipment === null), 'falta un ejercicio sin equipamiento')
  assert(rows.some((r) => r.equipment === 'body only'), 'falta uno de peso corporal')
  assert(rows.some((r) => r.description === null), 'falta uno sin descripción')
  assert(rows.some((r) => r.name_status === 'reviewed'), 'falta uno con nombre revisado')
  assert(rows.some((r) => r.name_status === 'machine_translated'), 'falta uno sin revisar')
  assert(rows.some((r) => r.aliases.length > 0), 'faltan alias')
  assert(rows.some((r) => r.original_name !== null), 'falta un nombre original')
  assert(rows.some((r) => r.secondary_muscles.length > 0), 'faltan músculos secundarios')
  assert(rows.some((r) => r.primary_muscles.length === 0), 'falta uno sin músculo principal (sin dato)')
  assert(rows.some((r) => r.source_item_id.startsWith('base-')), 'falta uno de la fuente propia')
})
