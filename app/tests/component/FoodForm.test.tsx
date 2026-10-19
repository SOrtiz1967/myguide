// T032 (spec 002, FR-015 a FR-019, FR-023, FR-031): formulario para crear un alimento propio.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import { createFood } from '../../src/features/foods/api'
import { FoodCreatePage } from '../../src/features/foods/FoodCreatePage'
import { FoodForm } from '../../src/features/foods/FoodForm'
import { emptyFoodForm, type FoodPayload } from '../../src/features/foods/schema'
import { draftKey } from '../../src/lib/drafts'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/foods/api', () => ({ createFood: vi.fn() }))
const mockedCreate = vi.mocked(createFood)

const label = (text: string) => screen.getByLabelText(text, { exact: false })

function renderForm(
  props: Partial<React.ComponentProps<typeof FoodForm>> = {},
  onSubmit = vi.fn<(payload: FoodPayload, requestId: string) => Promise<string>>(),
) {
  onSubmit.mockResolvedValue('new-id')
  const onSaved = vi.fn()
  render(
    <FoodForm
      userId="u1"
      formId="food-new"
      initialValues={emptyFoodForm()}
      submitLabel={es.foods.actions.save}
      onSubmit={onSubmit}
      onSaved={onSaved}
      {...props}
    />,
  )
  return { onSubmit, onSaved }
}

const save = () => screen.getByRole('button', { name: es.foods.actions.save })

describe('FoodForm', () => {
  it('FR-015: crea un alimento con solo nombre y energía', async () => {
    const { onSubmit, onSaved } = renderForm()
    await userEvent.type(label('Nombre'), 'Mi galletita')
    await userEvent.type(label('Energía (kcal)'), '450')
    await userEvent.click(save())

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('new-id'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [payload, requestId] = onSubmit.mock.calls[0]!
    expect(payload).toMatchObject({
      name: 'Mi galletita',
      brand: null,
      reference_basis: '100g',
      energy_kcal: 450,
      protein_g: null,
      portions: [],
    })
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('FR-019: acepta la coma decimal', async () => {
    const { onSubmit } = renderForm()
    await userEvent.type(label('Nombre'), 'Queso')
    await userEvent.type(label('Energía (kcal)'), '300')
    await userEvent.type(label('Proteínas (g)'), '12,5')
    await userEvent.click(save())
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0]![0].protein_g).toBe(12.5)
  })

  it('todos los campos numéricos tienen etiqueta con su unidad', () => {
    renderForm()
    for (const text of [
      'Energía (kcal)',
      'Proteínas (g)',
      'Carbohidratos (g)',
      'de los cuales azúcares (g)',
      'Grasas totales (g)',
      'de las cuales saturadas (g)',
      'Fibra (g)',
      'Sodio (mg)',
    ]) {
      expect(label(text)).toBeVisible()
    }
    expect(screen.getByRole('radio', { name: es.foods.form.basis['100g'] })).toBeChecked()
    expect(screen.getByRole('radio', { name: es.foods.form.basis['100ml'] })).not.toBeChecked()
  })

  it('agrega y quita porciones, y las envía', async () => {
    const { onSubmit } = renderForm()
    await userEvent.type(label('Nombre'), 'Arroz')
    await userEvent.type(label('Energía (kcal)'), '130')

    await userEvent.click(screen.getByRole('button', { name: es.foods.actions.addPortion }))
    await userEvent.click(screen.getByRole('button', { name: es.foods.actions.addPortion }))
    const names = screen.getAllByLabelText(es.foods.form.portionName)
    const amounts = screen.getAllByLabelText(es.foods.form.portionAmount, { exact: false })
    expect(names).toHaveLength(2)
    await userEvent.type(names[0]!, 'Taza')
    await userEvent.type(amounts[0]!, '158')
    await userEvent.type(names[1]!, 'Sobrante')
    await userEvent.type(amounts[1]!, '10')

    await userEvent.click(
      screen.getAllByRole('button', { name: es.foods.actions.removePortion })[1]!,
    )
    expect(screen.getAllByLabelText(es.foods.form.portionName)).toHaveLength(1)

    await userEvent.click(save())
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0]![0].portions).toEqual([{ name: 'Taza', quantity: 158 }])
  })

  it('la unidad de la cantidad de una porción sigue a la base elegida', async () => {
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: es.foods.actions.addPortion }))
    expect(screen.getByLabelText(`${es.foods.form.portionAmount} (g)`)).toBeVisible()
    await userEvent.click(screen.getByRole('radio', { name: es.foods.form.basis['100ml'] }))
    expect(screen.getByLabelText(`${es.foods.form.portionAmount} (ml)`)).toBeVisible()
  })

  it('FR-017: muestra el error en cada campo y lleva el foco al primero', async () => {
    const { onSubmit } = renderForm()
    await userEvent.type(label('Proteínas (g)'), '-3')
    await userEvent.click(save())

    expect(await screen.findByText(es.foods.errors.nameRequired)).toBeVisible()
    expect(screen.getByText(es.foods.errors.requiredEnergy)).toBeVisible()
    expect(screen.getByText(es.foods.errors.negative)).toBeVisible()
    expect(label('Nombre')).toHaveFocus()
    expect(label('Nombre')).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('FR-018: avisa si la energía no coincide con los macronutrientes, sin impedir guardar', async () => {
    const { onSubmit } = renderForm()
    await userEvent.type(label('Nombre'), 'Raro')
    await userEvent.type(label('Energía (kcal)'), '800')
    await userEvent.type(label('Proteínas (g)'), '10')
    await userEvent.type(label('Carbohidratos (g)'), '10')
    await userEvent.type(label('Grasas totales (g)'), '10')

    expect(await screen.findByText(es.foods.form.coherenceNotice(170))).toBeVisible()
    await userEvent.click(save())
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })

  it('sin datos suficientes no muestra el aviso de coherencia', async () => {
    renderForm()
    await userEvent.type(label('Energía (kcal)'), '800')
    await userEvent.type(label('Proteínas (g)'), '10')
    expect(screen.queryByText(/no coincide con los macronutrientes/)).toBeNull()
  })

  it('FR-023: el doble clic envía una sola vez y el botón se deshabilita', async () => {
    const onSubmit = vi.fn<(payload: FoodPayload, requestId: string) => Promise<string>>()
    let resolve: (id: string) => void = () => {}
    onSubmit.mockImplementation(() => new Promise((r) => (resolve = r)))
    const onSaved = vi.fn()
    render(
      <FoodForm
        userId="u1"
        formId="food-new"
        initialValues={{ ...emptyFoodForm(), name: 'Pan', energy_kcal: '250' }}
        submitLabel={es.foods.actions.save}
        onSubmit={onSubmit}
        onSaved={onSaved}
      />,
    )
    await userEvent.dblClick(save())
    await waitFor(() => expect(save()).toBeDisabled())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    resolve('id-1')
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('id-1'))
  })

  it('FR-023: un reintento tras un fallo usa el mismo identificador de solicitud', async () => {
    const onSubmit = vi.fn<(payload: FoodPayload, requestId: string) => Promise<string>>()
    onSubmit
      .mockRejectedValueOnce(new WriteError(true, es.errors.offline))
      .mockResolvedValue('id-2')
    const onSaved = vi.fn()
    render(
      <FoodForm
        userId="u1"
        formId="food-new"
        initialValues={{ ...emptyFoodForm(), name: 'Pan', energy_kcal: '250' }}
        submitLabel={es.foods.actions.save}
        onSubmit={onSubmit}
        onSaved={onSaved}
      />,
    )
    await userEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    await userEvent.click(save())
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('id-2'))
    expect(onSubmit.mock.calls[0]![1]).toBe(onSubmit.mock.calls[1]![1])
  })

  it('FR-031: un fallo de red conserva lo escrito y el borrador, y no da por guardado', async () => {
    const onSubmit = vi.fn<(payload: FoodPayload, requestId: string) => Promise<string>>()
    onSubmit.mockRejectedValue(new WriteError(true, es.errors.offline))
    const { onSaved } = renderForm({}, onSubmit)
    onSubmit.mockRejectedValue(new WriteError(true, es.errors.offline))
    await userEvent.type(label('Nombre'), 'Mi galletita')
    await userEvent.type(label('Energía (kcal)'), '450')
    await userEvent.click(save())

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(label('Nombre')).toHaveValue('Mi galletita')
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByText(es.foods.form.saved)).toBeNull()
    expect(localStorage.getItem(draftKey('u1', 'food-new'))).toContain('Mi galletita')
  })

  it('FR-031: recupera un borrador y permite descartarlo', async () => {
    localStorage.setItem(
      draftKey('u1', 'food-new'),
      JSON.stringify({
        savedAt: Date.now(),
        values: { ...emptyFoodForm(), name: 'Borrador', energy_kcal: '99' },
      }),
    )
    renderForm()
    expect(label('Nombre')).toHaveValue('Borrador')
    expect(screen.getByText(es.foods.form.draftRestored)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.foods.form.draftDiscard }))
    expect(label('Nombre')).toHaveValue('')
    expect(localStorage.getItem(draftKey('u1', 'food-new'))).toBeNull()
  })

  it('al guardar con éxito elimina el borrador', async () => {
    renderForm()
    await userEvent.type(label('Nombre'), 'Pan')
    await userEvent.type(label('Energía (kcal)'), '250')
    expect(localStorage.getItem(draftKey('u1', 'food-new'))).not.toBeNull()
    await userEvent.click(save())
    await waitFor(() => expect(localStorage.getItem(draftKey('u1', 'food-new'))).toBeNull())
  })
})

