// Spec 019: fotos de progreso (FR-002, FR-007 a FR-013, FR-015, FR-020).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  deleteProgressPhoto,
  fetchProgressPhotos,
  progressPhotoUrls,
  updateProgressPhoto,
  uploadProgressPhoto,
  type ProgressPhoto,
} from '../../src/features/progress-photos/api'
import { ProgressPhotosPage } from '../../src/features/progress-photos/ProgressPhotosPage'
import { preparePhoto } from '../../src/features/meals/photo'

vi.mock('../../src/features/progress-photos/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/progress-photos/api')>()),
  fetchProgressPhotos: vi.fn(),
  progressPhotoUrls: vi.fn(),
  uploadProgressPhoto: vi.fn(),
  updateProgressPhoto: vi.fn(),
  deleteProgressPhoto: vi.fn(),
}))
vi.mock('../../src/features/meals/photo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/meals/photo')>()),
  preparePhoto: vi.fn(),
}))
vi.mock('../../src/features/meals/useToday', () => ({ useToday: () => '2026-10-30' }))

const c = es.progressPhotos

const photo = (over: Partial<ProgressPhoto> = {}): ProgressPhoto => ({
  id: 'p1',
  taken_on: '2026-10-01',
  pose: 'front',
  storage_path: 'u1/uno.jpg',
  width: 900,
  height: 1200,
  bytes: 200000,
  created_at: '2026-10-01T10:00:00Z',
  ...over,
})

const OLD = photo({ id: 'old', taken_on: '2026-09-01', pose: 'front', storage_path: 'u1/old.jpg' })
const MID = photo({ id: 'mid', taken_on: '2026-10-01', pose: 'front', storage_path: 'u1/mid.jpg' })
const NEW = photo({ id: 'new', taken_on: '2026-10-29', pose: 'side', storage_path: 'u1/new.jpg' })
// De la más reciente a la más antigua, como las entrega la consulta.
const LIST = [NEW, MID, OLD]

function renderPage(path = '/fotos') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ProgressPhotosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(fetchProgressPhotos).mockReset().mockResolvedValue(LIST)
  vi.mocked(progressPhotoUrls)
    .mockReset()
    .mockImplementation((paths) =>
      Promise.resolve(Object.fromEntries(paths.map((p) => [p, `http://localhost/firmada/${p}`]))),
    )
  vi.mocked(uploadProgressPhoto).mockReset().mockResolvedValue(undefined)
  vi.mocked(updateProgressPhoto).mockReset().mockResolvedValue(undefined)
  vi.mocked(deleteProgressPhoto).mockReset().mockResolvedValue(undefined)
  vi.mocked(preparePhoto)
    .mockReset()
    .mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

describe('lista', () => {
  it('sin fotos muestra un estado vacío sin presión', async () => {
    vi.mocked(fetchProgressPhotos).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(c.list.emptyTitle)).toBeVisible()
    expect(screen.getByText(c.list.emptyBody)).toBeVisible()
  })

  it('las agrupa por fecha, de la más reciente a la más antigua', async () => {
    renderPage()
    await screen.findByText(c.list.count(3))
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual([
      'jueves 29 de octubre',
      'jueves 1 de octubre',
      'martes 1 de septiembre',
    ])
    expect(
      screen.getByRole('button', { name: /Abrir la foto del jueves 29 de octubre, perfil/ }),
    ).toBeVisible()
  })

  it('cada foto tiene un texto alternativo con fecha y pose, sin juicio sobre el cuerpo', async () => {
    renderPage()
    const image = await screen.findByAltText(/Foto de progreso del jueves 29 de octubre, perfil/)
    expect(image).toHaveAttribute('src', 'http://localhost/firmada/u1/new.jpg')
  })

  it('si no cargan las muestra con un error y deja reintentar', async () => {
    vi.mocked(fetchProgressPhotos).mockRejectedValueOnce(new Error('x'))
    renderPage()
    expect(await screen.findByText(c.list.loadError)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.common.retry }))
    expect(await screen.findByText(c.list.count(3))).toBeVisible()
  })

  it('si falla el enlace de una imagen lo dice en texto', async () => {
    vi.mocked(progressPhotoUrls).mockRejectedValue(new Error('x'))
    renderPage()
    await screen.findByText(c.list.count(3))
    expect((await screen.findAllByText(c.list.imageError)).length).toBe(3)
  })
})

