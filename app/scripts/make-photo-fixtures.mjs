// T005 (spec 003): genera las fotos de prueba de la comida, sin datos personales.
//
//   node scripts/make-photo-fixtures.mjs
//
// Dibuja una imagen sintética con Chromium (el de Playwright) y le inyecta a mano los metadatos que
// un teléfono real deja: EXIF con coordenadas GPS, XMP, IPTC y un comentario. Las coordenadas, el nombre
// del fabricante y el resto de los valores son inventados (el obelisco de Buenos Aires redondeado y
// textos "de prueba"); ninguna foto real participa.
//
// Escribe en `supabase/functions/meal-photo/fixtures/` (pruebas Deno) y en `app/tests/fixtures/`
// (pruebas de la aplicación y de extremo a extremo):
//   con-gps.jpg        JPEG con EXIF (fabricante, GPS) y un comentario COM
//   con-xmp-iptc.jpg   JPEG con XMP (APP1) e IPTC (APP13)
//   sin-metadatos.jpg  el mismo dibujo sin nada de lo anterior
//   imagen.png         PNG
//   no-es-imagen.txt   texto que no es una imagen
//   truncado.jpg       JPEG cortado antes de su final
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const targets = [
  join(here, '..', '..', 'supabase', 'functions', 'meal-photo', 'fixtures'),
  join(here, '..', 'tests', 'fixtures'),
]

/** Marcas que las pruebas buscan para comprobar que NO sobreviven a la limpieza. */
export const MARKS = {
  make: 'MarcaDePruebaCamara',
  comment: 'comentario-privado-de-prueba',
  xmp: 'xmp-privado-de-prueba',
  iptc: 'iptc-privado-de-prueba',
}

async function draw(width, height) {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const result = await page.evaluate(
      ({ width, height }) => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        const gradient = ctx.createLinearGradient(0, 0, width, height)
        gradient.addColorStop(0, '#e8d9b5')
        gradient.addColorStop(1, '#6b8f71')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = `hsl(${(i * 37) % 360} 60% ${30 + (i % 40)}%)`
          ctx.beginPath()
          ctx.arc((i * 97) % width, (i * 61) % height, 8 + (i % 25), 0, Math.PI * 2)
          ctx.fill()
        }
        const toBase64 = (type, quality) => canvas.toDataURL(type, quality).split(',')[1]
        return { jpeg: toBase64('image/jpeg', 0.9), png: toBase64('image/png') }
      },
      { width, height },
    )
    return {
      jpeg: Buffer.from(result.jpeg, 'base64'),
      png: Buffer.from(result.png, 'base64'),
    }
  } finally {
    await browser.close()
  }
}

const u16 = (n) => Buffer.from([(n >> 8) & 0xff, n & 0xff])
const le16 = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff])
const le32 = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff])

function segment(marker, payload) {
  return Buffer.concat([Buffer.from([0xff, marker]), u16(payload.length + 2), payload])
}

/** EXIF mínimo y válido (little endian): Make y un puntero al IFD de GPS con latitud y longitud. */
function exifSegment() {
  const make = Buffer.from(`${MARKS.make}\0`, 'latin1')
  const rational = (n, d) => Buffer.concat([le32(n), le32(d)])
  // Desplazamientos dentro del bloque TIFF
  const ifd0Offset = 8
  const ifd0Size = 2 + 2 * 12 + 4
  const makeOffset = ifd0Offset + ifd0Size
  const gpsOffset = makeOffset + make.length
  const gpsEntries = 4
  const gpsSize = 2 + gpsEntries * 12 + 4
  const latOffset = gpsOffset + gpsSize
  const lonOffset = latOffset + 24

  const entry = (tag, type, count, value) =>
    Buffer.concat([le16(tag), le16(type), le32(count), value])
  const ifd0 = Buffer.concat([
    le16(2),
    entry(0x010f, 2, make.length, le32(makeOffset)), // Make
    entry(0x8825, 4, 1, le32(gpsOffset)), // GPSInfo
    le32(0),
  ])
  const gps = Buffer.concat([
    le16(gpsEntries),
    entry(0x0001, 2, 2, Buffer.from('S\0\0\0', 'latin1')), // GPSLatitudeRef
    entry(0x0002, 5, 3, le32(latOffset)), // GPSLatitude
    entry(0x0003, 2, 2, Buffer.from('W\0\0\0', 'latin1')), // GPSLongitudeRef
    entry(0x0004, 5, 3, le32(lonOffset)), // GPSLongitude
    le32(0),
  ])
  const lat = Buffer.concat([rational(34, 1), rational(36, 1), rational(0, 1)])
  const lon = Buffer.concat([rational(58, 1), rational(23, 1), rational(0, 1)])
  const tiff = Buffer.concat([
    Buffer.from('II*\0', 'latin1'),
    le32(ifd0Offset),
    ifd0,
    make,
    gps,
    lat,
    lon,
  ])
  return segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]))
}

function xmpSegment() {
  const xml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description>${MARKS.xmp}</rdf:Description></rdf:RDF></x:xmpmeta>`
  return segment(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0${xml}`, 'latin1'))
}

function iptcSegment() {
  const text = Buffer.from(MARKS.iptc, 'latin1')
  // Registro IPTC 2:120 (descripción) dentro de un recurso 8BIM 0x0404
  const record = Buffer.concat([Buffer.from([0x1c, 0x02, 0x78]), u16(text.length), text])
  const padded = record.length % 2 ? Buffer.concat([record, Buffer.from([0])]) : record
  const resource = Buffer.concat([
    Buffer.from('8BIM', 'latin1'),
    u16(0x0404),
    Buffer.from([0, 0]),
    Buffer.from([0, 0, (record.length >> 8) & 0xff, record.length & 0xff]),
    padded,
  ])
  return segment(0xed, Buffer.concat([Buffer.from('Photoshop 3.0\0', 'latin1'), resource]))
}

function commentSegment() {
  return segment(0xfe, Buffer.from(MARKS.comment, 'latin1'))
}

/** Inserta segmentos justo después de SOI (y del APP0/JFIF si lo hay). */
function inject(jpeg, segments) {
  let at = 2
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at = 4 + ((jpeg[4] << 8) | jpeg[5])
  return Buffer.concat([jpeg.subarray(0, at), ...segments, jpeg.subarray(at)])
}

const { jpeg, png } = await draw(800, 600)
const files = {
  'con-gps.jpg': inject(jpeg, [exifSegment(), commentSegment()]),
  'con-xmp-iptc.jpg': inject(jpeg, [xmpSegment(), iptcSegment()]),
  'sin-metadatos.jpg': jpeg,
  'imagen.png': png,
  'no-es-imagen.txt': Buffer.from('Esto no es una imagen.\n', 'utf8'),
  'truncado.jpg': jpeg.subarray(0, Math.floor(jpeg.length / 2)),
}

for (const dir of targets) {
  mkdirSync(dir, { recursive: true })
  for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, name), data)
}
console.log(
  `Fixtures escritos en ${targets.length} carpetas (${Object.keys(files).length} archivos).`,
)
