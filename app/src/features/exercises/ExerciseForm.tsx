import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { newRequestId } from '../../lib/ids'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { useDraft } from '../../lib/useDraft'
import { exerciseErrorMessage, searchExercises } from './api'
import {
  EQUIPMENT,
  MEASUREMENT_TYPES,
  MUSCLES,
  equipmentLabel,
  measurementLabel,
  muscleLabel,
} from './exerciseLists'
import { measurementExplanation } from './exerciseText'
import {
  emptyExerciseForm,
  exerciseDraftSchema,
  exerciseFormSchema,
  MAX_DESCRIPTION,
  type ExerciseFormInput,
  type ExercisePayload,
} from './schema'

const t = es.exercises
const f = t.form

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** ¿Ya hay un ejercicio propio con este nombre (sin importar acentos ni mayúsculas)? Solo informa (FR-025). */
function useDuplicateName(name: string, excludeId?: string): boolean {
  const [debounced, setDebounced] = useState(name.trim())
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(name.trim()), 400)
    return () => clearTimeout(timer)
  }, [name])

  const { data } = useQuery({
    queryKey: ['exercises', 'own-name', normalize(debounced)],
    queryFn: () =>
      searchExercises({
        q: debounced,
        scope: 'own',
        muscle: null,
        equipment: null,
        pageSize: 20,
        pageOffset: 0,
      }),
    enabled: debounced.length >= 2,
  })
  const key = normalize(debounced)
  return (data ?? []).some((row) => row.id !== excludeId && normalize(row.name) === key)
}

interface ExerciseFormProps {
  userId: string
  /** Identificador del borrador local (uno por formulario). */
  draftId: string
  initial?: ExerciseFormInput
  /** Al editar: el propio ejercicio no cuenta como nombre repetido. */
  excludeId?: string
  submitLabel?: string
  onCancel?: () => void
  /** Guarda en el servidor y lanza si no lo confirmó. Devuelve el identificador del ejercicio. */
  onSubmit: (payload: ExercisePayload, requestId: string) => Promise<string>
  /** Se llama solo cuando el servidor confirmó el guardado. */
  onSaved: (id: string) => void
}

function MuscleGroup({
  legend,
  field,
  register,
  error,
}: {
  legend: string
  field: 'primary_muscles' | 'secondary_muscles'
  register: ReturnType<typeof useForm<ExerciseFormInput>>['register']
  error?: string
}) {
  const errorId = useId()
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-2">
      <legend className="font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
        {MUSCLES.map((code) => (
          <label key={code} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" value={code} className="size-5" {...register(field)} />
            <span>{muscleLabel(code)}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

/** Alta y edición de un ejercicio propio: nombre y tipo de medición obligatorios, el resto opcional. */
export function ExerciseForm({
  userId,
  draftId,
  initial,
  excludeId,
  submitLabel = t.actions.save,
  onCancel,
  onSubmit,
  onSaved,
}: ExerciseFormProps) {
  const queryClient = useQueryClient()
  const draft = useDraft({ userId, formId: draftId, schema: exerciseDraftSchema })
  const [requestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)
  const start = initial ?? emptyExerciseForm()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ExerciseFormInput, unknown, ExercisePayload>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: draft.initial ?? start,
  })

  // Cada cambio se guarda como borrador hasta que el servidor confirma (FR-037).
  const values = useWatch({ control })
  const saveDraft = draft.save
  useEffect(() => {
    const current = exerciseDraftSchema.safeParse(values)
    if (!current.success) return
    if (JSON.stringify(current.data) === JSON.stringify(start)) discardDraft(userId, draftId)
    else saveDraft(current.data)
  }, [values, saveDraft, start, userId, draftId])

  const duplicate = useDuplicateName(values.name ?? '', excludeId)

  const submit = handleSubmit(async (payload) => {
    setError(null)
    try {
      const id = await saveRemotely(() => onSubmit(payload, requestId), exerciseErrorMessage)
      discardDraft(userId, draftId)
      void queryClient.invalidateQueries({ queryKey: ['exercises'] })
      onSaved(id)
    } catch (e) {
      // Nada se muestra como guardado si no llegó al servidor; lo escrito y el borrador quedan.
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    }
  })

  const descriptionId = useId()
  const aliasesId = useId()

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {draft.restored ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{f.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                reset(start)
                draft.discard()
              }}
            >
              {f.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Field
          label={f.name}
          autoComplete="off"
          aria-required="true"
          error={errors.name?.message}
          {...register('name')}
        />
        {duplicate ? (
          <p role="status" className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
            {f.duplicateName}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2" aria-required="true">
        <legend className="font-medium">{f.measurementLegend}</legend>
        {MEASUREMENT_TYPES.map((type) => (
          <label
            key={type}
            className="flex min-h-11 items-start gap-3 rounded-md border border-line bg-surface p-3"
          >
            <input
              type="radio"
              value={type}
              className="mt-1 size-5"
              {...register('measurement_type')}
            />
            <span className="flex flex-col">
              <span className="font-medium">{measurementLabel(type)}</span>
              <span className="text-sm text-muted">{measurementExplanation(type)}</span>
            </span>
          </label>
        ))}
        {errors.measurement_type ? (
          <p className="text-sm text-danger">{errors.measurement_type.message}</p>
        ) : null}
      </fieldset>

      <MuscleGroup
        legend={f.primaryLegend}
        field="primary_muscles"
        register={register}
        error={errors.primary_muscles?.message}
      />
      <MuscleGroup
        legend={f.secondaryLegend}
        field="secondary_muscles"
        register={register}
        error={errors.secondary_muscles?.message}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="equipamiento" className="font-medium">
          {f.equipment}
        </label>
        <select
          id="equipamiento"
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
          {...register('equipment')}
        >
          <option value="">{f.equipmentNone}</option>
          {EQUIPMENT.map((code) => (
            <option key={code} value={code}>
              {equipmentLabel(code)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="descripcion" className="font-medium">
          {f.description}
        </label>
        <textarea
          id="descripcion"
          rows={5}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={`${descriptionId}-hint${errors.description ? ` ${descriptionId}-error` : ''}`}
          className="rounded-md border border-line bg-surface px-3 py-2"
          {...register('description')}
        />
        <p id={`${descriptionId}-hint`} className="text-sm text-muted">
          {f.descriptionHint} ({MAX_DESCRIPTION.toLocaleString('es-AR')} caracteres como máximo)
        </p>
        {errors.description ? (
          <p id={`${descriptionId}-error`} className="text-sm text-danger">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="otros-nombres" className="font-medium">
          {f.aliases}
        </label>
        <textarea
          id="otros-nombres"
          rows={2}
          aria-invalid={errors.aliases ? true : undefined}
          aria-describedby={`${aliasesId}-hint${errors.aliases ? ` ${aliasesId}-error` : ''}`}
          className="rounded-md border border-line bg-surface px-3 py-2"
          {...register('aliases')}
        />
        <p id={`${aliasesId}-hint`} className="text-sm text-muted">
          {f.aliasesHint}
        </p>
        {errors.aliases ? (
          <p id={`${aliasesId}-error`} className="text-sm text-danger">
            {errors.aliases.message}
          </p>
        ) : null}
      </div>

      {error ? <ErrorState message={`${f.notSaved} ${error}`} /> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t.actions.cancel}
          </button>
        ) : null}
      </div>
    </form>
  )
}
