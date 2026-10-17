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

/** Confirma el correo abriendo el enlace que llegó al buzón local. */
export async function confirmEmail(page: Page, email: string): Promise<void> {
  const text = await waitForMail(email, /confirma tu correo/i)
  const link = linkIn(text, /http\S+confirm-email\?token=\S+/)
  await page.goto(link)
  await expect(
    page.getByRole('heading', { level: 1, name: es.auth.titles.emailConfirmed }),
  ).toBeVisible()
}
