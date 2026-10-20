import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { useDraft } from '../../lib/useDraft'
import { useAuth } from '../auth/useAuth'
import { formatDayMonth, parseDate } from '../meals/meals'
import { useToday } from '../meals/useToday'
import { saveGoal } from './api'
import { currentGoal } from './goalHistory'
import { goalFormSchema, type GoalFormInput, type GoalFormValues } from './schema'
import { goalHistoryKey, useGoalHistory } from './useGoalHistory'

const FORM_ID = 'energy-goal'
const goalDraftSchema = z.object({ kcal: z.string() })

/**
 * Ver, fijar y cambiar el objetivo de energía diaria (spec 004). Es una referencia que elige la
 * persona: la aplicación nunca la cambia sola (FR-007). `?volver=AAAA-MM-DD` indica a qué día volver.
 */
export function GoalPage() {
  const today = useToday()
  const history = useGoalHistory()

  if (history.isPending) return <LoadingState label={es.goal.page.loading} />
  if (history.isError) {
    return <ErrorState message={es.goal.loadError} onRetry={() => void history.refetch()} />
  }

  const current = currentGoal(history.data, today)

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{es.goal.page.title}</h1>
      <p className="text-muted">{es.goal.page.explanation}</p>

      <p className="rounded-lg border border-line bg-surface p-4 font-medium">
        {current
          ? es.goal.page.current(current.kcal, formatDayMonth(current.since))
          : es.goal.page.none}
      </p>

      <GoalForm today={today} />
    </div>
  )
}

function GoalForm({ today }: { today: string }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const backDay = parseDate(params.get('volver') ?? '')
  // Sin día de vuelta se va directo al de hoy: pasar por /comidas perdería el mensaje de confirmación.
  const backTo = `/comidas/${backDay ?? today}`

  const draft = useDraft({ userId, formId: FORM_ID, schema: goalDraftSchema })
  const [requestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormInput, unknown, GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: draft.initial ?? { kcal: '' },
  })

  // Cada cambio se guarda como borrador hasta que el servidor confirma (FR-025).
  const kcalText = useWatch({ control, name: 'kcal' })
  const saveDraft = draft.save
  useEffect(() => {
    if ((kcalText ?? '') === '') discardDraft(userId, FORM_ID)
    else saveDraft({ kcal: kcalText })
  }, [kcalText, saveDraft, userId])

  const submit = handleSubmit(async ({ kcal }) => {
    if (sending.current) return // un doble clic no envía dos veces
    sending.current = true
    setError(null)
    try {
      await saveGoal(kcal, requestId)
      discardDraft(userId, FORM_ID)
      await queryClient.invalidateQueries({ queryKey: goalHistoryKey })
      void navigate(backTo, { state: { added: es.goal.page.saved } })
    } catch (e) {
      // Nada se muestra como guardado si no llegó al servidor; lo escrito y el borrador quedan.
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      sending.current = false
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {draft.restored ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{es.goal.page.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                reset({ kcal: '' })
                draft.discard()
              }}
            >
              {es.goal.page.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <Field
        label={es.goal.page.fieldLabel}
        hint={es.goal.page.fieldHelp}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-required="true"
        error={errors.kcal?.message}
        {...register('kcal')}
      />

      <p className="text-sm text-muted">{es.goal.page.rule}</p>

      {error ? <ErrorState message={`${es.goal.page.notSaved} ${error}`} /> : null}

      <div>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? es.goal.page.saving : es.goal.page.save}
        </button>
      </div>
    </form>
  )
}