describe('subir', () => {
  const picture = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })

  it('reduce la foto y la sube con la fecha de hoy y la pose elegida', async () => {
    renderPage()
    await screen.findByText(c.list.count(3))
    await userEvent.upload(screen.getByLabelText(c.upload.file), picture)
    await userEvent.selectOptions(screen.getByLabelText(c.upload.pose), 'back')
    await userEvent.click(screen.getByRole('button', { name: c.upload.submit }))
    await waitFor(() => expect(uploadProgressPhoto).toHaveBeenCalledTimes(1))
    expect(preparePhoto).toHaveBeenCalledWith(picture)
    expect(uploadProgressPhoto).toHaveBeenCalledWith('2026-10-30', 'back', expect.any(Blob))
    expect(await screen.findByText(c.upload.saved)).toBeVisible()
  })

  it('la pose es opcional', async () => {
    renderPage()
    await screen.findByText(c.list.count(3))
    await userEvent.upload(screen.getByLabelText(c.upload.file), picture)
    await userEvent.click(screen.getByRole('button', { name: c.upload.submit }))
    await waitFor(() =>
      expect(uploadProgressPhoto).toHaveBeenCalledWith('2026-10-30', null, expect.any(Blob)),
    )
  })

  it('sin elegir una foto avisa y no sube nada', async () => {
    renderPage()
    await screen.findByText(c.list.count(3))
    await userEvent.click(screen.getByRole('button', { name: c.upload.submit }))
    expect(await screen.findByText(c.upload.chooseFile)).toBeVisible()
    expect(uploadProgressPhoto).not.toHaveBeenCalled()
  })

  it('un doble toque no la sube dos veces', async () => {
    let finish: () => void = () => {}
    vi.mocked(uploadProgressPhoto).mockReturnValue(
      new Promise<void>((resolve) => (finish = resolve)),
    )
    renderPage()
    await screen.findByText(c.list.count(3))
    await userEvent.upload(screen.getByLabelText(c.upload.file), picture)
    const submit = screen.getByRole('button', { name: c.upload.submit })
    await userEvent.dblClick(submit)
    await waitFor(() => expect(uploadProgressPhoto).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: c.upload.sending })).toBeDisabled()
    finish()
    expect(await screen.findByText(c.upload.saved)).toBeVisible()
    expect(uploadProgressPhoto).toHaveBeenCalledTimes(1)
  })

  it('sin conexión avisa y no da la foto por guardada', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    renderPage()
    await screen.findByText(c.list.count(3))
    await userEvent.upload(screen.getByLabelText(c.upload.file), picture)
    await userEvent.click(screen.getByRole('button', { name: c.upload.submit }))
    expect(await screen.findByText(es.errors.offline)).toBeVisible()
    expect(uploadProgressPhoto).not.toHaveBeenCalled()
    expect(screen.queryByText(c.upload.saved)).not.toBeInTheDocument()
  })

  it('un archivo que no se puede leer se explica y no se sube', async () => {
    const { PhotoError } = await import('../../src/features/meals/photo')
    vi.mocked(preparePhoto).mockRejectedValue(new PhotoError('heic'))
    renderPage()
    await screen.findByText(c.list.count(3))
    await userEvent.upload(screen.getByLabelText(c.upload.file), picture)
    await userEvent.click(screen.getByRole('button', { name: c.upload.submit }))
    expect(await screen.findByText(c.errors.heic)).toBeVisible()
    expect(uploadProgressPhoto).not.toHaveBeenCalled()
  })

  it('con 200 fotos avisa en texto neutral y no ofrece subir', async () => {
    vi.mocked(fetchProgressPhotos).mockResolvedValue(
      Array.from({ length: 200 }, (_, i) =>
        photo({ id: `f${i}`, storage_path: `u1/${i}.jpg`, taken_on: '2026-10-01' }),
      ),
    )
    renderPage()
    expect(await screen.findByText(c.upload.limitReached)).toBeVisible()
    expect(screen.queryByRole('button', { name: c.upload.submit })).not.toBeInTheDocument()
  })

  it('la privacidad se dice en la pantalla: privada, sin datos ocultos y sin IA', async () => {
    renderPage()
    await screen.findByText(c.list.count(3))
    expect(screen.getByText(c.privacy)).toBeVisible()
    expect(c.privacy).toMatch(/inteligencia artificial/)
  })
})

