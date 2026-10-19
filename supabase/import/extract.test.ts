// T046 a T048 (spec 002): extractores de USDA, de la API de Open Food Facts y de su volcado.
import { assert, assertEquals, assertRejects } from '@std/assert'
import { extractOffApi } from './extract-off.ts'
import { type DumpStats, extractOffDump } from './extract-off-dump.ts'
import { extractUsda, parseTranslations, type UsdaDataset, type UsdaFile } from './extract-usda.ts'

const text = (value: string): ReadableStream<Uint8Array<ArrayBuffer>> =>
  new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value))
      controller.close()
    },
  })

function dataset(
  type: 'foundation_food' | 'sr_legacy_food',
  files: Record<UsdaFile, string>,
): UsdaDataset {
  return { data_type: type, open: (file) => Promise.resolve(text(files[file])) }
}

const MEASURE_UNITS = '"id","name"\n"1000","cup"\n"1001","undetermined"\n'

const translations = parseTranslations(
  [
    'fdc_id,nombre_es,estado',
    '100,Arroz blanco cocido,machine_translated',
    '200,Arroz blanco,reviewed',
    '300,Lenteja cocida,machine_translated',
    '400,Estado inválido,quizas',
    ',Sin código,reviewed',
  ].join('\n'),
)

Deno.test('parseTranslations conserva solo las filas completas con un estado válido', () => {
  assertEquals([...translations.keys()].sort(), ['100', '200', '300'])
  assertEquals(translations.get('200'), { nombre_es: 'Arroz blanco', estado: 'reviewed' })
  assertEquals(parseTranslations('').size, 0)
})

Deno.test('USDA: lee los CSV, mapea nutrientes y porciones, y omite lo que no tiene traducción', async () => {
  const sr = dataset('sr_legacy_food', {
    'food.csv': [
      '"fdc_id","data_type","description","food_category_id","publication_date"',
      '"100","sr_legacy_food","Rice, white, cooked","20","2019-04-01"',
      '"300","sr_legacy_food","Lentils, cooked","16","2019-04-01"',
      '"999","sr_legacy_food","Sin traducir","16","2019-04-01"',
      '"555","sub_sample_food","Otra cosa","16","2019-04-01"',
    ].join('\n'),
    'food_nutrient.csv': [
      '"id","fdc_id","nutrient_id","amount","data_points"',
      '"1","100","1008","130","1"',
      '"2","100","1003","2.7","1"',
      '"3","100","1005","28","1"',
      '"4","100","9999","50","1"',
      '"5","300","1008","116","1"',
      '"6","999","1008","10","1"',
    ].join('\n'),
    'measure_unit.csv': MEASURE_UNITS,
    'food_portion.csv': [
      '"id","fdc_id","seq_num","amount","measure_unit_id","portion_description","modifier","gram_weight"',
      '"1","100","1","1","1000","","","158"',
      '"2","100","2","1","1001","1 medium","","50"',
    ].join('\n'),
  })
  const result = await extractUsda([sr], translations)
  const byId = new Map(result.foods.map((f) => [f.source_item_id, f]))
  assertEquals(result.foods.length, 2)
  assertEquals(byId.get('100')?.name, 'Arroz blanco cocido')
  assertEquals(byId.get('100')?.energy_kcal, 130)
  assertEquals(byId.get('100')?.protein_g, 2.7)
  assertEquals(byId.get('100')?.fat_g, null)
  assertEquals(byId.get('100')?.portions, [{ name: '1 taza', quantity: 158 }])
  assertEquals(byId.get('300')?.name_status, 'machine_translated')
  assertEquals(result.preSkipped, { no_translation: 1 })
})

