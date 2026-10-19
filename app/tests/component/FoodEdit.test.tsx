// T060 (spec 002, FR-015, FR-021, FR-022, FR-031): editar y eliminar alimentos propios.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../../src/components/ConfirmDialog'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import { deleteFood, fetchFood, updateFood, type Food } from '../../src/features/foods/api'
import { FoodDetailPage } from '../../src/features/foods/FoodDetailPage'
import { FoodEditPage } from '../../src/features/foods/FoodEditPage'
import { draftKey } from '../../src/lib/drafts'

vi.mock('../../src/features/foods/api', () => ({
  fetchFood: vi.fn(),
  updateFood: vi.fn(),
  deleteFood: vi.fn(),
  copyFood: vi.fn(),
}))

const mockedFetch = vi.mocked(fetchFood)
const mockedUpdate = vi.mocked(updateFood)
const mockedDelete = vi.mocked(deleteFood)

function ownFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'o1',
    origin: 'own',
    source_item_id: null,
    imported_at: null,
    based_on_food_id: null,
    name: 'Mi galletita',
    name_status: 'original',
    brand: 'Casera',
    reference_basis: '100g',
    energy_kcal: 450,
    protein_g: 6.5,
    carbs_g: null,
    sugars_g: null,
    fat_g: null,
    saturated_fat_g: null,
    fiber_g: null,
    sodium_mg: null,
    portions: [{ id: 'p1', name: 'Unidad', quantity: 12, position: 0 }],
    source: null,
    based_on: null,
    ...overrides,
  }
}

const signedIn: AuthState = {
  status: 'signedIn',
  session: { access_token: 'jwt', user: { id: 'u1' } } as never,
  expired: false,
  signOut: async () => {},
}

function renderApp(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <AuthContext.Provider value={signedIn}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/alimentos" element={<h1>Búsqueda</h1>} />
            <Route path="/alimentos/:id" element={<FoodDetailPage />} />
            <Route path="/alimentos/:id/editar" element={<FoodEditPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

const label = (text: string) => screen.getByLabelText(text, { exact: false })
const saveButton = () => screen.getByRole('button', { name: es.foods.actions.save })

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue(ownFood())
  mockedUpdate.mockReset().mockResolvedValue('o1')
  mockedDelete.mockReset().mockResolvedValue(undefined)
})

