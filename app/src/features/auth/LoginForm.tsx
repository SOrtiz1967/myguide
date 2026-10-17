import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { toUserMessage } from '../../lib/errors'
import { signIn } from './api'
import { toAuthFlowError } from './errors'
import { loginSchema, type LoginValues } from './schemas'

/** Inicio de sesión. NO usa captcha: no depende de ningún servicio externo (FR-008, FR-025). */
export function LoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      await signIn(values.email, values.password)
      onSignedIn()
    } catch (e) {
      setError(toUserMessage(await toAuthFlowError(e, 'login')))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      {error ? <ErrorState message={error} /> : null}

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {es.auth.actions.login}
      </button>

      <p className="flex flex-col gap-1 text-sm">
        <Link to="/recuperar" className="underline">
          {es.auth.forgotPassword}
        </Link>
        <span>
          {es.auth.noAccount}{' '}
          <Link to="/registro" className="underline">
            {es.auth.actions.register}
          </Link>
        </span>
      </p>
    </form>
  )
}
