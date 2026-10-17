// T038 (FR-026): recordatorio visible y reenvío del enlace mientras el correo no esté confirmado.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { resendVerification } from '../../src/features/auth/api'
import { AuthFlowError } from '../../src/features/auth/errors'
import { VerifyEmailBanner } from '../../src/features/auth/VerifyEmailBanner'
import { useProfile } from '../../src/features/profile/useProfile'

vi.mock('../../src/features/auth/api', () => ({ resendVerification: vi.fn() }))
vi.mock('../../src/features/profile/useProfile', () => ({ useProfile: vi.fn() }))

const mockedResend = vi.mocked(resendVerification)
const mockedProfile = vi.mocked(useProfile)

function profile(emailVerifiedAt: string | null) {
  mockedProfile.mockReturnValue({
    data: { email_verified_at: emailVerifiedAt },
    isLoading: false,
  } as never)
}

beforeEach(() => {
  mockedResend.mockReset().mockResolvedValue(undefined)
  mockedProfile.mockReset()
})

describe('VerifyEmailBanner', () => {
  it('FR-026: con el correo sin confirmar muestra el recordatorio y el botón de reenvío', () => {
    profile(null)
    render(<VerifyEmailBanner />)
    expect(screen.getByText(es.auth.verifyBanner)).toBeVisible()
    expect(screen.getByRole('button', { name: es.auth.actions.resend })).toBeEnabled()
  })

  it('FR-026: con el correo confirmado no muestra nada', () => {
    profile('2026-10-16T12:00:00Z')
    const { container } = render(<VerifyEmailBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mientras se carga el perfil no muestra nada (evita un parpadeo)', () => {
    mockedProfile.mockReturnValue({ data: undefined, isLoading: true } as never)
    const { container } = render(<VerifyEmailBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('FR-026: reenviar confirma que se envió el enlace', async () => {
    profile(null)
    const user = userEvent.setup()
    render(<VerifyEmailBanner />)
    await user.click(screen.getByRole('button', { name: es.auth.actions.resend }))
    expect(await screen.findByRole('status')).toHaveTextContent(es.auth.verifyResent)
    expect(mockedResend).toHaveBeenCalledOnce()
  })

  it('FR-026: pedirlo demasiado pronto explica que hay que esperar', async () => {
    profile(null)
    mockedResend.mockRejectedValue(new AuthFlowError({ code: 'too_soon', status: 429 }))
    const user = userEvent.setup()
    render(<VerifyEmailBanner />)
    await user.click(screen.getByRole('button', { name: es.auth.actions.resend }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.verifyTooSoon)
  })

  it('FR-026: al llegar al máximo diario lo explica', async () => {
    profile(null)
    mockedResend.mockRejectedValue(new AuthFlowError({ code: 'daily_limit', status: 429 }))
    const user = userEvent.setup()
    render(<VerifyEmailBanner />)
    await user.click(screen.getByRole('button', { name: es.auth.actions.resend }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.verifyDailyLimit)
  })

  it('Principio VII: si el proveedor de correo falla (502) ofrece reintentar', async () => {
    profile(null)
    mockedResend.mockRejectedValue(new AuthFlowError({ code: 'email_unavailable', status: 502 }))
    const user = userEvent.setup()
    render(<VerifyEmailBanner />)
    await user.click(screen.getByRole('button', { name: es.auth.actions.resend }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.verifyEmailNotSent)
    expect(screen.getByRole('button', { name: es.auth.actions.resend })).toBeEnabled()
  })

  it('el botón se deshabilita mientras se envía', async () => {
    profile(null)
    let release: () => void = () => {}
    mockedResend.mockReturnValue(new Promise<void>((resolve) => (release = resolve)))
    const user = userEvent.setup()
    render(<VerifyEmailBanner />)
    const button = screen.getByRole('button', { name: es.auth.actions.resend })
    await user.click(button)
    expect(button).toBeDisabled()
    release()
  })
})
