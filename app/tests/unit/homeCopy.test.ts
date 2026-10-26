import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { findTrainingForbidden } from '../support/trainingForbiddenTerms'

// T003 (spec 013, FR-019; Principio IV): los textos del inicio pasan por la lista de términos prohibidos.
function texts(node: unknown, path = 'home'): { path: string; text: string }[] {
  if (typeof node === 'string') return [{ path, text: node }]
  if (typeof node === 'function') {
    const fn = node as (...args: unknown[]) => unknown
    const result = fn(...Array(Math.max(fn.length, 1)).fill('Arroz con pollo'))
    return typeof result === 'string' ? [{ path: `${path}()`, text: result }] : []
  }
  if (Array.isArray(node)) return node.flatMap((item, i) => texts(item, `${path}[${i}]`))
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => texts(value, `${path}.${key}`))
  }
  return []
}

describe('textos del inicio', () => {
  it('ninguno usa términos prohibidos (rachas, culpa, valoraciones)', () => {
    const all = texts(es.home)
    expect(all.length).toBeGreaterThan(20)
    const found = all.flatMap(({ path, text }) =>
      findTrainingForbidden(text).map((term) => `${path}: «${term}»`),
    )
    expect(found).toEqual([])
  })
})
