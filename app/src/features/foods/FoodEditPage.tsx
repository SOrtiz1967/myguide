import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { saveRemotely } from '../../lib/mutation'
import { useAuth } from '../auth/useAuth'
import { updateFood } from './api'
import { FoodForm } from './FoodForm'
import { foodToFormValues } from './schema'
import { useFood } from './useFood'

export function FoodEditPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const copied = (useLocation().state as { copied?: boolean } | null)?.copied === true
  const { data: food, isPending, isError, refetch } = useFood(id)

  const initialValues = useMemo(() => (food ? foodToFormValues(food) : null), [food])
  const back = (
    <Link to={`/alimentos/${id}`} className="underline">
      {es.foods.actions.cancel}
    </Link>
  )

  if (isPending) return <LoadingState />
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState message={es.foods.detailError} onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!food) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={es.foods.notFound} />
        <Link to="/alimentos" className="underline">
          {es.foods.backToSearch}
        </Link>
      </div>
    )
  }
  // FR-022: el catálogo es de solo lectura; se ofrece crear una versión propia desde el detalle.
  if (food.origin !== 'own' || !initialValues) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={es.foods.form.editNotAllowed} />
        {back}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>{back}</div>
      <h1 className="text-2xl font-semibold tracking-tight">{es.foods.form.editTitle}</h1>
      {copied ? <SuccessMessage>{es.foods.form.copyCreated}</SuccessMessage> : null}
      <FoodForm
        userId={session?.user.id ?? ''}
        formId={`food-edit-${id}`}
        initialValues={initialValues}
        submitLabel={es.foods.actions.save}
        onSubmit={(payload) => saveRemotely(() => updateFood(id, payload))}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['foods'] })
          void navigate(`/alimentos/${id}`, { state: { saved: true } })
        }}
      />
    </div>
  )
}
