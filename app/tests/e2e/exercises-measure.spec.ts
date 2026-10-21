// T065 (spec 005): mediciones de SC-001, SC-002, SC-003 y SC-012. No es una prueba de regresión estricta:
// los topes son los de la spec, y los valores medidos se imprimen para registrarlos en research.md.
// Usa el catálogo real cargado en la base local (npm run import:ejercicios).
import { readFileSync } from 'node:fs'
import { devices, expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises } from './exercises-support'
import {
  dbQuery,
  register,
  resetRateLimits,
  stubTurnstile,
  SUPABASE_URL,
  uniqueEmail,
} from './support'

// Se mide sobre la compilación de producción (preview), que es lo que llega a las personas: el
// servidor de desarrollo sirve cientos de módulos sueltos y no representa la carga real.
test.use({ ...devices['Pixel 7'], baseURL: 'http://localhost:4173' })

const t = es.exercises
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? readAnonKey()

function readAnonKey(): string {
  const env = readFileSync('.env.local', 'utf8')
  return /^VITE_SUPABASE_ANON_KEY=(.+)$/m.exec(env)?.[1]?.trim() ?? ''
}

async function accessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
    return key ? (JSON.parse(localStorage.getItem(key) ?? '{}').access_token as string) : ''
  })
}

interface Row {
  id: string
  name: string
}

