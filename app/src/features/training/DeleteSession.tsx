import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { es } from '../../copy/es'
import { WriteError } from '../../lib/mutation'
import { deleteSession } from './api'

const s = es.training.session

/** «Eliminar» una sesión con confirmación (FR-039). El diálogo sigue abierto si falla, con un aviso claro. */
export function DeleteSession({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => deleteSession(sessionId),
    onMutate: () => setError(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['training'] })
      void navigate('/entrenamiento', { state: { deleted: true } })
    },
    onError: (e) => setError(e instanceof WriteError ? e.message : s.deleteFailed),
  })
  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        {s.delete}
      </button>
      {open ? (
        <ConfirmDialog
          title={s.confirmDeleteTitle}
          description={s.confirmDeleteBody}
          confirmLabel={s.confirmDelete}
          cancelLabel={s.cancelDelete}
          onConfirm={() => mutation.mutate()}
          onCancel={() => setOpen(false)}
          busy={mutation.isPending}
          error={error}
        />
      ) : null}
    </>
  )
}
