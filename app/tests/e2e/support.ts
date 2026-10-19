// Utilidades de las pruebas de extremo a extremo. Requieren el stack local levantado:
// `npx supabase start` y `npx supabase functions serve --env-file supabase/.env.local`.
import { execSync } from 'node:child_process'
import { expect, type Page } from '@playwright/test'
import { es } from '../../src/copy/es'

export const MAILPIT = 'http://127.0.0.1:54324'
export const SUPABASE_URL = 'http://127.0.0.1:54321'
export const PASSWORD = 'una-clave-muy-larga-1'

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1e6)}@test.local`
}

/**
 * Sustituye el script de Cloudflare Turnstile por uno que entrega un token de inmediato.
 * La función `register` igual valida el token contra Cloudflare con la clave secreta de prueba.
 */
export async function stubTurnstile(page: Page): Promise<void> {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = {
        render(container, options) { setTimeout(() => options.callback('token-e2e'), 0); return 'w1' },
        remove() {},
      }`,
    }),
  )
}

export interface MailMessage {
  ID: string
  Subject: string
  To: Array<{ Address: string }>
}

export async function messagesFor(email: string): Promise<MailMessage[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
  const body = (await res.json()) as { messages?: MailMessage[] }
  return body.messages ?? []
}

/** Espera un correo para `email` cuyo asunto cumpla `subject` y devuelve su texto. */
export async function waitForMail(
  email: string,
  subject: RegExp,
  timeoutMs = 15000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = (await messagesFor(email)).find((m) => subject.test(m.Subject))
    if (found) {
      const res = await fetch(`${MAILPIT}/api/v1/message/${found.ID}`)
      return ((await res.json()) as { Text: string }).Text
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`No llegó un correo "${subject}" para ${email}`)
}

export function linkIn(text: string, pattern: RegExp): string {
  const match = pattern.exec(text)
  if (!match) throw new Error(`No hay un enlace ${pattern} en el correo`)
  return match[0]
}

/** Consulta de solo lectura a la base local (para comprobar sesiones, que la API no lista). */
export function dbQuery(sql: string): string {
  return execSync(`docker exec supabase_db_myguide psql -U postgres -At -c "${sql}"`, {
    encoding: 'utf8',
  }).trim()
}

/** Reinicia el límite de solicitudes por IP (FR-008). Solo para el entorno local de pruebas. */
export function resetRateLimits(): void {
  dbQuery('delete from private.rate_limit_hits')
}

export function sessionCount(email: string): number {
  return Number(
    dbQuery(
      `select count(*) from auth.sessions s join auth.users u on u.id = s.user_id where u.email = '${email}'`,
    ),
  )
}

export async function register(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/registro')
  await page.getByLabel(es.auth.labels.email).fill(email)
  await page.getByLabel(es.auth.labels.password).fill(password)
  await page.getByLabel(es.auth.labels.privacyAccept).check()
  await page.getByRole('button', { name: es.auth.actions.register }).click()
  await expect(page.getByRole('heading', { level: 1, name: es.home.title })).toBeVisible()
}

export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/ingresar')
  await page.getByLabel(es.auth.labels.email).fill(email)
  await page.getByLabel(es.auth.labels.password).fill(password)
  await page.getByRole('button', { name: es.auth.actions.login }).click()
}

/** Alimentos de catálogo para las pruebas (spec 002). Solo ASCII: el texto viaja por la línea de comandos. */
export interface SeedFood {
  id: string
  name: string
  brand?: string
  energy: number | null
  fiber?: number | null
  portions?: Array<{ name: string; quantity: number }>
}

/** Borra los ítems de comidas de corridas anteriores (todos llevan "e2e" en el nombre). */
export function clearSeededEntries(): void {
  dbQuery("delete from public.meal_entries where food_name like '%e2e%'")
}

export function clearSeededFoods(): void {
  dbQuery("delete from public.foods where source_item_id like 'E2E-%'")
}

export function seedCatalogFoods(foods: SeedFood[]): void {
  for (const food of foods) {
    const brand = food.brand ? `'${food.brand}'` : 'null'
    const energy = food.energy === null ? 'null' : String(food.energy)
    const fiber =
      food.fiber === undefined ? '0.4' : food.fiber === null ? 'null' : String(food.fiber)
    dbQuery(
      `insert into public.foods (origin, source_id, source_item_id, imported_at, name, brand, reference_basis, energy_kcal, protein_g, carbs_g, fat_g, fiber_g) select 'imported', id, 'E2E-${food.id}', '2026-10-18T12:00:00Z', '${food.name}', ${brand}, '100g', ${energy}, 3.3, 12, 0.5, ${fiber} from public.food_sources where slug = 'usda-fdc'`,
    )
    for (const [position, portion] of (food.portions ?? []).entries()) {
      dbQuery(
        `insert into public.food_portions (food_id, name, quantity, position) select id, '${portion.name}', ${portion.quantity}, ${position} from public.foods where source_item_id = 'E2E-${food.id}'`,
      )
    }
  }
}

/** Confirma el correo abriendo el enlace que llegó al buzón local. */
export async function confirmEmail(page: Page, email: string): Promise<void> {
  const text = await waitForMail(email, /confirma tu correo/i)
  const link = linkIn(text, /http\S+confirm-email\?token=\S+/)
  await page.goto(link)
  await expect(
    page.getByRole('heading', { level: 1, name: es.auth.titles.emailConfirmed }),
  ).toBeVisible()
}

/** Una zona de horas enteras en la que ahora son las 01:xx. */
export function zoneWhereItIsOneAm(): string {
  const utcHour = new Date().getUTCHours()
  let offset = (1 - utcHour + 24) % 24
  if (offset > 12) offset -= 24
  if (offset === 0) return 'Etc/GMT'
  return `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`
}

export function dayIn(zone: string, plusDays = 0): string {
  const date = new Date(Date.now() + plusDays * 24 * 3600 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(date)
}
