// Spec 011 (FR-002, FR-005): nombres y armado de las descargas.
import { describe, expect, it } from 'vitest'
import {
  dataBlob,
  dataFileName,
  photoFiles,
  photosFileName,
  type ExportData,
} from '../../src/features/privacy/exportData'

const data: ExportData = {
  format_version: 1,
  exported_at: '2026-11-01T12:00:00Z',
  account: { email: 'a@ejemplo.com' },
  tables: {
    supplements: [{ name: 'Creatina', dose: null }],
    meal_photos: [
      { log_date: '2026-11-01', meal: 'lunch', storage_path: 'u/1.jpg' },
      { log_date: '2026-11-01', meal: 'lunch', storage_path: 'u/2.jpg' },
      { log_date: '2026-11-02', meal: 'raro', storage_path: 'u/3.jpg' },
      { log_date: '2026-11-02', meal: 'dinner', storage_path: '' },
    ],
    progress_photos: [
      { taken_on: '2026-10-30', pose: 'front', storage_path: 'u/4.jpg' },
      { taken_on: '2026-10-30', pose: null, storage_path: 'u/5.jpg' },
    ],
  },
}

describe('nombres de archivo', () => {
  it('llevan el día de la exportación', () => {
    expect(dataFileName(data.exported_at)).toBe('myguide-datos-2026-11-01.json')
    expect(photosFileName(data.exported_at)).toBe('myguide-fotos-2026-11-01.zip')
  })
})

describe('dataBlob', () => {
  it('es un JSON legible y conserva los nulos', async () => {
    const blob = dataBlob(data)
    expect(blob.type).toBe('application/json')
    const parsed = JSON.parse(await blob.text()) as ExportData
    expect(parsed.tables['supplements']).toEqual([{ name: 'Creatina', dose: null }])
    expect(parsed.format_version).toBe(1)
  })
})

describe('photoFiles', () => {
  it('lista las fotos de ambos depósitos con nombres únicos y legibles', () => {
    expect(photoFiles(data)).toEqual([
      { bucket: 'meal-photos', path: 'u/1.jpg', name: 'fotos-de-comidas/2026-11-01-almuerzo.jpg' },
      {
        bucket: 'meal-photos',
        path: 'u/2.jpg',
        name: 'fotos-de-comidas/2026-11-01-almuerzo-2.jpg',
      },
      { bucket: 'meal-photos', path: 'u/3.jpg', name: 'fotos-de-comidas/2026-11-02-comida.jpg' },
      {
        bucket: 'progress-photos',
        path: 'u/4.jpg',
        name: 'fotos-de-progreso/2026-10-30-frente.jpg',
      },
      {
        bucket: 'progress-photos',
        path: 'u/5.jpg',
        name: 'fotos-de-progreso/2026-10-30-sin-pose.jpg',
      },
    ])
  })

  it('sin fotos devuelve una lista vacía', () => {
    expect(photoFiles({ ...data, tables: {} })).toEqual([])
  })
})
