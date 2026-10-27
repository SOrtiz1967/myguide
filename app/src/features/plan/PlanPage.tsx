import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { saveGoal } from '../goals/api'
import { goalHistoryKey } from '../goals/useGoalHistory'
import { PlanProposal } from './PlanProposal'
import { usePlanInputs } from './usePlanInputs'

const p = es.plan

/** Recalcular el objetivo calórico con los datos actuales y confirmarlo (spec 015, FR-010). */
export function PlanPage() {
  const queryClient = useQueryClient()
  const inputs = usePlanInputs()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // Se renueva tras cada guardado confirmado: un valor nuevo es una solicitud nueva.
  const [requestId, setRequestId] = useState(newRequestId)

  if (inputs.isPending) return <LoadingState label={p.loading} />
  if (inputs.isError || !inputs.result) {
    return <ErrorState message={p.loadError} onRetry={inputs.refetch} />
  }

  async function use(kcal: number) {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await saveGoal(kcal, requestId)
      await queryClient.invalidateQueries({ queryKey: goalHistoryKey })
      setRequestId(newRequestId())
      setSaved(true)
    } catch (e) {
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  const result = inputs.result

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
      <p className="text-muted">{p.pageIntro}</p>

      {result.ok ? (
        <PlanProposal
          input={result.input}
          busy={busy}
          error={error}
          onUse={(kcal) => void use(kcal)}
        />
      ) : (
        <section aria-labelledby="faltan-datos" className="flex flex-col gap-3">
          <h2 id="faltan-datos" className="text-lg font-semibold">
            {p.missingTitle}
          </h2>
          <p>{p.missingIntro}</p>
          <ul className="list-disc pl-5">
            {result.missing.map((field) => (
              <li key={field}>{p.missing[field]}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link to="/perfil" className="btn-secondary">
              {p.goToProfile}
            </Link>
            {result.missing.includes('weight') ? (
              <Link to="/medidas" className="btn-secondary">
                {p.goToMeasures}
              </Link>
            ) : null}
          </div>
        </section>
      )}

      {saved ? (
        <div className="flex flex-col gap-2">
          <SuccessMessage>{p.actions.saved}</SuccessMessage>
          <Link to="/objetivo" className="underline">
            {es.goal.page.title}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
