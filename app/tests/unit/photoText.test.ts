// Spec 019: orden, agrupación y días de diferencia de las fotos de progreso.
import { describe, expect, it } from 'vitest'
import type { ProgressPhoto } from '../../src/features/progress-photos/api'
import {
  daysBetween,
  groupByDate,
  orderForCompare,
  poseLabel,
  posesDiffer,
} from '../../src/features/progress-photos/photoText'

const photo = (over: Partial<ProgressPhoto>): ProgressPhoto => ({
  id: 'x',
  taken_on: '2026-10-01',
  pose: null,
  storage_path: 'u/x.jpg',
  width: 1,
  height: 1,
  bytes: 1,
  created_at: '2026-10-01T10:00:00Z',
  ...over,
})

describe('groupByDate', () => {
  it('agrupa las consecutivas de la misma fecha y conserva el orden', () => {
    const days = groupByDate([
      photo({ id: 'a', taken_on: '2026-10-29' }),
      photo({ id: 'b', taken_on: '2026-10-01' }),
      photo({ id: 'c', taken_on: '2026-10-01' }),
    ])
    expect(days.map((d) => [d.date, d.photos.map((p) => p.id)])).toEqual([
      ['2026-10-29', ['a']],
      ['2026-10-01', ['b', 'c']],
    ])
  })

  it('sin fotos no hay grupos', () => {
    expect(groupByDate([])).toEqual([])
  })
})

describe('daysBetween', () => {
  it('cuenta días de calendario sin importar el orden', () => {
    expect(daysBetween('2026-09-01', '2026-10-29')).toBe(58)
    expect(daysBetween('2026-10-29', '2026-09-01')).toBe(58)
  })

  it('el mismo día son cero', () => {
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(0)
  })

  it('no se descuadra con el cambio de hora', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-11-01')).toBe(8)
  })
})

describe('orderForCompare', () => {
  it('pone primero la más antigua', () => {
    const [first] = orderForCompare(
      photo({ id: 'nueva', taken_on: '2026-10-29' }),
      photo({ id: 'vieja', taken_on: '2026-09-01' }),
    )
    expect(first.id).toBe('vieja')
  })

  it('a igual fecha, primero la subida más antigua', () => {
    const [first] = orderForCompare(
      photo({ id: 'tarde', created_at: '2026-10-01T12:00:00Z' }),
      photo({ id: 'temprano', created_at: '2026-10-01T08:00:00Z' }),
    )
    expect(first.id).toBe('temprano')
  })
})

describe('posesDiffer', () => {
  it('iguales no difieren', () => {
    expect(posesDiffer(photo({ pose: 'front' }), photo({ pose: 'front' }))).toBe(false)
  })

  it('distintas o con alguna sin indicar sí', () => {
    expect(posesDiffer(photo({ pose: 'front' }), photo({ pose: 'side' }))).toBe(true)
    expect(posesDiffer(photo({ pose: null }), photo({ pose: 'side' }))).toBe(true)
    expect(posesDiffer(photo({ pose: null }), photo({ pose: null }))).toBe(true)
  })
})

describe('poseLabel', () => {
  it('traduce las poses y «Sin indicar»', () => {
    expect(poseLabel('front')).toBe('Frente')
    expect(poseLabel('side')).toBe('Perfil')
    expect(poseLabel('back')).toBe('Espalda')
    expect(poseLabel('other')).toBe('Otra')
    expect(poseLabel(null)).toBe('Sin indicar')
  })
})
