// Spec 022: suplementación — lista propia, marcas del día y textos neutrales (FR-001 a FR-014).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  createSupplement,
  deleteSupplement,
  fetchMarks,
  fetchSupplements,
  setSupplementArchived,
  setSupplementTaken,
  updateSupplement,
  type Supplement,
} from '../../src/features/supplements/api'
import { DaySupplements } from '../../src/features/supplements/DaySupplements'
import { SupplementsPage } from '../../src/features/supplements/SupplementsPage'
import { WriteError } from '../../src/lib/mutation'

vi.mock('../../src/features/supplements/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/supplements/api')>()),
  fetchSupplements: vi.fn(),
  fetchMarks: vi.fn(),
  createSupplement: vi.fn(),
  updateSupplement: vi.fn(),
  setSupplementArchived: vi.fn(),
  deleteSupplement: vi.fn(),
  setSupplementTaken: vi.fn(),
}))

const c = es.supplements

const supp = (
  id: string,
  name: string,
  dose: string | null = null,
  archived = false,
): Supplement => ({
  id,
  name,
  dose,
  archived_at: archived ? '2026-10-20T00:00:00Z' : null,
})

const CREATINE = supp('s1', 'Creatina', '5 g')
const VITD = supp('s2', 'Vitamina D')
const OLD = supp('s3', 'Omega 3', null, true)

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(fetchSupplements).mockReset().mockResolvedValue([CREATINE, VITD, OLD])
  vi.mocked(fetchMarks).mockReset().mockResolvedValue([])
  vi.mocked(createSupplement).mockReset().mockResolvedValue(CREATINE)
  vi.mocked(updateSupplement).mockReset().mockResolvedValue(CREATINE)
  vi.mocked(setSupplementArchived).mockReset().mockResolvedValue(CREATINE)
  vi.mocked(deleteSupplement).mockReset().mockResolvedValue(undefined)
  vi.mocked(setSupplementTaken).mockReset().mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

describe('pantalla de suplementos', () => {
  it('lista los activos y deja los archivados aparte', async () => {
    renderWith(<SupplementsPage />)
    const list = await screen.findByRole('region', { name: c.listTitle })
    expect(within(list).getAllByText('Creatina')[0]).toBeVisible()
    expect(within(list).getByText(/5 g/)).toBeVisible()
    expect(within(list).getAllByText('Vitamina D')[0]).toBeVisible()
    expect(within(list).queryAllByText('Omega 3')).toHaveLength(0)
    expect(screen.getByText(c.archivedTitle(1))).toBeInTheDocument()
  })

  it('sin suplementos muestra un estado vacío sin recomendar nada', async () => {
    vi.mocked(fetchSupplements).mockResolvedValue([])
    renderWith(<SupplementsPage />)
    expect(await screen.findByText(c.emptyTitle)).toBeVisible()
    expect(screen.getByText(c.emptyBody)).toBeVisible()
  })

  it('agrega uno con nombre y dosis opcional', async () => {
    const user = userEvent.setup()
    renderWith(<SupplementsPage />)
    await user.type(await screen.findByLabelText(c.form.name), '  Magnesio ')
    await user.type(screen.getByLabelText(c.form.dose), '300 mg')
    await user.click(screen.getByRole('button', { name: c.form.add }))
    await waitFor(() =>
      expect(createSupplement).toHaveBeenCalledWith(
        { name: 'Magnesio', dose: '300 mg' },
        expect.any(String),
      ),
    )
    expect(await screen.findByText(c.added)).toBeVisible()
    expect(screen.getByLabelText(c.form.name)).toHaveValue('')
  })

  it('un nombre vacío o demasiado largo se rechaza sin llamar al servidor', async () => {
    const user = userEvent.setup()
    renderWith(<SupplementsPage />)
    await user.click(await screen.findByRole('button', { name: c.form.add }))
    expect(await screen.findByText(c.form.nameRequired)).toBeVisible()
    await user.type(screen.getByLabelText(c.form.name), 'a'.repeat(61))
    await user.click(screen.getByRole('button', { name: c.form.add }))
    expect(await screen.findByText(c.form.nameTooLong)).toBeVisible()
    expect(createSupplement).not.toHaveBeenCalled()
  })

  it('un doble toque crea uno solo', async () => {
    let finish: (value: Supplement) => void = () => {}
    vi.mocked(createSupplement).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    renderWith(<SupplementsPage />)
    await user.type(await screen.findByLabelText(c.form.name), 'Magnesio')
    await user.dblClick(screen.getByRole('button', { name: c.form.add }))
    expect(createSupplement).toHaveBeenCalledTimes(1)
    finish(CREATINE)
    expect(await screen.findByText(c.added)).toBeVisible()
  })

  it('si falla el guardado avisa, conserva lo escrito y no da nada por guardado', async () => {
    vi.mocked(createSupplement).mockRejectedValue(new WriteError(false, c.errors.name_taken))
    const user = userEvent.setup()
    renderWith(<SupplementsPage />)
    await user.type(await screen.findByLabelText(c.form.name), 'Creatina')
    await user.click(screen.getByRole('button', { name: c.form.add }))
    expect(await screen.findByText(new RegExp(c.errors.name_taken))).toBeVisible()
    expect(screen.getByLabelText(c.form.name)).toHaveValue('Creatina')
    expect(screen.queryByText(c.added)).not.toBeInTheDocument()
  })

  it('corrige el nombre y la dosis', async () => {
    const user = userEvent.setup()
    renderWith(<SupplementsPage />)
    await user.click(await screen.findByRole('button', { name: /^Corregir\s+Creatina/ }))
    const dose = screen.getByDisplayValue('5 g')
    await user.clear(dose)
    await user.type(dose, '3 g')
    await user.click(screen.getByRole('button', { name: c.form.saveChanges }))
    await waitFor(() =>
      expect(updateSupplement).toHaveBeenCalledWith('s1', { name: 'Creatina', dose: '3 g' }),
    )
    expect(await screen.findByText(c.updated)).toBeVisible()
  })

  it('archiva y restaura', async () => {
    const user = userEvent.setup()
    renderWith(<SupplementsPage />)
    await user.click(await screen.findByRole('button', { name: /^Archivar\s+Vitamina D/ }))
    await waitFor(() => expect(setSupplementArchived).toHaveBeenCalledWith('s2', true))
    expect(await screen.findByText(c.archivedDone)).toBeVisible()
    await user.click(screen.getByText(c.archivedTitle(1)))
    await user.click(screen.getByRole('button', { name: /^Restaurar\s+Omega 3/ }))
    await waitFor(() => expect(setSupplementArchived).toHaveBeenCalledWith('s3', false))
  })

  it('eliminar pide confirmación y, sin ella, no elimina nada', async () => {
    const user = userEvent.setup()
    renderWith(<SupplementsPage />)
    await user.click(await screen.findByRole('button', { name: /^Eliminar\s+Creatina/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: c.form.cancel }))
    expect(deleteSupplement).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Eliminar\s+Creatina/ }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: c.confirmDelete }),
    )
    await waitFor(() => expect(deleteSupplement).toHaveBeenCalledWith('s1'))
    expect(await screen.findByText(c.deletedDone)).toBeVisible()
  })

  it('con 30 sin archivar avisa del máximo y no ofrece agregar', async () => {
    vi.mocked(fetchSupplements).mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => supp(`x${i}`, `Suplemento ${i}`)),
    )
    renderWith(<SupplementsPage />)
    expect(await screen.findByText(c.limit)).toBeVisible()
    expect(screen.queryByRole('button', { name: c.form.add })).not.toBeInTheDocument()
  })

  it('aclara que no recomienda nada y no usa lenguaje de culpa ni de cumplimiento', async () => {
    renderWith(<SupplementsPage />)
    expect(await screen.findByText(c.note)).toBeVisible()
    expect(c.note).toMatch(/no recomienda/)
    expect(JSON.stringify(c)).not.toMatch(
      /olvidaste|incumpl|racha|cumplimiento|deberías|debes tomar|te recomendamos|efecto|mejora|beneficio/i,
    )
  })
})

