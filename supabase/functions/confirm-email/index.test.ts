// T024 (FR-026): `confirm-email` valida el token de un solo uso y redirige sin distinguir causas.
import { assertEquals } from '@std/assert'
import { type ConfirmEmailDeps, handleConfirmEmail } from './handler.ts'

const SITE = 'http://localhost:5173'

function get(token: string | null): Request {
  const url = new URL('http://localhost/functions/v1/confirm-email')
  if (token !== null) url.searchParams.set('token', token)
  return new Request(url, { method: 'GET' })
}

function makeDeps(overrides: Partial<ConfirmEmailDeps> = {}) {
  const calls = { consumed: [] as string[], verified: [] as string[] }
  const deps: ConfirmEmailDeps = {
    siteUrl: SITE,
    hashToken: (t) => Promise.resolve(`hash:${t}`),
    consumeToken: (hash) => {
      calls.consumed.push(hash)
      return Promise.resolve({ userId: 'user-1' })
    },
    markVerified: (userId) => {
      calls.verified.push(userId)
      return Promise.resolve()
    },
    log: () => {},
    ...overrides,
  }
  return { deps, calls }
}

Deno.test('FR-026: token válido marca el correo como confirmado y redirige a /correo-confirmado', async () => {
  const { deps, calls } = makeDeps()
  const res = await handleConfirmEmail(get('abc'), deps)
  assertEquals(res.status, 303)
  assertEquals(res.headers.get('location'), `${SITE}/correo-confirmado`)
  assertEquals(calls.consumed, ['hash:abc'])
  assertEquals(calls.verified, ['user-1'])
})

Deno.test('FR-026: vencido, usado o inexistente redirigen exactamente igual a /correo-no-valido', async () => {
  // consumeToken devuelve null en los tres casos: la causa no se distingue hacia afuera.
  const { deps, calls } = makeDeps({ consumeToken: () => Promise.resolve(null) })
  const results = await Promise.all(
    ['vencido', 'usado', 'inexistente'].map((t) => handleConfirmEmail(get(t), deps)),
  )
  for (const res of results) {
    assertEquals(res.status, 303)
    assertEquals(res.headers.get('location'), `${SITE}/correo-no-valido`)
  }
  assertEquals(calls.verified.length, 0)
})

Deno.test('FR-026: sin token redirige a /correo-no-valido sin consultar la base', async () => {
  const { deps, calls } = makeDeps()
  const res = await handleConfirmEmail(get(null), deps)
  assertEquals(res.headers.get('location'), `${SITE}/correo-no-valido`)
  assertEquals(calls.consumed.length, 0)
})

Deno.test('FR-026: un error al consumir el token no confirma el correo y redirige a no válido', async () => {
  const { deps, calls } = makeDeps({ consumeToken: () => Promise.reject(new Error('db caída')) })
  const res = await handleConfirmEmail(get('abc'), deps)
  assertEquals(res.headers.get('location'), `${SITE}/correo-no-valido`)
  assertEquals(calls.verified.length, 0)
})

Deno.test('solo acepta GET', async () => {
  const { deps } = makeDeps()
  const res = await handleConfirmEmail(
    new Request('http://localhost/functions/v1/confirm-email?token=abc', { method: 'POST' }),
    deps,
  )
  assertEquals(res.status, 405)
})