Deno.test('USDA: entre Foundation Foods y SR Legacy con el mismo nombre gana Foundation Foods', async () => {
  const header = '"fdc_id","data_type","description","food_category_id","publication_date"'
  const nutrientHeader = '"id","fdc_id","nutrient_id","amount","data_points"'
  const portionHeader =
    '"id","fdc_id","seq_num","amount","measure_unit_id","portion_description","modifier","gram_weight"'
  const foundation = dataset('foundation_food', {
    'food.csv': `${header}\n"200","foundation_food","Rice","20","2024-01-01"`,
    'food_nutrient.csv': `${nutrientHeader}\n"1","200","1008","111","1"`,
    'measure_unit.csv': MEASURE_UNITS,
    'food_portion.csv': portionHeader,
  })
  const legacy = dataset('sr_legacy_food', {
    'food.csv': `${header}\n"100","sr_legacy_food","Rice","20","2019-04-01"`,
    'food_nutrient.csv': `${nutrientHeader}\n"1","100","1008","130","1"`,
    'measure_unit.csv': MEASURE_UNITS,
    'food_portion.csv': portionHeader,
  })
  // 100 se llama "Arroz blanco cocido" y 200 "Arroz blanco": distintos, ambos quedan
  let result = await extractUsda([foundation, legacy], translations)
  assertEquals(result.foods.length, 2)

  // con el mismo nombre normalizado gana Foundation Foods
  const same = new Map(translations)
  same.set('100', { nombre_es: 'ARROZ  blanco', estado: 'machine_translated' })
  result = await extractUsda([legacy, foundation], same)
  assertEquals(result.foods.map((f) => f.source_item_id), ['200'])
  assertEquals(result.preSkipped.duplicate_name, 1)
})

// ---- Open Food Facts: API -----------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const product = (code: string) => ({
  code,
  product_name: `Producto ${code}`,
  image_url: 'https://ej.test/no-se-copia.jpg',
  nutriments: { 'energy-kcal_100g': 10 },
})

Deno.test('OFF API: se identifica, pide por páginas, descarta las imágenes y respeta el ritmo', async () => {
  const urls: string[] = []
  const agents: string[] = []
  const sleeps: number[] = []
  const pages = [[product('1'), product('2')], [product('3')]]
  const fetchStub: typeof fetch = (input, init) => {
    urls.push(String(input))
    agents.push(new Headers(init?.headers).get('User-Agent') ?? '')
    const page = Number(new URL(String(input)).searchParams.get('page'))
    return Promise.resolve(jsonResponse({ products: pages[page - 1] ?? [] }))
  }
  const found = []
  for await (
    const item of extractOffApi({
      fetch: fetchStub,
      userAgent: 'MyGuide/0.1 (prueba)',
      pageSize: 2,
      delayMs: 250,
      sleep: (ms) => {
        sleeps.push(ms)
        return Promise.resolve()
      },
    })
  ) {
    found.push(item)
  }
  assertEquals(found.map((p) => p.code), ['1', '2', '3'])
  assert(!('image_url' in found[0]))
  assert(urls[0].includes('countries_tags_en=argentina'))
  assertEquals(new Set(agents), new Set(['MyGuide/0.1 (prueba)']))
  assertEquals(sleeps, [250]) // espera entre la página 1 y la 2; la 2 es la última
})

Deno.test('OFF API: reintenta ante 429/503 y falla ante otros errores', async () => {
  let calls = 0
  const flaky: typeof fetch = () => {
    calls++
    return Promise.resolve(
      calls < 3 ? jsonResponse({}, 503) : jsonResponse({ products: [product('1')] }),
    )
  }
  const found = []
  for await (
    const item of extractOffApi({
      fetch: flaky,
      userAgent: 'x',
      pageSize: 5,
      sleep: () => Promise.resolve(),
    })
  ) {
    found.push(item)
  }
  assertEquals(found.length, 1)
  assertEquals(calls, 3)

  const forbidden: typeof fetch = () => Promise.resolve(jsonResponse({}, 403))
  await assertRejects(async () => {
    for await (
      const _ of extractOffApi({
        fetch: forbidden,
        userAgent: 'x',
        sleep: () => Promise.resolve(),
      })
    ) {
      // no debería producir nada
    }
  })
})

