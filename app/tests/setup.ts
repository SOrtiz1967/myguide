import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Con globals desactivados, Testing Library no limpia el DOM entre pruebas por sí sola.
afterEach(() => {
  cleanup()
})
