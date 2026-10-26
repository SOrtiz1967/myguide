import { es } from '../../copy/es'

// Peso y medidas (spec 008). Un valor por medida y por día; kilogramos para el peso y centímetros para el resto.

export const MEASURE_KINDS = ['weight', 'waist', 'hips', 'chest', 'arm', 'thigh'] as const
export type MeasureKind = (typeof MEASURE_KINDS)[number]

export const isMeasureKind = (value: string): value is MeasureKind =>
  (MEASURE_KINDS as readonly string[]).includes(value)

const m = es.measures

export const kindLabel = (kind: MeasureKind): string => m.kinds[kind]
export const unitOf = (kind: MeasureKind): string => (kind === 'weight' ? 'kg' : 'cm')
export const rangeOf = (kind: MeasureKind): { min: number; max: number } =>
  kind === 'weight' ? { min: 20, max: 500 } : { min: 10, max: 300 }

const number = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** 72.4 → '72,4 kg'. */
export const formatMeasure = (kind: MeasureKind, value: number): string =>
  `${number.format(value)} ${unitOf(kind)}`

/** 72.4 → '72,4': como lo escribiría la persona. */
export const valueInput = (value: number): string => String(value).replace('.', ',')

/**
 * Lee el valor escrito (coma o punto, un decimal como máximo). Devuelve el número, o un texto con el motivo del rechazo.
 */
export function parseMeasure(kind: MeasureKind, text: string): number | string {
  const clean = text.trim()
  if (clean === '') return m.validation.required
  if (!/^\d+([.,]\d)?$/.test(clean)) return m.validation.format
  const value = Number(clean.replace(',', '.'))
  const { min, max } = rangeOf(kind)
  if (value < min || value > max) return m.validation.range(kindLabel(kind), min, max, unitOf(kind))
  return value
}
