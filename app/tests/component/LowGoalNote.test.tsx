// T035 (spec 004, FR-005): la nota informativa es neutral, sin orden ni diagnóstico.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { LowGoalNote } from '../../src/features/goals/LowGoalNote'
import { findForbidden } from '../support/forbiddenTerms'

describe('LowGoalNote', () => {
  it('dice que el objetivo está por debajo de 1.200 kcal y sugiere consultar a un profesional', () => {
    render(<LowGoalNote />)
    const note = screen.getByText(es.goal.lowGoalNote)
    expect(note).toBeVisible()
    expect(note).toHaveTextContent('por debajo de 1.200 kcal')
    expect(note).toHaveTextContent('puedes consultar a un profesional de la salud')
  })

  it('es una nota, no una alerta: sin rol de alerta, color de error ni íconos', () => {
    const { container } = render(<LowGoalNote />)
    expect(screen.getByRole('note')).toBeVisible()
    expect(container.querySelector('[role="alert"], svg, img')).toBeNull()
    expect(container.innerHTML).not.toMatch(/danger|warning/)
  })

  it('no contiene términos prohibidos ni órdenes', () => {
    expect(findForbidden(es.goal.lowGoalNote)).toEqual([])
    expect(es.goal.lowGoalNote).not.toMatch(/debes|tienes que|hay que/i)
  })
})
