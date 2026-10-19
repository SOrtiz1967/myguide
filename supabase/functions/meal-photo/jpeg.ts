// T062 (spec 003, FR-031): limpieza de metadatos de un JPEG, sin decodificar la imagen.
//
// Recorre los segmentos y deja solo lo necesario para mostrarla: se quitan todos los APPn salvo APP0
// (JFIF) —ahí viven EXIF y GPS (APP1), XMP (APP1), IPTC (APP13), perfiles ICC (APP2) y las miniaturas
// incrustadas— y todos los comentarios (COM). Los datos comprimidos de la imagen no se tocan.
// Lo que hay después del marcador final (EOI) también se descarta.

export class InvalidImageError extends Error {
  constructor(reason: string) {
    super(`invalid_image: ${reason}`)
    this.name = 'InvalidImageError'
  }
}

export interface CleanJpeg {
  bytes: Uint8Array
  width: number
  height: number
}

const FF = 0xff
const SOI = 0xd8
const EOI = 0xd9
const SOS = 0xda
const APP0 = 0xe0
const APP15 = 0xef
const COM = 0xfe

/** Marcadores sin largo ni contenido (restablecimiento y TEM). */
const isStandalone = (marker: number) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)
/** SOF0..SOF15 salvo DHT (C4), JPG (C8) y DAC (CC): llevan las dimensiones. */
const isFrameHeader = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

export function cleanJpeg(input: Uint8Array): CleanJpeg {
  const size = input.length
  if (size < 4 || input[0] !== FF || input[1] !== SOI) throw new InvalidImageError('no_signature')

  const out: Uint8Array[] = [input.subarray(0, 2)]
  let pos = 2
  let width = 0
  let height = 0
  let scans = 0
  let ended = false

  while (pos < size) {
    if (input[pos] !== FF) throw new InvalidImageError('bad_marker')
    // Los bytes de relleno FF antes de un marcador se ignoran.
    while (pos < size && input[pos] === FF) pos++
    if (pos >= size) throw new InvalidImageError('truncated')
    const marker = input[pos]!
    pos++

    if (marker === EOI) {
      out.push(Uint8Array.of(FF, EOI))
      ended = true
      break
    }
    if (marker === 0x00) throw new InvalidImageError('bad_marker')
    if (isStandalone(marker)) {
      out.push(Uint8Array.of(FF, marker))
      continue
    }

    if (pos + 2 > size) throw new InvalidImageError('truncated')
    const length = (input[pos]! << 8) | input[pos + 1]!
    if (length < 2 || pos + length > size) throw new InvalidImageError('bad_segment_length')
    const body = input.subarray(pos, pos + length)
    pos += length

    if (isFrameHeader(marker)) {
      if (length < 8) throw new InvalidImageError('bad_segment_length')
      height = (body[3]! << 8) | body[4]!
      width = (body[5]! << 8) | body[6]!
    }

    if (marker === APP0) {
      out.push(Uint8Array.of(FF, marker), jfifWithoutThumbnail(body))
      continue
    }
    if ((marker > APP0 && marker <= APP15) || marker === COM) continue

    out.push(Uint8Array.of(FF, marker), body)

    if (marker === SOS) {
      scans++
      // Datos comprimidos: se copian hasta el próximo marcador que no sea relleno (FF 00) ni reinicio.
      const start = pos
      while (pos < size) {
        if (input[pos] === FF) {
          const next = input[pos + 1]
          if (next === undefined) throw new InvalidImageError('truncated')
          if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7) && next !== FF) break
          pos += next === FF ? 1 : 2
        } else {
          pos++
        }
      }
      if (pos >= size) throw new InvalidImageError('truncated')
      out.push(input.subarray(start, pos))
    }
  }

  if (!ended) throw new InvalidImageError('truncated')
  if (scans === 0 || width === 0 || height === 0) throw new InvalidImageError('no_image_data')

  const total = out.reduce((sum, part) => sum + part.length, 0)
  const bytes = new Uint8Array(total)
  let at = 0
  for (const part of out) {
    bytes.set(part, at)
    at += part.length
  }
  return { bytes, width, height }
}

/** APP0 sin la miniatura que pueda llevar: solo el encabezado de 16 bytes (largo incluido). */
function jfifWithoutThumbnail(body: Uint8Array): Uint8Array {
  const isJfif = body.length >= 16 &&
    body[2] === 0x4a &&
    body[3] === 0x46 &&
    body[4] === 0x49 &&
    body[5] === 0x46 &&
    body[6] === 0x00
  if (!isJfif) return body
  const header = body.slice(0, 16)
  header[0] = 0
  header[1] = 16
  header[14] = 0 // ancho de la miniatura
  header[15] = 0 // alto de la miniatura
  return header
}
