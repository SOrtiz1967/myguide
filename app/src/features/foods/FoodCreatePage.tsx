import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { es } from '../../copy/es'
import { saveRemotely } from '../../lib/mutation'
import { useAuth } from '../auth/useAuth'
import { createFood } from './api'
import { FoodForm } from './FoodForm'
import { emptyFoodForm } from './schema'

export function FoodCreatePage() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // `?nombre=` trae lo que se buscó sin éxito (contracts/ui-routes.md).
  const searched = params.get('nombre') ?? ''
  const initialValues = useMemo(() => ({ ...emptyFoodForm(), name: searched }), [searched])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/alimentos" className="inline-flex min-h-11 items-center underline">
          {es.foods.backToSearch}
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{es.foods.form.createTitle}</h1>
      <FoodForm
        userId={session?.user.id ?? ''}
        formId="food-new"
        initialValues={initialValues}
        submitLabel={es.foods.actions.save}
        onSubmit={(payload, requestId) => saveRemotely(() => createFood(payload, requestId))}
        onSaved={(id) => {
          void queryClient.invalidateQueries({ queryKey: ['foods'] })
          void navigate(`/alimentos/${id}`, { state: { saved: true } })
        }}
      />
    </div>
  )
}
