import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { useAuth } from '../auth/useAuth'
import { deleteAccount, DeleteAccountError } from './api'

const copy = es.privacy.delete

function errorMessage(error: unknown): string {
  if (error instanceof DeleteAccountError) {
    if (error.code === 'offline') return copy.errors.offline
    if (error.code === 'http_401') return copy.errors.unauthorized
    const known = (copy.errors as Record<string, string>)[error.code]
    if (known) return known
  }
  return isNetworkError(error) ? copy.errors.offline : copy.errors.generic
}

/**
 * Eliminación de cuenta (spec 011, FR-007 a FR-011): pide la contraseña y una frase escrita. Es definitiva, así que el
 * texto lo dice claro y sin presionar a quedarse. Al terminar se cierra la sesión y se vuelve al ingreso.
 */
export function DeleteAccountSection() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [phrase, setPhrase] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; phrase?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const errors: typeof fieldErrors = {}
    if (password === '') errors.password = copy.errors.password
    if (phrase.trim().toLowerCase() !== copy.phrase) errors.phrase = copy.errors.phrase
    setFieldErrors(errors)
    setError(null)
    if (errors.password || errors.phrase) return

    setBusy(true)
    try {
      await deleteAccount(password)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
      return
    }
    // La cuenta ya no existe: se limpia lo local y se vuelve al ingreso.
    try {
      await signOut()
    } finally {
      void navigate('/ingresar', { replace: true, state: { notice: 'accountDeleted' } })
    }
  }

  return (
    <section aria-labelledby="eliminar-titulo" className="card flex flex-col gap-4">
      <div>
        <h2 id="eliminar-titulo" className="text-base font-bold">
          {copy.title}
        </h2>
        <p className="text-sm text-muted">{copy.intro}</p>
        <p className="text-sm text-muted">{copy.suggestion}</p>
      </div>

      {open ? (
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <Field
            label={copy.password}
            type="password"
            autoComplete="current-password"
            aria-required="true"
            value={password}
            error={fieldErrors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Field
            label={copy.confirmLabel(copy.phrase)}
            autoComplete="off"
            aria-required="true"
            value={phrase}
            error={fieldErrors.phrase}
            onChange={(event) => setPhrase(event.target.value)}
          />
          {error ? <ErrorState message={error} /> : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? copy.submitting : copy.submit}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setPassword('')
                setPhrase('')
                setFieldErrors({})
                setError(null)
              }}
            >
              {copy.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
            {copy.open}
          </button>
        </div>
      )}
    </section>
  )
}