describe('abrir, corregir y eliminar', () => {
  async function open(name: RegExp) {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name }))
    return await screen.findByRole('region', { name: /Foto abierta/ })
  }

  it('abre la foto en grande con su fecha y su pose', async () => {
    const viewer = await open(/Abrir la foto del jueves 1 de octubre/)
    expect(within(viewer).getByRole('heading', { level: 2 })).toHaveTextContent(
      'jueves 1 de octubre, frente',
    )
  })

  it('corrige la fecha y la pose sin volver a subir el archivo', async () => {
    const viewer = await open(/Abrir la foto del jueves 1 de octubre/)
    const date = within(viewer).getByLabelText(c.upload.date)
    await userEvent.clear(date)
    await userEvent.type(date, '2026-10-02')
    await userEvent.selectOptions(within(viewer).getByLabelText(c.upload.pose), 'side')
    await userEvent.click(within(viewer).getByRole('button', { name: c.viewer.save }))
    await waitFor(() =>
      expect(updateProgressPhoto).toHaveBeenCalledWith('mid', '2026-10-02', 'side'),
    )
    expect(await within(viewer).findByText(c.viewer.saved)).toBeVisible()
    expect(uploadProgressPhoto).not.toHaveBeenCalled()
  })

  it('sin cambios no llama al servidor', async () => {
    const viewer = await open(/Abrir la foto del jueves 1 de octubre/)
    await userEvent.click(within(viewer).getByRole('button', { name: c.viewer.save }))
    expect(await within(viewer).findByText(c.viewer.noChanges)).toBeVisible()
    expect(updateProgressPhoto).not.toHaveBeenCalled()
  })

  it('una fecha posterior a hoy se rechaza antes de llamar al servidor', async () => {
    const viewer = await open(/Abrir la foto del jueves 1 de octubre/)
    const date = within(viewer).getByLabelText(c.upload.date)
    await userEvent.clear(date)
    await userEvent.type(date, '2026-11-15')
    await userEvent.click(within(viewer).getByRole('button', { name: c.viewer.save }))
    expect(await within(viewer).findByText(c.upload.dateInvalid)).toBeVisible()
    expect(updateProgressPhoto).not.toHaveBeenCalled()
  })

  it('eliminar pide confirmación y, sin ella, no elimina nada', async () => {
    const viewer = await open(/Abrir la foto del jueves 1 de octubre/)
    await userEvent.click(within(viewer).getByRole('button', { name: c.viewer.delete }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: c.viewer.cancel }))
    expect(deleteProgressPhoto).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: /Foto abierta/ })).toBeVisible()
  })

  it('confirmado, elimina la foto y cierra el visor', async () => {
    const viewer = await open(/Abrir la foto del jueves 1 de octubre/)
    await userEvent.click(within(viewer).getByRole('button', { name: c.viewer.delete }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: c.viewer.confirmDelete }))
    await waitFor(() => expect(deleteProgressPhoto).toHaveBeenCalledWith('mid'))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /Foto abierta/ })).not.toBeInTheDocument(),
    )
  })

  it('si no se pudo eliminar lo dice dentro del diálogo y no cierra', async () => {
    vi.mocked(deleteProgressPhoto).mockRejectedValue(new Error('x'))
    const viewer = await open(/Abrir la foto del jueves 1 de octubre/)
    await userEvent.click(within(viewer).getByRole('button', { name: c.viewer.delete }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: c.viewer.confirmDelete }))
    expect(await within(dialog).findByText(es.errors.generic)).toBeVisible()
  })
})

