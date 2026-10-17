// FR-031 y FR-015: formato regional (es-AR) y unidades siempre visibles.

/** '1990-05-17' → '17/05/1990'. Se arma desde el texto para no correr el día por la zona horaria. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

/** 171.5 → '171,5 cm' */
export function formatHeight(centimeters: number): string {
  return `${number.format(centimeters)} cm`
}
