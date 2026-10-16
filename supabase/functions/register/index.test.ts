// T082: la función `register` crea la cuenta con Turnstile, aviso vigente y correo único.
import { assert, assertEquals, assertFalse } from '@std/assert'
import { handleRegister, type RegisterDeps } from './handler.ts'

const EMAIL = 'persona@ejemplo.com'
const PASSWORD = 'una-contraseña-larga'

function body(overrides: Record<string, unknown> = {}) {
  return {
    email: EMAIL,
    password: PASSWORD,
    turnstileToken: 'token-captcha',
    privacyNoticeVersion: '2026-10-16',
    ...overrides,
  }
}

function post(payload: unknown): Request {
  return new Request('http://localhost/functions/v1/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify(payload),
  })
}

function makeDeps(overrides: Partial<RegisterDeps> = {}) {
  const calls = {
    turnstile: 0,
    rateLimit: 0,
    createAccount: [] as Array<{ email: string; password: string; privacyNoticeVersion: string }>,
    sendVerification: 0,
    logs: [] as string[],
  }
  const deps: RegisterDeps = {
    rateLimit: (_key) => {
      calls.rateLimit++
      return Promise.resolve(true)
    },
    verifyTurnstile: (_token, _ip) => {
      calls.turnstile++
      return Promise.resolve('ok')
    },
    createAccount: (input) => {
      calls.createAccount.push(input)
      return Promise.resolve({ status: 'created', userId: 'user-1' })
    },
    sendVerification: (_userId, _email) => {
      calls.sendVerification++
      return Promise.resolve({ sent: true })
    },
    log: (level, event, fields) => {
      calls.logs.push(JSON.stringify({ level, event, ...fields }))
    },
    ...overrides,
  }
  return { deps, calls }
}

Deno.test('FR-001: con datos válidos crea la cuenta y responde 201', async () => {
  const { deps, calls } = makeDeps()
  const res = await handleRegister(post(body()), deps)
  assertEquals(res.status, 201)
  assertEquals((await res.json()).verificationEmailSent, true)
  assertEquals(calls.createAccount.length, 1)
  assertEquals(calls.createAccount[0]?.privacyNoticeVersion, '2026-10-16')
})

Deno.test('FR-001: el correo se normaliza antes de crear la cuenta', async () => {
  const { deps, calls } = makeDeps()
  await handleRegister(post(body({ email: '  Persona@Ejemplo.COM ' })), deps)
  assertEquals(calls.createAccount[0]?.email, EMAIL)
})

Deno.test('FR-008: Turnstile rechazado responde 403 y no crea la cuenta', async () => {
  const { deps, calls } = makeDeps({ verifyTurnstile: () => Promise.resolve('rejected') })
  const res = await handleRegister(post(body()), deps)
  assertEquals(res.status, 403)
  assertEquals(calls.createAccount.length, 0)
})

Deno.test('FR-008 / VII: Turnstile caído responde 503 y no crea la cuenta', async () => {
  const { deps, calls } = makeDeps({ verifyTurnstile: () => Promise.resolve('unavailable') })
  const res = await handleRegister(post(body()), deps)
  assertEquals(res.status, 503)
  assertEquals(calls.createAccount.length, 0)
  assert(
    calls.logs.some((l) => l.includes('turnstile_unavailable')),
    'se registra la causa técnica',
  )
})

Deno.test('FR-007: un correo ya registrado responde 409 con código account_exists', async () => {
  const { deps } = makeDeps({ createAccount: () => Promise.resolve({ status: 'exists' }) })
  const res = await handleRegister(post(body()), deps)
  assertEquals(res.status, 409)
  assertEquals((await res.json()).code, 'account_exists')
})

Deno.test('FR-002: rechaza contraseña corta, larga y correo inválido con 400', async () => {
  for (
    const bad of [
      { password: 'corta' },
      { password: 'a'.repeat(73) },
      { email: 'no-es-un-correo' },
      { email: undefined },
    ]
  ) {
    const { deps, calls } = makeDeps()
    const res = await handleRegister(post(body(bad)), deps)
    assertEquals(res.status, 400, JSON.stringify(bad))
    assertEquals(calls.createAccount.length, 0)
  }
})

Deno.test('FR-029: una versión del aviso no vigente responde 400', async () => {
  const { deps } = makeDeps({
    createAccount: () => Promise.resolve({ status: 'invalid_privacy_version' }),
  })
  const res = await handleRegister(post(body({ privacyNoticeVersion: '1999-01-01' })), deps)
  assertEquals(res.status, 400)
  assertEquals((await res.json()).code, 'privacy_notice_invalid')
})

Deno.test('FR-029: sin versión del aviso responde 400 sin crear la cuenta', async () => {
  const { deps, calls } = makeDeps()
  const res = await handleRegister(post(body({ privacyNoticeVersion: undefined })), deps)
  assertEquals(res.status, 400)
  assertEquals(calls.createAccount.length, 0)
})

Deno.test('FR-026 / VII: si el correo de confirmación falla, la cuenta se crea igual', async () => {
  const { deps, calls } = makeDeps({
    sendVerification: () => Promise.resolve({ sent: false, cause: 'smtp_timeout' }),
  })
  const res = await handleRegister(post(body()), deps)
  assertEquals(res.status, 201)
  assertEquals((await res.json()).verificationEmailSent, false)
  assert(calls.logs.some((l) => l.includes('smtp_timeout')), 'se registra la causa técnica')
})

Deno.test('FR-026 / VII: una excepción al enviar el correo no rompe el alta', async () => {
  const { deps } = makeDeps({
    sendVerification: () => Promise.reject(new Error('conexión rechazada')),
  })
  const res = await handleRegister(post(body()), deps)
  assertEquals(res.status, 201)
  assertEquals((await res.json()).verificationEmailSent, false)
})

Deno.test('FR-008: supera el límite por IP y responde 429 sin llamar a Turnstile', async () => {
  const { deps, calls } = makeDeps({ rateLimit: () => Promise.resolve(false) })
  const res = await handleRegister(post(body()), deps)
  assertEquals(res.status, 429)
  assertEquals(calls.turnstile, 0)
})

Deno.test('IX: ningún registro técnico contiene el correo ni la contraseña', async () => {
  const { deps, calls } = makeDeps({
    verifyTurnstile: () => Promise.resolve('unavailable'),
  })
  await handleRegister(post(body()), deps)
  const { deps: deps2, calls: calls2 } = makeDeps({
    sendVerification: () => Promise.resolve({ sent: false, cause: 'smtp_rejected' }),
  })
  await handleRegister(post(body()), deps2)
  for (const line of [...calls.logs, ...calls2.logs]) {
    assertFalse(line.includes(EMAIL), `correo en el log: ${line}`)
    assertFalse(line.includes(PASSWORD), `contraseña en el log: ${line}`)
  }
})

Deno.test('solo acepta POST y responde el preflight de CORS', async () => {
  const { deps } = makeDeps()
  const pre = await handleRegister(
    new Request('http://localhost/functions/v1/register', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    }),
    deps,
  )
  assertEquals(pre.status, 204)
  const get = await handleRegister(new Request('http://localhost/functions/v1/register'), deps)
  assertEquals(get.status, 405)
})

Deno.test('un cuerpo que no es JSON responde 400', async () => {
  const { deps } = makeDeps()
  const res = await handleRegister(
    new Request('http://localhost/functions/v1/register', { method: 'POST', body: 'no es json' }),
    deps,
  )
  assertEquals(res.status, 400)
})