describe('comparar', () => {
  const choose = (name: RegExp) => screen.findByRole('checkbox', { name })

  it('con una sola foto elegida pide elegir otra y no arma la comparación', async () => {
    renderPage()
    await userEvent.click(await choose(/Elegir para comparar la foto del jueves 1 de octubre/))
    expect(await screen.findByText(c.compare.pickOther)).toBeVisible()
    expect(screen.queryByText(c.compare.before)).not.toBeInTheDocument()
  })

  it('con dos fotos las muestra con fecha y pose, la anterior primero, y los días que las separan', async () => {
    renderPage()
    await userEvent.click(await choose(/Elegir para comparar la foto del jueves 29 de octubre/))
    await userEvent.click(await choose(/Elegir para comparar la foto del martes 1 de septiembre/))
    const panel = await screen.findByRole('region', { name: c.compare.title })
    const captions = within(panel)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(captions[0]).toContain('Anterior: martes 1 de septiembre, frente')
    expect(captions[1]).toContain('Posterior: jueves 29 de octubre, perfil')
    expect(within(panel).getByText(c.compare.daysApart(58))).toBeVisible()
    expect(within(panel).getByText(c.compare.note)).toBeVisible()
  })

  it('con poses distintas avisa en texto neutral y no impide comparar', async () => {
    renderPage()
    await userEvent.click(await choose(/Elegir para comparar la foto del jueves 29 de octubre/))
    await userEvent.click(await choose(/Elegir para comparar la foto del jueves 1 de octubre/))
    const panel = await screen.findByRole('region', { name: c.compare.title })
    expect(within(panel).getByText(c.compare.differentPose)).toBeVisible()
    await waitFor(() => expect(within(panel).getAllByRole('img')).toHaveLength(2))
  })

  it('con la misma pose no muestra el aviso', async () => {
    renderPage()
    await userEvent.click(await choose(/Elegir para comparar la foto del jueves 1 de octubre/))
    await userEvent.click(await choose(/Elegir para comparar la foto del martes 1 de septiembre/))
    const panel = await screen.findByRole('region', { name: c.compare.title })
    expect(within(panel).queryByText(c.compare.differentPose)).not.toBeInTheDocument()
  })

  it('elegidas dos, las demás no se pueden elegir hasta quitar una', async () => {
    renderPage()
    await userEvent.click(await choose(/Elegir para comparar la foto del jueves 29 de octubre/))
    await userEvent.click(await choose(/Elegir para comparar la foto del jueves 1 de octubre/))
    expect(
      await screen.findByRole('checkbox', {
        name: /Elegir para comparar la foto del martes 1 de septiembre/,
      }),
    ).toBeDisabled()
    expect(screen.getByText(c.list.compareFull)).toBeVisible()
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /Elegir para comparar la foto del jueves 1 de octubre/,
      }),
    )
    expect(
      screen.getByRole('checkbox', {
        name: /Elegir para comparar la foto del martes 1 de septiembre/,
      }),
    ).toBeEnabled()
  })

  it('«Cerrar comparación» deja todo sin elegir', async () => {
    renderPage()
    await userEvent.click(await choose(/Elegir para comparar la foto del jueves 29 de octubre/))
    await userEvent.click(await screen.findByRole('button', { name: c.compare.clear }))
    expect(screen.queryByRole('region', { name: c.compare.title })).not.toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: /Elegir para comparar la foto del jueves 29 de octubre/,
      }),
    ).not.toBeChecked()
  })

  it('recupera la comparación desde la dirección y descarta ids que ya no existen', async () => {
    renderPage('/fotos?a=old&b=new')
    const panel = await screen.findByRole('region', { name: c.compare.title })
    await waitFor(() => expect(within(panel).getAllByRole('img')).toHaveLength(2))
  })

  it('un id que ya no existe sale solo de la comparación', async () => {
    renderPage('/fotos?a=old&b=eliminada')
    expect(await screen.findByText(c.compare.pickOther)).toBeVisible()
  })

  it('no usa lenguaje que juzgue el cuerpo en ninguna frase fija', () => {
    const fixed = JSON.stringify(c)
    expect(fixed).not.toMatch(
      /bajaste|subiste de peso|mejor|peor|logro|fallaste|gordo|flaco|músculo/i,
    )
  })
})
