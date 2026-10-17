// T018: la tabla de rutas de contracts/ui-routes.md existe y cada ruta pública se renderiza.
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '../../src/routes'

const publicRoutes: Array<[string, string]> = [
  ['/registro', 'Crear cuenta'],
  ['/ingresar', 'Ingresar'],
  ['/recuperar', 'Recuperar contraseña'],
  ['/restablecer', 'Nueva contraseña'],
  ['/correo-confirmado', 'Correo confirmado'],
  ['/correo-no-valido', 'Enlace no válido'],
  ['/sin-conexion', 'Sin conexión'],
]

describe('rutas', () => {
  it.each(publicRoutes)('%s muestra "%s"', (path, heading) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  })
})
