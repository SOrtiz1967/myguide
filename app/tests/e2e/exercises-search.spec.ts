// T023 (spec 005, escenarios 1 a 14 del quickstart): buscar un ejercicio y ver su detalle.
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedCatalogExercises, type SeedExercise } from './exercises-support'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.exercises

const STEPS =
  '1. Apoya la barra sobre la espalda.\n2. Baja hasta que los muslos queden paralelos.\n3. Sube.'

const EXERCISES: SeedExercise[] = [
  {
    id: 'squat',
    name: 'Sentadilla con barra e2e',
    originalName: 'Barbell Squat e2e',
    aliases: ['Cuclillas e2e'],
    primary: ['quadriceps'],
    secondary: ['glutes', 'hamstrings'],
    equipment: 'barbell',
    description: STEPS,
    nameStatus: 'machine_translated',
    descriptionStatus: 'machine_translated',
  },
  {
    id: 'lateral',
    name: 'Elevación lateral e2e',
    originalName: 'Side Lateral Raise e2e',
    aliases: ['Vuelos laterales e2e'],
    primary: ['shoulders'],
    equipment: 'dumbbell',
    description: null,
  },
  {
    id: 'bench',
    name: 'Press de banca e2e',
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    equipment: 'barbell',
    description: STEPS,
    nameStatus: 'reviewed',
    descriptionStatus: 'reviewed',
  },
  {
    id: 'dbpress',
    name: 'Press con mancuernas e2e',
    primary: ['chest'],
    secondary: ['triceps'],
    equipment: 'dumbbell',
    description: null,
  },
  {
    id: 'plank',
    name: 'Plancha e2e',
    measurement: 'duration',
    primary: ['abdominals'],
    equipment: null,
    description: null,
    nameStatus: 'reviewed',
  },
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `filler-${i}`,
    name: `Relleno ${String(i).padStart(2, '0')} e2e`,
    measurement: 'reps_bodyweight' as const,
    primary: ['calves'],
    equipment: 'body only',
    description: null,
  })),
]

test.beforeAll(() => {
  clearSeededExercises()
  seedCatalogExercises(EXERCISES)
})

test.afterAll(() => {
  clearSeededExercises()
})

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  await register(page, uniqueEmail('exs'))
})

const searchBox = (page: Page) => page.getByLabel(t.searchLabel)
const results = (page: Page) => page.getByRole('tabpanel')

