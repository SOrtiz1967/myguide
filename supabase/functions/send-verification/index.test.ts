// T024 (FR-026): `send-verification` emite el enlace de confirmación con límites de frecuencia.
import { assert, assertEquals, assertFalse } from '@std/assert'
import { handleSendVerification, type SendVerificationDeps } from './handler.ts'

const EMAIL = 'persona@ejemplo.com'
const NOW = new Date('2026-10-16T12:00:00Z')

function post(authorization: string | null = 'Bearer jwt-valido'): Request {
  const headers: Record<string, string> = {}
  if (authorization) headers.authorization = authorization
  return new Request('http://localhost/functions/v1/send-verification', {
    method: 'POST',
    headers,
  })
}

function makeDeps(overrides: Partial<SendVerificationDeps> = {}) {
  const calls = {
    createToken: 0,
    sentLinks: [] as string[],
    logs: [] as string[],
  }
  const deps: SendVerificationDeps = {
    now: () => NOW,
    siteUrl: 'http://localhost:5173',
    functionsUrl: 'http://localhost:54321/functions/v1',
    getUser: () => Promise.resolve({ id: 'user-1', email: EMAIL, emailVerified: false }),
    lastTokenAt: () => Promise.resolve(null),
    tokensInLastDay: () => Promise.resolve(0),
    createToken: (_userId, _expiresAt) => {
      calls.createToken++
      return Promise.resolve('token-en-claro')
    },
    sendMail: ({ link }) => {
      calls.sentLinks.push(link)
      return Promise.resolve()
    },
    log: (level, event, fields) => {
      calls.logs.push(JSON.stringify({ level, event, ...fields }))
    },
    ...overrides,
  }
  return { deps, calls }
}

Deno.test('FR-026: con sesión válida crea el token y envía el enlace (204)', async () => {
  const { deps, calls } = makeDeps()
  const res = await handleSendVerification(post(), deps)
  assertEquals(res.status, 204)
  assertEquals(calls.createToken, 1)
  assertEquals(calls.sentLinks.length, 1)
  assert(calls.sentLinks[0]?.includes('/confirm-email?token=token-en-claro'))
})

Deno.test('FR-012: sin sesión responde 401', async () => {
  const { deps, calls } = makeDeps({ getUser: () => Promise.resolve(null) })
  const res = await handleSendVerification(post(null), deps)
  assertEquals(res.status, 401)
  assertEquals(calls.createToken, 0)
})

Deno.test('FR-026: si el correo ya está confirmado responde 409', async () => {
  const { deps, calls } = makeDeps({
    getUser: () => Promise.resolve({ id: 'user-1', email: EMAIL, emailVerified: true }),
  })
  const res = await handleSendVerification(post(), deps)
  assertEquals(res.status, 409)
  assertEquals(calls.createToken, 0)
})

Deno.test('FR-026: reenvío antes de 60 segundos responde 429', async () => {
  const { deps, calls } = makeDeps({
    lastTokenAt: () => Promise.resolve(new Date(NOW.getTime() - 30_000)),
  })
  const res = await handleSendVerification(post(), deps)
  assertEquals(res.status, 429)
  assertEquals(calls.createToken, 0)
})

Deno.test('FR-026: pasados 60 segundos permite reenviar', async () => {
  const { deps } = makeDeps({
    lastTokenAt: () => Promise.resolve(new Date(NOW.getTime() - 61_000)),
  })
  const res = await handleSendVerification(post(), deps)
  assertEquals(res.status, 204)
})

Deno.test('FR-026: el máximo diario (5) responde 429', async () => {
  const { deps, calls } = makeDeps({ tokensInLastDay: () => Promise.resolve(5) })
  const res = await handleSendVerification(post(), deps)
  assertEquals(res.status, 429)
  assertEquals(calls.createToken, 0)
})

Deno.test('FR-026: el token vence a las 24 horas', async () => {
  let expiresAt: Date | undefined
  const { deps } = makeDeps({
    createToken: (_userId, exp) => {
      expiresAt = exp
      return Promise.resolve('t')
    },
  })
  await handleSendVerification(post(), deps)
  assertEquals(expiresAt?.getTime(), NOW.getTime() + 24 * 60 * 60 * 1000)
})

Deno.test('VII: si el proveedor de correo falla responde 502 y registra la causa sin datos personales', async () => {
  const { deps, calls } = makeDeps({
    sendMail: () => Promise.reject(new Error(`rechazado para ${EMAIL} con token-en-claro`)),
  })
  const res = await handleSendVerification(post(), deps)
  assertEquals(res.status, 502)
  assert(calls.logs.some((l) => l.includes('verification_email_failed')))
  for (const line of calls.logs) {
    assertFalse(line.includes(EMAIL), `correo en el log: ${line}`)
    assertFalse(line.includes('token-en-claro'), `token en el log: ${line}`)
  }
})
