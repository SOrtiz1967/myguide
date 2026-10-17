// T083: `request-password-reset` responde siempre igual y solo envía a cuentas con correo confirmado.
import { assert, assertEquals, assertFalse } from '@std/assert'
import { handleRequestReset, type ResetDeps } from './handler.ts'

const EMAIL = 'persona@ejemplo.com'

function post(payload: unknown): Request {
  return new Request('http://localhost/functions/v1/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify(payload),
  })
}

function makeDeps(overrides: Partial<ResetDeps> = {}) {
  const calls = { findUser: 0, sendRecovery: 0, logs: [] as string[] }
  const deps: ResetDeps = {
    rateLimit: () => Promise.resolve(true),
    verifyTurnstile: () => Promise.resolve('ok'),
    findUser: () => {
      calls.findUser++
      return Promise.resolve({ id: 'user-1', emailVerified: true })
    },
    sendRecovery: () => {
      calls.sendRecovery++
      return Promise.resolve()
    },
    log: (level, event, fields) => {
      calls.logs.push(JSON.stringify({ level, event, ...fields }))
    },
    ...overrides,
  }
  return { deps, calls }
}

const valid = { email: EMAIL, turnstileToken: 'token-captcha' }

Deno.test('FR-004: correo confirmado → 202 y se envía la recuperación', async () => {
  const { deps, calls } = makeDeps()
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 202)
  assertEquals(calls.sendRecovery, 1)
})

Deno.test('FR-027: correo sin confirmar → 202 pero NO se envía nada', async () => {
  const { deps, calls } = makeDeps({
    findUser: () => Promise.resolve({ id: 'user-1', emailVerified: false }),
  })
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 202)
  assertEquals(calls.sendRecovery, 0)
})

Deno.test('FR-005: cuenta inexistente → 202 y no se envía nada', async () => {
  const { deps, calls } = makeDeps({ findUser: () => Promise.resolve(null) })
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 202)
  assertEquals(calls.sendRecovery, 0)
})

Deno.test('FR-005: existente, sin confirmar e inexistente dan exactamente la misma respuesta', async () => {
  const confirmed = await handleRequestReset(post(valid), makeDeps().deps)
  const unconfirmed = await handleRequestReset(
    post(valid),
    makeDeps({ findUser: () => Promise.resolve({ id: 'u', emailVerified: false }) }).deps,
  )
  const missing = await handleRequestReset(
    post(valid),
    makeDeps({ findUser: () => Promise.resolve(null) }).deps,
  )
  const texts = await Promise.all([confirmed.text(), unconfirmed.text(), missing.text()])
  assertEquals(texts[0], texts[1])
  assertEquals(texts[1], texts[2])
  assertEquals([confirmed.status, unconfirmed.status, missing.status], [202, 202, 202])
})

Deno.test('FR-008: Turnstile rechazado → 403 y no se consulta la cuenta', async () => {
  const { deps, calls } = makeDeps({ verifyTurnstile: () => Promise.resolve('rejected') })
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 403)
  assertEquals(calls.findUser, 0)
})

Deno.test('FR-008 / VII: Turnstile caído → 503 y no se consulta la cuenta', async () => {
  const { deps, calls } = makeDeps({ verifyTurnstile: () => Promise.resolve('unavailable') })
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 503)
  assertEquals(calls.findUser, 0)
})

Deno.test('VII: si falla el envío de correo la respuesta sigue siendo 202 y queda registrado', async () => {
  const { deps, calls } = makeDeps({
    sendRecovery: () => Promise.reject(new Error('smtp_timeout')),
  })
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 202)
  assert(calls.logs.some((l) => l.includes('recovery_email_failed')))
})

Deno.test('FR-008: supera el límite por IP → 429', async () => {
  const { deps } = makeDeps({ rateLimit: () => Promise.resolve(false) })
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 429)
})

Deno.test('FR-002: un correo con formato inválido → 400', async () => {
  const { deps } = makeDeps()
  const res = await handleRequestReset(post({ ...valid, email: 'no-es-correo' }), deps)
  assertEquals(res.status, 400)
})

Deno.test('IX: los registros técnicos no contienen el correo', async () => {
  const { deps, calls } = makeDeps({
    sendRecovery: () => Promise.reject(new Error(`fallo enviando a ${EMAIL}`)),
  })
  await handleRequestReset(post(valid), deps)
  for (const line of calls.logs) assertFalse(line.includes(EMAIL), line)
})

Deno.test('FR-005: el envío del correo no retrasa la respuesta (sin canal de tiempo que revele si la cuenta existe)', async () => {
  const background: Array<Promise<unknown>> = []
  const { deps } = makeDeps({
    // Un envío que nunca termina: si la respuesta lo esperara, esta prueba se colgaría.
    sendRecovery: () => new Promise<void>(() => {}),
    runInBackground: (task) => {
      background.push(task)
    },
  })
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 202)
  assertEquals(background.length, 1, 'el envío se delegó a segundo plano')
})

Deno.test('FR-005: una cuenta inexistente no delega nada pero responde igual', async () => {
  const background: Array<Promise<unknown>> = []
  const { deps } = makeDeps({
    findUser: () => Promise.resolve(null),
    runInBackground: (task) => {
      background.push(task)
    },
  })
  const res = await handleRequestReset(post(valid), deps)
  assertEquals(res.status, 202)
  assertEquals(background.length, 0)
})

Deno.test('VII: un fallo del envío en segundo plano igual se registra sin datos personales', async () => {
  const background: Array<Promise<unknown>> = []
  const { deps, calls } = makeDeps({
    sendRecovery: () => Promise.reject(new Error(`falló ${EMAIL}`)),
    runInBackground: (task) => {
      background.push(task)
    },
  })
  await handleRequestReset(post(valid), deps)
  await Promise.all(background)
  assert(calls.logs.some((l) => l.includes('recovery_email_failed')))
  for (const line of calls.logs) assertFalse(line.includes(EMAIL), line)
})
