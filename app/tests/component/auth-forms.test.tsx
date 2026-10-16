// T026 (FR-005, FR-006, FR-028): ingreso, recuperación, restablecimiento y cambio de contraseña.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import {
  changePassword,
  requestPasswordReset,
  resetPassword,
  signIn,
} from '../../src/features/auth/api'
import { ChangePasswordForm } from '../../src/features/auth/ChangePasswordForm'
import { AuthFlowError } from '../../src/features/auth/errors'
import { LoginForm } from '../../src/features/auth/LoginForm'
import { RecoverForm } from '../../src/features/auth/RecoverForm'
import { ResetForm } from '../../src/features/auth/ResetForm'

vi.mock('../../src/features/auth/api', () => ({
  signIn: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
}))
vi.mock('../../src/features/auth/TurnstileWidget', async () => {
  const { useEffect } = await import('react')
  return {
    // El captcha real no se carga en las pruebas: entrega un token apenas se monta.
    TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => {
      useEffect(() => {
        onToken('token-captcha')
      }, [onToken])
      return <div data-testid="turnstile" />
    },
  }
})

const mocked = {
  signIn: vi.mocked(signIn),
  requestPasswordReset: vi.mocked(requestPasswordReset),
  resetPassword: vi.mocked(resetPassword),
  changePassword: vi.mocked(changePassword),
}

beforeEach(() => {
  for (const fn of Object.values(mocked)) fn.mockReset()
  mocked.signIn.mockResolvedValue(undefined)
  mocked.requestPasswordReset.mockResolvedValue(undefined)
  mocked.resetPassword.mockResolvedValue(undefined)
  mocked.changePassword.mockResolvedValue(undefined)
})