test('escenarios 1 y 2: busca sin importar acentos ni mayúsculas', async ({ page }) => {
  await page.goto('/ejercicios')
  await expect(page.getByText(t.searchTooShort)).toBeVisible()

  await searchBox(page).fill('sentadilla e2e')
  const row = results(page).getByRole('link', { name: /Sentadilla con barra e2e/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Repeticiones y peso')
  await expect(row).toContainText('Cuádriceps')
  await expect(row).toContainText('Barra')
  await expect(row).toContainText(t.originBadge.catalog)

  for (const text of ['elevacion lateral e2e', 'ELEVACIÓN LATERAL E2E', 'Elevación Lateral e2e']) {
    await searchBox(page).fill(text)
    await expect(results(page).getByRole('link', { name: /Elevación lateral e2e/ })).toBeVisible()
  }
})

test('escenarios 3, 5 y 6: el detalle completo, la procedencia y el estado de la traducción', async ({
  page,
}) => {
  await page.goto('/ejercicios')
  await searchBox(page).fill('sentadilla con barra e2e')
  await results(page)
    .getByRole('link', { name: /Sentadilla con barra e2e/ })
    .click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Sentadilla con barra e2e' }),
  ).toBeVisible()
  await expect(page.getByText(t.textStatus.machine_translated).first()).toBeVisible()
  const section = (title: string) =>
    page.getByRole('heading', { name: title }).locator('xpath=ancestor::section[1]')
  await expect(section(t.detail.alsoKnownAs)).toContainText('Barbell Squat e2e')
  await expect(section(t.detail.alsoKnownAs)).toContainText('Cuclillas e2e')
  await expect(section(t.detail.measurement)).toContainText('Se registra con repeticiones y peso')
  await expect(section(t.detail.primaryMuscles)).toContainText('Cuádriceps')
  await expect(section(t.detail.secondaryMuscles)).toContainText('Glúteos, Isquiotibiales')
  await expect(section(t.detail.equipment)).toContainText('Barra')
  await expect(section(t.detail.description).getByRole('listitem')).toHaveCount(3)
  await expect(section(t.provenance.title)).toContainText(
    /Del catálogo · free-exercise-db · código E2E-squat · importado el \d{2}\/\d{2}\/\d{4}/,
  )

  // la procedencia lleva a las fuentes
  await section(t.provenance.title).getByRole('link', { name: t.provenance.viewSources }).click()
  await expect(page).toHaveURL(/\/fuentes$/)

  // un ejercicio revisado no lleva la etiqueta de traducción sin revisar
  await page.goto('/ejercicios')
  await searchBox(page).fill('press de banca e2e')
  await results(page)
    .getByRole('link', { name: /Press de banca e2e/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Press de banca e2e' })).toBeVisible()
  await expect(page.getByText(t.textStatus.machine_translated)).toHaveCount(0)
})

test('escenario 4: lo que falta dice «sin dato»', async ({ page }) => {
  await page.goto('/ejercicios')
  await searchBox(page).fill('plancha e2e')
  await results(page)
    .getByRole('link', { name: /Plancha e2e/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Plancha e2e' })).toBeVisible()
  const section = (title: string) =>
    page.getByRole('heading', { name: title }).locator('xpath=ancestor::section[1]')
  await expect(section(t.detail.equipment)).toContainText(t.missing)
  await expect(section(t.detail.secondaryMuscles)).toContainText(t.missing)
  await expect(section(t.detail.description)).toContainText(t.missing)
  await expect(section(t.detail.measurement)).toContainText('Se registra con el tiempo')
  await expect(page.getByText('Peso corporal')).toHaveCount(0)
})

test('escenarios 7, 8 y 9: sin resultados, mínimo de caracteres y «Ver más»', async ({ page }) => {
  await page.goto('/ejercicios')
  await searchBox(page).fill('zzzxxqq')
  await expect(page.getByText(t.emptyTitle)).toBeVisible()
  await page.getByRole('button', { name: t.createNamed('zzzxxqq') }).click()
  await expect(page).toHaveURL(/\/ejercicios\/nuevo\?nombre=zzzxxqq$/)

  await page.goto('/ejercicios')
  await searchBox(page).fill('r')
  await expect(page.getByText(t.searchTooShort)).toBeVisible()
  await searchBox(page).fill('   ')
  await expect(page.getByText(t.searchTooShort)).toBeVisible()

  await searchBox(page).fill('relleno')
  await expect(results(page).getByRole('link')).toHaveCount(20)
  await expect(results(page).getByText('30 resultados')).toBeVisible()
  await results(page).getByRole('button', { name: t.loadMore }).click()
  await expect(results(page).getByRole('link')).toHaveCount(30)
  await expect(results(page).getByRole('button', { name: t.loadMore })).toHaveCount(0)
})

test('escenario 10: las pestañas y el estado sobreviven a ir al detalle y volver', async ({
  page,
}) => {
  await page.goto('/ejercicios')
  await searchBox(page).fill('e2e')
  await page.getByRole('tab', { name: t.tabs.own }).click()
  await expect(page.getByText(t.emptyTitle)).toBeVisible()
  await page.getByRole('tab', { name: t.tabs.catalog }).click()
  await expect(results(page).getByRole('link').first()).toBeVisible()
  await page.getByRole('tab', { name: t.tabs.all }).click()
  await expect(results(page).getByRole('link').first()).toBeVisible()

  await page.getByRole('tab', { name: t.tabs.catalog }).click()
  await searchBox(page).fill('plancha e2e')
  // el texto llega a la URL tras una breve espera; recién entonces la lista es la de esta búsqueda
  await expect(page).toHaveURL(/q=plancha/)
  await expect(results(page).getByRole('link')).toHaveCount(1)
  await results(page)
    .getByRole('link', { name: /Plancha e2e/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Plancha e2e' })).toBeVisible()
  await page.getByRole('link', { name: t.backToSearch }).click()
  await expect(searchBox(page)).toHaveValue('plancha e2e')
  await expect(page.getByRole('tab', { name: t.tabs.catalog })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(results(page).getByRole('link', { name: /Plancha e2e/ })).toBeVisible()
})

test('escenarios 11, 12 y 13: filtros por músculo y equipamiento, solos y combinados con el texto', async ({
  page,
}) => {
  await page.goto('/ejercicios')
  await searchBox(page).fill('e2e')

  // músculo: principal o secundario
  await page.getByLabel(t.filters.muscle).selectOption('triceps')
  await expect(results(page).getByRole('link', { name: /Press de banca e2e/ })).toBeVisible()
  await expect(results(page).getByRole('link', { name: /Press con mancuernas e2e/ })).toBeVisible()
  await expect(results(page).getByRole('link', { name: /Plancha e2e/ })).toHaveCount(0)
  await expect(results(page).getByText('2 resultados')).toBeVisible()

  // equipamiento a la vez
  await page.getByLabel(t.filters.equipment).selectOption('dumbbell')
  await expect(results(page).getByRole('link')).toHaveCount(1)
  await expect(results(page).getByRole('link', { name: /Press con mancuernas e2e/ })).toBeVisible()

  // quitar un filtro con un gesto
  await page.getByRole('button', { name: t.filters.remove('Mancuernas') }).click()
  await expect(results(page).getByRole('link')).toHaveCount(2)

  // sin resultados con filtros
  await page.getByLabel(t.filters.muscle).selectOption('neck')
  await expect(page.getByText(t.emptyFiltersTitle)).toBeVisible()
  await expect(page.getByText(t.emptyFiltersBody('Cuello'))).toBeVisible()
  await expect(page.getByRole('button', { name: /^Crear "/ })).toHaveCount(0)
  await page.getByRole('button', { name: t.clearFilters }).click()
  await expect(results(page).getByRole('link').first()).toBeVisible()
})

test('escenario 14: encuentra por el nombre original y por sinónimos', async ({ page }) => {
  await page.goto('/ejercicios')
  await searchBox(page).fill('barbell squat e2e')
  await expect(results(page).getByRole('link', { name: /Sentadilla con barra e2e/ })).toBeVisible()
  await searchBox(page).fill('vuelos laterales e2e')
  await expect(results(page).getByRole('link', { name: /Elevación lateral e2e/ })).toBeVisible()
  await searchBox(page).fill('cuclillas e2e')
  await expect(results(page).getByRole('link', { name: /Sentadilla con barra e2e/ })).toBeVisible()
})
