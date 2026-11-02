// Spec 011 (FR-005): el escritor de ZIP sin compresión. Se lee de vuelta con un lector mínimo escrito acá.
import { describe, expect, it } from 'vitest'
import { crc32, ZipBuilder } from '../../src/features/privacy/zip'

const bytes = (text: string) => new TextEncoder().encode(text)

async function readBack(blob: Blob) {
  const data = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(data.buffer)
  // Fin del directorio central.
  const end = data.length - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  const count = view.getUint16(end + 10, true)
  const centralSize = view.getUint32(end + 12, true)
  const centralStart = view.getUint32(end + 16, true)
  expect(centralStart + centralSize).toBe(end)

  const files: { name: string; content: Uint8Array; crc: number }[] = []
  let at = centralStart
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50)
    const crc = view.getUint32(at + 16, true)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const offset = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(data.subarray(at + 46, at + 46 + nameLength))
    // Encabezado local.
    expect(view.getUint32(offset, true)).toBe(0x04034b50)
    expect(view.getUint32(offset + 14, true)).toBe(crc)
    const localName = view.getUint16(offset + 26, true)
    const start = offset + 30 + localName
    files.push({ name, content: data.subarray(start, start + size), crc })
    at += 46 + nameLength
  }
  return files
}

describe('crc32', () => {
  it('coincide con el valor de referencia de "123456789"', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('ZipBuilder', () => {
  it('guarda cada archivo con su nombre, su contenido y su CRC', async () => {
    const zip = new ZipBuilder(new Date(2026, 10, 1, 12, 30, 10))
    zip.add('fotos-de-comidas/2026-11-01-almuerzo.jpg', new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]))
    zip.add('fotos-de-progreso/2026-11-01-frente.jpg', bytes('otra foto'))
    expect(zip.count).toBe(2)

    const blob = zip.finish()
    expect(blob.type).toBe('application/zip')
    const files = await readBack(blob)
    expect(files.map((f) => f.name)).toEqual([
      'fotos-de-comidas/2026-11-01-almuerzo.jpg',
      'fotos-de-progreso/2026-11-01-frente.jpg',
    ])
    expect([...files[0]!.content]).toEqual([0xff, 0xd8, 0xff, 1, 2, 3])
    expect(new TextDecoder().decode(files[1]!.content)).toBe('otra foto')
    for (const file of files) expect(crc32(file.content)).toBe(file.crc)
  })

  it('admite nombres con tildes y archivos vacíos', async () => {
    const zip = new ZipBuilder()
    zip.add('sección/ñandú.txt', new Uint8Array())
    const [file] = await readBack(zip.finish())
    expect(file!.name).toBe('sección/ñandú.txt')
    expect(file!.content.length).toBe(0)
  })

  it('un ZIP sin archivos sigue siendo válido', async () => {
    expect(await readBack(new ZipBuilder().finish())).toEqual([])
  })
})
