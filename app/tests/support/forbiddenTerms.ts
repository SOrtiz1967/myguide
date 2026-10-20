/**
 * Términos que no pueden aparecer en los textos del objetivo y del resumen diario (Principio IV).
 *
 * Es una red de seguridad: evita que una frase que sugiera ayunar, saltar comidas, compensar,
 * restringir o culpar llegue por descuido. No prueba que un texto sea bueno; la revisión sigue siendo
 * humana. Se puede ampliar.
 *
 * Los términos son raíces, sin acentos y en minúsculas, y coinciden al comienzo de una palabra
 * (`quema` marca "quemar" pero no "equema"). Los de `WHOLE_WORD` solo coinciden como palabra completa,
 * para que `mal` no marque "normal".
 */
export const FORBIDDEN_TERMS = [
  'ayun',
  'saltar',
  'saltea',
  'compens',
  'quemar',
  'quema',
  'ejercicio',
  'entren',
  'culpa',
  'fall',
  'excedi',
  'exceso',
  'pasaste',
  'pasarte',
  'mal',
  'malo',
  'prohib',
  'castig',
  'engord',
  'limit',
  'restring',
  'dieta',
  'deber',
  'tenes que',
  'tienes que',
  'hay que',
] as const

const WHOLE_WORD: ReadonlySet<string> = new Set(['mal'])

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Los términos prohibidos hallados en el texto (vacío si no hay ninguno). */
export function findForbidden(text: string): string[] {
  const normalized = normalize(text)
  return FORBIDDEN_TERMS.filter((term) => {
    const tail = WHOLE_WORD.has(term) ? '(?![a-z])' : ''
    return new RegExp(`(^|[^a-z])${term}${tail}`).test(normalized)
  })
}
