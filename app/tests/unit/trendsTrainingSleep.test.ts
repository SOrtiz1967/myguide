// Spec 010: series por grupo muscular y sueño por semana.
import { describe, expect, it } from 'vitest'
import { buildSleepWeeks } from '../../src/features/trends/sleep'
import {
  ALL_GROUPS,
  availableGroups,
  buildTrainingWeeks,
  type TrainingWeekRow,
} from '../../src/features/trends/training'
import { periodWeeks } from '../../src/features/trends/weeks'

const weeks = periodWeeks('4w', '2026-10-14') // lunes 09-21, 09-28, 10-05, 10-12 (en curso)

const rows: TrainingWeekRow[] = [
  { week_start: '2026-09-28', total_sets: 5, by_muscle: { chest: 3, triceps: 3, lats: 2 } },
  { week_start: '2026-10-05', total_sets: 4, by_muscle: { chest: 2, sin_grupo: 2 } },
]

describe('series por grupo muscular', () => {
  it('cuenta las series de un grupo por semana, con cero en las semanas sin series', () => {
    expect(buildTrainingWeeks(rows, weeks, 'chest').map((w) => w.sets)).toEqual([0, 3, 2, 0])
  })

  it('«todos los grupos» cuenta cada serie una vez, no la suma de los grupos', () => {
    expect(buildTrainingWeeks(rows, weeks, ALL_GROUPS).map((w) => w.sets)).toEqual([0, 5, 4, 0])
  })

  it('un grupo que no se entrenó una semana tiene cero series', () => {
    expect(buildTrainingWeeks(rows, weeks, 'lats').map((w) => w.sets)).toEqual([0, 2, 0, 0])
  })

  it('lista los grupos con series, de más a menos', () => {
    expect(availableGroups(rows, weeks)).toEqual([
      { group: 'chest', sets: 5 },
      { group: 'triceps', sets: 3 },
      { group: 'lats', sets: 2 },
      { group: 'sin_grupo', sets: 2 },
    ])
  })

  it('no lista grupos de semanas fuera del período', () => {
    const outside: TrainingWeekRow[] = [
      { week_start: '2026-08-03', total_sets: 9, by_muscle: { calves: 9 } },
    ]
    expect(availableGroups(outside, weeks)).toEqual([])
  })
})

describe('sueño por semana', () => {
  const records = [
    { activity_date: '2026-10-05', value: 420 },
    { activity_date: '2026-10-07', value: 480 },
    { activity_date: '2026-10-11', value: 450 },
    { activity_date: '2026-09-30', value: 360 },
  ]

  it('promedia los minutos de las noches con dato y dice cuántas son', () => {
    const result = buildSleepWeeks(records, weeks)
    expect(result[2]).toMatchObject({ nights: 3, averageMinutes: 450 })
    expect(result[1]).toMatchObject({ nights: 1, averageMinutes: 360 })
  })

  it('una semana sin noches registradas es sin dato y no cero horas', () => {
    const result = buildSleepWeeks(records, weeks)
    expect(result[0]).toMatchObject({ nights: 0, averageMinutes: null })
    expect(result[3]).toMatchObject({ nights: 0, averageMinutes: null })
  })
})
