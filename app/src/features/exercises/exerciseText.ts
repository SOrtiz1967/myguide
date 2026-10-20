// Textos puros del catálogo de ejercicios (spec 005): sin acceso a datos ni a la pantalla.
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import {
  equipmentLabel,
  isEquipment,
  isMuscle,
  muscleLabel,
  type Equipment,
  type MeasurementType,
} from './exerciseLists'

const MISSING = es.exercises.missing

/** Cómo se registra el ejercicio, dicho con palabras (FR-015). */
export const measurementExplanation = (type: MeasurementType): string =>
  es.exercises.measurement[type]

/** Los músculos en español; una lista vacía es «sin dato», nunca un texto vacío (FR-007). */
export function formatMuscles(muscles: readonly string[]): string {
  const labels = muscles.filter(isMuscle).map(muscleLabel)
  return labels.length === 0 ? MISSING : labels.join(', ')
}

/** El equipamiento ausente es «sin dato»; «Peso corporal» es un valor informado, distinto de no saber. */
export function formatEquipment(equipment: Equipment | string | null): string {
  return equipment !== null && isEquipment(equipment) ? equipmentLabel(equipment) : MISSING
}

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Otros nombres del ejercicio (original y alias), sin repetidos y sin el nombre que ya se muestra. */
export function alsoKnownAs(exercise: {
  name: string
  original_name: string | null
  aliases: readonly string[]
}): string[] {
  const seen = new Set([normalize(exercise.name)])
  const names: string[] = []
  for (const candidate of [exercise.original_name, ...exercise.aliases]) {
    if (!candidate) continue
    const key = normalize(candidate)
    if (key === '' || seen.has(key)) continue
    seen.add(key)
    names.push(candidate)
  }
  return names
}

export type DescriptionView =
  { kind: 'none' } | { kind: 'steps'; steps: string[] } | { kind: 'text'; text: string }

const STEP = /^(\d+)\.\s+(.*)$/

/**
 * La descripción se muestra como lista numerada si todas sus líneas no vacías empiezan con «N. »;
 * si no, como texto libre con sus saltos de línea (un ejercicio propio puede tener cualquiera de los dos).
 * Los pasos salen sin su número: la lista numerada lo pone, y así no se numera dos veces.
 */
export function descriptionView(description: string | null): DescriptionView {
  if (description === null || description.trim() === '') return { kind: 'none' }
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const steps = lines.map((line) => STEP.exec(line)?.[2])
  if (steps.every((step): step is string => step !== undefined && step !== '')) {
    return { kind: 'steps', steps }
  }
  return { kind: 'text', text: description }
}

export interface ProvenanceInput {
  origin: 'imported' | 'own'
  source_name: string | null
  source_item_id: string | null
  imported_at: string | null
  based_on: { id: string; name: string } | null
}

/** La procedencia en una línea (FR-017). La fecha se toma del texto, para no correr el día por la zona. */
export function provenanceLine(p: ProvenanceInput): string {
  const text = es.exercises.provenance
  if (p.origin === 'imported') {
    return text.catalog(
      p.source_name ?? '',
      p.source_item_id ?? '',
      p.imported_at ? formatDate(p.imported_at.slice(0, 10)) : '',
    )
  }
  return p.based_on ? `${text.ownBasedOnPrefix} ${p.based_on.name}` : text.own
}

/** «traducción sin revisar» solo para lo traducido sin revisar (FR-020). */
export function translationLabel(status: string | null): string | null {
  return status === 'machine_translated' ? es.exercises.textStatus.machine_translated : null
}
