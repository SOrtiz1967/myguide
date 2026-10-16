// T013: el cliente de Supabase valida las variables publicas al arrancar (Principio VII).
import { describe, expect, it } from 'vitest'
import { parseEnv } from '../../src/lib/env'

describe('parseEnv', () => {
  it('acepta una configuracion valida', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })
    expect(env.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321')
  })

  it('falla con un mensaje claro si falta la URL', () => {
    expect(() => parseEnv({ VITE_SUPABASE_ANON_KEY: 'k' })).toThrow(/VITE_SUPABASE_URL/)
  })

  it('falla con un mensaje claro si falta la clave publica', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'http://x.test' })).toThrow(/VITE_SUPABASE_ANON_KEY/)
  })

  it('rechaza una URL invalida', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'no-es-url', VITE_SUPABASE_ANON_KEY: 'k' })).toThrow(
      /VITE_SUPABASE_URL/,
    )
  })

  it('Principio I: rechaza claves de servicio expuestas como variables publicas', () => {
    expect(() =>
      parseEnv({
        VITE_SUPABASE_URL: 'http://x.test',
        VITE_SUPABASE_ANON_KEY: 'k',
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'secreta',
      }),
    ).toThrow(/secret|servicio|SERVICE/i)
  })
})
