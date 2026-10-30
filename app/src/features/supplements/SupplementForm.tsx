import { useState, type FormEvent } from 'react'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { WriteError } from '../../lib/mutation'

const copy = es.supplements.form

interface SupplementFormProps {
  initial?: { name: string; dose: string }
  submitLabel: string
  busyLabel: string
  /** Debe lanzar `WriteError` si no se pudo guardar; así el formulario conserva lo escrito y avisa. */
  onSubmit: (values: { name: string; dose: string }) => Promise<void>
  onCancel?: () => void
  /** Prefijo para que los campos de varios formularios en pantalla no compartan identificadores. */
  idPrefix: string
}

/** Nombre y dosis (opcional, texto libre) de un suplemento. Sirve para agregar y para corregir. */
export function SupplementForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
  idPrefix,
}: SupplementFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [dose, setDose] = useState(initial?.dose ?? '')
  const [errors, setErrors] = useState<{ name?: string; dose?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setFailure(null)
    const next: typeof errors = {}
    if (name.trim() === '') next.name = copy.nameRequired
    else if (name.trim().length > 60) next.name = copy.nameTooLong
    if (dose.trim().length > 60) next.dose = copy.doseTooLong
    setErrors(next)
    if (next.name || next.dose) return

    setBusy(true)
    try {
      await onSubmit({ name: name.trim(), dose: dose.trim() })
      if (!initial) {
        setName('')
        setDose('')
      }
    } catch (e) {
      // Nada se da por guardado si no llegó al servidor; lo escrito queda en el formulario.
      setFailure(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-nombre`}
          label={copy.name}
          type="text"
          maxLength={80}
          autoComplete="off"
          aria-required="true"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <Field
          id={`${idPrefix}-dosis`}
          label={copy.dose}
          hint={copy.doseHint}
          type="text"
          maxLength={80}
          autoComplete="off"
          value={dose}
          onChange={(event) => setDose(event.target.value)}
          error={errors.dose}
        />
      </div>
      {failure ? (
        <p role="alert" className="notice-error px-4 py-3">
          {copy.notSaved} {failure}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {copy.cancel}
          </button>
        ) : null}
      </div>
    </form>
  )
}
