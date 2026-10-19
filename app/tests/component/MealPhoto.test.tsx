// T060 (spec 003, FR-030 a FR-035): la foto opcional de una comida.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { deletePhoto, photoUrl, uploadPhoto, type MealPhotoRow } from '../../src/features/meals/api'
import { MealPhoto } from '../../src/features/meals/MealPhoto'
import { PhotoError, PhotoRequestError, preparePhoto } from '../../src/features/meals/photo'

vi.mock('../../src/features/meals/api', () => ({
  uploadPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  photoUrl: vi.fn(),
}))
vi.mock('../../src/features/meals/photo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/meals/photo')>()),
  preparePhoto: vi.fn(),
}))

const mockedUpload = vi.mocked(uploadPhoto)
const mockedDelete = vi.mocked(deletePhoto)
const mockedUrl = vi.mocked(photoUrl)
const mockedPrepare = vi.mocked(preparePhoto)

const row: MealPhotoRow = {
  id: 'p1',
  log_date: '2026-10-19',
  meal: 'lunch',
  storage_path: 'u1/foto.jpg',
  width: 1600,
  height: 1200,
  bytes: 200000,
}

const picture = new File(['x'], 'plato.jpg', { type: 'image/jpeg' })

function renderPhoto(photo?: MealPhotoRow) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const view = render(
    <QueryClientProvider client={client}>
      <MealPhoto date="2026-10-19" meal="lunch" photo={photo} />
    </QueryClientProvider>,
  )
  return { ...view, invalidate }
}

