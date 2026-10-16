// FR-008 / Principio VII: el resultado de Turnstile distingue rechazo del usuario de caída del servicio.
import { assertEquals } from '@std/assert'
import { verifyTurnstile } from './turnstile.ts'

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

Deno.test('FR-008: token válido devuelve ok', async () => {
  const r = await verifyTurnstile({
    secret: 's',
    token: 't',
    fetchFn: () => json({ success: true }),
  })
  assertEquals(r, 'ok')
})

Deno.test('FR-008: token rechazado por Cloudflare devuelve rejected', async () => {
  const r = await verifyTurnstile({
    secret: 's',
    token: 't',
    fetchFn: () => json({ success: false, 'error-codes': ['invalid-input-response'] }),
  })
  assertEquals(r, 'rejected')
})

Deno.test('Principio VII: error interno de Cloudflare devuelve unavailable', async () => {
  const r = await verifyTurnstile({
    secret: 's',
    token: 't',
    fetchFn: () => json({ success: false, 'error-codes': ['internal-error'] }),
  })
  assertEquals(r, 'unavailable')
})

Deno.test('Principio VII: respuesta 5xx devuelve unavailable', async () => {
  const r = await verifyTurnstile({
    secret: 's',
    token: 't',
    fetchFn: () => json({}, 503),
  })
  assertEquals(r, 'unavailable')
})

Deno.test('Principio VII: fallo de red devuelve unavailable', async () => {
  const r = await verifyTurnstile({
    secret: 's',
    token: 't',
    fetchFn: () => Promise.reject(new TypeError('network down')),
  })
  assertEquals(r, 'unavailable')
})

Deno.test('Principio VII: tiempo de espera agotado devuelve unavailable', async () => {
  const r = await verifyTurnstile({
    secret: 's',
    token: 't',
    timeoutMs: 20,
    fetchFn: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('abort', 'AbortError')),
        )
      }),
  })
  assertEquals(r, 'unavailable')
})

Deno.test('un token vacío se rechaza sin llamar a Cloudflare', async () => {
  let called = false
  const r = await verifyTurnstile({
    secret: 's',
    token: '',
    fetchFn: () => {
      called = true
      return json({ success: true })
    },
  })
  assertEquals(r, 'rejected')
  assertEquals(called, false)
})

Deno.test('envía el secreto, el token y la IP como formulario', async () => {
  let sent: URLSearchParams | undefined
  await verifyTurnstile({
    secret: 'mi-secreto',
    token: 'mi-token',
    ip: '203.0.113.9',
    fetchFn: (_url, init) => {
      sent = new URLSearchParams(String(init?.body))
      return json({ success: true })
    },
  })
  assertEquals(sent?.get('secret'), 'mi-secreto')
  assertEquals(sent?.get('response'), 'mi-token')
  assertEquals(sent?.get('remoteip'), '203.0.113.9')
})