describe('bloque del día', () => {
  const day = (date = '2026-10-30', today = '2026-10-30') =>
    renderWith(<DaySupplements date={date} today={today} />)

  it('cada suplemento muestra su estado en texto: «Sin registro» o «Tomado»', async () => {
    vi.mocked(fetchMarks).mockResolvedValue(['s1'])
    day()
    const creatine = await screen.findByRole('checkbox', { name: /Creatina/ })
    expect(creatine).toBeChecked()
    expect(screen.getAllByText(c.day.taken)).toHaveLength(1)
    expect(screen.getAllByText(c.day.none)).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: /Vitamina D/ })).not.toBeChecked()
  })

  it('los archivados solo aparecen si tienen marca ese día', async () => {
    day()
    await screen.findByRole('checkbox', { name: /Creatina/ })
    expect(screen.queryByRole('checkbox', { name: /Omega 3/ })).not.toBeInTheDocument()
  })

  it('un archivado con marca ese día se ve y se puede desmarcar', async () => {
    vi.mocked(fetchMarks).mockResolvedValue(['s3'])
    const user = userEvent.setup()
    day()
    const old = await screen.findByRole('checkbox', { name: /Omega 3/ })
    expect(old).toBeChecked()
    await user.click(old)
    await waitFor(() => expect(setSupplementTaken).toHaveBeenCalledWith('s3', '2026-10-30', false))
  })

  it('marcar llama al servidor con el día elegido', async () => {
    const user = userEvent.setup()
    day('2026-10-28')
    await user.click(await screen.findByRole('checkbox', { name: /Creatina/ }))
    await waitFor(() => expect(setSupplementTaken).toHaveBeenCalledWith('s1', '2026-10-28', true))
  })

  it('un día futuro se muestra sin dejar marcar', async () => {
    day('2026-11-02')
    expect(await screen.findByRole('checkbox', { name: /Creatina/ })).toBeDisabled()
    expect(screen.getByText(c.day.future)).toBeVisible()
  })

  it('si no se pudo guardar lo dice y el estado no cambia', async () => {
    vi.mocked(setSupplementTaken).mockRejectedValue(new WriteError(true, es.errors.offline))
    const user = userEvent.setup()
    day()
    const box = await screen.findByRole('checkbox', { name: /Creatina/ })
    await user.click(box)
    expect(await screen.findByText(es.errors.offline)).toBeVisible()
    expect(box).not.toBeChecked()
  })

  it('sin suplementos lo dice y enlaza a la pantalla, sin insistir', async () => {
    vi.mocked(fetchSupplements).mockResolvedValue([])
    day()
    expect(await screen.findByText(new RegExp(c.day.empty))).toBeVisible()
    expect(screen.getByRole('link', { name: c.day.manage })).toHaveAttribute('href', '/suplementos')
  })

  it('si falla la carga muestra un error con reintento', async () => {
    vi.mocked(fetchSupplements).mockRejectedValueOnce(new Error('x'))
    day()
    expect(await screen.findByText(es.home.loadError)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByRole('checkbox', { name: /Creatina/ })).toBeInTheDocument()
  })
})
