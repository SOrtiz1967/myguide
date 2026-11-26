// Spec 025: perfil de atleta — objetivos con prioridad, disponibilidad, preferencias y textos neutrales.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { saveAvailability, saveGoals, savePreferences } from '../../src/features/athlete/api'
import { AvailabilityForm } from '../../src/features/athlete/AvailabilityForm'
import { GoalsForm } from '../../src/features/athlete/GoalsForm'
import { PreferencesForm } from '../../src/features/athlete/PreferencesForm'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/athlete/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/athlete/api')>()),
  saveGoals: vi.fn(),
  saveAvailability: vi.fn(),
  savePreferences: vi.fn(),
}))
// El buscador de catálogo no es parte de esta prueba.
vi.mock('../../src/features/athlete/ItemPicker', () => ({ ItemPicker: () => null }))

const c = es.athlete

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(saveGoals).mockReset().mockResolvedValue(undefined)
  vi.mocked(saveAvailability).mockReset().mockResolvedValue(undefined)
  vi.mocked(savePreferences).mockReset().mockResolvedValue(undefined)
})

describe('GoalsForm', () => {
  it('no deja guardar sin objetivos y no llama al servidor', async () => {
    renderWith(<GoalsForm current={null} history={[]} />)
    expect(screen.getByRole('button', { name: c.goals.save })).toBeDisabled()
  })

  it('guarda los objetivos en el orden elegido, con la prioridad por posición', async () => {
    const user = userEvent.setup()
    renderWith(<GoalsForm current={null} history={[]} />)

    await user.click(screen.getByRole('button', { name: c.goals.add }))
    await user.selectOptions(screen.getAllByRole('combobox')[0]!, 'strength')
    await user.click(screen.getByRole('button', { name: c.goals.add }))
    await user.selectOptions(screen.getAllByRole('combobox')[1]!, 'hypertrophy')
    // Subir el segundo lo convierte en el principal.
    await user.click(screen.getAllByRole('button', { name: c.goals.moveUp })[1]!)
    await user.click(screen.getByRole('button', { name: c.goals.save }))

    await waitFor(() => expect(saveGoals).toHaveBeenCalledTimes(1))
    const [input] = vi.mocked(saveGoals).mock.calls[0]!
    expect(input.goals).toEqual([
      { kind: 'hypertrophy', priority: 1 },
      { kind: 'strength', priority: 2 },
    ])
    expect(input.applyToProfile).toBe(false)
    expect(await screen.findByText(new RegExp(c.goals.saved))).toBeInTheDocument()
  })

  it('ofrece usar hipertrofia como objetivo del perfil solo si hay equivalente', async () => {
    const user = userEvent.setup()
    renderWith(<GoalsForm current={null} history={[]} />)
    await user.click(screen.getByRole('button', { name: c.goals.add }))
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'strength')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'hypertrophy')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: c.goals.save }))
    await waitFor(() => expect(saveGoals).toHaveBeenCalled())
    expect(vi.mocked(saveGoals).mock.calls[0]![0].applyToProfile).toBe(true)
  })

  it('exige texto en el objetivo personalizado y no guarda', async () => {
    const user = userEvent.setup()
    renderWith(<GoalsForm current={null} history={[]} />)
    await user.click(screen.getByRole('button', { name: c.goals.add }))
    await user.selectOptions(screen.getByRole('combobox'), 'custom')
    await user.click(screen.getByRole('button', { name: c.goals.save }))
    expect(await screen.findByText(c.errors.label)).toBeInTheDocument()
    expect(saveGoals).not.toHaveBeenCalled()
  })

  it('no muestra «guardado» si el servidor falla y conserva lo escrito', async () => {
    vi.mocked(saveGoals).mockRejectedValue(new WriteError(false, es.errors.generic))
    const user = userEvent.setup()
    renderWith(<GoalsForm current={null} history={[]} />)
    await user.click(screen.getByRole('button', { name: c.goals.add }))
    await user.selectOptions(screen.getByRole('combobox'), 'fitness')
    await user.click(screen.getByRole('button', { name: c.goals.save }))
    expect(await screen.findByText(es.errors.generic)).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(c.goals.saved))).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('fitness')
  })
})

