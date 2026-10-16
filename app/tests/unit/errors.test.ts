// T017 (FR-005): los errores de credenciales usan un único mensaje que no revela si el correo existe.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { toUserMessage } from '../../src/lib/errors'

describe('toUserMessage', () => {
  it('FR-005: credenciales inválidas y usuario inexistente dan el mismo mensaje', () => {
    const a = toUserMessage({ code: 'invalid_credentials', status: 400 })
    const b = toUserMessage({ code: 'user_not_found', status: 400 })
    const c = toUserMessage({ message: 'Invalid login credentials', status: 400 })
    expect(a).toBe(b)
    expect(a).toBe(c)
    expect(a).toBe(es.errors.invalidCredentials)
  })

  it('FR-005: el mensaje de credenciales no menciona correo, usuario ni cuenta inexistente', () => {
    expect(es.errors.invalidCredentials).not.toMatch(/no existe|inexistente|no encontr/i)
  })

  it('el registro con correo repetido (409) muestra el mensaje claro definido por el autor', () => {
    expect(toUserMessage({ status: 409, context: 'register' })).toBe(es.errors.accountExists)
    expect(es.errors.accountExists).toBe(
      'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
    )
  })

  it('FR-006: el límite por IP pide esperar sin revelar nada de la cuenta', () => {
    expect(toUserMessage({ code: 'over_request_rate_limit', status: 429 })).toBe(
      es.errors.rateLimited,
    )
  })

  it('FR-008: captcha no disponible (503) pide reintentar más tarde', () => {
    expect(toUserMessage({ status: 503, context: 'captcha' })).toBe(es.errors.captchaUnavailable)
  })

  it('FR-002: contraseña débil explica el requisito', () => {
    expect(toUserMessage({ code: 'weak_password' })).toBe(es.errors.weakPassword)
  })

  it('FR-020: un fallo de red indica que no se guardó nada', () => {
    expect(toUserMessage({ network: true })).toBe(es.errors.offline)
    expect(es.errors.offline).toMatch(/no se guard/i)
  })

  it('un error desconocido da un mensaje genérico y nunca el texto crudo del proveedor', () => {
    const out = toUserMessage({ message: 'duplicate key value violates constraint users_pkey' })
    expect(out).toBe(es.errors.generic)
    expect(out).not.toMatch(/constraint|duplicate/i)
  })
})
