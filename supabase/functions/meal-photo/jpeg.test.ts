// T056 (spec 003, FR-031): la limpieza de metadatos de un JPEG.
import { assert, assertEquals, assertFalse, assertThrows } from '@std/assert'
import { cleanJpeg, InvalidImageError } from './jpeg.ts'

const read = (name: string) => Deno.readFile(new URL(`./fixtures/${name}`, import.meta.url))
const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

/** Marcadores de los segmentos que hay en un JPEG, en orden (hasta el primer SOS). */
function markers(bytes: Uint8Array): number[] {
  const found: number[] = []
  let pos = 2
  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) break
    const marker = bytes[pos + 1]!
    found.push(marker)
    if (marker === 0xda || marker === 0xd9) break
    pos += 2 + ((bytes[pos + 2]! << 8) | bytes[pos + 3]!)
  }
  return found
}

Deno.test('quita EXIF, GPS y comentarios de una foto con GPS', async () => {
  const original = await read('con-gps.jpg')
  assert(text(original).includes('Exif'), 'el fixture debe traer EXIF')
  assert(text(original).includes('MarcaDePruebaCamara'))
  assert(text(original).includes('comentario-privado-de-prueba'))

  const { bytes } = cleanJpeg(original)
  const out = text(bytes)
  assertFalse(out.includes('Exif'))
  assertFalse(out.includes('MarcaDePruebaCamara'))
  assertFalse(out.includes('comentario-privado-de-prueba'))
  assertFalse(markers(bytes).includes(0xe1), 'sin APP1')
  assertFalse(markers(bytes).includes(0xfe), 'sin COM')
})

Deno.test('quita XMP (APP1) e IPTC (APP13)', async () => {
  const original = await read('con-xmp-iptc.jpg')
  assert(text(original).includes('xmp-privado-de-prueba'))
  assert(text(original).includes('iptc-privado-de-prueba'))
  assert(markers(original).includes(0xed))

  const { bytes } = cleanJpeg(original)
  const out = text(bytes)
  assertFalse(out.includes('xmp-privado-de-prueba'))
  assertFalse(out.includes('iptc-privado-de-prueba'))
  assertFalse(out.includes('Photoshop'))
  const kept = markers(bytes)
  assertFalse(kept.some((m) => m >= 0xe1 && m <= 0xef), 'ningún APPn salvo APP0')
})

Deno.test('conserva APP0 y los datos de la imagen, y las dimensiones', async () => {
  const original = await read('con-gps.jpg')
  const { bytes, width, height } = cleanJpeg(original)
  assertEquals(width, 800)
  assertEquals(height, 600)
  assertEquals(markers(bytes)[0], 0xe0)
  // La imagen limpia es la misma que la que nunca tuvo metadatos.
  const clean = cleanJpeg(await read('sin-metadatos.jpg'))
  assertEquals(bytes.length, clean.bytes.length)
  assertEquals(bytes, clean.bytes)
})

Deno.test('la salida empieza en FF D8 y termina en FF D9', async () => {
  const { bytes } = cleanJpeg(await read('con-gps.jpg'))
  assertEquals([bytes[0], bytes[1]], [0xff, 0xd8])
  assertEquals([bytes.at(-2), bytes.at(-1)], [0xff, 0xd9])
})

Deno.test('descarta lo que viene después del marcador final', async () => {
  const original = await read('sin-metadatos.jpg')
  const withTail = new Uint8Array(original.length + 40)
  withTail.set(original)
  withTail.set(new TextEncoder().encode('datos-escondidos-al-final'), original.length)
  const { bytes } = cleanJpeg(withTail)
  assertFalse(text(bytes).includes('datos-escondidos'))
  assertEquals([bytes.at(-2), bytes.at(-1)], [0xff, 0xd9])
})

Deno.test('un archivo truncado da invalid_image', async () => {
  assertThrows(() => cleanJpeg(awaitedTruncated), InvalidImageError, 'invalid_image')
})

Deno.test('un archivo sin firma JPEG da invalid_image', () => {
  assertThrows(() => cleanJpeg(new TextEncoder().encode('esto no es un jpeg')), InvalidImageError)
  assertThrows(() => cleanJpeg(new Uint8Array()), InvalidImageError)
})

Deno.test('un largo de segmento inválido da invalid_image', () => {
  const bad = Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00, 0x00, 0xff, 0xd9)
  assertThrows(() => cleanJpeg(bad), InvalidImageError, 'bad_segment_length')
  const tooShort = Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x01, 0xff, 0xd9)
  assertThrows(() => cleanJpeg(tooShort), InvalidImageError, 'bad_segment_length')
})

Deno.test('sin datos de imagen da invalid_image', () => {
  assertThrows(() => cleanJpeg(Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)), InvalidImageError)
})

Deno.test('una entrada grande no se recorre más allá de su tamaño', () => {
  // 3 MiB de segmentos APP1 vacíos y luego el final: termina y no lee fuera del arreglo.
  const parts: number[] = [0xff, 0xd8]
  const big = new Uint8Array(3 * 1024 * 1024)
  big.set(parts)
  let pos = 2
  while (pos + 4 <= big.length - 2) {
    big[pos] = 0xff
    big[pos + 1] = 0xe1
    big[pos + 2] = 0x00
    big[pos + 3] = 0x02
    pos += 4
  }
  big[pos] = 0xff
  big[pos + 1] = 0xd9
  const started = performance.now()
  assertThrows(() => cleanJpeg(big.subarray(0, pos + 2)), InvalidImageError, 'no_image_data')
  assert(performance.now() - started < 1000)
})

Deno.test('rendimiento: limpia una foto en menos de 1 s', async () => {
  const original = await read('con-gps.jpg')
  const started = performance.now()
  cleanJpeg(original)
  assert(performance.now() - started < 1000)
})

const awaitedTruncated = await read('truncado.jpg')