describe('AvailabilityForm', () => {
  it('sin ningún dato no llama al servidor', async () => {
    const user = userEvent.setup()
    renderWith(<AvailabilityForm current={null} history={[]} />)
    await user.click(screen.getByRole('button', { name: c.availability.save }))
    expect(saveAvailability).not.toHaveBeenCalled()
  })

  it('rechaza una duración fuera de rango antes de enviar', async () => {
    const user = userEvent.setup()
    renderWith(<AvailabilityForm current={null} history={[]} />)
    await user.selectOptions(screen.getByLabelText(c.availability.days), '3')
    await user.type(screen.getByLabelText(c.availability.minutes), '10')
    await user.click(screen.getByRole('button', { name: c.availability.save }))
    expect(await screen.findByText(c.errors.out_of_range)).toBeInTheDocument()
    expect(saveAvailability).not.toHaveBeenCalled()
  })

  it('guarda días, duración y equipamiento', async () => {
    const user = userEvent.setup()
    renderWith(<AvailabilityForm current={null} history={[]} />)
    await user.selectOptions(screen.getByLabelText(c.availability.days), '4')
    await user.type(screen.getByLabelText(c.availability.minutes), '60')
    await user.click(screen.getByLabelText(c.availability.equipmentOptions.barbell))
    await user.click(screen.getByRole('button', { name: c.availability.save }))
    await waitFor(() => expect(saveAvailability).toHaveBeenCalledTimes(1))
    expect(vi.mocked(saveAvailability).mock.calls[0]![0]).toMatchObject({
      days: 4,
      minutes: 60,
      equipment: ['barbell'],
      effectiveFrom: null,
    })
  })
})

describe('PreferencesForm', () => {
  it('guarda sin completar nada: lo no indicado va como nulo, nunca como cero', async () => {
    const user = userEvent.setup()
    renderWith(<PreferencesForm preferences={null} items={[]} />)
    await user.click(screen.getByRole('button', { name: c.preferences.save }))
    await waitFor(() => expect(savePreferences).toHaveBeenCalledTimes(1))
    expect(vi.mocked(savePreferences).mock.calls[0]![0]).toEqual({
      priority_muscles: [],
      meals_per_day: null,
      usual_sleep_minutes: null,
      perceived_recovery: null,
      approx_steps: null,
      effort_scale: 'rir',
      items: [],
    })
  })

  it('limita los músculos prioritarios a 5', async () => {
    const user = userEvent.setup()
    renderWith(<PreferencesForm preferences={null} items={[]} />)
    for (const muscle of ['chest', 'lats', 'biceps', 'triceps', 'quadriceps'] as const) {
      await user.click(screen.getByLabelText(c.preferences.muscleNames[muscle]))
    }
    expect(screen.getByLabelText(c.preferences.muscleNames.calves)).toBeDisabled()
  })

  it('convierte las horas de sueño a minutos y conserva la escala elegida', async () => {
    const user = userEvent.setup()
    renderWith(<PreferencesForm preferences={null} items={[]} />)
    await user.type(screen.getByLabelText(c.preferences.sleep), '7.5')
    await user.click(screen.getByLabelText(c.preferences.effortScales.rpe))
    await user.click(screen.getByRole('button', { name: c.preferences.save }))
    await waitFor(() => expect(savePreferences).toHaveBeenCalled())
    expect(vi.mocked(savePreferences).mock.calls[0]![0]).toMatchObject({
      usual_sleep_minutes: 450,
      effort_scale: 'rpe',
    })
  })

  it('muestra las preferencias guardadas y permite quitarlas', async () => {
    const user = userEvent.setup()
    renderWith(
      <PreferencesForm
        preferences={null}
        items={[
          { kind: 'exercise_favorite', exercise_id: 'e1', food_id: null, name: 'Press banca' },
        ]}
      />,
    )
    expect(screen.getByText('Press banca')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: c.preferences.removeItem('Press banca') }))
    expect(screen.queryByText('Press banca')).not.toBeInTheDocument()
  })
})

describe('textos', () => {
  it('no usan lenguaje de orden ni de juicio sobre el cuerpo', () => {
    const text = JSON.stringify(c).toLowerCase()
    for (const word of ['debes', 'tienes que', 'deberías', 'gordo', 'flaco']) {
      expect(text).not.toContain(word)
    }
  })
})
