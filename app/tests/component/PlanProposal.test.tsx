// Spec 015: la propuesta muestra el cálculo, su método y las notas; confirma, cambia el valor o lo deja para después.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import type { PlanInput } from '../../src/features/plan/calorie'
import { PlanProposal } from '../../src/features/plan/PlanProposal'

const p = es.plan
const input: PlanInput = {
  sex: 'male',
  ageYears: 30,
  heightCm: 175,
  weightKg: 75,
  job: 'mixed',
  experience: 'intermediate',
  goal: 'muscle_gain',
  sessionsPerWeek: 3,
  sessionsBasis: 'declared',
}

describe('PlanProposal', () => {
  it('muestra mantenimiento, objetivo, rango, ajuste, proteína y la aclaración de estimación', () => {
    render(<PlanProposal input={input} onUse={vi.fn()} />)
    expect(screen.getByText(p.kcal(2660))).toBeInTheDocument()
    expect(screen.getByText(p.kcal(2930))).toBeInTheDocument()
    expect(screen.getByText(p.range(2640, 3220))).toBeInTheDocument()
    expect(screen.getByText(p.adjustment.muscle_gain(10))).toBeInTheDocument()
    expect(screen.getByText(p.protein(120, 165))).toBeInTheDocument()
    expect(screen.getByText(p.accuracy)).toBeInTheDocument()
  })

  it('explica el método con los datos y la fuente de los entrenos', async () => {
    const user = userEvent.setup()
    render(<PlanProposal input={input} onUse={vi.fn()} />)
    await user.click(screen.getByText(p.method.summary))
    expect(screen.getByText(p.method.rmr(1699))).toBeInTheDocument()
    expect(screen.getByText(p.method.maintenance(2660))).toBeInTheDocument()
    expect(screen.getByText(p.basis.declared('3'))).toBeInTheDocument()
    expect(screen.queryByText(p.basis.logged('3'))).not.toBeInTheDocument()
  })

  it('con entrenos registrados lo dice', async () => {
    render(
      <PlanProposal
        input={{ ...input, sessionsPerWeek: 2, sessionsBasis: 'logged' }}
        onUse={vi.fn()}
      />,
    )
    expect(screen.getByText(p.basis.logged('2'))).toBeInTheDocument()
  })

  it('avisa del piso sin proponer un déficit extremo', () => {
    render(
      <PlanProposal
        input={{
          sex: 'female',
          ageYears: 40,
          heightCm: 150,
          weightKg: 45,
          job: 'sedentary',
          experience: 'beginner',
          goal: 'fat_loss',
          sessionsPerWeek: 0,
          sessionsBasis: 'declared',
        }}
        onUse={vi.fn()}
      />,
    )
    expect(screen.getByText(p.kcal(1200))).toBeInTheDocument()
    expect(screen.getByText(p.notes.floor)).toBeInTheDocument()
  })

  it('usa el objetivo propuesto al confirmar', async () => {
    const onUse = vi.fn()
    const user = userEvent.setup()
    render(<PlanProposal input={input} onUse={onUse} />)
    await user.click(screen.getByRole('button', { name: p.actions.use }))
    expect(onUse).toHaveBeenCalledWith(2930)
  })

  it('permite elegir otro valor, con las reglas de la spec 004', async () => {
    const onUse = vi.fn()
    const user = userEvent.setup()
    render(<PlanProposal input={input} onUse={onUse} />)
    await user.click(screen.getByRole('button', { name: p.actions.other }))
    await user.type(screen.getByLabelText(p.actions.otherLabel), '500')
    await user.click(screen.getByRole('button', { name: p.actions.useOther }))
    expect(onUse).not.toHaveBeenCalled()
    expect(screen.getByText(es.goal.validation.range)).toBeInTheDocument()

    await user.clear(screen.getByLabelText(p.actions.otherLabel))
    await user.type(screen.getByLabelText(p.actions.otherLabel), '2.400')
    await user.click(screen.getByRole('button', { name: p.actions.useOther }))
    expect(onUse).toHaveBeenCalledWith(2400)
  })

  it('ofrece seguir sin objetivo calórico cuando se pide', async () => {
    const onSkip = vi.fn()
    const user = userEvent.setup()
    render(
      <PlanProposal
        input={input}
        onUse={vi.fn()}
        skip={{ label: 'Más tarde', hint: 'Ayuda', onSkip }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Más tarde' }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('muestra el error de guardado sin ocultar la propuesta', () => {
    render(<PlanProposal input={input} onUse={vi.fn()} error="Sin conexión" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByText(p.kcal(2930))).toBeInTheDocument()
  })
})
