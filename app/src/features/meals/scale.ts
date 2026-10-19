/** Valor proporcional a una cantidad (g o ml) a partir de su valor por 100, con 2 decimales. Lo que falta sigue faltando. */
export function scaleValue(per100: number | null, quantity: number): number | null {
  if (per100 === null) return null
  return Math.round(((per100 * quantity) / 100) * 100) / 100
}
