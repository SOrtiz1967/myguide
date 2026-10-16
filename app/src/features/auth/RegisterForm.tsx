import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { CheckboxField } from '../../components/CheckboxField'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { PRIVACY_NOTICE_POINTS } from '../../copy/privacy-notice'
import { toUserMessage } from '../../lib/errors'
import { registerAccount } from './api'
import { toAuthFlowError } from './errors'
import { registerSchema, type RegisterValues } from './schemas'
import { TurnstileWidget } from './TurnstileWidget'

interface RegisterFormProps {
  onRegistered: (result: { verificationEmailSent: boolean }) => void
}

export function RegisterForm({ onRegistered }: RegisterFormProps) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', acceptPrivacy: false },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    if (!token) {
      setError(es.errors.captchaRejected)
      return
    }
    try {
      const result = await registerAccount({
        email: values.email,
        password: values.password,
        turnstileToken: token,
      })
      onRegistered(result)
    } catch (e) {
      setToken('') // un token de Turnstile sirve una sola vez
      setError(toUserMessage(await toAuthFlowError(e, 'register')))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <section
        aria-labelledby="aviso-privacidad"
        className="rounded-lg border border-line bg-surface p-4"
      >
        <h2 id="aviso-privacidad" className="text-lg font-semibold">
          {es.auth.titles.privacyNotice}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {PRIVACY_NOTICE_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <Field
        label={es.auth.labels.email}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        label={es.auth.labels.password}
        type="password"
        autoComplete="new-password"
        hint={es.auth.passwordHint}
        error={errors.password?.message}
        {...register('password')}
      />
      <CheckboxField
        label={es.auth.labels.privacyAccept}
        error={errors.acceptPrivacy?.message}
        {...register('acceptPrivacy')}
      />

      <TurnstileWidget onToken={setToken} onError={() => setError(es.errors.captchaUnavailable)} />

      {error ? <ErrorState message={error} /> : null}

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {es.auth.actions.register}
      </button>
    </form>
  )
}
