import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Con globals desactivados, Testing Library no limpia el DOM entre pruebas por sí sola.
// El almacenamiento local también se limpia: un borrador de una prueba no debe filtrarse a la siguiente.
afterEach(() => {
  cleanup()
  localStorage.clear()
})
