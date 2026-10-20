// T037 (spec 005, FR-019, FR-031, FR-035): extractores de free-exercise-db (con su SHA-256 fijado) y de la
// fuente propia myguide-base, y lectura estricta de los archivos que mantiene el autor.
import { assert, assertEquals, assertRejects, assertThrows } from '@std/assert'
import { extractBase, parseBase } from './extract-exercises-base.ts'
import {
  extractFreeExerciseDb,
  parseOverrides,
  parseTranslations,
  SourceHashMismatch,
  toNdjson,
} from './extract-exercises.ts'

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

const SOURCE = [
  {
    id: 'Barbell_Squat',
    name: 'Barbell Squat',
    category: 'powerlifting',
    equipment: 'barbell',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes'],
    instructions: ['Place the bar.', 'Squat.'],
    images: ['x/0.jpg'],
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
  },
  {
    id: 'Running_Treadmill',
    name: 'Running, Treadmill',
    category: 'cardio',
    equipment: 'machine',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    instructions: ['Run.'],
  },
]

const TRANSLATIONS = JSON.stringify({
  Barbell_Squat: {
    nombre: 'Sentadilla con barra',
    sinonimos: ['Cuclillas con barra'],
    pasos: ['Apoya la barra.', 'Baja.'],
    nombre_estado: 'machine_translated',
    pasos_estado: 'machine_translated',
  },
  Running_Treadmill: {
    nombre: 'Correr en cinta',
    sinonimos: [],
    pasos: ['Corre.'],
    nombre_estado: 'reviewed',
    pasos_estado: 'reviewed',
  },
})

const OVERRIDES = 'source_item_id,tipo,motivo\nRunning_Treadmill,distance_duration,avanza por distancia\n'

Deno.test('extractFreeExerciseDb aplica las traducciones y las excepciones de medición', async () => {
  const bytes = encode(SOURCE)
  const batch = await extractFreeExerciseDb({
    bytes,
    expectedSha256: await sha256(bytes),
    translations: parseTranslations(TRANSLATIONS),
    overrides: parseOverrides(OVERRIDES),
  })
  assertEquals(batch.exercises.map((e) => [e.source_item_id, e.name, e.measurement_type]), [
    ['Barbell_Squat', 'Sentadilla con barra', 'reps_weight'],
    ['Running_Treadmill', 'Correr en cinta', 'distance_duration'],
  ])
  assertEquals(batch.exercises[0]!.original_name, 'Barbell Squat')
  assertEquals(batch.exercises[1]!.name_status, 'reviewed')
  // las imágenes, la fuerza, el nivel y la mecánica no se importan
  assert(!('images' in batch.exercises[0]!))
  assertEquals(batch.skipped, {})
})

Deno.test('se detiene si el SHA-256 no coincide, antes de leer el contenido', async () => {
  const bytes = encode(SOURCE)
  await assertRejects(
    () =>
      extractFreeExerciseDb({
        bytes,
        expectedSha256: '0'.repeat(64),
        translations: parseTranslations(TRANSLATIONS),
        overrides: parseOverrides(OVERRIDES),
      }),
    SourceHashMismatch,
  )
  // aunque el contenido no sea JSON, el error es el del SHA-256 y no el de la lectura
  const garbage = new TextEncoder().encode('esto no es json')
  await assertRejects(
    () =>
      extractFreeExerciseDb({
        bytes: garbage,
        expectedSha256: '0'.repeat(64),
        translations: new Map(),
        overrides: new Map(),
      }),
    SourceHashMismatch,
  )
})

Deno.test('sin traducción para un ejercicio se omite y se cuenta', async () => {
  const bytes = encode(SOURCE)
  const batch = await extractFreeExerciseDb({
    bytes,
    expectedSha256: await sha256(bytes),
    translations: parseTranslations(JSON.stringify({ Barbell_Squat: JSON.parse(TRANSLATIONS).Barbell_Squat })),
    overrides: new Map(),
  })
  assertEquals(batch.exercises.map((e) => e.source_item_id), ['Barbell_Squat'])
  assertEquals(batch.skipped, { no_translation: 1 })
})

