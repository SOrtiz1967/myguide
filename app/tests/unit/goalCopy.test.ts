import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { findForbidden } from '../support/forbiddenTerms'

// Spec 004, Principio IV, SC-005: todos los textos del objetivo y del resumen pasan por la lista de
// términos prohibidos. La lista es una red de seguridad; la revisión del texto sigue siendo humana.
const SAMPLES = [0, 1, 2, 250, 300, 650, 1350, 2000]

/** Todos los textos de `goal`: las cadenas y los resultados de las funciones con valores de ejemplo. */
function allTexts(node: unknown, path = 'goal'): { path: string; text: string }[] {
  if (typeof node === 'string') return [{ path, text: node }]
  if (typeof node === 'function') {
    const fn = node as (...args: number[]) => unknown
    const out: { path: string; text: string }[] = []
    const combos =
      fn.length <= 1
        ? SAMPLES.map((a) => [a])
        : SAMPLES.flatMap((a) => SAMPLES.map((b) => [a, b, 2000, 3].slice(0, fn.length)))
    for (const args of combos) {
      let result: unknown
      try {
        result = fn(...args)
      } catch {
        continue // funciones que reciben un objeto: se barren aparte, por estado
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

/** Las frases que dependen del estado del resumen, barridas por todos los estados. */
function stateTexts(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  for (const lowerBound of [false, true]) {
    out.push(
      {
        path: `statement(under, ${lowerBound})`,
        text: es.goal.statement({ state: 'under', remaining: 650, lowerBound }),
      },
      {
        path: `statement(met, ${lowerBound})`,
        text: es.goal.statement({ state: 'met', remaining: 0, lowerBound }),
      },
      {
        path: `statement(over, ${lowerBound})`,
        text: es.goal.statement({ state: 'over', difference: 250, lowerBound }),
      },
    )
  }
  out.push(
    {
      path: 'equation(under)',
      text: es.goal.equation({ goal: 2000, registered: 1350, state: 'under', remaining: 650 }),
    },
    {
      path: 'equation(met)',
      text: es.goal.equation({ goal: 2000, registered: 2000, state: 'met', remaining: 0 }),
    },
    {
      path: 'equation(over)',
      text: es.goal.equation({
        goal: 2000,
        registered: 2250,
        state: 'over',
        remaining: -250,
        difference: 250,
      }),
    },
  )
  return out
}

describe('textos del objetivo (copy.goal)', () => {
  const texts = [...allTexts(es.goal), ...stateTexts()]

  it('hay textos que revisar', () => {
    expect(texts.length).toBeGreaterThan(40)
  })

  it('ninguno contiene un término prohibido', () => {
    const found = texts
      .map(({ path, text }) => ({ path, text, terms: findForbidden(text) }))
      .filter((t) => t.terms.length > 0)
    expect(found).toEqual([])
  })

  it('ninguno da una orden ("debes", "tienes que")', () => {
    const orders = texts.filter(({ text }) => /\bdebes\b|\btienes que\b|\bhay que\b/i.test(text))
    expect(orders).toEqual([])
  })
})

describe('frases del contrato (ui-routes.md)', () => {
  const g = es.goal

  it('los tres estados del resumen', () => {
    expect(g.statement({ state: 'under', remaining: 650, lowerBound: false })).toBe(
      'Restan 650 kcal',
    )
    expect(g.statement({ state: 'met', remaining: 0, lowerBound: false })).toBe(
      'Restan 0 kcal. Lo registrado coincide con el objetivo.',
    )
    expect(g.statement({ state: 'over', difference: 250, lowerBound: false })).toBe(
      'Registraste 250 kcal más que el objetivo de este día.',
    )
  })

  it('con ítems sin dato de energía el restante es un máximo y el exceso, un mínimo', () => {
    expect(g.statement({ state: 'under', remaining: 650, lowerBound: true })).toBe(
      'Restan como máximo 650 kcal',
    )
    expect(g.statement({ state: 'met', remaining: 0, lowerBound: true })).toBe(
      'Restan como máximo 0 kcal',
    )
    expect(g.statement({ state: 'over', difference: 250, lowerBound: true })).toBe(
      'Registraste al menos 250 kcal más que el objetivo de este día.',
    )
  })

  it('la cuenta que explica el resultado', () => {
    expect(g.equation({ goal: 2000, registered: 1350, state: 'under', remaining: 650 })).toBe(
      '2.000 − 1.350 = 650 kcal',
    )
    expect(g.equation({ goal: 2000, registered: 2000, state: 'met', remaining: 0 })).toBe(
      '2.000 − 2.000 = 0 kcal',
    )
    expect(
      g.equation({ goal: 2000, registered: 2250, state: 'over', remaining: -250, difference: 250 }),
    ).toBe('2.250 − 2.000 = 250 kcal')
  })

  it('cifras, avance y aclaraciones', () => {
    expect(g.goalLine(2000)).toBe('Objetivo: 2.000 kcal')
    expect(g.registered(1350, false)).toBe('Registrado: 1.350 kcal')
    expect(g.registered(1350, true)).toBe('Registrado: al menos 1.350 kcal')
    expect(g.percent(68)).toBe('68 % del objetivo')
    expect(g.missingNote(2)).toBe('2 ítems no tienen dato de energía y no suman.')
    expect(g.missingNote(1)).toBe('1 ítem no tiene dato de energía y no suma.')
    expect(g.pendingNote(300)).toBe(
      'Incluye 300 kcal estimadas que todavía no confirmaste. Lo que resta depende de esa estimación.',
    )
  })

  it('invitación, enlaces, errores y nota informativa', () => {
    expect(g.cardTitle).toBe('Objetivo del día')
    expect(g.invite).toBe('Fijar un objetivo de energía (opcional)')
    expect(g.change).toBe('Cambiar objetivo')
    expect(g.howTitle).toBe('Cómo se calcula')
    expect(g.loadError).toBe('No pudimos cargar el objetivo')
    expect(g.lowGoalNote).toBe(
      'El objetivo está por debajo de 1.200 kcal. Si tienes dudas sobre tu alimentación, puedes consultar a un profesional de la salud.',
    )
  })

  it('la pantalla del objetivo', () => {
    expect(g.page.title).toBe('Objetivo de energía diaria')
    expect(g.page.explanation).toBe('Es una referencia que eliges tú. MyGuide no la cambia sola.')
    expect(g.page.current(2000, '12 de octubre')).toBe(
      'Vigente: 2.000 kcal, desde el 12 de octubre',
    )
    expect(g.page.none).toBe('Todavía no fijaste un objetivo')
    expect(g.page.fieldLabel).toBe('Energía por día (kcal)')
    expect(g.page.fieldHelp).toBe('Entre 1.000 y 6.000')
    expect(g.page.save).toBe('Guardar objetivo')
    expect(g.page.remove).toBe('Quitar objetivo')
    expect(g.page.loading).toBe('Cargando el objetivo…')
    expect(g.page.saved).toBe('Objetivo guardado. Rige desde hoy.')
    expect(g.page.removed).toBe('Objetivo quitado. Rige desde hoy.')
    expect(g.page.rule).toBe(
      'El cambio rige desde hoy. Los días anteriores conservan el objetivo que tenían.',
    )
  })

  it('los cuatro mensajes de validación', () => {
    expect(g.validation.empty).toBe('Escribe el objetivo en kcal.')
    expect(g.validation.notNumber).toBe('Escribe solo números, por ejemplo 2000.')
    expect(g.validation.notInteger).toBe('Escribe el objetivo en kcal enteras, sin decimales.')
    expect(g.validation.range).toBe('El objetivo debe estar entre 1.000 y 6.000 kcal.')
  })

  it('el desplegable "Cómo se calcula" explica la fórmula, lo incluido y lo excluido', () => {
    expect(g.how).toEqual([
      'Restan = objetivo − registrado.',
      'Registrado es la suma de la energía de los ítems del día que tienen ese dato. Los ítems sin dato de energía no suman y se cuentan aparte.',
      'Las estimaciones que todavía no confirmaste suman y se muestran aparte.',
      'El objetivo es el que tenías ese día. Si lo cambias, rige desde hoy y los días anteriores no cambian.',
    ])
  })
})
