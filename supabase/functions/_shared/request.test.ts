// FR-008: el límite por IP no puede saltarse inventando encabezados.
import { assertEquals } from '@std/assert'
import { clientIp } from './request.ts'

const req = (headers: Record<string, string>) => new Request('http://localhost/x', { headers })

Deno.test('FR-008: el encabezado de Cloudflare tiene prioridad, porque el cliente no puede fijarlo', () => {
  assertEquals(
    clientIp(req({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 9.9.9.9' })),
    '203.0.113.7',
  )
})

Deno.test('FR-008: de X-Forwarded-For se toma la ÚLTIMA entrada (la agrega el proxy), no la primera', () => {
  // Un cliente puede enviar "X-Forwarded-For: 1.2.3.4"; el proxy confiable añade la IP real al final.
  assertEquals(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })), '203.0.113.9')
})

Deno.test('FR-008: cambiar la primera entrada no cambia la IP detectada', () => {
  const a = clientIp(req({ 'x-forwarded-for': 'aaa, 203.0.113.9' }))
  const b = clientIp(req({ 'x-forwarded-for': 'bbb, 203.0.113.9' }))
  assertEquals(a, b)
})

Deno.test('una sola entrada se usa tal cual y los espacios se ignoran', () => {
  assertEquals(clientIp(req({ 'x-forwarded-for': '  203.0.113.9  ' })), '203.0.113.9')
})

Deno.test('sin encabezados devuelve "unknown"', () => {
  assertEquals(clientIp(req({})), 'unknown')
})
