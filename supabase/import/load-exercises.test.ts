// T038 (spec 005, FR-019, FR-031 a FR-034): cargador del catálogo de ejercicios, con un cliente doble.
import { assert, assertEquals, assertRejects, assertThrows } from '@std/assert'
import type { ImportBatchResult, SourceInfo } from './load.ts'
import {
  BATCH_SIZE,
  loadExercises,
  parseExerciseFlags,
  type ExerciseImportClient,
} from './load-exercises.ts'
import type { NormalizedExercise } from './normalize-exercises.ts'

function exercise(id: string, overrides: Partial<NormalizedExercise> = {}): NormalizedExercise {
  return {
    source_item_id: id,
    name: `Ejercicio ${id}`,
    name_status: 'machine_translated',
    original_name: `Exercise ${id}`,
    aliases: [],
    measurement_type: 'reps_weight',
    primary_muscles: ['chest'],
    secondary_muscles: [],
    equipment: 'barbell',
    description: '1. Hazlo.',
    description_status: 'machine_translated',
    ...overrides,
  }
}

const many = (count: number) => Array.from({ length: count }, (_, i) => exercise(`E${i}`))

const LICENSED: SourceInfo = {
  license_name: 'Unlicense',
  license_url: 'https://unlicense.org/',
  attribution: 'free-exercise-db',
}

class FakeClient implements ExerciseImportClient {
  calls: { slug: string; items: NormalizedExercise[]; drop: boolean }[] = []
  finished: { slug: string; report: unknown }[] = []
  constructor(
    private source: SourceInfo | null = LICENSED,
    private fail = false,
    private skippedPerBatch: Record<string, number> = {},
  ) {}
  getSource(): Promise<SourceInfo | null> {
    return Promise.resolve(this.source)
  }
  importExercises(slug: string, items: NormalizedExercise[], drop: boolean): Promise<ImportBatchResult> {
    if (this.fail) return Promise.reject(new Error('boom'))
    this.calls.push({ slug, items, drop })
    const skipped = Object.values(this.skippedPerBatch).reduce((a, b) => a + b, 0)
    return Promise.resolve({
      created: items.length - skipped,
      updated: 0,
      skipped,
      skipped_reasons: this.skippedPerBatch,
    })
  }
  finishImport(slug: string, report: unknown): Promise<void> {
    this.finished.push({ slug, report })
    return Promise.resolve()
  }
}

Deno.test('FR-019: rechaza una fuente sin licencia y no envía nada', async () => {
  const client = new FakeClient({ license_name: 'CC0 1.0', license_url: '', attribution: 'x' })
  const error = await assertRejects(() => loadExercises(client, { source: 'free-exercise-db', exercises: many(3) }))
  assertEquals((error as { code?: string }).code, 'license_missing')
  assertEquals(client.calls.length, 0)
  assertEquals(client.finished.length, 0)
})

Deno.test('una fuente inexistente se rechaza', async () => {
  const error = await assertRejects(() =>
    loadExercises(new FakeClient(null), { source: 'no-existe', exercises: many(1) }),
  )
  assertEquals((error as { code?: string }).code, 'source_not_found')
})

Deno.test('carga en lotes de 200 y cierra con el informe', async () => {
  assertEquals(BATCH_SIZE, 200)
  const client = new FakeClient()
  const report = await loadExercises(client, { source: 'free-exercise-db', exercises: many(450) })
  assertEquals(client.calls.map((c) => c.items.length), [200, 200, 50])
  assertEquals(report.created, 450)
  assertEquals(report.valid, 450)
  assertEquals(client.finished.length, 1)
  assertEquals(client.finished[0]!.slug, 'free-exercise-db')
})