beforeEach(() => {
  mockedUpload.mockReset().mockResolvedValue(undefined)
  mockedDelete.mockReset().mockResolvedValue(undefined)
  mockedUrl.mockReset().mockResolvedValue('http://localhost/firmada-1')
  mockedPrepare.mockReset().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sin foto', () => {
  it('ofrece agregarla y dice que es privada y sin datos ocultos', () => {
    renderPhoto()
    expect(screen.getByLabelText(es.meals.photo.add)).toBeInTheDocument()
    expect(screen.getByText(es.meals.photo.privacy)).toBeVisible()
  })

  it('reduce la foto, la sube y avisa con una barra de progreso mientras tanto', async () => {
    let finish: () => void = () => {}
    mockedUpload.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    const { invalidate } = renderPhoto()

    await user.upload(screen.getByLabelText(es.meals.photo.add), picture)
    expect(mockedPrepare).toHaveBeenCalledWith(picture)
    expect(await screen.findByText(es.meals.photo.sending)).toBeVisible()
    expect(screen.getByRole('progressbar', { name: es.meals.photo.sending })).toBeInTheDocument()
    expect(mockedUpload).toHaveBeenCalledWith('2026-10-19', 'lunch', expect.any(Blob))

    await act(async () => finish())
    expect(await screen.findByText(es.meals.photo.uploaded)).toBeVisible()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['meals', 'photos', '2026-10-19'] })
  })

  it('un archivo que no es imagen se rechaza con un mensaje claro y no sube nada', async () => {
    mockedPrepare.mockRejectedValue(new PhotoError('not_image'))
    const user = userEvent.setup({ applyAccept: false })
    renderPhoto()
    await user.upload(
      screen.getByLabelText(es.meals.photo.add),
      new File(['x'], 'notas.txt', { type: 'text/plain' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(es.meals.photo.errors.notImage)
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  it('un HEIC que el navegador no lee da el mensaje acordado', async () => {
    mockedPrepare.mockRejectedValue(new PhotoError('heic'))
    const user = userEvent.setup()
    renderPhoto()
    await user.upload(screen.getByLabelText(es.meals.photo.add), picture)
    expect(await screen.findByRole('alert')).toHaveTextContent(es.meals.photo.errors.heic)
  })

  it('los rechazos del servidor se explican y no afectan nada más', async () => {
    mockedUpload.mockRejectedValue(new PhotoRequestError('rate_limited'))
    const user = userEvent.setup()
    renderPhoto()
    await user.upload(screen.getByLabelText(es.meals.photo.add), picture)
    expect(await screen.findByRole('alert')).toHaveTextContent(es.meals.photo.errors.rateLimited)
    expect(screen.queryByText(es.meals.photo.uploaded)).not.toBeInTheDocument()
  })

  it('un corte de red no da la foto por guardada', async () => {
    mockedUpload.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    renderPhoto()
    await user.upload(screen.getByLabelText(es.meals.photo.add), picture)
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(screen.queryByText(es.meals.photo.uploaded)).not.toBeInTheDocument()
  })

  it('sin conexión no se procesa ni se sube nada', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    const user = userEvent.setup()
    renderPhoto()
    await user.upload(screen.getByLabelText(es.meals.photo.add), picture)
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.offline)
    expect(mockedPrepare).not.toHaveBeenCalled()
    expect(mockedUpload).not.toHaveBeenCalled()
  })
})

describe('con foto', () => {
  it('muestra la miniatura con texto alternativo y se puede ver más grande', async () => {
    const user = userEvent.setup()
    renderPhoto(row)
    const image = await screen.findByRole('img', {
      name: es.meals.photo.alt('Almuerzo', 'lunes 19 de octubre'),
    })
    expect(image).toHaveAttribute('src', 'http://localhost/firmada-1')
    expect(mockedUrl).toHaveBeenCalledWith('u1/foto.jpg')

    const enlarge = screen.getByRole('button', { name: es.meals.photo.enlarge })
    expect(enlarge).toHaveAttribute('aria-expanded', 'false')
    await user.click(enlarge)
    expect(screen.getByRole('button', { name: es.meals.photo.shrink })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('reemplazar sube la nueva con la misma comida y día', async () => {
    const user = userEvent.setup()
    renderPhoto(row)
    await screen.findByRole('img')
    await user.upload(screen.getByLabelText(es.meals.photo.replace), picture)
    await waitFor(() =>
      expect(mockedUpload).toHaveBeenCalledWith('2026-10-19', 'lunch', expect.any(Blob)),
    )
  })

  it('eliminar pide confirmación y cancelar no borra nada', async () => {
    const user = userEvent.setup()
    renderPhoto(row)
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: es.meals.photo.remove }))
    const dialog = await screen.findByRole('dialog', { name: es.meals.photo.deleteTitle })
    await user.click(within(dialog).getByRole('button', { name: es.meals.photo.cancel }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('confirmar elimina la foto', async () => {
    const user = userEvent.setup()
    const { invalidate } = renderPhoto(row)
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: es.meals.photo.remove }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: es.meals.photo.confirmDelete }))
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('2026-10-19', 'lunch'))
    expect(await screen.findByText(es.meals.photo.removed)).toBeVisible()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['meals', 'photos', '2026-10-19'] })
  })

  it('si falla la eliminación el diálogo sigue abierto con el aviso', async () => {
    mockedDelete.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    renderPhoto(row)
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: es.meals.photo.remove }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: es.meals.photo.confirmDelete }))
    expect(await within(dialog).findByRole('alert')).toBeVisible()
  })

  it('si la imagen no se puede mostrar lo dice y permite reintentar', async () => {
    mockedUrl.mockRejectedValue(new Error('sin URL'))
    renderPhoto(row)
    expect(await screen.findByText(es.meals.photo.imageError)).toBeVisible()
    expect(screen.getByRole('button', { name: es.meals.photo.retry })).toBeInTheDocument()
  })

  it('la URL firmada se renueva antes de vencer (10 minutos)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    renderPhoto(row)
    await vi.waitFor(() => expect(mockedUrl).toHaveBeenCalledTimes(1))
    mockedUrl.mockResolvedValue('http://localhost/firmada-2')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9 * 60 * 1000 + 100)
    })
    await vi.waitFor(() => expect(mockedUrl.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(await screen.findByRole('img')).toHaveAttribute('src', 'http://localhost/firmada-2')
  })
})