Deno.test('OFF API: se puede reanudar desde una página y limitar la cantidad de páginas', async () => {
  const requested: number[] = []
  const nextPages: number[] = []
  const fetchStub: typeof fetch = (input) => {
    const page = Number(new URL(String(input)).searchParams.get('page'))
    requested.push(page)
    return Promise.resolve(jsonResponse({ products: [product(String(page)), product(`${page}b`)] }))
  }
  for await (
    const _ of extractOffApi({
      fetch: fetchStub,
      userAgent: 'x',
      pageSize: 2,
      startPage: 5,
      maxPages: 2,
      sleep: () => Promise.resolve(),
      onPage: (next) => nextPages.push(next),
    })
  ) {
    // consumir
  }
  assertEquals(requested, [5, 6])
  assertEquals(nextPages, [6, 7])
})

// ---- Open Food Facts: volcado -----------------------------------------------------------------------------

async function gzip(value: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = text(value).pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const asStream = (bytes: Uint8Array<ArrayBuffer>) =>
  new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })

Deno.test('OFF volcado: conserva solo los productos de Argentina y cuenta lo que no se pudo leer', async () => {
  const fixture = [
    JSON.stringify({
      code: '1',
      countries_tags: ['en:argentina'],
      product_name: 'Argentino',
      image_url: 'x',
      nutriments: {},
    }),
    JSON.stringify({ code: '2', countries_tags: ['en:france'], product_name: 'Francés' }),
    '{esto no es json',
    JSON.stringify({
      code: '3',
      countries_tags: ['en:france', 'en:argentina'],
      product_name: 'Vendido en ambos',
    }),
    '',
  ].join('\n')
  const stats: DumpStats = { rows: 0, argentine: 0, malformed: 0 }
  const found = []
  for await (const item of extractOffDump(asStream(await gzip(fixture)), { stats })) {
    found.push(item)
  }
  assertEquals(found.map((p) => p.code), ['1', '3'])
  assertEquals(stats, { rows: 4, argentine: 2, malformed: 1 })
  assert(!('image_url' in found[0]))
})

Deno.test('OFF volcado: lee por transmisión; no consume todo el archivo para entregar el primer producto', async () => {
  // Se generan 200.000 líneas de a pedazos; si el extractor las acumulara, el contador de pedazos
  // leídos llegaría al total antes de entregar el primero.
  const totalChunks = 2000
  let pulled = 0
  const line = JSON.stringify({ code: 'x', countries_tags: ['en:argentina'], product_name: 'P' }) +
    '\n'
  const chunk = line.repeat(100)
  const raw = new ReadableStream<string>({
    pull(controller) {
      if (pulled >= totalChunks) return controller.close()
      pulled++
      controller.enqueue(chunk)
    },
  })
  const source = raw.pipeThrough(new TextEncoderStream())
  const iterator = extractOffDump(source, { gzip: false })
  const first = await iterator.next()
  assertEquals(first.done, false)
  assert(pulled < 50, `se leyeron ${pulled} pedazos de ${totalChunks} para entregar el primero`)
  await iterator.return(undefined)
})

// ---- T074: líneas desmedidas ----------------------------------------------------------------------------------

Deno.test('T074: una línea desmedida se descarta sin acumularla en memoria y la lectura continúa', async () => {
  const huge = JSON.stringify({
    code: 'x',
    countries_tags: ['en:argentina'],
    product_name: 'A'.repeat(300_000),
  })
  const ok = JSON.stringify({ code: '1', countries_tags: ['en:argentina'], product_name: 'Normal' })
  const stats: DumpStats = { rows: 0, argentine: 0, malformed: 0 }
  const found = []
  for await (
    const item of extractOffDump(asStream(await gzip(`${huge}\n${ok}\n`)), {
      stats,
      maxLineLength: 100_000,
    })
  ) {
    found.push(item)
  }
  assertEquals(found.map((p) => p.code), ['1'])
  assertEquals(stats.malformed, 1)
})
