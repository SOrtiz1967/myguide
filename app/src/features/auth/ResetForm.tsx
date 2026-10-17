import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { toUserMessage } from '../../lib/errors'
import { resetPassword } from './api'
import { toAuthFlowError, type AuthFlowError } from './errors'
import { resetSchema, type ResetValues } from './schemas'

const INVALID_LINK_CODES = new Set([
  'session_not_found',
  'session_expired',
  'otp_expired',
  'bad_jwt',
  'no_authorization',
])

function resetErrorMessage(error: AuthFlowError): string {
  if (
    error.status === 401 ||
    error.status === 403 ||
    (error.code && INVALID_LINK_CODES.has(error.code))
  ) {
    return es.auth.resetLinkInvalid
  }
  return toUserMessage(error)
}

export function ResetForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      await resetPassword(values.newPassword)
      onDone()
    } catch (e) {
      setError(resetErrorMessage(await toAuthFlowError(e)))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label={es.auth.labels.newPassword}
        type="password"
        autoComplete="new-password"
        hint={es.auth.passwordHint}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Field
        label={es.auth.labels.confirmPassword}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {error ? <ErrorState message={error} /> : null}

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {es.auth.actions.savePassword}
      </button>
    </form>
  )
}