Deno.test('parseTranslations lee el archivo del autor y rechaza lo mal formado', () => {
  const map = parseTranslations(TRANSLATIONS)
  assertEquals([...map.keys()], ['Barbell_Squat', 'Running_Treadmill'])
  assertEquals(map.get('Barbell_Squat')!.sinonimos, ['Cuclillas con barra'])
  assertEquals(parseTranslations('{}').size, 0)

  const entry = JSON.parse(TRANSLATIONS).Barbell_Squat
  const bad = (change: Record<string, unknown>) => JSON.stringify({ X: { ...entry, ...change } })
  assertThrows(() => parseTranslations(bad({ nombre: '' })), Error, 'X')
  assertThrows(() => parseTranslations(bad({ nombre_estado: 'dudoso' })), Error, 'X')
  assertThrows(() => parseTranslations(bad({ pasos_estado: 'original' })), Error, 'X')
  assertThrows(() => parseTranslations(bad({ sinonimos: 'no es lista' })), Error, 'X')
  assertThrows(() => parseTranslations(bad({ pasos: [1, 2] })), Error, 'X')
  assertThrows(() => parseTranslations('[]'), Error)
  assertThrows(() => parseTranslations('no es json'), Error)
})

Deno.test('parseOverrides lee el CSV y rechaza tipos inválidos o identificadores repetidos', () => {
  const map = parseOverrides(OVERRIDES)
  assertEquals([...map.entries()], [['Running_Treadmill', 'distance_duration']])
  assertEquals(parseOverrides('source_item_id,tipo,motivo\n').size, 0)
  assertEquals(parseOverrides('').size, 0)
  assertThrows(() => parseOverrides('source_item_id,tipo,motivo\nA,sets,x\n'), Error, 'A')
  assertThrows(() => parseOverrides('source_item_id,tipo,motivo\nA,duration,x\nA,reps_weight,y\n'), Error, 'A')
})

const BASE = [
  {
    id: 'base-caminar',
    nombre: 'Caminar',
    sinonimos: ['Caminata'],
    tipo_medicion: 'distance_duration',
    musculos_principales: ['quadriceps'],
    musculos_secundarios: ['glutes'],
    equipamiento: 'body only',
    descripcion: 'Caminata a ritmo cómodo.',
  },
  {
    id: 'base-yoga',
    nombre: 'Yoga',
    sinonimos: [],
    tipo_medicion: 'duration',
    musculos_principales: [],
    musculos_secundarios: [],
    equipamiento: null,
    descripcion: null,
  },
]

Deno.test('extractBase normaliza la fuente propia: textos originales, sin nombre original', () => {
  const batch = extractBase(parseBase(JSON.stringify(BASE)))
  assertEquals(batch.exercises.map((e) => e.source_item_id), ['base-caminar', 'base-yoga'])
  assertEquals(batch.exercises[0]!.name_status, 'original')
  assertEquals(batch.exercises[0]!.original_name, null)
  assertEquals(batch.exercises[1]!.description, null)
  assertEquals(batch.skipped, {})
})

Deno.test('parseBase rechaza una forma inválida', () => {
  assertThrows(() => parseBase('{}'), Error)
  assertThrows(() => parseBase(JSON.stringify([{ ...BASE[0], id: '' }])), Error)
  assertThrows(() => parseBase(JSON.stringify([{ ...BASE[0], sinonimos: 'x' }])), Error)
  assertThrows(() => parseBase(JSON.stringify([BASE[0], BASE[0]])), Error, 'base-caminar')
})

Deno.test('toNdjson produce una línea por ejercicio con los campos del contrato', () => {
  const batch = extractBase(parseBase(JSON.stringify(BASE)))
  const lines = toNdjson(batch.exercises).trimEnd().split('\n')
  assertEquals(lines.length, 2)
  const first = JSON.parse(lines[0]!)
  assertEquals(Object.keys(first).sort(), [
    'aliases',
    'description',
    'description_status',
    'equipment',
    'measurement_type',
    'name',
    'name_status',
    'original_name',
    'primary_muscles',
    'secondary_muscles',
    'source_item_id',
  ])
  assertEquals(first.source_item_id, 'base-caminar')
})
