// T052 (spec 003, FR-028, FR-029): repetir una comida en otro día.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { previewRepeat, repeatMeal } from '../../src/features/meals/api'
import { RepeatMeal } from '../../src/features/meals/RepeatMeal'
import { fetchProfile, type Profile } from '../../src/features/profile/api'

vi.mock('../../src/features/meals/api', () => ({ previewRepeat: vi.fn(), repeatMeal: vi.fn() }))
vi.mock('../../src/features/profile/api', () => ({ fetchProfile: vi.fn(), updateProfile: vi.fn() }))

const profile = {
  user_id: 'u1',
  birth_date: null,
  sex: null,
  height_cm: null,
  timezone: 'America/Argentina/Buenos_Aires',
  unit_system: 'metric',
  last_active_at: '2026-10-19T00:00:00Z',
} as unknown as Profile

const mockedPreview = vi.mocked(previewRepeat)
const mockedRepeat = vi.mocked(repeatMeal)

function Destination() {
  const location = useLocation()
  const added = (location.state as { added?: string } | null)?.added
  return (
    <div>
      <h1>Día {location.pathname}</h1>
      {added ? <p role="status">{added}</p> : null}
    </div>
  )
}

function renderRepeat() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/origen']}>
        <Routes>
          <Route path="/origen" element={<RepeatMeal date="2026-10-17" meal="lunch" />} />
          <Route path="/comidas/:fecha" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  // Solo se simula la fecha: "hoy" es el 19/10/2026 en Buenos Aires.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-19T15:00:00Z') })
  mockedPreview.mockReset().mockResolvedValue({ total: 5, recalculated: 3, copied: 2 })
  mockedRepeat.mockReset().mockResolvedValue({ created: 5, recalculated: 3, copied: 2 })
  vi.mocked(fetchProfile).mockReset().mockResolvedValue(profile)
})

afterEach(() => {
  vi.useRealTimers()
})

const user = () => userEvent.setup({ advanceTimers: () => {} })

describe('Repetir en… (FR-028)', () => {
  it('abre el panel con el día de hoy y la misma comida como destino', async () => {
    const u = user()
    renderRepeat()
    await u.click(screen.getByRole('button', { name: es.meals.repeat.action }))
    expect(screen.getByLabelText(es.meals.repeat.day)).toHaveValue('2026-10-19')
    expect(screen.getByLabelText(es.meals.repeat.meal)).toHaveValue('lunch')
    expect(mockedPreview).toHaveBeenCalledWith('2026-10-17', 'lunch')
  })

  it('la confirmación dice cuántos ítems se recalculan y cuántos se copian', async () => {
    const u = user()
    renderRepeat()
    await u.click(screen.getByRole('button', { name: es.meals.repeat.action }))
    await u.selectOptions(screen.getByLabelText(es.meals.repeat.meal), 'dinner')
    const next = await screen.findByRole('button', { name: es.meals.repeat.next })
    await waitFor(() => expect(next).toBeEnabled())
    await u.click(next)

    const dialog = await screen.findByRole('dialog', {
      name: es.meals.repeat.confirmTitle('5 ítems'),
    })
    expect(dialog).toHaveTextContent('3 se recalculan')
    expect(dialog).toHaveTextContent('2 se copian tal cual')
    expect(dialog).toHaveTextContent('Cena del lunes 19 de octubre')
  })

  it('confirmar repite una sola vez, aunque se haga doble clic, y avisa en el día de destino', async () => {
    const u = user()
    let release: (value: {
      created: number
      recalculated: number
      copied: number
    }) => void = () => {}
    mockedRepeat.mockReturnValue(new Promise((resolve) => (release = resolve)))
    renderRepeat()
    await u.click(screen.getByRole('button', { name: es.meals.repeat.action }))
    const next = await screen.findByRole('button', { name: es.meals.repeat.next })
    await waitFor(() => expect(next).toBeEnabled())
    await u.click(next)

    const confirm = await screen.findByRole('button', { name: es.meals.repeat.confirm })
    await u.dblClick(confirm)
    expect(mockedRepeat).toHaveBeenCalledTimes(1)
    expect(mockedRepeat).toHaveBeenCalledWith(
      { fromDate: '2026-10-17', fromMeal: 'lunch', toDate: '2026-10-19', toMeal: 'lunch' },
      expect.any(String),
    )
    release({ created: 5, recalculated: 3, copied: 2 })

    expect(await screen.findByRole('heading', { name: /\/comidas\/2026-10-19/ })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(es.meals.repeat.done('5 ítems'))
  })

  it('un fallo de red no da nada por hecho y el reintento usa la misma solicitud', async () => {
    const u = user()
    mockedRepeat.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderRepeat()
    await u.click(screen.getByRole('button', { name: es.meals.repeat.action }))
    const next = await screen.findByRole('button', { name: es.meals.repeat.next })
    await waitFor(() => expect(next).toBeEnabled())
    await u.click(next)

    await u.click(await screen.findByRole('button', { name: es.meals.repeat.confirm }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await u.click(within(dialog).getByRole('button', { name: es.meals.repeat.confirm }))
    await waitFor(() => expect(mockedRepeat).toHaveBeenCalledTimes(2))
    expect(mockedRepeat.mock.calls[1]![1]).toBe(mockedRepeat.mock.calls[0]![1])
  })

  it('cancelar la confirmación no repite nada', async () => {
    const u = user()
    renderRepeat()
    await u.click(screen.getByRole('button', { name: es.meals.repeat.action }))
    const next = await screen.findByRole('button', { name: es.meals.repeat.next })
    await waitFor(() => expect(next).toBeEnabled())
    await u.click(next)
    const dialog = await screen.findByRole('dialog')
    await u.click(within(dialog).getByRole('button', { name: es.meals.repeat.cancel }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockedRepeat).not.toHaveBeenCalled()
  })

  it('una fecha fuera de rango se rechaza antes de confirmar', async () => {
    const u = user()
    renderRepeat()
    await u.click(screen.getByRole('button', { name: es.meals.repeat.action }))
    const next = await screen.findByRole('button', { name: es.meals.repeat.next })
    await waitFor(() => expect(next).toBeEnabled())
    const day = screen.getByLabelText(es.meals.repeat.day)
    await u.clear(day)
    await u.click(next)
    expect(await screen.findByText(es.meals.errors.invalidDate)).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('si no se pudo preparar la vista previa lo dice y no deja continuar', async () => {
    const u = user()
    mockedPreview.mockRejectedValue(new TypeError('Failed to fetch'))
    renderRepeat()
    await u.click(screen.getByRole('button', { name: es.meals.repeat.action }))
    expect(await screen.findByText(es.meals.repeat.previewError)).toBeVisible()
    expect(screen.getByRole('button', { name: es.meals.repeat.next })).toBeDisabled()
  })
})
