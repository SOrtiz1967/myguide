import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { formatDate } from '../../lib/format'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { useDraft } from '../../lib/useDraft'
import { useAuth } from '../auth/useAuth'
import { useToday } from '../meals/useToday'
import { deleteMeasurement, saveMeasurement, updateMeasurement, type Measurement } from './api'
import {
  formatMeasure,
  isMeasureKind,
  kindLabel,
  MEASURE_KINDS,
  parseMeasure,
  unitOf,
  valueInput,
  type MeasureKind,
} from './measures'
import { measuresKey, useLatestMeasures, useMeasureHistory } from './useMeasures'

const m = es.measures
const FORM_ID = 'measure'
const draftSchema = z.object({
  kind: z.string(),
  value: z.string(),
  date: z.string(),
  note: z.string(),
})

/** Peso y medidas (spec 008): lo último de cada una, un formulario para registrar y el historial de la elegida. */
export function MeasuresPage() {
  const [kind, setKind] = useState<MeasureKind>('weight')
  const [editing, setEditing] = useState<Measurement | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{m.title}</h1>
        <p className="text-muted">{m.intro}</p>
      </div>
      {message ? <SuccessMessage>{message}</SuccessMessage> : null}
      <LatestCards selected={kind} onSelect={setKind} />
      <MeasureForm
        key={editing?.id ?? 'new'}
        kind={kind}
        editing={editing}
        onKind={setKind}
        onDone={(text) => {
          setEditing(null)
          setMessage(text)
        }}
        onCancel={() => setEditing(null)}
      />
      <History
        kind={kind}
        onEdit={(row) => {
          setMessage(null)
          setEditing(row)
        }}
        onDeleted={() => setMessage(m.delete.done)}
      />
    </div>
  )
}

