// T074 (spec 006, escenario 47, FR-052, SC-012): las pantallas de entrenamiento funcionan en teléfono y en escritorio,
// sin desplazamiento horizontal y con áreas táctiles de 44 px o más (incluidas las filas de series y los días).
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { dbQuery, register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training

const VIEWPORTS = [
  { name: 'teléfono', width: 375, height: 667 },
  { name: 'escritorio', width: 1280, height: 800 },
]

const LONG_WORD = 'Supercalifragilisticoespialidosoextraordinariamenteprolongadoe2e'
const LONG_NAME = `Press de banca inclinado con pausa ${LONG_WORD}`
const LONG_NOTE = Array.from({ length: 10 }, () => `Nota muy larga ${LONG_WORD}`).join(' ')

const userOf = (email: string) => `(select id from auth.users where email = '${email}')`
const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + offset * 86_400_000))

async function expectNoHorizontalScroll(page: Page, where: string) {
  const { overflow, offenders } = await page.evaluate(() => {
    const doc = document.documentElement
    const over = doc.scrollWidth - doc.clientWidth
    const list =
      over > 0
        ? [...document.querySelectorAll('body *')]
            .filter((el) => {
              const wide = (node: Element) =>
                node.getBoundingClientRect().width > 2 &&
                (node.scrollWidth > node.clientWidth + 1 ||
                  node.getBoundingClientRect().right > doc.clientWidth + 1)
              return wide(el) && ![...el.children].some(wide)
            })
            .slice(0, 5)
            .map(
              (el) =>
                `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} «${(el.textContent ?? '').slice(0, 25)}»`,
            )
        : []
    return { overflow: over, offenders: list }
  })
  expect(
    overflow,
    `desplazamiento horizontal en ${where}: ${offenders.join(' | ')}`,
  ).toBeLessThanOrEqual(0)
}

/** Todo botón, enlace con aspecto de botón, selector y campo mide 44 px o más. */
async function expectTouchTargets(page: Page, where: string) {
  const small = await page
    .locator(
      'button:visible, a.btn-primary:visible, a.btn-secondary:visible, select:visible, textarea:visible, input:not([type="checkbox"]):not([type="radio"]):visible, ul.grid a:visible',
    )
    .evaluateAll((elements) =>
      elements
        .map((el) => ({
          text: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30),
          h: el.getBoundingClientRect().height,
        }))
        .filter((item) => item.h < 43.5),
    )
  expect(small, `áreas táctiles menores a 44 px en ${where}`).toEqual([])
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
})

for (const viewport of VIEWPORTS) {
  test(`sin desplazamiento horizontal y con áreas táctiles de 44 px: ${viewport.name}`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const email = uniqueEmail('trr')
    await register(page, email)
    const user = userOf(email)
    seedOwnExercise(email, { name: LONG_NAME, measurement: 'reps_weight' })
    const exerciseId = dbQuery(
      `select id from public.exercises where user_id = ${user} and name = '${LONG_NAME}'`,
    )
    const routineId = dbQuery(
      `select tests.create_routine(${user}, '${LONG_NAME.slice(0, 80)}', array['${exerciseId}'::uuid], 4)`,
    )
    const planned = dbQuery(
      `select tests.create_session(${user}, date '${day(3)}', 'planned', '${routineId}', true)`,
    )
    dbQuery(
      `select tests.create_session(${user}, date '${day(-2)}', 'planned', '${routineId}', true)`,
    )
    const done = dbQuery(
      `select tests.create_session(${user}, date '${day(-1)}', 'completed', '${routineId}', true)`,
    )
    const x = dbQuery(`select tests.add_session_exercise('${done}', '${exerciseId}')`)
    dbQuery(`select tests.add_session_set('${x}', 8, 60)`)
    dbQuery(`update public.workout_sessions set note = '${LONG_NOTE}' where id = '${done}'`)

    // sesión en curso con 30 ejercicios de 20 series cada uno
    const open = dbQuery(`select tests.create_session(${user}, date '${day(0)}', 'in_progress')`)
    dbQuery(
      `do $$ declare s uuid := '${open}'; x uuid; i int; j int; begin for i in 1..30 loop x := tests.add_session_exercise(s, '${exerciseId}'); for j in 1..20 loop perform tests.add_session_set(x, 8, 60); end loop; end loop; end $$`,
    )

    const screens: Array<[string, string]> = [
      ['inicio', '/entrenamiento'],
      ['día', `/entrenamiento/dia/${day(3)}`],
      ['sesión planificada', `/entrenamiento/sesion/${planned}`],
      ['sesión realizada', `/entrenamiento/sesion/${done}`],
      ['rutinas', '/entrenamiento/rutinas'],
      ['detalle de rutina', `/entrenamiento/rutinas/${routineId}`],
      ['nueva rutina', '/entrenamiento/rutinas/nueva'],
      ['historia', `/ejercicios/${exerciseId}/historia`],
      ['editor con 30 ejercicios', `/entrenamiento/sesion/${open}`],
    ]
    for (const [name, path] of screens) {
      await page.goto(path)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await page.waitForLoadState('networkidle')
      await expectNoHorizontalScroll(page, `${name} (${viewport.name})`)
      await expectTouchTargets(page, `${name} (${viewport.name})`)
    }
    await expect(page.getByText(t.status.in_progress).first()).toBeVisible()
  })
}
