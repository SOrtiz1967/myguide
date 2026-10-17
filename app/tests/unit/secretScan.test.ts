// T074 (Principio I): detección de secretos en el bundle y en el repositorio, sin mostrar nunca el secreto.
import { describe, expect, it } from 'vitest'
import { findSecrets } from '../../scripts/secret-scan'

const base64url = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = (role: string) => `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ role, iss: 'supabase-demo' })}.firma-de-prueba`

describe('findSecrets', () => {
  it('detecta un JWT con rol service_role', () => {
    const found = findSecrets(`const k = "${jwt('service_role')}"`, [])
    expect(found.map((f) => f.rule)).toContain('clave de servicio (JWT service_role)')
  })

  it('no marca la clave pública (anon), que sí puede ir en el frontend', () => {
    expect(findSecrets(`const k = "${jwt('anon')}"`, [])).toEqual([])
  })

  it('detecta las claves secretas con prefijo conocido', () => {
    const text = 'a sb_secret_ABCDEFGHIJKLMNOPQRSTUV b xsmtpsib-1234567890abcdef1234567890abcdef c xkeysib-1234567890abcdef1234567890abcdef'
    expect(findSecrets(text, []).map((f) => f.rule)).toEqual(
      expect.arrayContaining([
        'clave secreta de Supabase (sb_secret_)',
        'clave SMTP de Brevo',
        'API key de Brevo',
      ]),
    )
  })

  it('detecta los valores secretos exactos que se conocen del entorno', () => {
    const found = findSecrets('algo 0x4AAAAAAAsecretoReal1234 algo', [
      { name: 'TURNSTILE_SECRET_KEY', value: '0x4AAAAAAAsecretoReal1234' },
    ])
    expect(found).toHaveLength(1)
    expect(found[0]?.rule).toBe('valor de TURNSTILE_SECRET_KEY')
  })

  it('nunca incluye el secreto en el resultado', () => {
    const secret = '0x4AAAAAAAsecretoReal1234'
    const found = findSecrets(`x ${secret} y`, [{ name: 'TURNSTILE_SECRET_KEY', value: secret }])
    expect(JSON.stringify(found)).not.toContain(secret)
  })

  it('ignora valores conocidos demasiado cortos, que darían falsos positivos', () => {
    expect(findSecrets('puerto 587 y host smtp', [{ name: 'SMTP_PORT', value: '587' }])).toEqual([])
  })

  it('no marca texto común', () => {
    expect(findSecrets('const url = "https://ejemplo.com"; // sin secretos', [])).toEqual([])
  })

  it('informa en qué línea está el hallazgo', () => {
    const found = findSecrets(`linea uno\nlinea dos sb_secret_ABCDEFGHIJKLMNOPQRSTUV`, [])
    expect(found[0]?.line).toBe(2)
  })
})
