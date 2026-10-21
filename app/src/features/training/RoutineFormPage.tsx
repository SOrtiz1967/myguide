import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { useDraft } from '../../lib/useDraft'
import { useAuth } from '../auth/useAuth'
import { measurementLabel, type MeasurementType } from '../exercises/exerciseLists'
import type { ExerciseSummary } from '../exercises/api'
import { createRoutine, updateRoutine } from './api'
import { MAX_EXERCISES } from './limits'
import { ExercisePickerPanel } from './ExercisePickerPanel'
import {
  emptyRoutineForm,
  routineDraftSchema,
  routineFormSchema,
  routineToFormValues,
  type RoutineFormInput,
  type RoutineFormItem,
  type RoutinePayload,
} from './schema'
import { useRoutine } from './useRoutines'

const r = es.training.routines
const e = es.training.editor

type TargetField = 'target_reps' | 'target_weight_kg' | 'target_duration' | 'target_distance_km'

/** Los objetivos que admite cada tipo de medición, con su etiqueta (la unidad va en la etiqueta). */
const TARGETS: Record<MeasurementType, Array<{ field: TargetField; label: string }>> = {
  reps_weight: [
    { field: 'target_reps', label: r.targetReps },
    { field: 'target_weight_kg', label: r.targetWeight },
  ],
  reps_bodyweight: [{ field: 'target_reps', label: r.targetReps }],
  duration: [{ field: 'target_duration', label: r.targetDuration }],
  distance_duration: [
    { field: 'target_distance_km', label: r.targetDistance },
    { field: 'target_duration', label: r.targetDuration },
  ],
}

const newItem = (exercise: ExerciseSummary): RoutineFormItem => ({
  exercise_id: exercise.id,
  exercise_name: exercise.name,
  measurement_type: exercise.measurement_type,
  sets: '3',
  target_reps: '',
  target_weight_kg: '',
  target_duration: '',
  target_distance_km: '',
  flag: '',
  review: '',
})

type Picking = { mode: 'add' } | { mode: 'replace'; index: number } | null

