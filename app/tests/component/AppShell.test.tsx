// T016 (FR-024): estructura accesible y responsive de la aplicacion.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppShell } from '../../src/components/AppShell'

describe('AppShell', () => {
  it('ofrece un enlace para saltar al contenido y un unico landmark main', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>contenido</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#contenido',
    )
    const mains = screen.getAllByRole('main')
    expect(mains).toHaveLength(1)
    expect(mains[0]).toHaveAttribute('id', 'contenido')
    expect(screen.getByText('contenido')).toBeVisible()
  })
})
