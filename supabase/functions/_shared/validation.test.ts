// FR-002: correo y contraseña válidos. La contraseña de bcrypt admite como máximo 72 bytes.
import { assertEquals } from '@std/assert'
import { isValidEmail, isValidPassword, normalizeEmail } from './validation.ts'

Deno.test('FR-002: acepta contraseñas de 10 a 72 caracteres', () => {
  assertEquals(isValidPassword('a'.repeat(10)), true)
  assertEquals(isValidPassword('a'.repeat(72)), true)
})

Deno.test('FR-002: rechaza contraseñas de 9 caracteres o de más de 72', () => {
  assertEquals(isValidPassword('a'.repeat(9)), false)
  assertEquals(isValidPassword('a'.repeat(73)), false)
})

Deno.test('FR-002: el límite de 72 se mide en bytes, no en letras', () => {
  // 40 caracteres de 2 bytes = 80 bytes: excede el máximo aunque tenga menos de 72 letras.
  assertEquals(isValidPassword('ñ'.repeat(40)), false)
})

Deno.test('FR-002: rechaza valores que no son texto', () => {
  assertEquals(isValidPassword(undefined), false)
  assertEquals(isValidPassword(1234567890), false)
  assertEquals(isValidPassword(null), false)
})

Deno.test('FR-002: valida el formato del correo', () => {
  assertEquals(isValidEmail('persona@ejemplo.com'), true)
  assertEquals(isValidEmail('nombre.apellido+etiqueta@sub.ejemplo.com.ar'), true)
  assertEquals(isValidEmail('sin-arroba.com'), false)
  assertEquals(isValidEmail('dos@@ejemplo.com'), false)
  assertEquals(isValidEmail('espacio @ejemplo.com'), false)
  assertEquals(isValidEmail('a@b'), false)
  assertEquals(isValidEmail(''), false)
  assertEquals(isValidEmail(undefined), false)
  assertEquals(isValidEmail('a'.repeat(250) + '@ejemplo.com'), false)
})

Deno.test('el correo se normaliza sin espacios y en minúsculas', () => {
  assertEquals(normalizeEmail('  Persona@Ejemplo.COM '), 'persona@ejemplo.com')
})
