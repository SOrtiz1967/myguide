// T036 (spec 005, FR-014, FR-016, FR-020, FR-034, FR-035): normalización y validación de los ejercicios
// que se importan (contracts/import-pipeline.md). Todo lo que entra a la base pasa por aquí. Un dato
// opcional ausente es `null` o `[]`, nunca un valor supuesto.
import { assertEquals } from '@std/assert'
import {
  dedupeById,
  joinSteps,
  measurementFor,
  normalizeBaseExercise,
  normalizeFreeExercise,
  normalizeSourceExercises,
  validateExercise,
  type BaseExercise,
  type NormalizedExercise,
  type SourceExercise,
  type Translation,
} from './normalize-exercises.ts'

function source(overrides: Partial<SourceExercise> = {}): SourceExercise {
  return {
    id: 'Barbell_Squat',
    name: 'Barbell Squat',
    category: 'powerlifting',
    equipment: 'barbell',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    instructions: ['Place the bar.', 'Squat down.', 'Stand up.'],
    ...overrides,
  }
}

function translation(overrides: Partial<Translation> = {}): Translation {
  return {
    nombre: 'Sentadilla con barra',
    sinonimos: ['Cuclillas con barra'],
    pasos: ['Apoya la barra.', 'Baja.', 'Sube.'],
    nombre_estado: 'machine_translated',
    pasos_estado: 'machine_translated',
    ...overrides,
  }
}

const NO_OVERRIDES = new Map<string, never>()

function ok(result: ReturnType<typeof normalizeFreeExercise>): NormalizedExercise {
  if (!result.ok) throw new Error(`se esperaba un ejercicio válido y se omitió: ${result.reason}`)
  return result.exercise
}

function exercise(overrides: Partial<NormalizedExercise> = {}): NormalizedExercise {
  return {
    source_item_id: 'A',
    name: 'Plancha',
    name_status: 'original',
    original_name: null,
    aliases: [],
    measurement_type: 'duration',
    primary_muscles: [],
    secondary_muscles: [],
    equipment: null,
    description: null,
    description_status: null,
    ...overrides,
  }
}

Deno.test('mapea los campos de la fuente y de la traducción al formato del contrato', () => {
  const result = ok(normalizeFreeExercise(source(), translation(), NO_OVERRIDES))
  assertEquals(result, {
    source_item_id: 'Barbell_Squat',
    name: 'Sentadilla con barra',
    name_status: 'machine_translated',
    original_name: 'Barbell Squat',
    aliases: ['Cuclillas con barra'],
    measurement_type: 'reps_weight',
    primary_muscles: ['quadriceps'],
    secondary_muscles: ['glutes', 'hamstrings'],
    equipment: 'barbell',
    description: '1. Apoya la barra.\n2. Baja.\n3. Sube.',
    description_status: 'machine_translated',
  })
})

Deno.test('los estados del nombre y de los pasos salen de la traducción, cada uno por su lado', () => {
  const result = ok(
    normalizeFreeExercise(
      source(),
      translation({ nombre_estado: 'reviewed', pasos_estado: 'machine_translated' }),
      NO_OVERRIDES,
    ),
  )
  assertEquals([result.name_status, result.description_status], ['reviewed', 'machine_translated'])
})

Deno.test('FR-034: el equipamiento ausente es null y no se convierte en «body only»', () => {
  assertEquals(ok(normalizeFreeExercise(source({ equipment: null }), translation(), NO_OVERRIDES)).equipment, null)
})

Deno.test('FR-035: los músculos y el equipamiento sin equivalente se omiten del arreglo y se cuentan', () => {
  const result = normalizeFreeExercise(
    source({ primaryMuscles: ['quadriceps', 'cuello raro'], secondaryMuscles: ['glutes', 'otro'], equipment: 'trineo' }),
    translation(),
    NO_OVERRIDES,
  )
  if (!result.ok) throw new Error('se esperaba un ejercicio válido')
  assertEquals(result.exercise.primary_muscles, ['quadriceps'])
  assertEquals(result.exercise.secondary_muscles, ['glutes'])
  assertEquals(result.exercise.equipment, null)
  assertEquals(result.unmapped, { unmapped_muscle: 2, unmapped_equipment: 1 })
})

