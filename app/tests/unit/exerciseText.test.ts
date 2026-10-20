// T014 (spec 005, FR-006, FR-007, FR-013, FR-015, FR-017, FR-020): textos puros del catálogo de ejercicios.
import { describe, expect, it } from 'vitest'
import {
  alsoKnownAs,
  descriptionView,
  formatEquipment,
  formatMuscles,
  measurementExplanation,
  provenanceLine,
  translationLabel,
} from '../../src/features/exercises/exerciseText'

describe('measurementExplanation (FR-015)', () => {
  it.each([
    ['reps_weight', 'Se registra con repeticiones y peso'],
    ['reps_bodyweight', 'Se registra con repeticiones, sin peso'],
    ['duration', 'Se registra con el tiempo'],
    ['distance_duration', 'Se registra con distancia y tiempo'],
  ] as const)('%s → «%s»', (type, text) => {
    expect(measurementExplanation(type)).toBe(text)
  })
})

describe('músculos y equipamiento (FR-007)', () => {
  it('lista los músculos en español', () => {
    expect(formatMuscles(['chest', 'triceps'])).toBe('Pecho, Tríceps')
  })
  it('una lista vacía es «sin dato», nunca un texto vacío', () => {
    expect(formatMuscles([])).toBe('sin dato')
  })
  it('el equipamiento ausente es «sin dato» y «Peso corporal» es un valor informado', () => {
    expect(formatEquipment(null)).toBe('sin dato')
    expect(formatEquipment('body only')).toBe('Peso corporal')
    expect(formatEquipment('dumbbell')).toBe('Mancuernas')
  })
})

describe('alsoKnownAs (FR-013)', () => {
  it('junta el nombre original y los alias, sin repetidos ni el nombre mostrado', () => {
    expect(
      alsoKnownAs({
        name: 'Sentadilla con barra',
        original_name: 'Barbell Squat',
        aliases: [
          'Cuclillas con barra',
          'barbell squat',
          'Sentadilla con barra',
          'Sentadilla trasera',
        ],
      }),
    ).toEqual(['Barbell Squat', 'Cuclillas con barra', 'Sentadilla trasera'])
  })
  it('ignora acentos y mayúsculas al comparar', () => {
    expect(
      alsoKnownAs({
        name: 'Elevación lateral',
        original_name: null,
        aliases: ['ELEVACION LATERAL', 'Vuelos'],
      }),
    ).toEqual(['Vuelos'])
  })
  it('sin otros nombres devuelve una lista vacía', () => {
    expect(alsoKnownAs({ name: 'Plancha', original_name: null, aliases: [] })).toEqual([])
  })
})

describe('descriptionView (regla de pasos numerados)', () => {
  it('sin descripción', () => {
    expect(descriptionView(null)).toEqual({ kind: 'none' })
    expect(descriptionView('   \n  ')).toEqual({ kind: 'none' })
  })
  it('si todas las líneas empiezan con «N. » es una lista de pasos, sin el número', () => {
    expect(descriptionView('1. Acuéstate.\n2. Sube.\n\n3. Baja.')).toEqual({
      kind: 'steps',
      steps: ['Acuéstate.', 'Sube.', 'Baja.'],
    })
  })
  it('no renumera dos veces: el número del texto no queda dentro del paso', () => {
    const view = descriptionView('1. Primero\n2. Segundo')
    expect(view.kind === 'steps' && view.steps.some((s) => /^\d+\./.test(s))).toBe(false)
  })
  it('si alguna línea no está numerada es texto libre, con sus saltos de línea', () => {
    expect(descriptionView('Caminata cómoda.\n1. Con ritmo')).toEqual({
      kind: 'text',
      text: 'Caminata cómoda.\n1. Con ritmo',
    })
  })
  it('una sola línea sin número es texto libre', () => {
    expect(descriptionView('Nado continuo en pileta.')).toEqual({
      kind: 'text',
      text: 'Nado continuo en pileta.',
    })
  })
  it('un número sin punto o sin espacio no cuenta como paso', () => {
    expect(descriptionView('1 Primero\n2 Segundo').kind).toBe('text')
    expect(descriptionView('1.Primero\n2.Segundo').kind).toBe('text')
  })
})

describe('provenanceLine (FR-017)', () => {
  it('del catálogo: fuente, código y fecha dd/mm/aaaa', () => {
    expect(
      provenanceLine({
        origin: 'imported',
        source_name: 'free-exercise-db',
        source_item_id: 'Barbell_Squat',
        imported_at: '2026-10-21T14:30:00+00:00',
        based_on: null,
      }),
    ).toBe('Del catálogo · free-exercise-db · código Barbell_Squat · importado el 21/10/2026')
  })
  it('propio', () => {
    expect(
      provenanceLine({
        origin: 'own',
        source_name: null,
        source_item_id: null,
        imported_at: null,
        based_on: null,
      }),
    ).toBe('Propio')
  })
  it('propio, basado en otro ejercicio', () => {
    expect(
      provenanceLine({
        origin: 'own',
        source_name: null,
        source_item_id: null,
        imported_at: null,
        based_on: { id: 'x', name: 'Plancha' },
      }),
    ).toBe('Propio, basado en Plancha')
  })
})

describe('translationLabel (FR-020)', () => {
  it('solo la traducción sin revisar lleva etiqueta', () => {
    expect(translationLabel('machine_translated')).toBe('traducción sin revisar')
    expect(translationLabel('reviewed')).toBeNull()
    expect(translationLabel('original')).toBeNull()
    expect(translationLabel(null)).toBeNull()
  })
})
