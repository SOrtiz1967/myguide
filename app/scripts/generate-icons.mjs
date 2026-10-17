// Genera los íconos PNG de la PWA sin dependencias nativas (solo zlib de Node).
// Uso: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const ACCENT = [0x0b, 0x6e, 0x99]
const WHITE = [0xff, 0xff, 0xff]

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

/** Ícono: fondo del color de acento y un anillo blanco con un punto central. `safe` reduce el dibujo para íconos "maskable". */
function icon(size, safe) {
  const scale = safe ? 0.55 : 0.8 // el área segura de un ícono maskable es el 80 % central
  const cx = size / 2
  const outer = (size / 2) * scale
  const inner = outer * 0.72
  const dot = outer * 0.34
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filtro "none"
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cx)
      const white = (d <= outer && d >= inner) || d <= dot
      const [r, g, b] = white ? WHITE : ACCENT
      const i = y * (size * 4 + 1) + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = 255
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 8 bits por canal
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
writeFileSync('public/pwa-192x192.png', icon(192, false))
writeFileSync('public/pwa-512x512.png', icon(512, false))
writeFileSync('public/pwa-maskable-512x512.png', icon(512, true))
writeFileSync('public/apple-touch-icon.png', icon(180, false))
console.log('Íconos generados en public/')