Deno.test('un músculo que es principal y secundario queda solo como principal', () => {
  const result = ok(
    normalizeFreeExercise(source({ primaryMuscles: ['chest'], secondaryMuscles: ['chest', 'triceps'] }), translation(), NO_OVERRIDES),
  )
  assertEquals(result.secondary_muscles, ['triceps'])
})

Deno.test('las reglas del tipo de medición, por categoría y equipamiento', () => {
  const type = (overrides: Partial<SourceExercise>) => measurementFor(source(overrides), NO_OVERRIDES)
  assertEquals(type({ category: 'stretching', equipment: null }), 'duration')
  assertEquals(type({ category: 'stretching', equipment: 'foam roll' }), 'duration')
  assertEquals(type({ category: 'cardio', equipment: 'machine' }), 'duration')
  assertEquals(type({ category: 'plyometrics', equipment: 'medicine ball' }), 'reps_bodyweight')
  assertEquals(type({ category: 'strength', equipment: 'body only' }), 'reps_bodyweight')
  assertEquals(type({ category: 'strength', equipment: 'barbell' }), 'reps_weight')
  assertEquals(type({ category: 'strength', equipment: 'dumbbell' }), 'reps_weight')
  assertEquals(type({ category: 'strength', equipment: 'cable' }), 'reps_weight')
  assertEquals(type({ category: 'strength', equipment: 'machine' }), 'reps_weight')
  assertEquals(type({ category: 'strength', equipment: 'kettlebells' }), 'reps_weight')
  assertEquals(type({ category: 'strength', equipment: 'bands' }), 'reps_weight')
  assertEquals(type({ category: 'strength', equipment: 'other' }), 'reps_weight')
  assertEquals(type({ category: 'powerlifting' }), 'reps_weight')
  assertEquals(type({ category: 'olympic weightlifting' }), 'reps_weight')
  assertEquals(type({ category: 'strongman' }), 'reps_weight')
})

Deno.test('una excepción de ejercicios-medicion.csv gana sobre la regla', () => {
  const overrides = new Map([['Barbell_Squat', 'distance_duration' as const]])
  assertEquals(measurementFor(source(), overrides), 'distance_duration')
  assertEquals(measurementFor(source({ id: 'Otro' }), overrides), 'reps_weight')
})

Deno.test('FR-016: sin tipo determinable se omite con no_measurement_type', () => {
  const result = normalizeFreeExercise(source({ category: 'yoga-inventada' }), translation(), NO_OVERRIDES)
  assertEquals(result, { ok: false, reason: 'no_measurement_type' })
})

Deno.test('sin traducción se omite con no_translation', () => {
  assertEquals(normalizeFreeExercise(source(), undefined, NO_OVERRIDES), { ok: false, reason: 'no_translation' })
})

Deno.test('con pasos en la fuente pero sin pasos traducidos se omite con no_translation', () => {
  assertEquals(normalizeFreeExercise(source(), translation({ pasos: [] }), NO_OVERRIDES), {
    ok: false,
    reason: 'no_translation',
  })
})

Deno.test('sin pasos en la fuente, la descripción y su estado son null', () => {
  const result = ok(normalizeFreeExercise(source({ instructions: [] }), translation({ pasos: [] }), NO_OVERRIDES))
  assertEquals([result.description, result.description_status], [null, null])
})

Deno.test('los pasos se unen numerados, uno por línea, sin pasos vacíos', () => {
  assertEquals(joinSteps(['Uno.', '  ', 'Dos.', ' Tres. ']), '1. Uno.\n2. Dos.\n3. Tres.')
  assertEquals(joinSteps([]), '')
})

Deno.test('los alias repetidos o iguales al nombre se descartan en silencio', () => {
  const result = ok(
    normalizeFreeExercise(
      source(),
      translation({ sinonimos: ['Cuclillas', 'cuclillas', 'SENTADILLA CON BARRA', '  ', 'Sentadilla trasera'] }),
      NO_OVERRIDES,
    ),
  )
  assertEquals(result.aliases, ['Cuclillas', 'Sentadilla trasera'])
})

