// T021 (spec 006, FR-018, FR-007): elegir un ejercicio con la búsqueda de la spec 005, dentro de un panel accesible.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { searchExercises, type ExerciseSummary } from '../../src/features/exercises/api'
import { ExercisePickerPanel } from '../../src/features/training/ExercisePickerPanel'

vi.mock('../../src/features/exercises/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/exercises/api')>()),
  searchExercises: vi.fn(),
  catalogHasExercises: vi.fn().mockResolvedValue(true),
}))

const mockedSearch = vi.mocked(searchExercises)
const t = es.training.picker
const x = es.exercises

function summary(over: Partial<ExerciseSummary> = {}): ExerciseSummary {
  return {
    id: 'e1',
    name: 'Sentadilla con barra',
    name_status: 'original',
    measurement_type: 'reps_weight',
    primary_muscles: ['quadriceps'],
    equipment: 'barbell',
    origin: 'imported',
    based_on_exercise_id: null,
    source_name: 'free-exercise-db',
    total_estimate: 1,
    ...over,
  }
}

function Host({ onPick }: { onPick: (exercise: ExerciseSummary) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open ? (
        <ExercisePickerPanel
          onPick={(exercise) => {
            onPick(exercise)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}

function renderHost(onPick = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Host onPick={onPick} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return onPick
}

async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
  return screen.findByRole('dialog', { name: t.title })
}

beforeEach(() => {
  mockedSearch.mockReset().mockResolvedValue([summary()])
})

describe('ExercisePickerPanel', () => {
  it('se abre como diálogo modal con el foco en el campo de búsqueda', async () => {
    renderHost()
    const dialog = await open()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText(t.searchLabel)).toHaveFocus()
  })

  it('busca por texto en propios y catálogo, y muestra nombre, tipo y origen', async () => {
    renderHost()
    await open()
    await userEvent.type(screen.getByLabelText(t.searchLabel), 'sentadilla')
    const button = await screen.findByRole('button', { name: /Sentadilla con barra/ })
    expect(button).toHaveTextContent('Repeticiones y peso')
    expect(button).toHaveTextContent(x.originBadge.catalog)
    expect(mockedSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'sentadilla', scope: 'all', pageOffset: 0 }),
    )
  })

  it('elegir un ejercicio lo entrega y cierra el panel', async () => {
    const onPick = renderHost()
    await open()
    await userEvent.type(screen.getByLabelText(t.searchLabel), 'sent')
    await userEvent.click(await screen.findByRole('button', { name: /Sentadilla con barra/ }))
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', name: 'Sentadilla con barra' }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con una sola letra pide escribir más y no busca', async () => {
    renderHost()
    await open()
    await userEvent.type(screen.getByLabelText(t.searchLabel), 's')
    expect(await screen.findByText(x.searchTooShort)).toBeVisible()
    expect(mockedSearch).not.toHaveBeenCalled()
  })

  it('sin resultados ofrece crear un ejercicio', async () => {
    mockedSearch.mockResolvedValue([])
    renderHost()
    await open()
    await userEvent.type(screen.getByLabelText(t.searchLabel), 'zzzz')
    expect(await screen.findByText(x.emptyTitle)).toBeVisible()
    expect(screen.getByRole('link', { name: t.createExercise })).toHaveAttribute(
      'href',
      expect.stringContaining('/ejercicios/nuevo'),
    )
  })

  it('si falla la búsqueda avisa y permite reintentar', async () => {
    mockedSearch.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([summary()])
    renderHost()
    await open()
    await userEvent.type(screen.getByLabelText(t.searchLabel), 'sent')
    expect(await screen.findByRole('alert')).toHaveTextContent(x.searchError)
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('button', { name: /Sentadilla con barra/ })).toBeVisible()
  })

  it('«Ver más» suma resultados sin perder los anteriores', async () => {
    const page = (start: number) =>
      Array.from({ length: 20 }, (_, i) =>
        summary({ id: `e${start + i}`, name: `Ejercicio ${start + i}` }),
      )
    mockedSearch.mockResolvedValueOnce(page(0)).mockResolvedValueOnce(page(20).slice(0, 3))
    renderHost()
    await open()
    await userEvent.type(screen.getByLabelText(t.searchLabel), 'ejercicio')
    await screen.findByRole('button', { name: /^Ejercicio 0(?!\d)/ })
    await userEvent.click(screen.getByRole('button', { name: x.loadMore }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Ejercicio 22(?!\d)/ })).toBeVisible(),
    )
    expect(screen.getByRole('button', { name: /^Ejercicio 0(?!\d)/ })).toBeVisible()
  })

  it('Escape lo cierra y el foco vuelve a quien lo abrió', async () => {
    renderHost()
    const opener = screen.getByRole('button', { name: 'Abrir' })
    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it('atrapa el foco con Tab', async () => {
    renderHost()
    const dialog = await open()
    const close = screen.getByRole('button', { name: t.close })
    close.focus()
    await userEvent.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    await userEvent.tab({ shift: true })
    await userEvent.tab({ shift: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})
