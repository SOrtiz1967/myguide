import { useCallback, useState } from 'react'

// Spec 020 (FR-010): «Todos los pesos» o «Solo en ayunas» se recuerda en el navegador. Si el almacenamiento no está
// disponible (ventana privada, datos bloqueados), se usa «Todos los pesos» y no se muestra ningún error.
const KEY = 'myguide:weight-fasting-only'

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function useFastingFilter(): [boolean, (value: boolean) => void] {
  const [fastingOnly, setFastingOnly] = useState(read)
  const update = useCallback((value: boolean) => {
    setFastingOnly(value)
    try {
      window.localStorage.setItem(KEY, value ? '1' : '0')
    } catch {
      // Sin almacenamiento: la elección vale solo en esta pantalla.
    }
  }, [])
  return [fastingOnly, update]
}
