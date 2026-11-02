// Spec 010 (FR-011 a FR-016): estimación de las calorías de mantenimiento a partir del peso y de lo registrado.
//
// Es una estimación de lo que la persona registró, no su gasto real. Compara el promedio de calorías de una ventana de
// 21 días con el cambio del peso entre su primera y su última semana, usando la convención de 7.700 kcal por kilo.
// Con pocos datos no hay cifra: se dice qué falta (Principio V). Nunca se completan ni se interpolan días o pesajes.
import { addDaysTo, daysBetween } from '../measures/weightSeries'
import type { DayNutrition, WeightPoint } from './nutrition'

/** Días terminados que mira la estimación (hoy no entra: su registro está incompleto). */
export const WINDOW_DAYS = 21
/** Días de cada extremo de la ventana donde tiene que haber al menos un pesaje. */
export const EDGE_DAYS = 7
export const MIN_CALORIE_DAYS = 14
export const MIN_WEIGHINS = 4
/** Convención declarada: kcal por kilo de cambio de peso (regla de Wishnofsky). */
export const KCAL_PER_KG = 7700
/** Variación de un pesaje (agua, sal, comida) que se toma para el ancho del rango; es una convención, no una medición. */
export const WEIGH_SIGMA_KG = 0.5

export interface MaintenanceWindow {
  from: string
  to: string
}

/** Los 21 días terminados antes de `today`. */
export function maintenanceWindow(today: string): MaintenanceWindow {
  return { from: addDaysTo(today, -WINDOW_DAYS), to: addDaysTo(today, -1) }
}

/** Qué falta para poder estimar. */
export interface MaintenanceMissing {
  /** Días con calorías que faltan para llegar al mínimo (0 si ya alcanza). */
  calorieDays: number
  /** Pesajes que faltan para llegar al mínimo (0 si ya alcanza). */
  weighIns: number
  /** No hay ningún pesaje en los primeros 7 días de la ventana. */
  startEdge: boolean
  /** No hay ningún pesaje en los últimos 7 días de la ventana. */
  endEdge: boolean
}

export interface MaintenanceEstimate {
  window: MaintenanceWindow
  calorieDays: number
  weighIns: number
  /** Promedio de calorías por día de los días con calorías. */
  averageKcal: number
  startWeight: number
  endWeight: number
  /** Días entre la fecha media de los pesajes del inicio y la de los del final. */
  elapsedDays: number
  /** La estimación central, sin redondear, y el rango redondeado a la decena de kcal. */
  estimate: number
  low: number
  high: number
}

export type MaintenanceResult =
  | { ready: true; estimate: MaintenanceEstimate }
  | {
      ready: false
      window: MaintenanceWindow
      calorieDays: number
      weighIns: number
      missing: MaintenanceMissing
    }

const roundToTen = (value: number) => Math.round(value / 10) * 10
const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length

export function estimateMaintenance(
  days: readonly DayNutrition[],
  weights: readonly WeightPoint[],
  today: string,
): MaintenanceResult {
  const window = maintenanceWindow(today)
  const inWindow = (date: string) => date >= window.from && date <= window.to
  const startEnd = addDaysTo(window.from, EDGE_DAYS - 1)
  const endStart = addDaysTo(window.to, -(EDGE_DAYS - 1))

  const calorieDays = days.filter(
    (day) => inWindow(day.log_date) && day.energy_count > 0 && day.energy_kcal !== null,
  )
  const weighIns = weights.filter((point) => inWindow(point.date))
  const start = weighIns.filter((point) => point.date <= startEnd)
  const end = weighIns.filter((point) => point.date >= endStart)

  const missing: MaintenanceMissing = {
    calorieDays: Math.max(0, MIN_CALORIE_DAYS - calorieDays.length),
    weighIns: Math.max(0, MIN_WEIGHINS - weighIns.length),
    startEdge: start.length === 0,
    endEdge: end.length === 0,
  }
  if (missing.calorieDays > 0 || missing.weighIns > 0 || missing.startEdge || missing.endEdge) {
    return {
      ready: false,
      window,
      calorieDays: calorieDays.length,
      weighIns: weighIns.length,
      missing,
    }
  }

  const averageKcal = mean(calorieDays.map((day) => day.energy_kcal as number))
  const startWeight = mean(start.map((point) => point.value))
  const endWeight = mean(end.map((point) => point.value))
  const offset = (point: WeightPoint) => daysBetween(window.from, point.date)
  const elapsedDays = mean(end.map(offset)) - mean(start.map(offset))

  const perKg = KCAL_PER_KG / elapsedDays
  const estimate = averageKcal - (endWeight - startWeight) * perKg
  const spread =
    Math.sqrt(WEIGH_SIGMA_KG ** 2 / start.length + WEIGH_SIGMA_KG ** 2 / end.length) * perKg

  return {
    ready: true,
    estimate: {
      window,
      calorieDays: calorieDays.length,
      weighIns: weighIns.length,
      averageKcal,
      startWeight,
      endWeight,
      elapsedDays,
      estimate,
      low: roundToTen(estimate - spread),
      high: roundToTen(estimate + spread),
    },
  }
}
