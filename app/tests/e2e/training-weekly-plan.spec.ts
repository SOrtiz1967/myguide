// Spec 018: plan semanal, «marcar como completado» y «Cargar entrenamiento».
import { expect, test, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'
import { clearSeededExercises, seedOwnExercise } from './exercises-support'
import { register, resetRateLimits, stubTurnstile, uniqueEmail } from './support'

const t = es.training
const r = t.routines
const p = t.weeklyPlan
const d = t.today

/** Hoy en la zona del navegador, como día de la semana ISO (1 = lunes). */
const todayWeekday = () => ((new Date().getDay() + 6) % 7) + 1

async function createRoutine(page: Page, name: string) {
  await page.goto('/entrenamiento/rutinas/nueva')
  await page.getByLabel(r.name).fill(name)
  await page.getByRole('button', { name: r.addExercise }).click()
  const dialog = page.getByRole('dialog', { name: t.picker.title })
  await dialog.getByLabel(t.picker.searchLabel).fill('press plan')
  await dialog.getByRole('button', { name: /Press plan e2e/ }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: r.save }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  resetRateLimits()
  await stubTurnstile(page)
  clearSeededExercises()
})

test('armar el plan, marcar el día como completado y ver la sesión sin detalle', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const email = uniqueEmail('plan')
  await register(page, email)
  seedOwnExercise(email, { name: 'Press plan e2e', measurement: 'reps_weight' })
  await createRoutine(page, 'Pecho')

  // El plan: el día de hoy toca «Pecho»; se guarda y se conserva al recargar.
  await page.goto('/entrenamiento')
  const day = p.weekdays[todayWeekday() - 1]!
  await page.getByLabel(day, { exact: true }).selectOption({ label: 'Pecho' })
  await expect(page.getByText(p.saved)).toBeVisible()
  await page.reload()
  await expect(page.getByLabel(day, { exact: true })).toHaveText(/Pecho/)

  // Inicio: toca Pecho y se marca con un solo toque.
  await page.goto('/')
  await expect(page.getByText(d.planned('Pecho'))).toBeVisible()
  await page.getByRole('button', { name: d.markDone }).click()
  await expect(page.getByText(d.doneTitle)).toBeVisible()
  await expect(page.getByText(new RegExp(t.marks.markedComplete)).first()).toBeVisible()
  await expect(page.getByRole('button', { name: d.markDone })).toHaveCount(0)

  // La sesión conserva el plan como planificado y no muestra series realizadas.
  await page.getByRole('link', { name: /Pecho/ }).first().click()
  await expect(page.getByText(d.markedNote)).toBeVisible()
  await expect(page.getByText('Press plan e2e').first()).toBeVisible()

  // Cambiar el plan no toca la sesión ya creada.
  await page.goto('/entrenamiento')
  await page.getByLabel(day, { exact: true }).selectOption({ label: p.none })
  await expect(page.getByText(p.saved)).toBeVisible()
  await page.goto('/entrenamiento')
  await expect(page.getByText(t.marks.markedComplete).first()).toBeVisible()
})

test('un día sin rutina asignada ofrece cargar entrenamiento y no marcar como completado', async ({
  page,
}) => {
  const email = uniqueEmail('plan')
  await register(page, email)
  seedOwnExercise(email, { name: 'Press plan e2e', measurement: 'reps_weight' })
  await createRoutine(page, 'Espalda')

  await page.goto('/')
  await expect(page.getByText(d.loadTitle)).toBeVisible()
  await expect(page.getByRole('button', { name: d.markDone })).toHaveCount(0)
  await page.getByRole('button', { name: d.markRoutine('Espalda') }).click()
  await expect(page.getByText(d.doneTitle)).toBeVisible()
})