function LatestCards({
  selected,
  onSelect,
}: {
  selected: MeasureKind
  onSelect: (kind: MeasureKind) => void
}) {
  const { data, isPending, isError, refetch } = useLatestMeasures()
  return (
    <section aria-labelledby="ultimas-medidas" className="flex flex-col gap-3">
      <h2 id="ultimas-medidas" className="text-xl font-semibold">
        {m.latestTitle}
      </h2>
      {isPending ? <LoadingState /> : null}
      {isError ? <ErrorState message={m.loadError} onRetry={() => void refetch()} /> : null}
      {data ? (
        <ul className="grid grid-cols-2 gap-3">
          {MEASURE_KINDS.map((kind) => {
            const last = data[kind]
            return (
              <li key={kind}>
                <button
                  type="button"
                  aria-pressed={selected === kind}
                  onClick={() => onSelect(kind)}
                  className={`flex min-h-16 w-full flex-col items-start gap-0.5 rounded-lg border p-3 text-left ${
                    selected === kind
                      ? 'border-2 border-accent bg-surface'
                      : 'border-line bg-surface'
                  }`}
                >
                  <span className="font-medium">{kindLabel(kind)}</span>
                  <span className="text-sm text-muted">
                    {last
                      ? m.latest(formatMeasure(kind, last.value), formatDate(last.measured_on))
                      : m.noData}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

interface FormProps {
  kind: MeasureKind
  editing: Measurement | null
  onKind: (kind: MeasureKind) => void
  onDone: (message: string) => void
  onCancel: () => void
}

function MeasureForm({ kind, editing, onKind, onDone, onCancel }: FormProps) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const today = useToday()
  const queryClient = useQueryClient()
  const draft = useDraft({ userId, formId: FORM_ID, schema: draftSchema })
  const useDraftNow = editing === null ? draft.initial : null

  const [value, setValue] = useState(
    editing ? valueInput(editing.value) : (useDraftNow?.value ?? ''),
  )
  const [date, setDate] = useState(editing?.measured_on ?? useDraftNow?.date ?? today)
  const [note, setNote] = useState(editing?.note ?? useDraftNow?.note ?? '')
  const [errors, setErrors] = useState<{ value?: string; date?: string; note?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [requestId, setRequestId] = useState(newRequestId)
  const [restored, setRestored] = useState(draft.restored && editing === null)

  // El borrador del formulario de alta (no el de una corrección) vive hasta que el servidor confirma.
  const saveDraft = draft.save
  useEffect(() => {
    if (editing) return
    if (value === '' && note === '') discardDraft(userId, FORM_ID)
    else saveDraft({ kind, value, date, note })
  }, [editing, kind, value, date, note, saveDraft, userId])

  useEffect(() => {
    if (!editing && draft.initial && isMeasureKind(draft.initial.kind)) onKind(draft.initial.kind)
    // Solo al montar: restaura la medida del borrador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setFailure(null)
    const parsed = parseMeasure(kind, value)
    const next: typeof errors = {}
    if (typeof parsed === 'string') next.value = parsed
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = m.validation.date
    else if (date > today) next.date = m.validation.future
    if (note.length > 200) next.note = m.validation.note
    setErrors(next)
    if (typeof parsed === 'string' || next.date || next.note) return

    setBusy(true)
    try {
      if (editing) await updateMeasurement(editing.id, { value: parsed, measuredOn: date, note })
      else await saveMeasurement({ kind, value: parsed, measuredOn: date, note }, requestId)
      if (!editing) {
        discardDraft(userId, FORM_ID)
        setValue('')
        setNote('')
        // Una intención nueva (otro valor) no puede reutilizar la solicitud ya cumplida.
        setRequestId(newRequestId())
      }
      await queryClient.invalidateQueries({ queryKey: measuresKey })
      onDone(editing ? m.form.corrected : m.form.saved)
    } catch (e) {
      // Nada se muestra como guardado si no llegó al servidor; lo escrito y el borrador quedan.
      setFailure(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      aria-labelledby="registrar-medida"
      className="flex flex-col gap-4"
    >
      <h2 id="registrar-medida" className="text-xl font-semibold">
        {editing ? m.form.editTitle : m.form.title}
      </h2>

      {restored ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{m.form.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setValue('')
                setNote('')
                setRestored(false)
                draft.discard()
              }}
            >
              {m.form.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="medida-tipo" className="font-medium">
          {m.form.kind}
        </label>
        <select
          id="medida-tipo"
          value={kind}
          disabled={editing !== null}
          onChange={(event) => onKind(event.target.value as MeasureKind)}
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
        >
          {MEASURE_KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(k)}
            </option>
          ))}
        </select>
      </div>

      <Field
        label={`${m.form.value} (${unitOf(kind)})`}
        hint={m.form.valueHint(unitOf(kind))}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-required="true"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={errors.value}
      />
      <Field
        label={m.form.date}
        hint={m.form.dateHint}
        type="date"
        max={today}
        value={date}
        onChange={(event) => setDate(event.target.value)}
        error={errors.date}
      />
      <Field
        label={m.form.note}
        type="text"
        maxLength={200}
        autoComplete="off"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={errors.note}
      />

      {failure ? <ErrorState message={`${m.form.notSaved} ${failure}`} /> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? m.form.saving : m.form.save}
        </button>
        {editing ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {m.form.cancelEdit}
          </button>
        ) : null}
      </div>
    </form>
  )
}

function History({
  kind,
  onEdit,
  onDeleted,
}: {
  kind: MeasureKind
  onEdit: (row: Measurement) => void
  onDeleted: () => void
}) {
  const history = useMeasureHistory(kind)
  const queryClient = useQueryClient()
  const [toDelete, setToDelete] = useState<Measurement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const rows = history.data?.pages.flatMap((page) => page.rows) ?? []

  async function confirmDelete() {
    if (!toDelete || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteMeasurement(toDelete.id)
      await queryClient.invalidateQueries({ queryKey: measuresKey })
      setToDelete(null)
      onDeleted()
    } catch (e) {
      setDeleteError(e instanceof WriteError ? e.message : m.delete.failed)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section aria-labelledby="historial-medida" className="flex flex-col gap-3">
      <h2 id="historial-medida" className="text-xl font-semibold">
        {m.history.title(kindLabel(kind))}
      </h2>
      {history.isPending ? <LoadingState /> : null}
      {history.isError ? (
        <ErrorState message={m.history.loadError} onRetry={() => void history.refetch()} />
      ) : null}
      {history.isSuccess && rows.length === 0 ? (
        <p className="text-muted">{m.history.empty}</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="rounded-lg border border-line bg-surface px-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {m.history.row(formatMeasure(row.kind, row.value), formatDate(row.measured_on))}
                </p>
                {row.note ? <p className="break-words text-sm text-muted">{row.note}</p> : null}
              </div>
              <span className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => onEdit(row)}>
                  {m.history.edit}
                  <span className="sr-only"> {formatDate(row.measured_on)}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDeleteError(null)
                    setToDelete(row)
                  }}
                >
                  {m.history.delete}
                  <span className="sr-only"> {formatDate(row.measured_on)}</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {history.hasNextPage ? (
        <div>
          <button
            type="button"
            className="btn-secondary"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {m.history.more}
          </button>
        </div>
      ) : null}
      {toDelete ? (
        <ConfirmDialog
          title={m.delete.title}
          description={m.delete.body}
          confirmLabel={m.delete.confirm}
          cancelLabel={m.delete.cancel}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
          busy={deleting}
          error={deleteError}
        />
      ) : null}
    </section>
  )
}
