import { es } from '../../copy/es'

/** Lo que devuelve `export_my_data()` (contrato privacy.md). */
export interface ExportData {
  format_version: number
  exported_at: string
  account: { email: string | null }
  tables: Record<string, Record<string, unknown>[]>
}

export interface PhotoFile {
  bucket: 'meal-photos' | 'progress-photos'
  path: string
  /** Nombre dentro del ZIP. */
  name: string
}

const POSES: Record<string, string> = {
  front: 'frente',
  side: 'perfil',
  back: 'espalda',
  other: 'otra',
}

const MEAL_NAMES: Record<string, string> = {
  breakfast: 'desayuno',
  lunch: 'almuerzo',
  snack: 'merienda',
  dinner: 'cena',
  extra: 'colacion',
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Nombre del archivo JSON, con el día de la exportación. */
export function dataFileName(exportedAt: string): string {
  return `myguide-datos-${exportedAt.slice(0, 10)}.json`
}

export function photosFileName(exportedAt: string): string {
  return `myguide-fotos-${exportedAt.slice(0, 10)}.zip`
}

export function dataBlob(data: ExportData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

/** Las fotos de comidas y de progreso de la exportación, con un nombre único y legible dentro del ZIP. */
export function photoFiles(data: ExportData): PhotoFile[] {
  const files: PhotoFile[] = []
  const used = new Set<string>()
  const unique = (base: string): string => {
    let candidate = `${base}.jpg`
    for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}.jpg`
    used.add(candidate)
    return candidate
  }

  for (const row of data.tables['meal_photos'] ?? []) {
    const path = text(row['storage_path'])
    if (!path) continue
    const meal = MEAL_NAMES[text(row['meal'])] ?? 'comida'
    files.push({
      bucket: 'meal-photos',
      path,
      name: unique(`fotos-de-comidas/${text(row['log_date'])}-${meal}`),
    })
  }
  for (const row of data.tables['progress_photos'] ?? []) {
    const path = text(row['storage_path'])
    if (!path) continue
    const pose = POSES[text(row['pose'])] ?? 'sin-pose'
    files.push({
      bucket: 'progress-photos',
      path,
      name: unique(`fotos-de-progreso/${text(row['taken_on'])}-${pose}`),
    })
  }
  return files
}

/** Texto del aviso final de una descarga de fotos. */
export function photosResultMessage(done: number, missing: number): string {
  return missing === 0
    ? es.privacy.export.photosReady(done)
    : es.privacy.export.photosPartial(done, missing)
}
