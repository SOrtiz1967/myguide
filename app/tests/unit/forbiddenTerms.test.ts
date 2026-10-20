import { describe, expect, it } from 'vitest'
import { FORBIDDEN_TERMS, findForbidden } from '../support/forbiddenTerms'

// Spec 004, Principio IV (research, Decisión 5): la lista es una red de seguridad contra frases que
// sugieran ayunar, saltar comidas, compensar o culpar. Esta prueba fija cómo se busca.
describe('findForbidden', () => {
  it.each([
    ['Hoy toca ayuno', 'ayun'],
    ['Compensa con ejercicio', 'compens'],
    ['Te pasaste de calorías', 'pasaste'],
    ['Eso está mal', 'mal'],
    ['Tienes que comer menos', 'tienes que'],
    ['AYUNO', 'ayun'],
    ['Quemá lo que comiste', 'quema'],
  ])('detecta «%s»', (text, term) => {
    expect(findForbidden(text)).toContain(term)
  })

  it.each([
    'Restan 650 kcal.',
    'Registraste 250 kcal más que el objetivo de este día.',
    'Si tienes dudas sobre tu alimentación, puedes consultar a un profesional de la salud.',
    'Un valor normal para esta comida',
    'Restan 0 kcal. Lo registrado coincide con el objetivo.',
  ])('no marca «%s»', (text) => {
    expect(findForbidden(text)).toEqual([])
  })

  it('ignora los acentos y las mayúsculas', () => {
    expect(findForbidden('EXCEDISTE')).toContain('excedi')
    expect(findForbidden('Límite diario')).toContain('limit')
  })

  it('la lista inicial incluye los términos de la investigación', () => {
    for (const term of ['ayun', 'saltar', 'compens', 'ejercicio', 'culpa', 'exceso', 'dieta']) {
      expect(FORBIDDEN_TERMS).toContain(term)
    }
  })
})
