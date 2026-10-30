import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { PageHeader } from '../../components/PageHeader'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import {
  createSupplement,
  deleteSupplement,
  MAX_ACTIVE,
  setSupplementArchived,
  updateSupplement,
  type Supplement,
} from './api'
import { SupplementForm } from './SupplementForm'
import { supplementsKey, useSupplements } from './useSupplements'

const copy = es.supplements

/**
 * Suplementos (spec 022): la lista propia de la persona. Nombre y dosis son texto que ella escribe; la aplicación no
 * recomienda nada. Archivar conserva las marcas pasadas y eliminar las borra, con confirmación.
 */
export function SupplementsPage() {
  const queryClient = useQueryClient()
  const list = useSupplements()
  const [requestId, setRequestId] = useState(newRequestId)
  const [editing, setEditing] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Supplement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const all = list.data ?? []
  const active = all.filter((s) => s.archived_at === null)
  const archived = all.filter((s) => s.archived_at !== null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: supplementsKey })

  async function add(values: { name: string; dose: string }) {
    setMessage(null)
    await createSupplement(values, requestId)
    // Una intención nueva no puede reutilizar la solicitud ya cumplida.
    setRequestId(newRequestId())
    await refresh()
    setMessage(copy.added)
  }

  async function archive(supplement: Supplement, value: boolean) {
    setMessage(null)
    setActionError(null)
    try {
      await setSupplementArchived(supplement.id, value)
      await refresh()
      setMessage(value ? copy.archivedDone : copy.restoredDone)
    } catch (e) {
      setActionError(e instanceof WriteError ? e.message : es.errors.generic)
    }
  }

  async function confirmDelete() {
    if (!toDelete || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteSupplement(toDelete.id)
      await refresh()
      setToDelete(null)
      setMessage(copy.deletedDone)
    } catch (e) {
      setDeleteError(e instanceof WriteError ? e.message : copy.deleteFailed)
    } finally {
      setDeleting(false)
    }
  }

  const row = (supplement: Supplement) => (
    <li key={supplement.id} className="card-inset flex flex-col gap-3">
      {editing === supplement.id ? (
        <SupplementForm
          idPrefix={`supl-${supplement.id}`}
          initial={{ name: supplement.name, dose: supplement.dose ?? '' }}
          submitLabel={copy.form.saveChanges}
          busyLabel={copy.form.saving}
          onCancel={() => setEditing(null)}
          onSubmit={async (values) => {
            setMessage(null)
            await updateSupplement(supplement.id, values)
            await refresh()
            setEditing(null)
            setMessage(copy.updated)
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 break-words">
            <span className="font-semibold">{supplement.name}</span>
            {supplement.dose ? <span className="text-muted"> · {supplement.dose}</span> : null}
          </p>
          <span className="flex flex-wrap gap-2">
            {supplement.archived_at === null ? (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  aria-label={`${copy.edit} ${supplement.name}`}
                  onClick={() => {
                    setMessage(null)
                    setEditing(supplement.id)
                  }}
                >
                  {copy.edit}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  aria-label={`${copy.archive} ${supplement.name}`}
                  onClick={() => void archive(supplement, true)}
                >
                  {copy.archive}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                aria-label={`${copy.restore} ${supplement.name}`}
                onClick={() => void archive(supplement, false)}
              >
                {copy.restore}
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              aria-label={`${copy.delete} ${supplement.name}`}
              onClick={() => {
                setDeleteError(null)
                setToDelete(supplement)
              }}
            >
              {copy.delete}
            </button>
          </span>
        </div>
      )}
    </li>
  )

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={copy.title} subtitle={copy.intro} />
      {message ? <SuccessMessage>{message}</SuccessMessage> : null}

      <section aria-labelledby="suplementos-agregar" className="card flex flex-col gap-3">
        <h2 id="suplementos-agregar" className="text-lg font-extrabold">
          {copy.form.title}
        </h2>
        {active.length >= MAX_ACTIVE ? (
          <p role="status" className="notice-error px-4 py-3">
            {copy.limit}
          </p>
        ) : (
          <SupplementForm
            idPrefix="supl-nuevo"
            submitLabel={copy.form.add}
            busyLabel={copy.form.saving}
            onSubmit={add}
          />
        )}
        <p className="text-sm text-muted">{copy.note}</p>
      </section>

      {list.isPending ? <LoadingState /> : null}
      {list.isError ? (
        <ErrorState message={copy.loadError} onRetry={() => void list.refetch()} />
      ) : null}
      {actionError ? (
        <p role="alert" className="notice-error px-4 py-3">
          {actionError}
        </p>
      ) : null}

      {list.isSuccess && active.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyBody} />
      ) : null}

      {active.length > 0 ? (
        <section aria-labelledby="suplementos-lista" className="flex flex-col gap-3">
          <h2 id="suplementos-lista" className="text-lg font-extrabold">
            {copy.listTitle}
          </h2>
          <ul className="flex flex-col gap-2">{active.map(row)}</ul>
        </section>
      ) : null}

      {archived.length > 0 ? (
        <details className="card">
          <summary className="min-h-11 cursor-pointer py-2 text-lg font-extrabold">
            {copy.archivedTitle(archived.length)}
          </summary>
          <p className="mb-3 text-sm text-muted">{copy.archivedHint}</p>
          <ul className="flex flex-col gap-2">{archived.map(row)}</ul>
        </details>
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          title={copy.deleteTitle}
          description={copy.deleteBody}
          confirmLabel={copy.confirmDelete}
          cancelLabel={copy.form.cancel}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
          busy={deleting}
          error={deleteError}
        />
      ) : null}
    </div>
  )
}
