// T020 (Principio IX): el registrador no deja pasar datos personales, tokens ni secretos.
import { assert, assertEquals, assertFalse } from '@std/assert'
import { formatLog, redact } from './log.ts'

Deno.test('IX: reemplaza correos dentro de textos', () => {
  const out = redact('fallo al enviar a persona@ejemplo.com por smtp') as string
  assertFalse(out.includes('persona@ejemplo.com'))
  assert(out.includes('[correo]'))
})

Deno.test('IX: elimina el valor de claves sensibles aunque esten anidadas', () => {
  const out = redact({
    status: 502,
    user: { email: 'a@b.com', password: 'secreta123', token: 'abc', id: 'u-1' },
    headers: { authorization: 'Bearer xyz', apikey: 'k' },
    secret: 's',
  }) as Record<string, unknown>
  const json = JSON.stringify(out)
  for (const leaked of ['a@b.com', 'secreta123', 'abc', 'Bearer xyz', '"k"', '"s"']) {
    assertFalse(json.includes(leaked), `se filtro ${leaked}`)
  }
  assertEquals((out.user as Record<string, unknown>).id, 'u-1')
  assertEquals(out.status, 502)
})

Deno.test('IX: enmascara JWT y tokens largos en textos', () => {
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
  const out = redact(`respuesta invalida: ${jwt}`) as string
  assertFalse(out.includes(jwt))
  assert(out.includes('[token]'))
})

Deno.test('IX: conserva los datos tecnicos utiles para diagnosticar', () => {
  const out = redact({ cause: 'smtp_timeout', provider: 'brevo', status: 504, attempt: 2 })
  assertEquals(out, { cause: 'smtp_timeout', provider: 'brevo', status: 504, attempt: 2 })
})

Deno.test('IX: formatLog devuelve una sola linea JSON con nivel, evento y hora', () => {
  const line = formatLog('error', 'smtp_failed', { cause: 'timeout', to: 'x@y.com' })
  assertFalse(line.includes('\n'))
  const parsed = JSON.parse(line)
  assertEquals(parsed.level, 'error')
  assertEquals(parsed.event, 'smtp_failed')
  assert(typeof parsed.ts === 'string')
  assertFalse(line.includes('x@y.com'))
})
