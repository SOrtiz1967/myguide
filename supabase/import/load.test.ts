// T041 (spec 002, FR-013, FR-025, FR-026, FR-028): el cargador, con un cliente simulado.
import { assert, assertEquals, assertRejects } from '@std/assert'
import {
  type ImportBatchResult,
  type ImportClient,
  LoadError,
  loadFoods,
  redact,
  type SourceInfo,
} from './load.ts'
import type { NormalizedFood } from './normalize.ts'

function food(id: string, overrides: Partial<NormalizedFood> = {}): NormalizedFood {
  return {
    source_item_id: id,
    name: `Alimento ${id}`,
    name_status: 'original',
    brand: null,
    reference_basis: '100g',
    energy_kcal: 100,
    protein_g: null,
    carbs_g: null,
    sugars_g: null,
    fat_g: null,
    saturated_fat_g: null,
    fiber_g: null,
    sodium_mg: null,
    portions: [],
    ...overrides,
  }
}

const validSource: SourceInfo = {
  license_name: 'CC0 1.0',
  license_url: 'https://ej.test/l',
  attribution: 'Atribución',
}

interface FakeClient extends ImportClient {
  batches: NormalizedFood[][]
  finished: Array<Record<string, unknown>>
}

function fakeClient(
  options: {
    source?: SourceInfo | null
    importFoods?: (batch: NormalizedFood[], call: number) => Promise<ImportBatchResult>
  } = {},
): FakeClient {
  const batches: NormalizedFood[][] = []
  const finished: Array<Record<string, unknown>> = []
  return {
    batches,
    finished,
    getSource: () => Promise.resolve('source' in options ? options.source! : validSource),
    importFoods: (_slug, batch) => {
      batches.push(batch)
      return options.importFoods
        ? options.importFoods(batch, batches.length)
        : Promise.resolve({ created: batch.length, updated: 0, skipped: 0, skipped_reasons: {} })
    },
    finishImport: (_slug, report) => {
      finished.push(report as unknown as Record<string, unknown>)
      return Promise.resolve()
    },
  }
}

const many = (count: number) => Array.from({ length: count }, (_, i) => food(String(i)))

Deno.test('carga en lotes de 500 y cierra con finish_import', async () => {
  const client = fakeClient()
  const report = await loadFoods(client, { source: 'x', foods: many(1200) })
  assertEquals(client.batches.map((b) => b.length), [500, 500, 200])
  assertEquals(report.created, 1200)
  assertEquals(client.finished.length, 1)
  assertEquals(client.finished[0].created, 1200)
})

Deno.test('--dry-run valida y cuenta sin escribir nada', async () => {
  const client = fakeClient()
  const report = await loadFoods(client, {
    source: 'x',
    foods: [...many(3), food('malo', { energy_kcal: -1 })],
    dryRun: true,
  })
  assertEquals(client.batches.length, 0)
  assertEquals(client.finished.length, 0)
  assertEquals(report.dry_run, true)
  assertEquals(report.valid, 3)
  assertEquals(report.skipped, 1)
  assertEquals(report.skipped_reasons, { negative_value: 1 })
  assertEquals(report.created, 0)
})

Deno.test('FR-013: rechaza una fuente sin licencia ni atribución (license_missing) y no carga nada', async () => {
  for (
    const source of [
      { license_name: '', license_url: 'https://ej.test/l', attribution: 'A' },
      { license_name: 'CC0', license_url: ' ', attribution: 'A' },
      { license_name: 'CC0', license_url: 'https://ej.test/l', attribution: '' },
    ]
  ) {
    const client = fakeClient({ source })
    const error = await assertRejects(
      () => loadFoods(client, { source: 'x', foods: many(2) }),
      LoadError,
    )
    assertEquals(error.code, 'license_missing')
    assertEquals(client.batches.length, 0)
  }
})

Deno.test('una fuente que no existe se rechaza (source_not_found)', async () => {
  const client = fakeClient({ source: null })
  const error = await assertRejects(
    () => loadFoods(client, { source: 'x', foods: many(1) }),
    LoadError,
  )
  assertEquals(error.code, 'source_not_found')
})

Deno.test('el informe suma lo creado, actualizado y omitido, con los motivos', async () => {
  const client = fakeClient({
    importFoods: (batch) =>
      Promise.resolve({
        created: batch.length - 2,
        updated: 1,
        skipped: 1,
        skipped_reasons: { invalid: 1 },
      }),
  })
  const report = await loadFoods(client, {
    source: 'x',
    foods: [...many(10), food('neg', { energy_kcal: -3 }), food('', { energy_kcal: 1 })],
  })
  assertEquals(report.created, 8)
  assertEquals(report.updated, 1)
  // 1 inválido en la base + 2 descartados antes (negativo y sin código)
  assertEquals(report.skipped, 3)
  assertEquals(report.skipped_reasons, { invalid: 1, negative_value: 1, no_code: 1 })
})

Deno.test('FR-026: los duplicados dentro de la fuente conservan el más completo', async () => {
  const client = fakeClient()
  const report = await loadFoods(client, {
    source: 'x',
    foods: [food('1', { name: 'Corto' }), food('1', { name: 'Completo', protein_g: 3 })],
  })
  assertEquals(client.batches[0].map((f) => f.name), ['Completo'])
  assertEquals(report.duplicates, 1)
})

Deno.test('el tope de volumen prioriza los más completos', async () => {
  const client = fakeClient()
  const report = await loadFoods(client, {
    source: 'x',
    limit: 2,
    foods: [
      food('a'),
      food('b', { protein_g: 1, fat_g: 1 }),
      food('c', { protein_g: 1 }),
      food('d'),
    ],
  })
  assertEquals(client.batches[0].map((f) => f.source_item_id), ['b', 'c'])
  assertEquals(report.capped, 2)
})

Deno.test('un lote que falla detiene la carga sin cerrarla y conserva el motivo', async () => {
  const client = fakeClient({
    importFoods: (_batch, call) =>
      call === 2
        ? Promise.reject(new Error('connection reset'))
        : Promise.resolve({ created: 500, updated: 0, skipped: 0, skipped_reasons: {} }),
  })
  const error = await assertRejects(
    () => loadFoods(client, { source: 'x', foods: many(1200) }),
    LoadError,
  )
  assertEquals(error.code, 'batch_failed')
  assert(error.message.includes('connection reset'))
  assertEquals(client.finished.length, 0)
})

Deno.test('redact quita las claves secretas de cualquier texto', () => {
  const key = 'eyJSECRETO.clave.de.servicio'
  const text = `fallo al conectar con Authorization: Bearer ${key} y apikey=${key}`
  const clean = redact(text, [key])
  assert(!clean.includes(key))
  assertEquals(redact('sin secretos', [key]), 'sin secretos')
  assertEquals(redact('nada', ['']), 'nada')
})
