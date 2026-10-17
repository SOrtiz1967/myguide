// T025 (FR-001, FR-002, FR-007, FR-008, FR-029): formulario de registro.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { AuthFlowError } from '../../src/features/auth/errors'
import { RegisterForm } from '../../src/features/auth/RegisterForm'
import { registerAccount } from '../../src/features/auth/api'

vi.mock('../../src/features/auth/api', () => ({ registerAccount: vi.fn() }))
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

const mockedRegister = vi.mocked(registerAccount)

async function fill(user: ReturnType<typeof userEvent.setup>, password = 'una-clave-muy-larga') {
  await user.type(screen.getByLabelText(es.auth.labels.email), 'persona@ejemplo.com')
  await user.type(screen.getByLabelText(es.auth.labels.password), password)
}

beforeEach(() => {
  mockedRegister.mockReset()
  mockedRegister.mockResolvedValue({ verificationEmailSent: true })
})

describe('RegisterForm', () => {
  it('FR-029: exige marcar el aviso de privacidad y no envía sin hacerlo', async () => {
    const user = userEvent.setup()
    render(<RegisterForm onRegistered={vi.fn()} />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: es.auth.actions.register }))
    expect(await screen.findByText(es.auth.privacyRequired)).toBeVisible()
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('FR-002: rechaza contraseñas de menos de 10 caracteres', async () => {
    const user = userEvent.setup()
    render(<RegisterForm onRegistered={vi.fn()} />)
    await fill(user, 'corta')
    await user.click(screen.getByLabelText(es.auth.labels.privacyAccept))
    await user.click(screen.getByRole('button', { name: es.auth.actions.register }))
    expect(await screen.findByText(es.errors.weakPassword)).toBeVisible()
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('FR-002: valida el formato del correo', async () => {
    const user = userEvent.setup()
    render(<RegisterForm onRegistered={vi.fn()} />)
    await user.type(screen.getByLabelText(es.auth.labels.email), 'no-es-correo')
    await user.type(screen.getByLabelText(es.auth.labels.password), 'una-clave-muy-larga')
    await user.click(screen.getByLabelText(es.auth.labels.privacyAccept))
    await user.click(screen.getByRole('button', { name: es.auth.actions.register }))
    expect(await screen.findByText(es.common.emailInvalid)).toBeVisible()
  })

  it('FR-001 / FR-008: con datos válidos envía correo, contraseña y el token del captcha', async () => {
    const user = userEvent.setup()
    const onRegistered = vi.fn()
    render(<RegisterForm onRegistered={onRegistered} />)
    await fill(user)
    await user.click(screen.getByLabelText(es.auth.labels.privacyAccept))
    await user.click(screen.getByRole('button', { name: es.auth.actions.register }))
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith({ verificationEmailSent: true }))
    expect(mockedRegister).toHaveBeenCalledWith({
      email: 'persona@ejemplo.com',
      password: 'una-clave-muy-larga',
      turnstileToken: 'token-captcha',
    })
  })

  it('FR-007: el botón se deshabilita mientras se envía, así un doble clic no duplica el alta', async () => {
    const user = userEvent.setup()
    let release: (v: { verificationEmailSent: boolean }) => void = () => {}
    mockedRegister.mockReturnValue(new Promise((resolve) => (release = resolve)))
    render(<RegisterForm onRegistered={vi.fn()} />)
    await fill(user)
    await user.click(screen.getByLabelText(es.auth.labels.privacyAccept))
    const button = screen.getByRole('button', { name: es.auth.actions.register })
    await user.click(button)
    await user.click(button)
    expect(button).toBeDisabled()
    expect(mockedRegister).toHaveBeenCalledTimes(1)
    release({ verificationEmailSent: true })
  })

  it('decisión del autor: un correo repetido (409) muestra el mensaje claro', async () => {
    const user = userEvent.setup()
    mockedRegister.mockRejectedValue(new AuthFlowError({ status: 409, context: 'register' }))
    render(<RegisterForm onRegistered={vi.fn()} />)
    await fill(user)
    await user.click(screen.getByLabelText(es.auth.labels.privacyAccept))
    await user.click(screen.getByRole('button', { name: es.auth.actions.register }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.accountExists)
  })

  it('FR-008: si el captcha no está disponible (503) pide reintentar más tarde', async () => {
    const user = userEvent.setup()
    mockedRegister.mockRejectedValue(new AuthFlowError({ status: 503, context: 'captcha' }))
    render(<RegisterForm onRegistered={vi.fn()} />)
    await fill(user)
    await user.click(screen.getByLabelText(es.auth.labels.privacyAccept))
    await user.click(screen.getByRole('button', { name: es.auth.actions.register }))
    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.captchaUnavailable)
  })

  it('FR-026: avisa a la pantalla siguiente si el correo de confirmación no pudo enviarse', async () => {
    const user = userEvent.setup()
    mockedRegister.mockResolvedValue({ verificationEmailSent: false })
    const onRegistered = vi.fn()
    render(<RegisterForm onRegistered={onRegistered} />)
    await fill(user)
    await user.click(screen.getByLabelText(es.auth.labels.privacyAccept))
    await user.click(screen.getByRole('button', { name: es.auth.actions.register }))
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith({ verificationEmailSent: false }))
  })

  it('FR-029: muestra el aviso de privacidad antes de crear la cuenta', () => {
    render(<RegisterForm onRegistered={vi.fn()} />)
    expect(screen.getByRole('heading', { name: es.auth.titles.privacyNotice })).toBeVisible()
  })

  it('FR-024: cada campo tiene su etiqueta accesible', () => {
    render(<RegisterForm onRegistered={vi.fn()} />)
    expect(screen.getByLabelText(es.auth.labels.email)).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText(es.auth.labels.password)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(es.auth.labels.password)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })
})