Deno.test('--dry-run valida y cuenta sin escribir ni cerrar la carga', async () => {
  const client = new FakeClient()
  const report = await loadExercises(client, {
    source: 'free-exercise-db',
    exercises: [...many(5), exercise('MALO', { name: '' })],
    dryRun: true,
  })
  assertEquals(client.calls.length, 0)
  assertEquals(client.finished.length, 0)
  assertEquals(report.dry_run, true)
  assertEquals(report.valid, 5)
  assertEquals(report.skipped_reasons, { invalid_name: 1 })
})

Deno.test('--sin-descripcion se envía al servidor y las descripciones no viajan', async () => {
  const client = new FakeClient()
  await loadExercises(client, { source: 'free-exercise-db', exercises: many(3), dropDescriptions: true })
  assertEquals(client.calls[0]!.drop, true)
  assert(client.calls[0]!.items.every((item) => item.description === null && item.description_status === null))
})

Deno.test('sin --sin-descripcion las descripciones viajan tal cual', async () => {
  const client = new FakeClient()
  await loadExercises(client, { source: 'free-exercise-db', exercises: many(2) })
  assertEquals(client.calls[0]!.drop, false)
  assert(client.calls[0]!.items.every((item) => item.description === '1. Hazlo.'))
})

Deno.test('FR-034: los registros inválidos y repetidos se omiten con su motivo y el resto se carga', async () => {
  const client = new FakeClient()
  const report = await loadExercises(client, {
    source: 'free-exercise-db',
    exercises: [exercise('A'), exercise('B', { name: '   ' }), exercise('A'), exercise('C', { aliases: ['x'.repeat(81)] })],
    preSkipped: { no_translation: 4 },
  })
  assertEquals(report.valid, 1)
  assertEquals(report.duplicates, 1)
  assertEquals(report.skipped_reasons, {
    no_translation: 4,
    invalid_name: 1,
    invalid_aliases: 1,
    duplicate_item: 1,
  })
  assertEquals(report.skipped, 7)
  assertEquals(client.calls[0]!.items.map((i) => i.source_item_id), ['A'])
})

Deno.test('suma las omisiones del servidor al informe', async () => {
  const client = new FakeClient(LICENSED, false, { invalid_muscle: 2 })
  const report = await loadExercises(client, { source: 'free-exercise-db', exercises: many(10) })
  assertEquals(report.skipped_reasons, { invalid_muscle: 2 })
  assertEquals(report.skipped, 2)
  assertEquals(report.created, 8)
})

Deno.test('si un lote falla, la carga se detiene y no se cierra', async () => {
  const client = new FakeClient(LICENSED, true)
  const error = await assertRejects(() => loadExercises(client, { source: 'free-exercise-db', exercises: many(3) }))
  assertEquals((error as { code?: string }).code, 'batch_failed')
  assertEquals(client.finished.length, 0)
})

Deno.test('el informe solo lleva identificadores de la fuente, cantidades y motivos, sin datos personales', async () => {
  const report = await loadExercises(new FakeClient(), { source: 'free-exercise-db', exercises: many(2) })
  assertEquals(Object.keys(report).sort(), [
    'capped',
    'created',
    'dry_run',
    'duplicates',
    'received',
    'skipped',
    'skipped_reasons',
    'source',
    'updated',
    'valid',
  ])
})

Deno.test('opciones de la línea de comandos', () => {
  assertEquals(parseExerciseFlags(['--source', 'free-exercise-db']), {
    source: 'free-exercise-db',
    dryRun: false,
    dropDescriptions: false,
  })
  assertEquals(parseExerciseFlags(['--source', 'myguide-base', '--dry-run', '--sin-descripcion']), {
    source: 'myguide-base',
    dryRun: true,
    dropDescriptions: true,
  })
  assertEquals(parseExerciseFlags(['--source', 'muestra']).source, 'muestra')
  assertThrows(() => parseExerciseFlags([]), Error, '--source')
  assertThrows(() => parseExerciseFlags(['--source', 'otra']), Error, '--source')
  assertThrows(() => parseExerciseFlags(['--source', 'muestra', '--rara']), Error, '--rara')
})
