import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { detectDeviceTimezone } from '../../lib/timezone'
import { useDraft } from '../../lib/useDraft'
import { goalHistoryKey } from '../goals/useGoalHistory'
import { measuresKey } from '../measures/useMeasures'
import { todayLocal } from '../training/dates'
import { PlanProposal } from '../plan/PlanProposal'
import type { Profile } from '../profile/api'
import { PROFILE_QUERY_KEY, useProfile } from '../profile/useProfile'
import { ChoiceGroup } from './ChoiceGroup'
import {
  draftSchema,
  EMPTY_VALUES,
  planInputOf,
  TOTAL_STEPS,
  validateStep,
  type OnboardingValues,
  type Step,
  type StepErrors,
} from './onboarding'
import { completeOnboarding } from './save'

const FORM_ID = 'onboarding'
const o = es.onboarding

/** Recorrido de cuatro pasos del primer ingreso (spec 014). Hasta completarlo no se abre el resto de la app. */
export function OnboardingPage() {
  const { data: profile, isPending, isError, refetch } = useProfile()
  if (isPending) return <LoadingState label={o.loading} />
  if (isError || !profile)
    return <ErrorState message={o.loadError} onRetry={() => void refetch()} />
  if (profile.onboarding_completed_at) return <Navigate to="/" replace />
  return <Wizard profile={profile} />
}

function initialValues(profile: Profile): OnboardingValues {
  return {
    ...EMPTY_VALUES,
    sex: profile.sex ?? '',
    birthDate: profile.birth_date ?? '',
    heightCm: profile.height_cm === null ? '' : String(profile.height_cm).replace('.', ','),
    job: profile.job_activity ?? '',
    trainingDays: profile.training_days === null ? '' : String(profile.training_days),
    experience: profile.experience ?? '',
    goal: profile.goal_type ?? '',
  }
}

function Wizard({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const draft = useDraft({ userId: profile.user_id, formId: FORM_ID, schema: draftSchema })
  const [values, setValues] = useState<OnboardingValues>(
    () => (draft.initial as OnboardingValues | null) ?? initialValues(profile),
  )
  const [step, setStep] = useState<Step>(1)
  const [errors, setErrors] = useState<StepErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // El mismo identificador en cada reintento: si la primera solicitud sí llegó, no se duplica.
  const [weightRequestId] = useState(newRequestId)
  const [goalRequestId] = useState(newRequestId)
  const today = todayLocal()
  const heading = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  const saveDraft = draft.save
  useEffect(() => {
    saveDraft(values)
  }, [values, saveDraft])

  // El foco va al título del paso nuevo para que el lector de pantalla anuncie el cambio.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    heading.current?.focus()
  }, [step])

  const set = <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function next() {
    const found = validateStep(step, values, today)
    setErrors(found)
    if (Object.keys(found).length === 0) setStep((step + 1) as Step)
  }

  async function finish(kcal: number | null) {
    setBusy(true)
    setSaveError(null)
    try {
      const saved = await completeOnboarding({
        values,
        kcal,
        today,
        timezone: detectDeviceTimezone(),
        requestIds: { weight: weightRequestId, goal: goalRequestId },
      })
      discardDraft(profile.user_id, FORM_ID)
      queryClient.setQueryData(PROFILE_QUERY_KEY, saved)
      await queryClient.invalidateQueries({ queryKey: measuresKey })
      await queryClient.invalidateQueries({ queryKey: goalHistoryKey })
      void navigate('/', { replace: true })
    } catch (error) {
      // Nada se muestra como guardado si no llegó al servidor; lo escrito y el borrador quedan.
      setSaveError(error instanceof WriteError ? error.message : es.errors.generic)
      setBusy(false)
    }
  }

  const planInput = step === 4 ? planInputOf(values, today) : null

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{o.title}</h1>
        <p className="text-muted">{o.intro}</p>
      </div>

      {draft.restored && step === 1 ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{o.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setValues(initialValues(profile))
                draft.discard()
              }}
            >
              {o.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-sm text-muted">{o.stepOf(step, TOTAL_STEPS)}</p>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
          {o.steps[step - 1]}
        </h2>
      </div>

      {step === 1 ? <StepAbout values={values} errors={errors} set={set} /> : null}
      {step === 2 ? <StepActivity values={values} errors={errors} set={set} /> : null}
      {step === 3 ? <StepGoal values={values} errors={errors} set={set} /> : null}
      {step === 4 ? (
        planInput ? (
          <PlanProposal
            input={planInput}
            busy={busy}
            error={saveError}
            onUse={(kcal) => void finish(kcal)}
            skip={{
              label: o.plan.later,
              hint: o.plan.laterHint,
              onSkip: () => void finish(null),
            }}
          />
        ) : (
          <ErrorState message={o.errors.incomplete!} />
        )
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 1 ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => setStep((step - 1) as Step)}
          >
            {o.nav.back}
          </button>
        ) : null}
        {step < 4 ? (
          <button type="button" className="btn-primary" onClick={next}>
            {o.nav.next}
          </button>
        ) : null}
      </div>
    </div>
  )
}

