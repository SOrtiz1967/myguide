// Spec 011 (FR-001 a FR-011): «Tus datos»: resumen, descargas y eliminación de cuenta.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthContext, type AuthState } from '../../src/features/auth/authContext'
import {
  deleteAccount,
  DeleteAccountError,
  downloadPhoto,
  fetchExport,
} from '../../src/features/privacy/api'
import type { ExportData } from '../../src/features/privacy/exportData'
import { PrivacyPage } from '../../src/features/privacy/PrivacyPage'
import { saveBlob } from '../../src/lib/download'

vi.mock('../../src/features/privacy/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/privacy/api')>()),
  fetchExport: vi.fn(),
  downloadPhoto: vi.fn(),
  deleteAccount: vi.fn(),
}))
vi.mock('../../src/lib/download', () => ({ saveBlob: vi.fn() }))

const mockedExport = vi.mocked(fetchExport)
const mockedPhoto = vi.mocked(downloadPhoto)
const mockedDelete = vi.mocked(deleteAccount)
const mockedSave = vi.mocked(saveBlob)
const c = es.privacy

const DATA: ExportData = {
  format_version: 1,
  exported_at: '2026-11-01T12:00:00Z',
  account: { email: 'a@ejemplo.com' },
  tables: {
    supplements: [{ name: 'Creatina' }],
    meal_photos: [{ log_date: '2026-11-01', meal: 'lunch', storage_path: 'u/1.jpg' }],
    progress_photos: [{ taken_on: '2026-10-30', pose: 'front', storage_path: 'u/2.jpg' }],
  },
}

const signOut = vi.fn(async () => {})
const signedIn: AuthState = {
  status: 'signedIn',
  session: { access_token: 'jwt', user: { id: 'u1' } } as never,
  expired: false,
  signOut,
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{`${location.pathname} ${JSON.stringify(location.state)}`}</p>
}

function renderPage() {
  render(
    <AuthContext.Provider value={signedIn}>
      <MemoryRouter initialEntries={['/privacidad']}>
        <Routes>
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/ingresar" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  mockedExport.mockReset().mockResolvedValue(DATA)
  mockedPhoto.mockReset().mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 1]))
  mockedDelete.mockReset().mockResolvedValue()
  mockedSave.mockReset()
  signOut.mockClear()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('Resumen de privacidad', () => {
  it('lista los servicios, los plazos y que las fotos de progreso no van a la IA', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: c.title, level: 1 })).toBeInTheDocument()
    for (const item of [...c.summary.services, ...c.summary.retention]) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
    expect(screen.getByText(/Nunca recibe fotos de progreso/)).toBeInTheDocument()
    expect(screen.getAllByText(/hasta 30 días/).length).toBeGreaterThan(0)
  })

  it('los textos no culpan ni presionan', () => {
    expect(JSON.stringify(c)).not.toMatch(/\b(lamentamos|no te vayas|seguro que|culpa)\b/i)
  })
})

describe('Descargar mis datos', () => {
  it('FR-002: descarga el JSON con el nombre del día', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: c.export.data }))
    expect(await screen.findByText(c.export.dataReady)).toBeInTheDocument()
    expect(mockedSave).toHaveBeenCalledTimes(1)
    const [blob, name] = mockedSave.mock.calls[0]!
    expect(name).toBe('myguide-datos-2026-11-01.json')
    expect(JSON.parse(await (blob as Blob).text()).tables.supplements).toEqual([
      { name: 'Creatina' },
    ])
  })

  it('si falla, avisa y no entrega ningún archivo', async () => {
    mockedExport.mockRejectedValue(new Error('boom'))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: c.export.data }))
    expect(await screen.findByRole('alert')).toHaveTextContent(c.export.error)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('sin conexión no lo intenta', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: c.export.data }))
    expect(await screen.findByRole('alert')).toHaveTextContent(c.export.offline)
    expect(mockedExport).not.toHaveBeenCalled()
  })
})

