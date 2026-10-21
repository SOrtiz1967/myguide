/**
 * Términos que no pueden aparecer en los textos de entrenamiento (spec 006, FR-051, SC-011; Principio IV y
 * Límites de alcance): rachas, días «perdidos», culpa, valoración del rendimiento o la constancia, y
 * sugerencias de entrenar a pesar de dolor o lesión.
 *
 * A diferencia de `forbiddenTerms.ts` (el de nutrición), aquí «ejercicio», «entrenamiento» y «saltear» son
 * palabras normales del dominio y no se prohíben. Es una red de seguridad: no prueba que un texto sea bueno;
 * la revisión sigue siendo humana.
 *
 * Los términos son raíces, sin acentos y en minúsculas, y coinciden al comienzo de una palabra. Los de
 * `WHOLE_WORD` solo coinciden como palabra completa.
 */
export const TRAINING_FORBIDDEN_TERMS = [
  'racha',
  'perdiste',
  'perdido',
  'perdida',
  'fallaste',
  'fracas',
  'culpa',
  'castig',
  'vago',
  'vaga',
  'flojo',
  'floja',
  'mejoraste',
  'retrocediste',
  'empeoraste',
  'objetivo cumplido',
  'felicit',
  'excelente',
  'sigue asi',
  'no pares',
  'no te rindas',
  'sin excusa',
  'excusa',
  'a pesar del dolor',
  'aguanta',
  'sin descanso',
  'obligatori',
  'deber',
  'debes',
  'tienes que',
  'tenes que',
  'hay que',
  'record',
  'no hiciste',
  'no entrenaste',
] as const

const WHOLE_WORD: ReadonlySet<string> = new Set(['record', 'deber'])

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Los términos prohibidos hallados en el texto (vacío si no hay ninguno). */
export function findTrainingForbidden(text: string): string[] {
  const normalized = normalize(text)
  return TRAINING_FORBIDDEN_TERMS.filter((term) => {
    const tail = WHOLE_WORD.has(term) ? '(?![a-z])' : ''
    return new RegExp(`(^|[^a-z])${term}${tail}`).test(normalized)
  })
}