function RoutineForm({ initial, routineId }: { initial: RoutineFormInput; routineId?: string }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user.id ?? ''
  const formId = routineId ? `routine-edit-${routineId}` : 'routine-new'
  const draft = useDraft({ userId, formId, schema: routineDraftSchema })
  const [requestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState<Picking>(null)
  const submitting = useRef(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RoutineFormInput, unknown, RoutinePayload>({
    resolver: zodResolver(routineFormSchema),
    defaultValues: draft.initial ?? initial,
  })
  const { fields, append, remove, move, update } = useFieldArray({ control, name: 'exercises' })

  // Cada cambio se guarda como borrador hasta que el servidor confirma (FR-045).
  const values = useWatch({ control })
  const start = useMemo(() => JSON.stringify(routineDraftSchema.parse(initial)), [initial])
  const saveDraft = draft.save
  useEffect(() => {
    const current = routineDraftSchema.safeParse(values)
    if (!current.success) return
    if (JSON.stringify(current.data) === start) discardDraft(userId, formId)
    else saveDraft(current.data)
  }, [values, start, saveDraft, userId, formId])

  const submit = handleSubmit(async (payload) => {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    try {
      const id = routineId
        ? await updateRoutine(routineId, payload)
        : await createRoutine(payload, requestId)
      discardDraft(userId, formId)
      void queryClient.invalidateQueries({ queryKey: ['training'] })
      void navigate(`/entrenamiento/rutinas/${id}`, { state: { saved: true } })
    } catch (caught) {
      // Nada se muestra como guardado si no llegó al servidor; lo escrito y el borrador quedan.
      setError(caught instanceof WriteError ? caught.message : es.errors.generic)
    } finally {
      submitting.current = false
    }
  })

  function onPick(exercise: ExerciseSummary) {
    if (picking?.mode === 'replace') {
      const current = values.exercises?.[picking.index]
      if (current) {
        const sameType = current.measurement_type === exercise.measurement_type
        update(picking.index, {
          ...newItem(exercise),
          sets: current.sets ?? '3',
          target_reps: sameType ? (current.target_reps ?? '') : '',
          target_weight_kg: sameType ? (current.target_weight_kg ?? '') : '',
          target_duration: sameType ? (current.target_duration ?? '') : '',
          target_distance_km: sameType ? (current.target_distance_km ?? '') : '',
        })
      }
    } else if (fields.length < MAX_EXERCISES) {
      append(newItem(exercise))
    }
    setPicking(null)
  }

  const listError =
    (errors.exercises as { message?: string } | undefined)?.message ??
    errors.exercises?.root?.message

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {draft.restored ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{r.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                reset(initial)
                draft.discard()
              }}
            >
              {r.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <Field
        label={r.name}
        autoComplete="off"
        aria-required="true"
        error={errors.name?.message}
        {...register('name')}
      />

      <section aria-labelledby="ejercicios-rutina-form" className="flex flex-col gap-4">
        <h2 id="ejercicios-rutina-form" className="text-xl font-semibold">
          {r.exercisesTitle}
        </h2>
        <p className="text-sm text-muted">{r.targetsHint}</p>
        {fields.length === 0 ? <p className="text-muted">{r.noExercises}</p> : null}

        {fields.map((field, index) => {
          const item = values.exercises?.[index] ?? field
          const type = (item.measurement_type ?? field.measurement_type) as MeasurementType
          const name = item.exercise_name ?? field.exercise_name
          const itemErrors = errors.exercises?.[index]
          return (
            <article
              key={field.id}
              aria-label={name}
              className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold">{name}</h3>
                  <p className="text-sm text-muted">{measurementLabel(type)}</p>
                </div>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="btn-secondary"
                    aria-label={e.moveExerciseUp(name)}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    aria-label={e.moveExerciseDown(name)}
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    aria-label={e.removeExercise(name)}
                    onClick={() => remove(index)}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </span>
              </header>

              {item.flag === 'missing' ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-danger">{r.missingExercise}</p>
                  <div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPicking({ mode: 'replace', index })}
                    >
                      {r.replace}
                    </button>
                  </div>
                </div>
              ) : null}
              {item.flag === 'type_changed' ? (
                <p className="text-sm text-danger">{r.typeChanged(item.review ?? '')}</p>
              ) : null}
              {itemErrors?.exercise_id?.message ? (
                <p className="text-sm text-danger">{itemErrors.exercise_id.message}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={r.sets}
                  inputMode="numeric"
                  autoComplete="off"
                  error={itemErrors?.sets?.message}
                  {...register(`exercises.${index}.sets`)}
                />
                {TARGETS[type].map(({ field: target, label }) => (
                  <Field
                    key={target}
                    label={label}
                    inputMode="decimal"
                    autoComplete="off"
                    error={itemErrors?.[target]?.message}
                    {...register(`exercises.${index}.${target}`)}
                  />
                ))}
              </div>
            </article>
          )
        })}

        {listError ? <p className="text-sm text-danger">{listError}</p> : null}
        <div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPicking({ mode: 'add' })}
          >
            {r.addExercise}
          </button>
        </div>
      </section>

      {error ? <ErrorState message={`${r.notSaved} ${error}`} /> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? r.saving : r.save}
        </button>
        <Link
          to={routineId ? `/entrenamiento/rutinas/${routineId}` : '/entrenamiento/rutinas'}
          className="btn-secondary"
        >
          {r.cancel}
        </Link>
      </div>

      {picking ? <ExercisePickerPanel onClose={() => setPicking(null)} onPick={onPick} /> : null}
    </form>
  )
}

/** Alta y edición de una rutina (`/entrenamiento/rutinas/nueva` y `/:id/editar`). */
export function RoutineFormPage() {
  const { id } = useParams()
  const { data: routine, isPending, isError, refetch } = useRoutine(id ?? '')
  const initial = useMemo(() => (routine ? routineToFormValues(routine) : null), [routine])
  const emptyForm = useMemo(() => emptyRoutineForm(), [])

  if (!id) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{r.createTitle}</h1>
        <RoutineForm key="new" initial={emptyForm} />
      </div>
    )
  }
  if (isPending) return <LoadingState />
  if (isError) {
    return <ErrorState message={r.loadError} onRetry={() => void refetch()} />
  }
  if (!routine || !initial) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={es.training.errors.notFound} />
        <Link to="/entrenamiento/rutinas" className="inline-flex min-h-11 items-center underline">
          {r.back}
        </Link>
      </div>
    )
  }
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{r.editTitle}</h1>
      <RoutineForm key={id} initial={initial} routineId={id} />
    </div>
  )
}
