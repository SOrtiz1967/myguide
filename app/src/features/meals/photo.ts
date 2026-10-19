// T065 (spec 003, FR-031): reduce y vuelve a codificar la foto en el navegador antes de subirla.
//
// Se decodifica, se reduce para que el lado mayor no pase de 1600 px (sin agrandar) y se codifica como
// JPEG de calidad 0,8. Re-codificar ya descarta EXIF y GPS; el servidor además limpia el archivo por si
// alguien salta este paso (la función `meal-photo` no confía en el cliente).

export const MAX_SOURCE_BYTES = 15 * 1024 * 1024
export const MAX_SIDE = 1600
export const JPEG_QUALITY = 0.8

/** Vida de la URL firmada con la que se muestra la foto (contracts/meal-photo.md). */
export const PHOTO_URL_SECONDS = 600

/** Error de `meal-photo` con el código que responde la función (contracts/meal-photo.md). */
export class PhotoRequestError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'PhotoRequestError'
    this.code = code
  }
}

export type PhotoErrorCode = 'not_image' | 'too_big' | 'heic' | 'unreadable'

export class PhotoError extends Error {
  readonly code: PhotoErrorCode

  constructor(code: PhotoErrorCode) {
    super(code)
    this.name = 'PhotoError'
    this.code = code
  }
}

/** Lo que necesita `preparePhoto` del navegador; las pruebas lo reemplazan. */
export interface PhotoEnv {
  decode(
    file: Blob,
  ): Promise<{ width: number; height: number; release?: () => void; source: unknown }>
  encode(
    decoded: { source: unknown },
    width: number,
    height: number,
    quality: number,
  ): Promise<Blob | null>
}

/** Dimensiones de destino: el lado mayor no pasa de `MAX_SIDE` y nunca se agranda. */
export function targetSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= MAX_SIDE) return { width, height }
  const scale = MAX_SIDE / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const isHeic = (file: File) => /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)

export const browserEnv: PhotoEnv = {
  async decode(file) {
    const bitmap = await createImageBitmap(file)
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      release: () => bitmap.close(),
    }
  },
  encode(decoded, width, height, quality) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.resolve(null)
    ctx.drawImage(decoded.source as ImageBitmap, 0, 0, width, height)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  },
}

/** Devuelve el JPEG reducido, o lanza `PhotoError` con el motivo. */
export async function preparePhoto(file: File, env: PhotoEnv = browserEnv): Promise<Blob> {
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoError('too_big')
  if (!file.type.startsWith('image/') && !isHeic(file)) throw new PhotoError('not_image')

  let decoded
  try {
    decoded = await env.decode(file)
  } catch {
    // Un HEIC que el navegador no sabe decodificar tiene su propio mensaje.
    throw new PhotoError(isHeic(file) ? 'heic' : 'unreadable')
  }
  try {
    const { width, height } = targetSize(decoded.width, decoded.height)
    const blob = await env.encode(decoded, width, height, JPEG_QUALITY)
    if (!blob || blob.type !== 'image/jpeg') throw new PhotoError('unreadable')
    return blob
  } finally {
    decoded.release?.()
  }
}
