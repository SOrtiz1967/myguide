import { es } from '../../copy/es'

// Sueño, pasos y actividad (spec 007). El sueño y la actividad se guardan en minutos; los pasos, como cantidad.

export const ACTIVITY_KINDS = ['sleep', 'steps', 'active_minutes'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export const isActivityKind = (value: string): value is ActivityKind =>
  (ACTIVITY_KINDS as readonly string[]).includes(value)

const a = es.activity

export const kindLabel = (kind: ActivityKind): string => a.kinds[kind]

const RANGE: Record<ActivityKind, { min: number; max: number }> = {
  sleep: { min: 1, max: 1440 },
  steps: { min: 0, max: 200000 },
  active_minutes: { min: 0, max: 1440 },
}
export const rangeOf = (kind: ActivityKind) => RANGE[kind]

const count = new Intl.NumberFormat('es-AR')

/** 450 → '7 h 30 min'; 8500 → '8.500 pasos'; 40 → '40 min'. */
export function formatActivity(kind: ActivityKind, value: number): string {
  if (kind === 'steps') return a.stepsValue(count.format(value))
  if (kind === 'active_minutes') return a.minutesValue(value)
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return a.sleepValue(hours, minutes)
}

/** El valor como lo escribiría la persona: el sueño como `h:mm`, lo demás como número. */
export function valueInput(kind: ActivityKind, value: number): string {
  if (kind !== 'sleep') return String(value)
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

/** Pista del formato esperado para cada tipo. */
export const hintOf = (kind: ActivityKind): string => a.form.hint[kind]

/**
 * Lee el valor escrito. Devuelve el entero (minutos o pasos), o un texto con el motivo del rechazo.
 * Sueño: `h:mm` o horas decimales (`7,5`). Pasos: entero, con puntos de miles opcionales. Actividad: minutos enteros.
 */
export function parseActivity(kind: ActivityKind, text: string): number | string {
  const clean = text.trim()
  if (clean === '') return a.validation.required
  let value: number
  if (kind === 'sleep') {
    const clock = /^(\d{1,2}):([0-5]\d)$/.exec(clean)
    const decimal = /^\d{1,2}([.,]\d{1,2})?$/.exec(clean)
    if (clock) value = Number(clock[1]) * 60 + Number(clock[2])
    else if (decimal) value = Math.round(Number(clean.replace(',', '.')) * 60)
    else return a.validation.formatSleep
  } else if (kind === 'steps') {
    if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(clean)) return a.validation.formatNumber
    value = Number(clean.replaceAll('.', ''))
  } else {
    if (!/^\d+$/.test(clean)) return a.validation.formatNumber
    value = Number(clean)
  }
  const { min, max } = RANGE[kind]
  if (value < min || value > max) return a.validation.range(kindLabel(kind), kind)
  return value
}
