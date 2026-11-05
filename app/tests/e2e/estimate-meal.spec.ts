// Spec 009: estimación de comidas con IA de punta a punta. La respuesta de la función `estimate-meal` se simula en el navegador
// (lo que devuelve Gemini está probado en las pruebas de Deno); lo que se guarda pasa por la base de datos real.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { es } from '../../src/copy/es'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const ai = es.meals.ai

const ITEMS = [
  {
    name: 'Milanesa al horno',
    quantity_text: '2 unidades',
    energy_kcal: 520,
    protein_g: 44,
    carbs_g: 30,
    fat_g: 24,
  },
  {
    name: 'Puré',
    quantity_text: null,
    energy_kcal: 180,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
  },
  {
    name: 'Manzana',
    quantity_text: '1 unidad',
    energy_kcal: 95,
    protein_g: 0.5,
    carbs_g: 25,
    fat_g: 0.3,
  },
]

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const entries = (email: string, column: string, where = 'true') =>
  dbQuery(`select ${column} from public.meal_entries where user_id = ${userOf(email)} and ${where}`)

function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

/** Responde `estimate-meal` desde el navegador: el preflight de CORS y la solicitud real. */
async function stubEstimate(
  page: Page,
  reply: { status: number; body: unknown } = { status: 200, body: { items: ITEMS, cached: false } },
) {
  const calls: unknown[] = []
  await page.route('**/functions/v1/estimate-meal', async (route: Route) => {
    const request = route.request()
    const headers = {
      'access-control-allow-origin': request.headers()['origin'] ?? '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      vary: 'origin',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    calls.push(request.postDataJSON())
    return route.fulfill({
      status: reply.status,
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(reply.body),
    })
  })
  return calls
}

async function expectNoViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`),
    `Violaciones de accesibilidad en ${name}`,
  ).toEqual([])
}

async function expectNoHorizontalScroll(page: Page, name: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `Desplazamiento horizontal en ${name}`).toBeLessThanOrEqual(0)
}

const addUrl = () => `/comidas/${today()}/agregar?comida=lunch`

test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000)
  resetRateLimits()
  await stubTurnstile(page)
})

test('describir, corregir, confirmar: nada se guarda hasta confirmar y queda como estimado', async ({
  page,
}) => {
  const email = uniqueEmail('ia')
  await register(page, email)
  const calls = await stubEstimate(page)

  await page.goto(addUrl())
  await page.getByRole('button', { name: ai.open }).click()
  await page.getByLabel(ai.textLabel).fill('2 milanesas al horno con puré y una manzana')
  await page.getByRole('button', { name: ai.estimate, exact: true }).click()

  await expect(page.getByRole('heading', { name: ai.review.title })).toBeVisible()
  expect(calls).toHaveLength(1)
  expect(Object.keys(calls[0] as object).sort()).toEqual(['request_id', 'text'])
  await expect(page.getByText(ai.review.status)).toHaveCount(3)
  expect(entries(email, 'count(*)')).toBe('0')

  const first = page.getByRole('group', { name: ai.review.itemTitle(1) })
  await first.getByLabel('Energía (kcal)').fill('480')
  await page.getByRole('button', { name: ai.review.remove('Puré') }).click()
  await expect(page.getByText(ai.review.total('575'))).toBeVisible()

  await page.getByRole('button', { name: ai.review.confirm }).click()
  await expect(page.getByText(es.meals.addedTo.lunch)).toBeVisible()

  const lunch = page.getByRole('region', { name: es.meals.names.lunch })
  await expect(lunch.getByText('Milanesa al horno')).toBeVisible()
  await expect(lunch.getByText('Manzana')).toBeVisible()
  await expect(lunch.getByText(es.meals.origin.estimated).first()).toBeVisible()

  expect(entries(email, 'count(*)')).toBe('2')
  expect(entries(email, 'sum(energy_kcal)::int')).toBe('575')
  expect(entries(email, 'count(*)', `origin = 'estimated' and status = 'confirmed'`)).toBe('2')
})

test('si la IA no está disponible el texto se conserva y se carga a mano', async ({ page }) => {
  const email = uniqueEmail('ia')
  await register(page, email)
  await stubEstimate(page, { status: 503, body: { code: 'ai_unavailable' } })

  await page.goto(addUrl())
  await page.getByRole('button', { name: ai.open }).click()
  await page.getByLabel(ai.textLabel).fill('una tarta de verdura')
  await page.getByRole('button', { name: ai.estimate, exact: true }).click()

  await expect(page.getByRole('alert')).toContainText(ai.errors.ai_unavailable)
  await expect(page.getByLabel(ai.textLabel)).toHaveValue('una tarta de verdura')

  await page.getByRole('button', { name: ai.writeByHand }).click()
  await page.getByLabel(es.meals.manual.description).fill('Tarta de verdura')
  await page.getByLabel('Energía (kcal)').fill('300')
  await page.getByRole('button', { name: es.meals.manual.save }).click()
  await expect(page.getByText(es.meals.addedTo.lunch)).toBeVisible()
  expect(entries(email, 'origin')).toBe('manual')
})

test('un alimento escrito a mano se calcula con IA y se guarda como estimado', async ({ page }) => {
  const email = uniqueEmail('ia')
  await register(page, email)
  await stubEstimate(page, {
    status: 200,
    body: {
      items: [
        {
          name: 'Tarta de verdura casera',
          quantity_text: '1 porción',
          energy_kcal: 310,
          protein_g: 12,
          carbs_g: 28,
          fat_g: 16,
        },
      ],
      cached: false,
    },
  })

  await page.goto(addUrl())
  await page.getByRole('button', { name: es.meals.add.manual }).click()
  await page.getByLabel(es.meals.manual.description).fill('Tarta de verdura casera')
  await page.getByLabel(es.meals.manual.quantityText).fill('1 porción')
  await page.getByRole('button', { name: ai.manual.calculate }).click()

  await expect(page.getByLabel('Energía (kcal)')).toHaveValue('310')
  await expect(page.getByText(ai.manual.status)).toBeVisible()
  await page.getByRole('button', { name: es.meals.manual.save }).click()
  await expect(page.getByText(es.meals.addedTo.lunch)).toBeVisible()
  expect(entries(email, "origin || ':' || status")).toBe('estimated:confirmed')
})

for (const [label, width, height] of [
  ['375 px', 375, 800],
  ['1280 px', 1280, 900],
] as const) {
  test(`axe y sin desborde a ${label}: texto, revisión y fallo de la IA`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await register(page, uniqueEmail('iaa'))
    await stubEstimate(page)

    await page.goto(addUrl())
    await page.getByRole('button', { name: ai.open }).click()
    await expect(page.getByLabel(ai.textLabel)).toBeVisible()
    await expectNoViolations(page, `texto (${label})`)
    await expectNoHorizontalScroll(page, `texto (${label})`)

    await page.getByLabel(ai.textLabel).fill('2 milanesas al horno con puré y una manzana')
    await page.getByRole('button', { name: ai.estimate, exact: true }).click()
    await expect(page.getByRole('heading', { name: ai.review.title })).toBeVisible()
    await expectNoViolations(page, `revisión (${label})`)
    await expectNoHorizontalScroll(page, `revisión (${label})`)

    await page
      .getByRole('group', { name: ai.review.itemTitle(1) })
      .getByLabel('Energía (kcal)')
      .fill('')
    await page.getByRole('button', { name: ai.review.confirm }).click()
    await expect(page.getByText(ai.review.invalidItems)).toBeVisible()
    await expectNoViolations(page, `revisión con errores (${label})`)
    await expectNoHorizontalScroll(page, `revisión con errores (${label})`)
  })
}
