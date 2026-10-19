// T085 (FR-006, FR-008, FR-002, FR-025): invariantes de seguridad de supabase/config.toml.
// Si alguien cambia la configuración de Auth y rompe una decisión de la spec 001, esta prueba falla.
import { assert, assertEquals } from '@std/assert'
import { parse } from '@std/toml'

type Toml = Record<string, any>

const config = parse(await Deno.readTextFile('supabase/config.toml')) as Toml
const auth = config.auth as Toml
const email = auth.email as Toml
const functions = (config.functions ?? {}) as Toml

Deno.test('FR-008: el registro nativo está desactivado (las cuentas se crean solo con `register`)', () => {
  assertEquals(auth.enable_signup, false)
})

Deno.test('FR-025: el ingreso con correo sigue habilitado', () => {
  // [auth.email].enable_signup deshabilita TAMBIÉN el inicio de sesión (descubierto en el prototipo T007).
  assertEquals(email.enable_signup, true)
})

Deno.test('FR-026: la confirmación nativa de correo está desactivada (la confirmación es propia y no bloqueante)', () => {
  assertEquals(email.enable_confirmations, false)
})

Deno.test('FR-002: la contraseña mínima es de 10 caracteres', () => {
  assertEquals(auth.minimum_password_length, 10)
})

Deno.test('FR-006: hay un límite estricto de intentos por IP', () => {
  const limit = (auth.rate_limit as Toml).sign_in_sign_ups
  assert(typeof limit === 'number' && limit > 0 && limit <= 10, `sign_in_sign_ups = ${limit}`)
})

Deno.test('FR-008/FR-025: el captcha nativo está desactivado (Turnstile se verifica en las funciones)', () => {
  const captcha = auth.captcha as Toml | undefined
  assert(!captcha || captcha.enabled !== true, 'el captcha nativo se aplicaría también al inicio de sesión')
})

Deno.test('FR-028: el cambio de contraseña exige haber ingresado hace poco', () => {
  assertEquals(email.secure_password_change, true)
})

Deno.test('FR-003: el token de acceso dura como máximo una hora', () => {
  assert(auth.jwt_expiry <= 3600, `jwt_expiry = ${auth.jwt_expiry}`)
})

Deno.test('FR-012: solo las funciones públicas por diseño se abren sin sesión', () => {
  assertEquals(functions.register?.verify_jwt, false)
  assertEquals(functions['request-password-reset']?.verify_jwt, false)
  assertEquals(functions['confirm-email']?.verify_jwt, false)
  assertEquals(functions['send-verification']?.verify_jwt, true)
})

// T004 (spec 003, FR-032, FR-033): las fotos de las comidas.
const storage = (config.storage ?? {}) as Toml
const photoBucket = (storage.buckets?.['meal-photos'] ?? {}) as Toml

Deno.test('FR-032: el bucket de fotos de las comidas es privado', () => {
  assertEquals(photoBucket.public, false)
})

Deno.test('FR-033: el bucket de fotos admite solo JPEG de hasta 3 MiB', () => {
  assertEquals(photoBucket.file_size_limit, '3MiB')
  assertEquals(photoBucket.allowed_mime_types, ['image/jpeg'])
})

Deno.test('FR-030: la función meal-photo verifica la sesión ella misma', () => {
  // Está configurada (y su verificación automática apagada porque el preflight de CORS no lleva sesión).
  assertEquals(functions['meal-photo']?.verify_jwt, false)
})
