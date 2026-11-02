// Escritor de ZIP sin compresión (método "store"). Las fotos ya están comprimidas (JPEG), así que no hace falta
// una librería: alcanza con encabezados, CRC-32 y el directorio central. Nombres en UTF-8.

const encoder = new TextEncoder()

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Fecha y hora en el formato de DOS que usa el ZIP. */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(date.getFullYear(), 1980)
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

interface Entry {
  name: Uint8Array
  crc: number
  size: number
  offset: number
}

/** Arma un ZIP archivo por archivo; `finish` entrega el Blob. */
export class ZipBuilder {
  private readonly parts: BlobPart[] = []
  private readonly entries: Entry[] = []
  private offset = 0
  private readonly stamp: { time: number; day: number }

  constructor(now: Date = new Date()) {
    this.stamp = dosDateTime(now)
  }

  get count(): number {
    return this.entries.length
  }

  add(name: string, data: Uint8Array): void {
    const nameBytes = encoder.encode(name)
    const entry: Entry = {
      name: nameBytes,
      crc: crc32(data),
      size: data.length,
      offset: this.offset,
    }
    const header = new DataView(new ArrayBuffer(30))
    header.setUint32(0, 0x04034b50, true)
    header.setUint16(4, 20, true) // versión necesaria
    header.setUint16(6, 0x0800, true) // nombres en UTF-8
    header.setUint16(8, 0, true) // sin compresión
    header.setUint16(10, this.stamp.time, true)
    header.setUint16(12, this.stamp.day, true)
    header.setUint32(14, entry.crc, true)
    header.setUint32(18, entry.size, true)
    header.setUint32(22, entry.size, true)
    header.setUint16(26, nameBytes.length, true)
    header.setUint16(28, 0, true)
    this.parts.push(header.buffer, nameBytes as BlobPart, data as BlobPart)
    this.offset += 30 + nameBytes.length + data.length
    this.entries.push(entry)
  }

  finish(): Blob {
    const start = this.offset
    let size = 0
    for (const entry of this.entries) {
      const central = new DataView(new ArrayBuffer(46))
      central.setUint32(0, 0x02014b50, true)
      central.setUint16(4, 20, true) // versión con la que se creó
      central.setUint16(6, 20, true) // versión necesaria
      central.setUint16(8, 0x0800, true)
      central.setUint16(10, 0, true)
      central.setUint16(12, this.stamp.time, true)
      central.setUint16(14, this.stamp.day, true)
      central.setUint32(16, entry.crc, true)
      central.setUint32(20, entry.size, true)
      central.setUint32(24, entry.size, true)
      central.setUint16(28, entry.name.length, true)
      central.setUint32(42, entry.offset, true)
      this.parts.push(central.buffer, entry.name as BlobPart)
      size += 46 + entry.name.length
    }
    const end = new DataView(new ArrayBuffer(22))
    end.setUint32(0, 0x06054b50, true)
    end.setUint16(8, this.entries.length, true)
    end.setUint16(10, this.entries.length, true)
    end.setUint32(12, size, true)
    end.setUint32(16, start, true)
    this.parts.push(end.buffer)
    return new Blob(this.parts, { type: 'application/zip' })
  }
}
