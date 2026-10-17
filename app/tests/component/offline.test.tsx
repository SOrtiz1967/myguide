// T070 (FR-019, FR-020): aviso claro cuando no hay conexión, sin funciones de registro ni consulta offline.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OfflineNotice } from '../../src/components/OfflineNotice'
import { es } from '../../src/copy/es'
import { OfflinePage } from '../../src/routes/OfflinePage'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

afterEach(() => setOnline(true))

describe('OfflineNotice', () => {
  it('con conexión no muestra nada', () => {
    const { container } = render(<OfflineNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('FR-020: al perder la conexión avisa que nada se guardará', async () => {
    render(<OfflineNotice />)
    act(() => setOnline(false))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.offline.banner)
  })

  it('al volver la conexión el aviso desaparece', async () => {
    render(<OfflineNotice />)
    act(() => setOnline(false))
    await screen.findByRole('alert')
    act(() => setOnline(true))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('si la app se abre ya sin conexión, el aviso aparece de entrada', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<OfflineNotice />)
    expect(screen.getByRole('alert')).toHaveTextContent(es.offline.banner)
  })
})

describe('OfflinePage', () => {
  it('FR-019: explica que MyGuide necesita conexión y ofrece reintentar', async () => {
    const reload = vi.fn()
    render(<OfflinePage onReload={reload} />)
    expect(screen.getByRole('heading', { level: 1, name: es.offline.pageTitle })).toBeVisible()
    expect(screen.getByText(es.offline.pageBody)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: es.offline.reload }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('FR-019: no ofrece ninguna función de registro ni de consulta', () => {
    render(<OfflinePage onReload={() => {}} />)
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
