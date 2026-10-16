// FR-026: contenido del correo de confirmación. El envío real por SMTP se verifica en T009.
import { assert, assertEquals, assertFalse } from '@std/assert'
import { buildVerificationMail, smtpConfigFromEnv } from './mail.ts'

const LINK = 'http://localhost:54321/functions/v1/confirm-email?token=abc_DEF-123'

Deno.test('FR-026: el correo está en español e incluye el enlace en texto y en HTML', () => {
  const mail = buildVerificationMail(LINK)
  assertEquals(mail.subject, 'Confirma tu correo en MyGuide')
  assert(mail.text.includes(LINK))
  assert(mail.html.includes(LINK))
  assert(mail.text.includes('24 horas'), 'informa cuánto dura el enlace')
})

Deno.test('FR-026: aclara qué hacer si la persona no creó la cuenta', () => {
  const mail = buildVerificationMail(LINK)
  assert(/no creaste|ignora este mensaje/i.test(mail.text))
})

Deno.test('IV: el texto no es culpabilizante ni apremiante', () => {
  const { text } = buildVerificationMail(LINK)
  assertFalse(/urgente|inmediatamente|ahora mismo|última oportunidad/i.test(text))
})

Deno.test('el HTML escapa el enlace para no inyectar marcado', () => {
  const mail = buildVerificationMail('http://x.test/?a=1&b="2"<script>')
  assertFalse(mail.html.includes('<script>'))
  assert(mail.html.includes('&amp;'))
})

Deno.test('VII: la configuración SMTP sale del entorno y falla con un mensaje claro si falta', () => {
  const ok = smtpConfigFromEnv({
    SMTP_HOST: 'smtp.ejemplo.com',
    SMTP_PORT: '587',
    SMTP_USER: 'usuario',
    SMTP_PASSWORD: 'clave',
    SMTP_FROM_EMAIL: 'no-reply@ejemplo.com',
    SMTP_FROM_NAME: 'MyGuide',
  })
  assertEquals(ok.host, 'smtp.ejemplo.com')
  assertEquals(ok.port, 587)
  assertEquals(ok.from, '"MyGuide" <no-reply@ejemplo.com>')

  let message = ''
  try {
    smtpConfigFromEnv({ SMTP_PORT: '587' })
  } catch (error) {
    message = (error as Error).message
  }
  assert(message.includes('SMTP_HOST'), 'nombra la variable que falta')
})

Deno.test('VII: sin usuario ni clave se permite (buzón local de pruebas sin autenticación)', () => {
  const cfg = smtpConfigFromEnv({
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_FROM_EMAIL: 'no-reply@myguide.local',
  })
  assertEquals(cfg.auth, undefined)
  assertEquals(cfg.from, '"MyGuide" <no-reply@myguide.local>')
})
