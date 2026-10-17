import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { toUserMessage } from '../../lib/errors'
import { requestPasswordReset } from './api'
import { toAuthFlowError } from './errors'
import { recoverSchema, type RecoverValues } from './schemas'
import { TurnstileWidget } from './TurnstileWidget'

export function RecoverForm() {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoverValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: '' },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    if (!token) {
      setError(es.errors.captchaRejected)
      return
    }
    try {
      await requestPasswordReset({ email: values.email, turnstileToken: token })
      setSent(true) // FR-005: el mismo mensaje exista o no la cuenta
    } catch (e) {
      setToken('')
      setError(toUserMessage(await toAuthFlowError(e, 'recover')))
    }
  })

  if (sent) return <SuccessMessage>{es.auth.recoverySent}</SuccessMessage>

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label={es.auth.labels.email}
        type="email"
        autoComplete="email"
        inputMode="email"
        hint={es.auth.recoveryRule}
        error={errors.email?.message}
        {...register('email')}
      />

      <TurnstileWidget onToken={setToken} onError={() => setError(es.errors.captchaUnavailable)} />

      {error ? <ErrorState message={error} /> : null}

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {es.auth.actions.sendLink}
      </button>
    </form>
  )
}