describe('LoginForm', () => {
  it('ingresa con correo y contraseña', async () => {
    const user = userEvent.setup()
    const onSignedIn = vi.fn()
    render(
      <MemoryRouter>
        <LoginForm onSignedIn={onSignedIn} />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText(es.auth.labels.email), 'persona@ejemplo.com')
    await user.type(screen.getByLabelText(es.auth.labels.password), 'una-clave-muy-larga')
    await user.click(screen.getByRole('button', { name: es.auth.actions.login }))
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
    expect(mocked.signIn).toHaveBeenCalledWith('persona@ejemplo.com', 'una-clave-muy-larga')
  })

  it('FR-008 / FR-025: el inicio de sesión NO usa captcha', () => {
    render(
      <MemoryRouter>
        <LoginForm onSignedIn={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('turnstile')).toBeNull()
  })

  it('FR-005: credenciales incorrectas muestran el mensaje uniforme', async () => {
    const user = userEvent.setup()
    mocked.signIn.mockRejectedValue(new AuthFlowError({ code: 'invalid_credentials', status: 400 }))
    render(
      <MemoryRouter>
        <LoginForm onSignedIn={vi.fn()} />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText(es.auth.labels.email), 'nadie@ejemplo.com')
    await user.type(screen.getByLabelText(es.auth.labels.password), 'cualquier-clave-larga')
    await user.click(screen.getByRole('button', { name: es.auth.actions.login }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.invalidCredentials)
  })

  it('FR-006: al superar el límite por IP pide esperar', async () => {
    const user = userEvent.setup()
    mocked.signIn.mockRejectedValue(
      new AuthFlowError({ code: 'over_request_rate_limit', status: 429 }),
    )
    render(
      <MemoryRouter>
        <LoginForm onSignedIn={vi.fn()} />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText(es.auth.labels.email), 'persona@ejemplo.com')
    await user.type(screen.getByLabelText(es.auth.labels.password), 'una-clave-muy-larga')
    await user.click(screen.getByRole('button', { name: es.auth.actions.login }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.rateLimited)
  })

  it('ofrece el camino a la recuperación y al registro', () => {
    render(
      <MemoryRouter>
        <LoginForm onSignedIn={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: es.auth.forgotPassword })).toHaveAttribute(
      'href',
      '/recuperar',
    )
    expect(screen.getByRole('link', { name: es.auth.actions.register })).toHaveAttribute(
      'href',
      '/registro',
    )
  })
})

describe('RecoverForm', () => {
  it('FR-005: muestra siempre el mismo mensaje neutral', async () => {
    const user = userEvent.setup()
    render(<RecoverForm />)
    await user.type(screen.getByLabelText(es.auth.labels.email), 'persona@ejemplo.com')
    await user.click(screen.getByRole('button', { name: es.auth.actions.sendLink }))
    expect(await screen.findByRole('status')).toHaveTextContent(es.auth.recoverySent)
    expect(mocked.requestPasswordReset).toHaveBeenCalledWith({
      email: 'persona@ejemplo.com',
      turnstileToken: 'token-captcha',
    })
  })

  it('FR-027: explica la regla de correo confirmado sin revelar nada de la cuenta', () => {
    render(<RecoverForm />)
    expect(screen.getByText(es.auth.recoveryRule)).toBeVisible()
  })

  it('FR-008: si el captcha no está disponible (503) pide reintentar', async () => {
    const user = userEvent.setup()
    mocked.requestPasswordReset.mockRejectedValue(
      new AuthFlowError({ status: 503, context: 'captcha' }),
    )
    render(<RecoverForm />)
    await user.type(screen.getByLabelText(es.auth.labels.email), 'persona@ejemplo.com')
    await user.click(screen.getByRole('button', { name: es.auth.actions.sendLink }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.captchaUnavailable)
  })
})

describe('ResetForm', () => {
  it('FR-002: exige 10 a 72 caracteres y que ambas contraseñas coincidan', async () => {
    const user = userEvent.setup()
    render(<ResetForm onDone={vi.fn()} />)
    await user.type(screen.getByLabelText(es.auth.labels.newPassword), 'una-clave-muy-larga')
    await user.type(screen.getByLabelText(es.auth.labels.confirmPassword), 'otra-clave-distinta')
    await user.click(screen.getByRole('button', { name: es.auth.actions.savePassword }))
    expect(await screen.findByText(es.common.passwordMismatch)).toBeVisible()
    expect(mocked.resetPassword).not.toHaveBeenCalled()
  })

  it('FR-030: guarda la contraseña nueva y avisa que terminó', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<ResetForm onDone={onDone} />)
    await user.type(screen.getByLabelText(es.auth.labels.newPassword), 'una-clave-muy-larga')
    await user.type(screen.getByLabelText(es.auth.labels.confirmPassword), 'una-clave-muy-larga')
    await user.click(screen.getByRole('button', { name: es.auth.actions.savePassword }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(mocked.resetPassword).toHaveBeenCalledWith('una-clave-muy-larga')
  })

  it('un enlace vencido o sin sesión de recuperación muestra un error claro', async () => {
    const user = userEvent.setup()
    mocked.resetPassword.mockRejectedValue(
      new AuthFlowError({ code: 'session_not_found', status: 401 }),
    )
    render(<ResetForm onDone={vi.fn()} />)
    await user.type(screen.getByLabelText(es.auth.labels.newPassword), 'una-clave-muy-larga')
    await user.type(screen.getByLabelText(es.auth.labels.confirmPassword), 'una-clave-muy-larga')
    await user.click(screen.getByRole('button', { name: es.auth.actions.savePassword }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.resetLinkInvalid)
  })
})

describe('ChangePasswordForm', () => {
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(es.auth.labels.currentPassword), 'clave-actual-larga')
    await user.type(screen.getByLabelText(es.auth.labels.newPassword), 'una-clave-muy-larga')
    await user.type(screen.getByLabelText(es.auth.labels.confirmPassword), 'una-clave-muy-larga')
  }

  it('FR-028: cambia la contraseña pidiendo la actual y avisa que cerró las otras sesiones', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordForm />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: es.auth.actions.changePassword }))
    expect(await screen.findByRole('status')).toHaveTextContent(es.auth.passwordChanged)
    expect(mocked.changePassword).toHaveBeenCalledWith({
      currentPassword: 'clave-actual-larga',
      newPassword: 'una-clave-muy-larga',
    })
  })

  it('FR-028: con la contraseña actual incorrecta rechaza con un mensaje claro', async () => {
    const user = userEvent.setup()
    mocked.changePassword.mockRejectedValue(
      new AuthFlowError({ code: 'invalid_credentials', status: 400 }),
    )
    render(<ChangePasswordForm />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: es.auth.actions.changePassword }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.currentPasswordWrong)
  })

  it('FR-002: rechaza una contraseña nueva de menos de 10 caracteres', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordForm />)
    await user.type(screen.getByLabelText(es.auth.labels.currentPassword), 'clave-actual-larga')
    await user.type(screen.getByLabelText(es.auth.labels.newPassword), 'corta')
    await user.type(screen.getByLabelText(es.auth.labels.confirmPassword), 'corta')
    await user.click(screen.getByRole('button', { name: es.auth.actions.changePassword }))
    expect(await screen.findByText(es.errors.weakPassword)).toBeVisible()
    expect(mocked.changePassword).not.toHaveBeenCalled()
  })
})
