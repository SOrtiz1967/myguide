import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { toUserMessage } from '../../lib/errors'
import { changePassword } from './api'
import { toAuthFlowError } from './errors'
import { changePasswordSchema, type ChangePasswordValues } from './schemas'

/** Cambio de contraseña con sesión iniciada: pide la actual y cierra las demás sesiones (FR-028, FR-030). */
export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    setDone(false)
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      reset()
      setDone(true)
    } catch (e) {
      const flowError = await toAuthFlowError(e)
      setError(
        flowError.code === 'invalid_credentials'
          ? es.auth.currentPasswordWrong
          : toUserMessage(flowError),
      )
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label={es.auth.labels.currentPassword}
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
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
      {done ? <SuccessMessage>{es.auth.passwordChanged}</SuccessMessage> : null}

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {es.auth.actions.changePassword}
      </button>
    </form>
  )
}
