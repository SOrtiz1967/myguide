// T008 (spec 006, FR-008, FR-029, FR-030): textos y formatos de entrenamiento (funciones puras).
import { describe, expect, it } from 'vitest'
import {
  effortLabel,
  formatDistance,
  formatDuration,
  formatReps,
  formatValue,
  formatWeight,
  markLabels,
  parseDecimal,
  parseDuration,
  setFields,
  setsCountLabel,
  statusLabel,
  summarizeSet,
} from '../../src/features/training/trainingText'
import {
  MAX_DISTANCE_KM,
  MAX_DURATION_S,
  MAX_EXERCISES,
  MAX_REPS,
  MAX_SETS,
  MAX_WEIGHT_KG,
} from '../../src/features/training/limits'

describe('estados y marcas (FR-008)', () => {
  it('los cuatro estados tienen su etiqueta', () => {
    expect(statusLabel('planned')).toBe('Planificada')
    expect(statusLabel('in_progress')).toBe('En curso')
    expect(statusLabel('completed')).toBe('Realizada')
    expect(statusLabel('cancelled')).toBe('Cancelada')
  })

  it('las marcas salen en orden fijo y solo las que corresponden', () => {
    expect(markLabels({ rescheduled_count: 0, modified: false, corrected_at: null })).toEqual([])
    expect(markLabels({ rescheduled_count: 2, modified: false, corrected_at: null })).toEqual([
      'Reprogramada',
    ])
    expect(
      markLabels({ rescheduled_count: 1, modified: true, corrected_at: '2026-10-22T10:00:00Z' }),
    ).toEqual(['Reprogramada', 'Modificada', 'Corregida'])
  })
})

describe('campos según el tipo de medición (FR-028)', () => {
  it('cada tipo pide solo lo suyo', () => {
    expect(setFields('reps_weight')).toEqual(['reps', 'weight_kg'])
    expect(setFields('reps_bodyweight')).toEqual(['reps'])
    expect(setFields('duration')).toEqual(['duration_s'])
    expect(setFields('distance_duration')).toEqual(['distance_km', 'duration_s'])
  })
})

describe('formatos con unidad y coma decimal (FR-029)', () => {
  it('peso', () => {
    expect(formatWeight(60)).toBe('60 kg')
    expect(formatWeight(62.5)).toBe('62,5 kg')
    expect(formatWeight(0)).toBe('0 kg')
  })

  it('repeticiones', () => {
    expect(formatReps(1)).toBe('1 repetición')
    expect(formatReps(8)).toBe('8 repeticiones')
  })

  it('duración: minutos y segundos, y horas cuando hace falta', () => {
    expect(formatDuration(45)).toBe('0:45 min')
    expect(formatDuration(90)).toBe('1:30 min')
    expect(formatDuration(1800)).toBe('30:00 min')
    expect(formatDuration(3930)).toBe('1:05:30 h')
    expect(formatDuration(86400)).toBe('24:00:00 h')
  })

  it('distancia', () => {
    expect(formatDistance(5.25)).toBe('5,25 km')
    expect(formatDistance(10)).toBe('10 km')
  })

  it('un valor ausente es «sin dato», nunca 0 (FR-030)', () => {
    expect(formatValue('weight_kg', null)).toBe('sin dato')
    expect(formatValue('reps', undefined)).toBe('sin dato')
    expect(formatValue('weight_kg', 0)).toBe('0 kg')
    expect(formatValue('duration_s', 90)).toBe('1:30 min')
    expect(formatValue('distance_km', 5.25)).toBe('5,25 km')
  })
})

describe('resumen de una serie', () => {
  it('repeticiones y peso', () => {
    expect(summarizeSet('reps_weight', { reps: 8, weight_kg: 60 })).toBe('8 repeticiones · 60 kg')
  })

  it('un dato que falta se dice, con su nombre', () => {
    expect(summarizeSet('reps_weight', { reps: 8, weight_kg: null })).toBe(
      '8 repeticiones · peso: sin dato',
    )
    expect(summarizeSet('reps_weight', { reps: null, weight_kg: 60 })).toBe(
      'repeticiones: sin dato · 60 kg',
    )
  })

  it('un peso de 0 se muestra como 0 kg', () => {
    expect(summarizeSet('reps_weight', { reps: 5, weight_kg: 0 })).toBe('5 repeticiones · 0 kg')
  })

  it('el resto de los tipos', () => {
    expect(summarizeSet('reps_bodyweight', { reps: 12 })).toBe('12 repeticiones')
    expect(summarizeSet('duration', { duration_s: 90 })).toBe('1:30 min')
    expect(summarizeSet('distance_duration', { distance_km: 5.25, duration_s: 1800 })).toBe(
      '5,25 km · 30:00 min',
    )
    expect(summarizeSet('distance_duration', { distance_km: 5, duration_s: null })).toBe(
      '5 km · tiempo: sin dato',
    )
  })

  it('cantidad de series', () => {
    expect(setsCountLabel(0)).toBe('Sin series')
    expect(setsCountLabel(1)).toBe('1 serie')
    expect(setsCountLabel(3)).toBe('3 series')
  })
})

describe('esfuerzo percibido', () => {
  it('de 1 a 10, o «sin dato»', () => {
    expect(effortLabel(7)).toBe('7 de 10')
    expect(effortLabel(null)).toBe('sin dato')
    expect(effortLabel(undefined)).toBe('sin dato')
  })
})

describe('lectura de lo que escribe la persona (FR-029)', () => {
  it('decimales con coma o con punto', () => {
    expect(parseDecimal('62,5')).toBe(62.5)
    expect(parseDecimal('62.5')).toBe(62.5)
    expect(parseDecimal(' 60 ')).toBe(60)
    expect(parseDecimal('0')).toBe(0)
  })

  it('vacío es «sin dato» y lo que no es un número es inválido', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('   ')).toBeNull()
    expect(Number.isNaN(parseDecimal('abc'))).toBe(true)
    expect(Number.isNaN(parseDecimal('1,2,3'))).toBe(true)
  })

  it('duraciones: segundos, mm:ss y h:mm:ss', () => {
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('1:30')).toBe(90)
    expect(parseDuration('30:00')).toBe(1800)
    expect(parseDuration('1:05:30')).toBe(3930)
    expect(parseDuration('')).toBeNull()
  })

  it('una duración mal escrita es inválida', () => {
    expect(Number.isNaN(parseDuration('1:75'))).toBe(true)
    expect(Number.isNaN(parseDuration('abc'))).toBe(true)
    expect(Number.isNaN(parseDuration('1:2:3:4'))).toBe(true)
    expect(Number.isNaN(parseDuration('-5'))).toBe(true)
  })
})

describe('límites compartidos con la base (FR-001, FR-028, FR-031)', () => {
  it('son los de la spec', () => {
    expect(MAX_EXERCISES).toBe(30)
    expect(MAX_SETS).toBe(20)
    expect(MAX_REPS).toBe(999)
    expect(MAX_WEIGHT_KG).toBe(999.9)
    expect(MAX_DURATION_S).toBe(86400)
    expect(MAX_DISTANCE_KM).toBe(999.9)
  })
})
