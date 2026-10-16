// FR-026: el token de confirmación viaja solo en el enlace; en la base solo se guarda su hash.
import { assert, assertEquals, assertNotEquals } from '@std/assert'
import { generateToken, hashToken } from './tokens.ts'

Deno.test('FR-026: genera tokens largos, distintos y seguros para una URL', () => {
  const a = generateToken()
  const b = generateToken()
  assertNotEquals(a, b)
  assert(a.length >= 43, 'al menos 256 bits')
  assert(/^[A-Za-z0-9_-]+$/.test(a), 'solo caracteres seguros para una URL')
})

Deno.test('FR-026: el hash es determinista y distinto del token', async () => {
  const token = generateToken()
  const h1 = await hashToken(token)
  const h2 = await hashToken(token)
  assertEquals(h1, h2)
  assertNotEquals(h1, token)
  assertEquals(h1.length, 64, 'SHA-256 en hexadecimal')
})

Deno.test('FR-026: tokens distintos dan hashes distintos', async () => {
  assertNotEquals(await hashToken('uno'), await hashToken('dos'))
})