Deno.test('validateExercise: nombre vacío o de más de 120 caracteres', () => {
  assertEquals(validateExercise(exercise({ name: '   ' })), { ok: false, reason: 'invalid_name' })
  assertEquals(validateExercise(exercise({ name: 'a'.repeat(121) })), { ok: false, reason: 'invalid_name' })
  assertEquals(validateExercise(exercise({ name: 'a'.repeat(120) })).ok, true)
})

Deno.test('validateExercise: descripción de más de 4.000 caracteres', () => {
  assertEquals(validateExercise(exercise({ description: 'a'.repeat(4001), description_status: 'original' })), {
    ok: false,
    reason: 'description_too_long',
  })
  assertEquals(validateExercise(exercise({ description: 'a'.repeat(4000), description_status: 'original' })).ok, true)
})

Deno.test('validateExercise: alias de más de 80 caracteres o más de 10 alias', () => {
  assertEquals(validateExercise(exercise({ aliases: ['a'.repeat(81)] })), { ok: false, reason: 'invalid_aliases' })
  assertEquals(
    validateExercise(exercise({ aliases: Array.from({ length: 11 }, (_, i) => `alias ${i}`) })),
    { ok: false, reason: 'invalid_aliases' },
  )
})

Deno.test('un identificador repetido en la misma fuente: gana el primero y se cuenta el resto', () => {
  const first = exercise({ source_item_id: 'A', name: 'Primero' })
  const second = exercise({ source_item_id: 'A', name: 'Segundo' })
  const other = exercise({ source_item_id: 'B', name: 'Otro' })
  const result = dedupeById([first, second, other])
  assertEquals(result.exercises.map((e) => e.name), ['Primero', 'Otro'])
  assertEquals(result.duplicates, 1)
})

Deno.test('normalizeSourceExercises: arma el lote y cuenta las omisiones por motivo', () => {
  const translations = new Map<string, Translation>([
    ['A', translation()],
    ['B', translation({ nombre: 'Plancha' })],
  ])
  const batch = normalizeSourceExercises(
    [
      source({ id: 'A' }),
      source({ id: 'B', category: 'stretching', equipment: null, instructions: ['x'] }),
      source({ id: 'C' }), // sin traducción
      source({ id: 'D', category: 'rara' }), // sin traducción ni tipo
      source({ id: 'A' }), // repetido
    ],
    translations,
    NO_OVERRIDES,
  )
  assertEquals(batch.exercises.map((e) => e.source_item_id), ['A', 'B'])
  assertEquals(batch.skipped, { no_translation: 2, duplicate_item: 1 })
})

Deno.test('una entrada marcada como revisada se conserva tal cual en el lote', () => {
  const translations = new Map<string, Translation>([['A', translation({ nombre: 'Nombre revisado', nombre_estado: 'reviewed' })]])
  const batch = normalizeSourceExercises([source({ id: 'A' })], translations, NO_OVERRIDES)
  assertEquals([batch.exercises[0]!.name, batch.exercises[0]!.name_status], ['Nombre revisado', 'reviewed'])
})

Deno.test('la fuente propia myguide-base se normaliza con su forma ya en español', () => {
  const base: BaseExercise = {
    id: 'base-caminar',
    nombre: 'Caminar',
    sinonimos: ['Caminata'],
    tipo_medicion: 'distance_duration',
    musculos_principales: ['quadriceps'],
    musculos_secundarios: ['glutes'],
    equipamiento: 'body only',
    descripcion: 'Caminata a ritmo cómodo.',
  }
  const result = normalizeBaseExercise(base)
  if (!result.ok) throw new Error(`se omitió: ${result.reason}`)
  assertEquals(result.exercise, {
    source_item_id: 'base-caminar',
    name: 'Caminar',
    name_status: 'original',
    original_name: null,
    aliases: ['Caminata'],
    measurement_type: 'distance_duration',
    primary_muscles: ['quadriceps'],
    secondary_muscles: ['glutes'],
    equipment: 'body only',
    description: 'Caminata a ritmo cómodo.',
    description_status: 'original',
  })
  assertEquals(normalizeBaseExercise({ ...base, tipo_medicion: 'sets' }), { ok: false, reason: 'no_measurement_type' })
  assertEquals(normalizeBaseExercise({ ...base, nombre: '' }), { ok: false, reason: 'invalid_name' })
  assertEquals(normalizeBaseExercise({ ...base, equipamiento: null, descripcion: null }).ok, true)
})
