// T071 (FR-020): nada se da por guardado sin respuesta del servidor; sin conexión ni se intenta.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { saveRemotely, WriteError } from '../../src/lib/mutation'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => setOnline(true))

describe('saveRemotely', () => {
  it('con conexión devuelve el resultado del servidor', async () => {
    await expect(saveRemotely(async () => 'guardado')).resolves.toBe('guardado')
  })

  it('FR-020: sin conexión no intenta guardar y avisa que no se guardó', async () => {
    setOnline(false)
    const write = vi.fn().mockResolvedValue('x')
    const error = await saveRemotely(write).catch((e: unknown) => e)
    expect(write).not.toHaveBeenCalled()
    expect(error).toBeInstanceOf(WriteError)
    expect((error as WriteError).network).toBe(true)
    expect((error as WriteError).message).toBe(es.errors.offline)
  })

  it('FR-020: un corte de red durante el guardado se informa como error de red', async () => {
    const error = await saveRemotely(() => Promise.reject(new TypeError('Failed to fetch'))).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(WriteError)
    expect((error as WriteError).network).toBe(true)
    expect((error as WriteError).message).toBe(es.errors.offline)
  })

  it('un error del servidor no se disfraza de error de red y no expone su texto', async () => {
    const error = await saveRemotely(() =>
      Promise.reject({ message: 'duplicate key value violates constraint', code: '23505' }),
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(WriteError)
    expect((error as WriteError).network).toBe(false)
    expect((error as WriteError).message).toBe(es.errors.generic)
  })
})