describe('Descargar mis fotos', () => {
  it('FR-005: arma un ZIP con las fotos de comidas y de progreso', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: c.export.photos }))
    expect(await screen.findByText(c.export.photosReady(2))).toBeInTheDocument()
    expect(mockedPhoto).toHaveBeenCalledTimes(2)
    const [blob, name] = mockedSave.mock.calls[0]!
    expect(name).toBe('myguide-fotos-2026-11-01.zip')
    expect((blob as Blob).type).toBe('application/zip')
  })

  it('sin fotos avisa y no descarga un ZIP vacío', async () => {
    mockedExport.mockResolvedValue({ ...DATA, tables: {} })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: c.export.photos }))
    expect(await screen.findByText(c.export.noPhotos)).toBeInTheDocument()
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('si una foto falla, lo informa y el ZIP no se presenta como completo', async () => {
    mockedPhoto.mockRejectedValueOnce(new Error('falta'))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: c.export.photos }))
    expect(await screen.findByRole('alert')).toHaveTextContent(c.export.photosPartial(1, 1))
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })

  it('si ninguna se puede leer, no entrega archivo', async () => {
    mockedPhoto.mockRejectedValue(new Error('falta'))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: c.export.photos }))
    expect(await screen.findByRole('alert')).toHaveTextContent(c.export.photosError)
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('muestra el avance, se puede cancelar y un doble toque inicia una sola descarga', async () => {
    let release!: () => void
    mockedPhoto.mockImplementation(
      () => new Promise((resolve) => (release = () => resolve(new Uint8Array([1])))),
    )
    renderPage()
    await userEvent.dblClick(screen.getByRole('button', { name: c.export.photos }))
    expect(await screen.findByText(c.export.progress(0, 2))).toBeInTheDocument()
    expect(mockedExport).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: c.export.cancel }))
    release()
    expect(await screen.findByText(c.export.cancelled)).toBeInTheDocument()
    expect(mockedSave).not.toHaveBeenCalled()
  })
})

describe('Eliminar mi cuenta', () => {
  const openForm = async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: c.delete.open }))
  }
  const submit = () => screen.getByRole('button', { name: c.delete.submit })

  it('explica que es definitivo, las copias de seguridad y sugiere descargar antes', () => {
    renderPage()
    expect(screen.getByText(/definitivo/)).toBeInTheDocument()
    expect(screen.getByText(c.delete.suggestion)).toBeInTheDocument()
  })

  it('FR-007: sin contraseña o sin la frase no elimina nada', async () => {
    await openForm()
    await userEvent.click(submit())
    expect(screen.getByText(c.delete.errors.password)).toBeInTheDocument()
    expect(screen.getByText(c.delete.errors.phrase)).toBeInTheDocument()
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('con la contraseña y la frase elimina, cierra la sesión y vuelve al ingreso con un aviso', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText(c.delete.password), 'clave-correcta-1')
    await userEvent.type(
      screen.getByLabelText(c.delete.confirmLabel(c.delete.phrase)),
      '  ELIMINAR MI cuenta ',
    )
    await userEvent.click(submit())

    await waitFor(() => expect(screen.getByTestId('where')).toBeInTheDocument())
    expect(mockedDelete).toHaveBeenCalledWith('clave-correcta-1')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('where')).toHaveTextContent('/ingresar {"notice":"accountDeleted"}')
  })

  it('un doble toque elimina una sola vez', async () => {
    mockedDelete.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 30)))
    await openForm()
    await userEvent.type(screen.getByLabelText(c.delete.password), 'x')
    await userEvent.type(
      screen.getByLabelText(c.delete.confirmLabel(c.delete.phrase)),
      c.delete.phrase,
    )
    await userEvent.dblClick(submit())
    await waitFor(() => expect(signOut).toHaveBeenCalled())
    expect(mockedDelete).toHaveBeenCalledTimes(1)
  })

  it('cada fallo del servidor se explica y no cierra la sesión', async () => {
    const cases = [
      'invalid_password',
      'rate_limited',
      'storage_error',
      'delete_failed',
      'offline',
    ] as const
    await openForm()
    await userEvent.type(screen.getByLabelText(c.delete.password), 'x')
    await userEvent.type(
      screen.getByLabelText(c.delete.confirmLabel(c.delete.phrase)),
      c.delete.phrase,
    )
    for (const code of cases) {
      mockedDelete.mockRejectedValueOnce(new DeleteAccountError(code))
      await userEvent.click(submit())
      expect(await screen.findByRole('alert')).toHaveTextContent(c.delete.errors[code])
    }
    expect(signOut).not.toHaveBeenCalled()
  })

  it('«Cancelar» cierra el formulario y borra lo escrito', async () => {
    await openForm()
    await userEvent.type(screen.getByLabelText(c.delete.password), 'secreto')
    await userEvent.click(screen.getByRole('button', { name: c.delete.cancel }))
    expect(screen.queryByLabelText(c.delete.password)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: c.delete.open }))
    expect(screen.getByLabelText(c.delete.password)).toHaveValue('')
  })
})
