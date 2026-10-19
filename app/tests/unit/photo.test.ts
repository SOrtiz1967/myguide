// T059 (spec 003, FR-031): reducir y volver a codificar la foto antes de subirla.
import { describe, expect, it, vi } from 'vitest'
import {
  JPEG_QUALITY,
  MAX_SIDE,
  MAX_SOURCE_BYTES,
  PhotoError,
  preparePhoto,
  targetSize,
  type PhotoEnv,
} from '../../src/features/meals/photo'

function fakeEnv(width: number, height: number) {
  const release = vi.fn()
  const encode = vi.fn(
    async (_decoded: { source: unknown }, w: number, h: number, quality: number) =>
      new Blob([`${w}x${h}@${quality}`], { type: 'image/jpeg' }),
  )
  const env: PhotoEnv = {
    decode: vi.fn(async () => ({ width, height, source: {}, release })),
    encode,
  }
  return { env, encode, release }
}

const file = (name: string, type: string, size = 1000) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('targetSize', () => {
  it('reduce para que el lado mayor no pase de 1600 px, manteniendo la proporción', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(targetSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
    expect(targetSize(12000, 100)).toEqual({ width: 1600, height: 13 })
  })

  it('no agranda lo que ya es chico', () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(targetSize(MAX_SIDE, 900)).toEqual({ width: MAX_SIDE, height: 900 })
  })
})

describe('preparePhoto', () => {
  it('devuelve un JPEG reducido con calidad 0,8', async () => {
    const { env, encode, release } = fakeEnv(4000, 3000)
    const blob = await preparePhoto(file('plato.png', 'image/png'), env)
    expect(blob.type).toBe('image/jpeg')
    expect(encode).toHaveBeenCalledWith(expect.anything(), 1600, 1200, JPEG_QUALITY)
    expect(JPEG_QUALITY).toBe(0.8)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('rechaza lo que no es imagen', async () => {
    const { env } = fakeEnv(10, 10)
    await expect(preparePhoto(file('notas.txt', 'text/plain'), env)).rejects.toMatchObject({
      code: 'not_image',
    })
    expect(env.decode).not.toHaveBeenCalled()
  })

  it('rechaza lo que pesa más de 15 MB sin decodificarlo', async () => {
    const { env } = fakeEnv(10, 10)
    await expect(
      preparePhoto(file('enorme.jpg', 'image/jpeg', MAX_SOURCE_BYTES + 1), env),
    ).rejects.toMatchObject({ code: 'too_big' })
    expect(env.decode).not.toHaveBeenCalled()
  })

  it('un HEIC que el navegador no puede decodificar da el mensaje acordado', async () => {
    const env: PhotoEnv = {
      decode: vi.fn(async () => {
        throw new Error('InvalidStateError')
      }),
      encode: vi.fn(),
    }
    await expect(preparePhoto(file('IMG_1.HEIC', 'image/heic'), env)).rejects.toMatchObject({
      code: 'heic',
    })
    // También cuando el sistema no informa el tipo pero la extensión lo delata.
    await expect(preparePhoto(file('IMG_2.heic', ''), env)).rejects.toMatchObject({ code: 'heic' })
  })

  it('una imagen corrupta da "no se pudo leer"', async () => {
    const env: PhotoEnv = {
      decode: vi.fn(async () => {
        throw new Error('InvalidStateError')
      }),
      encode: vi.fn(),
    }
    const error = await preparePhoto(file('rota.jpg', 'image/jpeg'), env).catch((e) => e)
    expect(error).toBeInstanceOf(PhotoError)
    expect(error.code).toBe('unreadable')
  })

  it('si no se puede codificar a JPEG falla sin dejar nada', async () => {
    const { env, release } = fakeEnv(100, 100)
    env.encode = vi.fn(async () => null)
    await expect(preparePhoto(file('a.png', 'image/png'), env)).rejects.toMatchObject({
      code: 'unreadable',
    })
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('la salida es siempre JPEG', async () => {
    const { env } = fakeEnv(100, 100)
    env.encode = vi.fn(async () => new Blob(['x'], { type: 'image/png' }))
    await expect(preparePhoto(file('a.png', 'image/png'), env)).rejects.toMatchObject({
      code: 'unreadable',
    })
  })
})