describe('FoodEditPage', () => {
  it('el formulario viene cargado con los valores guardados', async () => {
    renderApp('/alimentos/o1/editar')
    expect(await screen.findByDisplayValue('Mi galletita')).toBeVisible()
    expect(label('Marca')).toHaveValue('Casera')
    expect(label('Energía (kcal)')).toHaveValue('450')
    expect(label('Proteínas (g)')).toHaveValue('6,5')
    expect(label('Carbohidratos (g)')).toHaveValue('')
    expect(screen.getByLabelText(es.foods.form.portionName)).toHaveValue('Unidad')
    expect(screen.getByLabelText(`${es.foods.form.portionAmount} (g)`)).toHaveValue('12')
  })

  it('guarda los cambios, confirma y vuelve al detalle', async () => {
    renderApp('/alimentos/o1/editar')
    const name = await screen.findByDisplayValue('Mi galletita')
    await userEvent.clear(name)
    await userEvent.type(name, 'Galletita nueva')
    await userEvent.click(saveButton())

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1))
    const [id, payload] = mockedUpdate.mock.calls[0]!
    expect(id).toBe('o1')
    expect(payload).toMatchObject({ name: 'Galletita nueva', energy_kcal: 450, protein_g: 6.5 })
    expect(await screen.findByText(es.foods.form.saved)).toBeVisible()
  })

  it('rechaza los mismos valores inválidos que al crear', async () => {
    renderApp('/alimentos/o1/editar')
    const energy = await screen.findByLabelText('Energía (kcal)', { exact: false })
    await userEvent.clear(energy)
    await userEvent.type(energy, '-5')
    await userEvent.click(saveButton())
    expect(await screen.findByText(es.foods.errors.negative)).toBeVisible()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('una copia sin energía exige completarla para guardar', async () => {
    mockedFetch.mockResolvedValue(ownFood({ energy_kcal: null, based_on_food_id: 'c1' }))
    renderApp('/alimentos/o1/editar')
    await screen.findByDisplayValue('Mi galletita')
    await userEvent.click(saveButton())
    expect(await screen.findByText(es.foods.errors.requiredEnergy)).toBeVisible()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('FR-031: un fallo de red conserva el borrador y no da por guardado', async () => {
    mockedUpdate.mockRejectedValue(new TypeError('Failed to fetch'))
    renderApp('/alimentos/o1/editar')
    const name = await screen.findByDisplayValue('Mi galletita')
    await userEvent.clear(name)
    await userEvent.type(name, 'Cambio sin guardar')
    await userEvent.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.queryByText(es.foods.form.saved)).toBeNull()
    expect(screen.getByDisplayValue('Cambio sin guardar')).toBeVisible()
    expect(localStorage.getItem(draftKey('u1', 'food-edit-o1'))).toContain('Cambio sin guardar')
  })

  it('FR-022: un alimento del catálogo no se puede editar', async () => {
    mockedFetch.mockResolvedValue(
      ownFood({
        id: 'c1',
        origin: 'imported',
        source_item_id: '1',
        imported_at: '2026-10-18T12:00:00Z',
      }),
    )
    renderApp('/alimentos/c1/editar')
    expect(await screen.findByText(es.foods.form.editNotAllowed)).toBeVisible()
    expect(screen.queryByRole('button', { name: es.foods.actions.save })).toBeNull()
  })

  it('un alimento inexistente o ajeno dice "No encontramos este alimento"', async () => {
    mockedFetch.mockResolvedValue(null)
    renderApp('/alimentos/otro/editar')
    expect(await screen.findByText(es.foods.notFound)).toBeVisible()
  })

  it('tras crear una copia avisa que ya se puede editar', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(
      <AuthContext.Provider value={signedIn}>
        <QueryClientProvider client={client}>
          <MemoryRouter
            initialEntries={[{ pathname: '/alimentos/o1/editar', state: { copied: true } }]}
          >
            <Routes>
              <Route path="/alimentos/:id/editar" element={<FoodEditPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    )
    expect(await screen.findByText(es.foods.form.copyCreated)).toBeVisible()
  })
})

describe('Eliminar (FR-021)', () => {
  async function openDialog() {
    renderApp('/alimentos/o1')
    const trigger = await screen.findByRole('button', { name: es.foods.actions.delete })
    await userEvent.click(trigger)
    return trigger
  }

  it('pide confirmación accesible antes de eliminar y no elimina todavía', async () => {
    await openDialog()
    const dialog = await screen.findByRole('dialog', { name: es.foods.form.deleteTitle })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent(es.foods.form.deleteBody)
    expect(screen.getByRole('button', { name: es.foods.actions.cancel })).toHaveFocus()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('Escape cancela, devuelve el foco y no elimina', async () => {
    const trigger = await openDialog()
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('Cancelar cierra el diálogo sin eliminar', async () => {
    await openDialog()
    await userEvent.click(await screen.findByRole('button', { name: es.foods.actions.cancel }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('al confirmar elimina y vuelve a la búsqueda', async () => {
    await openDialog()
    await userEvent.click(
      await screen.findByRole('button', { name: es.foods.actions.confirmDelete }),
    )
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('o1'))
    expect(await screen.findByRole('heading', { name: 'Búsqueda' })).toBeVisible()
  })

  it('si falla, avisa dentro del diálogo y no lo cierra', async () => {
    mockedDelete.mockRejectedValue(new TypeError('Failed to fetch'))
    await openDialog()
    await userEvent.click(
      await screen.findByRole('button', { name: es.foods.actions.confirmDelete }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('el catálogo no ofrece Editar ni Eliminar', async () => {
    mockedFetch.mockResolvedValue(
      ownFood({
        id: 'c1',
        origin: 'imported',
        source_item_id: '1',
        imported_at: '2026-10-18T12:00:00Z',
        source: { id: 's', slug: 'usda-fdc', name: 'USDA' },
      }),
    )
    renderApp('/alimentos/c1')
    await screen.findByRole('button', { name: es.foods.actions.createMine })
    expect(screen.queryByRole('button', { name: es.foods.actions.delete })).toBeNull()
    expect(screen.queryByRole('link', { name: es.foods.actions.edit })).toBeNull()
  })
})

describe('ConfirmDialog', () => {
  function Harness({ onCancel = () => {}, onConfirm = () => {} }) {
    return (
      <ConfirmDialog
        title="¿Seguro?"
        description="Descripción"
        confirmLabel="Sí"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
  }

  it('atrapa el foco: Tab y Shift+Tab recorren solo los botones del diálogo', async () => {
    render(<Harness />)
    const no = screen.getByRole('button', { name: 'No' })
    const yes = screen.getByRole('button', { name: 'Sí' })
    expect(no).toHaveFocus()
    await userEvent.tab()
    expect(yes).toHaveFocus()
    await userEvent.tab()
    expect(no).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(yes).toHaveFocus()
  })

  it('Escape llama a onCancel y confirmar a onConfirm', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<Harness onCancel={onCancel} onConfirm={onConfirm} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Sí' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
