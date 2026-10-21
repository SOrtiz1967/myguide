import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { findTrainingForbidden } from '../support/trainingForbiddenTerms'

// T012 (spec 006, FR-051, SC-011; Principio IV): todos los textos de entrenamiento pasan por la lista de términos
// prohibidos. La lista es una red de seguridad; la revisión del texto sigue siendo humana.
const NUMBERS = [0, 1, 2, 3, 8, 30]
const STRINGS = ['Press de banca', 'Torso A', '22/10/2026']

/** Todos los textos de `training`: las cadenas y los resultados de las funciones con valores de ejemplo. */
function allTexts(node: unknown, path = 'training'): { path: string; text: string }[] {
  if (typeof node === 'string') return [{ path, text: node }]
  if (typeof node === 'function') {
    const fn = node as (...args: unknown[]) => unknown
    const out: { path: string; text: string }[] = []
    const combos: unknown[][] = []
    for (const n of NUMBERS) combos.push(Array(Math.max(fn.length, 1)).fill(n))
    for (const s of STRINGS) combos.push(Array(Math.max(fn.length, 1)).fill(s))
    combos.push(['Press de banca', 3], [3, 'Press de banca'], ['Torso A', 'Press de banca'])
    for (const args of combos) {
      let result: unknown
      try {
        result = fn(...args)
      } catch {
        continue // funciones que reciben un objeto: se barren aparte
      }
      if (typeof result === 'string')
        out.push({ path: `${path}(${args.join(', ')})`, text: result })
    }
    return out
  }
  if (Array.isArray(node)) return node.flatMap((child, i) => allTexts(child, `${path}[${i}]`))
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, child]) => allTexts(child, `${path}.${key}`))
  }
  return []
}

describe('textos de entrenamiento (copy.training)', () => {
  const texts = allTexts(es.training)

  it('existen y hay textos que revisar', () => {
    expect(es.training).toBeDefined()
    expect(texts.length).toBeGreaterThan(30)
  })

  it('ninguno contiene un término prohibido', () => {
    const found = texts
      .map(({ path, text }) => ({ path, text, terms: findTrainingForbidden(text) }))
      .filter((t) => t.terms.length > 0)
    expect(found).toEqual([])
  })

  it('ninguno da una orden ni sugiere entrenar con dolor o lesión', () => {
    const risky = texts.filter(({ text }) =>
      /\bdebes\b|\btienes que\b|\bhay que\b|\bdolor\b|\blesi[oó]n\b|\bno pares\b/i.test(text),
    )
    expect(risky).toEqual([])
  })

  it('lo que no se hizo se dice con palabras neutrales', () => {
    expect(es.training.plan.notDone).toBe('No realizado')
    expect(es.training.overdue).toBe('Sin registrar')
  })

  it('los estados y las marcas usan los nombres de la spec', () => {
    expect(es.training.status).toEqual({
      planned: 'Planificada',
      in_progress: 'En curso',
      completed: 'Realizada',
      cancelled: 'Cancelada',
    })
    expect(es.training.marks).toEqual({
      rescheduled: 'Reprogramada',
      modified: 'Modificada',
      corrected: 'Corregida',
    })
  })
})

describe('la lista de términos prohibidos funciona', () => {
  it('detecta rachas, culpa y valoraciones', () => {
    expect(findTrainingForbidden('Perdiste tu racha de 5 días')).toEqual(
      expect.arrayContaining(['perdiste', 'racha']),
    )
    expect(findTrainingForbidden('Nuevo récord personal')).toContain('record')
    expect(findTrainingForbidden('¡Mejoraste mucho!')).toContain('mejoraste')
  })

  it('no marca el vocabulario normal del dominio', () => {
    expect(findTrainingForbidden('Entrenamiento de hoy: ejercicios y series')).toEqual([])
    expect(findTrainingForbidden('Sin registrar. No realizado.')).toEqual([])
    expect(findTrainingForbidden('Puedes recordar la última vez')).toEqual([])
  })
})
