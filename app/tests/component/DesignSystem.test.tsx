// Spec 017: piezas del sistema de diseño y página de referencia.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Card } from '../../src/components/Card'
import { Meter } from '../../src/components/Meter'
import { PageHeader } from '../../src/components/PageHeader'
import { StatusTag } from '../../src/components/StatusTag'
import { DesignSystemPage } from '../../src/routes/DesignSystemPage'

describe('piezas del sistema', () => {
  it('Card aplica el tono pedido', () => {
    render(
      <Card tone="training" aria-label="bloque">
        contenido
      </Card>,
    )
    const block = screen.getByLabelText('bloque')
    expect(block).toHaveClass('card', 'card-training')
  })

  it('PageHeader tiene un único h1 con subtítulo y acción', () => {
    render(<PageHeader title="Título" subtitle="Detalle" action={<a href="/x">Acción</a>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Título' })).toBeInTheDocument()
    expect(screen.getByText('Detalle')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acción' })).toBeInTheDocument()
  })

  it('StatusTag dice el estado en texto y deja la forma como decoración', () => {
    const { container } = render(<StatusTag kind="below">Por debajo</StatusTag>)
    expect(screen.getByText('Por debajo')).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('Meter dice las cifras en texto y oculta la barra a los lectores de pantalla', () => {
    render(<Meter value={1680} goal={2600} low={2340} high={2860} caption="1.680 de 2.600 kcal" />)
    expect(screen.getByText('1.680 de 2.600 kcal')).toBeInTheDocument()
    expect(screen.getByTestId('meter-bar')).toHaveAttribute('aria-hidden', 'true')
  })

  it('Meter no pasa del ancho completo con un valor mayor que la meta', () => {
    render(<Meter value={5000} goal={2600} caption="x" />)
    const fill = screen.getByTestId('meter-bar').lastElementChild as HTMLElement
    expect(Number.parseFloat(fill.style.width)).toBeLessThanOrEqual(100)
  })
})

describe('página de referencia', () => {
  it('muestra cada pieza con su título y permite elegir un filtro', async () => {
    render(
      <MemoryRouter>
        <DesignSystemPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Sistema de diseño' })).toBeInTheDocument()
    for (const title of ['Colores', 'Bloques', 'Botones y filtros', 'Campos', 'Estados']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    const propios = screen.getByRole('button', { name: 'Propios' })
    expect(propios).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(propios)
    expect(propios).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Escribe un número válido.')).toBeInTheDocument()
  })
})