interface StepProps {
  values: OnboardingValues
  errors: StepErrors
  set: <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) => void
}

function StepAbout({ values, errors, set }: StepProps) {
  const t = o.about
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">{t.why}</p>
      <ChoiceGroup
        name="sexo"
        legend={t.sex}
        hint={t.sexHint}
        options={[
          { value: 'female', label: t.sexOptions.female },
          { value: 'male', label: t.sexOptions.male },
        ]}
        value={values.sex}
        onChange={(value) => set('sex', value as OnboardingValues['sex'])}
        error={errors.sex}
      />
      <Field
        label={t.birthDate}
        hint={t.birthDateHint}
        type="date"
        autoComplete="bday"
        value={values.birthDate}
        onChange={(event) => set('birthDate', event.target.value)}
        error={errors.birthDate}
      />
      <Field
        label={t.height}
        hint={t.heightHint}
        type="text"
        inputMode="decimal"
        value={values.heightCm}
        onChange={(event) => set('heightCm', event.target.value)}
        error={errors.heightCm}
      />
      <Field
        label={t.weight}
        hint={t.weightHint}
        type="text"
        inputMode="decimal"
        value={values.weightKg}
        onChange={(event) => set('weightKg', event.target.value)}
        error={errors.weightKg}
      />
    </div>
  )
}

function StepActivity({ values, errors, set }: StepProps) {
  const t = o.activity
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">{t.why}</p>
      <ChoiceGroup
        name="trabajo"
        legend={t.job}
        hint={t.jobHint}
        options={(['sedentary', 'mixed', 'on_feet'] as const).map((value) => ({
          value,
          label: t.jobOptions[value],
        }))}
        value={values.job}
        onChange={(value) => set('job', value as OnboardingValues['job'])}
        error={errors.job}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="onb-dias" className="font-medium">
          {t.days}
        </label>
        <select
          id="onb-dias"
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
          value={values.trainingDays}
          aria-invalid={errors.trainingDays ? true : undefined}
          aria-describedby="onb-dias-hint"
          onChange={(event) => set('trainingDays', event.target.value)}
        >
          <option value="">{t.choose}</option>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((count) => (
            <option key={count} value={String(count)}>
              {t.daysOption(count)}
            </option>
          ))}
        </select>
        <p id="onb-dias-hint" className="text-sm text-muted">
          {t.daysHint}
        </p>
        {errors.trainingDays ? <p className="text-sm text-danger">{errors.trainingDays}</p> : null}
      </div>
      <ChoiceGroup
        name="experiencia"
        legend={t.experience}
        options={(['beginner', 'intermediate', 'advanced'] as const).map((value) => ({
          value,
          label: t.experienceOptions[value],
        }))}
        value={values.experience}
        onChange={(value) => set('experience', value as OnboardingValues['experience'])}
        error={errors.experience}
      />
    </div>
  )
}

function StepGoal({ values, errors, set }: StepProps) {
  const t = o.goal
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">{t.why}</p>
      <ChoiceGroup
        name="objetivo"
        legend={t.legend}
        options={(['muscle_gain', 'fat_loss', 'recomposition'] as const).map((value) => ({
          value,
          label: t.options[value].label,
          description: t.options[value].description,
        }))}
        value={values.goal}
        onChange={(value) => set('goal', value as OnboardingValues['goal'])}
        error={errors.goal}
      />
    </div>
  )
}
