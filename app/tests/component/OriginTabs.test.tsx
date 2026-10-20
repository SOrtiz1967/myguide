// T018 (spec 005): las pestañas de origen se reutilizan en alimentos y en ejercicios, con sus propias etiquetas.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { OriginTabs, type OriginScope } from '../../src/components/OriginTabs'

const LABELS = { all: 'Todos', catalog: 'Del catálogo', own: 'Mis cosas' }

function Harness({ onChange = vi.fn() }: { onChange?: (scope: OriginScope) => void }) {
  const [scope, setScope] = useState<OriginScope>('all')
  return (
    <OriginTabs
      value={scope}
      ariaLabel="Origen de las cosas"
      labels={LABELS}
      onChange={(next) => {
        setScope(next)
        onChange(next)
      }}
    />
  )
}

describe('OriginTabs', () => {
  it('muestra las etiquetas que recibe, con rol de lista de pestañas y su nombre accesible', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Origen de las cosas' })).toBeVisible()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Todos',
      'Del catálogo',
      'Mis cosas',
    ])
  })

  it('marca la pestaña activa y solo esa entra en el orden de tabulación', () => {
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'Todos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Todos' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Mis cosas' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Mis cosas' })).toHaveAttribute('tabindex', '-1')
  })

  it('cambia con el clic', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Del catálogo' }))
    expect(onChange).toHaveBeenCalledWith('catalog')
    expect(screen.getByRole('tab', { name: 'Del catálogo' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('se recorre con las flechas (con vuelta), Inicio y Fin, y el foco sigue a la pestaña', async () => {
    render(<Harness />)
    screen.getByRole('tab', { name: 'Todos' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Del catálogo' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Mis cosas' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Todos' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Mis cosas' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Todos' })).toHaveFocus()
  })

  it('cada pestaña apunta al panel de resultados', () => {
    render(<Harness />)
    for (const tab of screen.getAllByRole('tab'))
      expect(tab).toHaveAttribute('aria-controls', 'resultados')
  })
})