function rpc(token: string, body: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/search_exercises`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: null,
      scope: 'all',
      muscle_filter: null,
      equipment_filter: null,
      page_size: 50,
      page_offset: 0,
      ...body,
    }),
  })
}

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!
}

test.beforeAll(() => {
  clearSeededExercises()
})
test.afterAll(() => {
  clearSeededExercises()
})
test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail('exm'))
})

test('SC-001: encontrar un ejercicio conocido y ver su detalle', async ({ page }) => {
  const count = Number(dbQuery("select count(*) from public.exercises where origin = 'imported'"))
  console.log(`MEDICION catálogo cargado: ${count} ejercicios importados`)

  const started = Date.now()
  await page.goto('/ejercicios')
  await page.getByLabel(t.searchLabel).fill('sentadilla con barra')
  await page
    .getByRole('tabpanel')
    .getByRole('link', { name: /Sentadilla con barra/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sentadilla')
  const ms = Date.now() - started
  console.log(`MEDICION SC-001: de abrir la búsqueda al detalle en ${ms} ms`)
  expect(ms).toBeLessThan(15_000)
})

test('SC-003: crear un ejercicio propio completo', async ({ page }) => {
  const started = Date.now()
  let interactions = 0
  await page.goto('/ejercicios/nuevo')
  await page.getByLabel(t.form.name, { exact: true }).fill('Medición propia e2e')
  interactions++
  await page.getByRole('radio', { name: /^Repeticiones y peso/ }).check()
  interactions++
  await page.getByRole('group', { name: t.form.primaryLegend }).getByLabel('Pecho').check()
  interactions++
  await page.getByRole('group', { name: t.form.secondaryLegend }).getByLabel('Tríceps').check()
  interactions++
  await page.getByLabel(t.form.equipment).selectOption('dumbbell')
  interactions++
  await page.getByRole('button', { name: t.actions.save }).click()
  interactions++
  await expect(page.getByRole('heading', { level: 1, name: 'Medición propia e2e' })).toBeVisible()
  const ms = Date.now() - started
  console.log(
    `MEDICION SC-003: ejercicio propio completo en ${ms} ms (${interactions} interacciones)`,
  )
  expect(ms).toBeLessThan(60_000)
})

test('SC-002: la primera tanda de resultados llega en menos de 1 s (95 %)', async ({ page }) => {
  const queries = [
    { q: 'sentadilla' },
    { q: 'press banca' },
    { q: 'remo' },
    { q: 'curl' },
    { q: 'cur' },
    { q: 'plancha' },
    { q: 'elevacion lateral' },
    { q: 'mancuernas' },
    { q: 'peso muerto' },
    { q: 'extencion' },
    { muscle_filter: 'chest' },
    { muscle_filter: 'quadriceps' },
    { equipment_filter: 'barbell' },
    { equipment_filter: 'body only' },
    { muscle_filter: 'lats', equipment_filter: 'cable' },
    { q: 'press', muscle_filter: 'chest', equipment_filter: 'barbell' },
    { q: 'sentadilla', muscle_filter: 'quadriceps' },
    { q: 'remo', equipment_filter: 'cable' },
  ]
  const token = await accessToken(page)

  // Por la API real (red local + PostgREST + función), con 5 repeticiones de cada consulta.
  const apiTimes: number[] = []
  for (const query of queries) {
    for (let run = 0; run < 5; run++) {
      const started = Date.now()
      const res = await rpc(token, { ...query, page_size: 20 })
      expect(res.ok).toBe(true)
      await res.json()
      apiTimes.push(Date.now() - started)
    }
  }

  // Por la interfaz: desde que se escribe hasta que aparece el primer resultado.
  const uiTimes: number[] = []
  await page.goto('/ejercicios')
  const box = page.getByLabel(t.searchLabel)
  for (const text of ['sentadilla', 'press banca', 'remo', 'curl', 'plancha', 'mancuernas']) {
    await box.fill('')
    const started = Date.now()
    await box.fill(text)
    await expect(page.getByRole('tabpanel').getByRole('link').first()).toBeVisible()
    uiTimes.push(Date.now() - started)
  }

  const apiP95 = percentile95(apiTimes)
  const uiP95 = percentile95(uiTimes)
  console.log(
    `MEDICION SC-002: API ${apiTimes.length} consultas p95=${apiP95} ms max=${Math.max(...apiTimes)} ms; interfaz ${uiTimes.length} búsquedas p95=${uiP95} ms max=${Math.max(...uiTimes)} ms`,
  )
  expect(apiP95).toBeLessThan(1000)
})

test('SC-012: el nombre original, los sinónimos y los filtros exactos', async ({ page }) => {
  const token = await accessToken(page)
  const ids = (rows: Row[]) => rows.map((r) => r.id)

  // Nombre original en inglés: 40 ejercicios al azar (orden fijo por id) deben aparecer en su propia búsqueda.
  const originals = dbQuery(
    "select id || '|' || original_name from public.exercises where origin = 'imported' and original_name is not null and source_id = (select id from public.exercise_sources where slug = 'free-exercise-db') order by md5(id::text) limit 40",
  )
    .split('\n')
    .map((line) => line.split('|') as [string, string])
  let originalHits = 0
  const originalMisses: string[] = []
  for (const [id, original] of originals) {
    const res = await rpc(token, { q: original, page_size: 50 })
    const rows = (await res.json()) as Row[]
    if (ids(rows).includes(id)) originalHits++
    else originalMisses.push(original)
  }

  // Sinónimos: 40 ejercicios con alias, buscando por el primero.
  const synonyms = dbQuery(
    "select id || '|' || aliases[1] from public.exercises where origin = 'imported' and cardinality(aliases) > 0 order by md5(id::text) limit 40",
  )
    .split('\n')
    .map((line) => line.split('|') as [string, string])
  let synonymHits = 0
  const synonymMisses: string[] = []
  for (const [id, alias] of synonyms) {
    const res = await rpc(token, { q: alias, page_size: 50 })
    const rows = (await res.json()) as Row[]
    if (ids(rows).includes(id)) synonymHits++
    else synonymMisses.push(alias)
  }

  // Filtros: cada músculo y cada equipamiento devuelven exactamente los que cumplen (todas las páginas).
  const muscles = dbQuery(
    'select distinct unnest(primary_muscles || secondary_muscles) from public.exercises',
  )
    .split('\n')
    .filter(Boolean)
  const equipments = dbQuery(
    'select distinct equipment from public.exercises where equipment is not null',
  )
    .split('\n')
    .filter(Boolean)
  const filterMismatches: string[] = []
  async function allIds(filter: Record<string, string>): Promise<string[]> {
    const found: string[] = []
    for (let offset = 0; ; offset += 50) {
      const res = await rpc(token, {
        ...filter,
        scope: 'catalog',
        page_size: 50,
        page_offset: offset,
      })
      const rows = (await res.json()) as Row[]
      found.push(...ids(rows))
      if (rows.length < 50) return found
    }
  }
  for (const muscle of muscles) {
    const expected = dbQuery(
      `select id from public.exercises where '${muscle}' = any(primary_muscles || secondary_muscles) and user_id is null order by id`,
    )
      .split('\n')
      .filter(Boolean)
    const got = (await allIds({ muscle_filter: muscle })).sort()
    if (JSON.stringify(got) !== JSON.stringify(expected.sort())) {
      filterMismatches.push(
        `músculo ${muscle}: esperados ${expected.length}, recibidos ${got.length}`,
      )
    }
  }
  for (const equipment of equipments) {
    const expected = dbQuery(
      `select id from public.exercises where equipment = '${equipment}' and user_id is null order by id`,
    )
      .split('\n')
      .filter(Boolean)
    const got = (await allIds({ equipment_filter: equipment })).sort()
    if (JSON.stringify(got) !== JSON.stringify(expected.sort())) {
      filterMismatches.push(
        `equipamiento ${equipment}: esperados ${expected.length}, recibidos ${got.length}`,
      )
    }
  }

  console.log(
    `MEDICION SC-012: nombre original ${originalHits}/${originals.length} (fallan: ${originalMisses.join('; ') || 'ninguno'}); sinónimo ${synonymHits}/${synonyms.length} (fallan: ${synonymMisses.join('; ') || 'ninguno'}); filtros: ${muscles.length} músculos y ${equipments.length} equipamientos, diferencias: ${filterMismatches.join('; ') || 'ninguna'}`,
  )
  expect(originalMisses).toEqual([])
  expect(synonymMisses).toEqual([])
  expect(filterMismatches).toEqual([])
})