describe('FoodCreatePage', () => {
  const signedIn: AuthState = {
    status: 'signedIn',
    session: { access_token: 'jwt', user: { id: 'u1' } } as never,
    expired: false,
    signOut: async () => {},
  }

  beforeEach(() => {
    mockedCreate.mockReset().mockResolvedValue('new-id')
  })

  function renderPage(entry = '/alimentos/nuevo') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <AuthContext.Provider value={signedIn}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/alimentos/nuevo" element={<FoodCreatePage />} />
              <Route path="/alimentos/:id" element={<h1>Detalle guardado</h1>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>,
    )
  }

  it('precarga el nombre desde ?nombre= (lo que se buscó)', () => {
    renderPage('/alimentos/nuevo?nombre=quinoa%20real')
    expect(label('Nombre')).toHaveValue('quinoa real')
  })

  it('al guardar crea el alimento con su request_id y lleva al detalle', async () => {
    renderPage()
    await userEvent.type(label('Nombre'), 'Mi pan')
    await userEvent.type(label('Energía (kcal)'), '250')
    await userEvent.click(screen.getByRole('button', { name: es.foods.actions.save }))

    expect(await screen.findByRole('heading', { name: 'Detalle guardado' })).toBeVisible()
    expect(mockedCreate).toHaveBeenCalledTimes(1)
    const [payload, requestId] = mockedCreate.mock.calls[0]!
    expect(payload.name).toBe('Mi pan')
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('muestra el título de la pantalla', () => {
    renderPage()
    expect(
      within(document.body).getByRole('heading', { level: 1, name: es.foods.form.createTitle }),
    ).toBeVisible()
  })
})
