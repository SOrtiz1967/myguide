import { es } from '../../copy/es'
import type { MeasurementType } from '../exercises/exerciseLists'

// Textos y formatos de entrenamiento (spec 006, FR-008, FR-029, FR-030). Funciones puras: todo valor lleva su
// unidad, los decimales llevan coma y un valor ausente es «sin dato», nunca 0.

const t = es.training

export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type SetField = 'reps' | 'weight_kg' | 'duration_s' | 'distance_km'

export interface SetValues {
  reps?: number | null
  weight_kg?: number | null
  duration_s?: number | null
  distance_km?: number | null
}

export const statusLabel = (status: SessionStatus): string => t.status[status]

/** Las marcas que acompañan al estado de una sesión, en orden fijo y solo las que corresponden. */
export function markLabels(session: {
  rescheduled_count: number
  modified: boolean
  corrected_at: string | null
}): string[] {
  const marks: string[] = []
  if (session.rescheduled_count > 0) marks.push(t.marks.rescheduled)
  if (session.modified) marks.push(t.marks.modified)
  if (session.corrected_at) marks.push(t.marks.corrected)
  return marks
}

const SET_FIELDS: Record<MeasurementType, SetField[]> = {
  reps_weight: ['reps', 'weight_kg'],
  reps_bodyweight: ['reps'],
  duration: ['duration_s'],
  distance_duration: ['distance_km', 'duration_s'],
}

/** Los valores que admite una serie (y un objetivo) de cada tipo de medición. */
export const setFields = (type: MeasurementType): SetField[] => SET_FIELDS[type]

const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 })

export const formatWeight = (kg: number): string => `${decimal.format(kg)} kg`
export const formatDistance = (km: number): string => `${decimal.format(km)} km`
export const formatReps = (count: number): string =>
  count === 1 ? '1 repetición' : `${decimal.format(count)} repeticiones`

const pad = (n: number): string => String(n).padStart(2, '0')

/** 90 → '1:30 min'; 3930 → '1:05:30 h'. */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)} h`
  return `${minutes}:${pad(seconds)} min`
}

/** El valor con su unidad, o «sin dato» si falta (FR-030). */
export function formatValue(field: SetField, value: number | null | undefined): string {
  if (value === null || value === undefined) return t.noData
  switch (field) {
    case 'reps':
      return formatReps(value)
    case 'weight_kg':
      return formatWeight(value)
    case 'duration_s':
      return formatDuration(value)
    case 'distance_km':
      return formatDistance(value)
  }
}

/** '8 repeticiones · 60 kg'; un dato que falta se dice con su nombre: '8 repeticiones · peso: sin dato'. */
export function summarizeSet(type: MeasurementType, set: SetValues): string {
  return setFields(type)
    .map((field) => {
      const value = set[field]
      return value === null || value === undefined
        ? `${t.fieldMissing[field]}: ${t.noData}`
        : formatValue(field, value)
    })
    .join(' · ')
}

export function setsCountLabel(count: number): string {
  if (count <= 0) return t.noSets
  return count === 1 ? '1 serie' : `${count} series`
}

export function effortLabel(effort: number | null | undefined): string {
  return effort === null || effort === undefined ? t.noData : t.effort.value(effort)
}

/**
 * Lee un número escrito con coma o con punto decimal. Vacío → `null` (sin dato); lo que no es un número → `NaN`.
 */
export function parseDecimal(text: string): number | null {
  const clean = text.trim()
  if (clean === '') return null
  if (!/^\d+([.,]\d+)?$/.test(clean)) return Number.NaN
  return Number(clean.replace(',', '.'))
}

/**
 * Lee una duración escrita como segundos ('90'), 'mm:ss' ('1:30') o 'h:mm:ss' ('1:05:30'), y la devuelve en
 * segundos. Vacío → `null`; lo mal escrito → `NaN`.
 */
export function parseDuration(text: string): number | null {
  const clean = text.trim()
  if (clean === '') return null
  const parts = clean.split(':')
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return Number.NaN
  const numbers = parts.map(Number)
  if (numbers.length === 1) return numbers[0]!
  const seconds = numbers[numbers.length - 1]!
  const minutes = numbers[numbers.length - 2]!
  if (seconds >= 60) return Number.NaN
  if (numbers.length === 2) return minutes * 60 + seconds
  if (minutes >= 60) return Number.NaN
  return numbers[0]! * 3600 + minutes * 60 + seconds
}
