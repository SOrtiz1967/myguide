import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { ChoiceGroup } from '../onboarding/ChoiceGroup'
import type { Experience, GoalType, JobActivity, Profile } from './api'
import { toProfileUpdate } from './profileValues'
import { useUpdateProfile } from './useUpdateProfile'

const t = es.profile.goalForm
const o = es.onboarding

/**
 * Objetivo físico, experiencia, trabajo y días de entrenamiento (spec 014, FR-006). Cambiarlos no
 * modifica el objetivo calórico: la persona lo recalcula y lo confirma en `/plan`.
 */
export function GoalProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [goal, setGoal] = useState<string>(profile.goal_type ?? '')
  const [experience, setExperience] = useState<string>(profile.experience ?? '')
  const [job, setJob] = useState<string>(profile.job_activity ?? '')
  const [days, setDays] = useState(
    profile.training_days === null ? '' : String(profile.training_days),
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    if (!goal || !experience || !job || !/^[0-7]$/.test(days)) {
      setError(t.incomplete)
      return
    }
    setError(null)
    try {
      await saveRemotely(() =>
        update.mutateAsync({
          ...toProfileUpdate(profile),
          goal_type: goal as GoalType,
          experience: experience as Experience,
          job_activity: job as JobActivity,
          training_days: Number(days),
        }),
      )
      setSaved(true)
    } catch (e) {
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t.title}</h2>
      <p className="text-sm text-muted">{t.hint}</p>

      <ChoiceGroup
        name="perfil-objetivo"
        legend={o.goal.legend}
        options={(['muscle_gain', 'fat_loss', 'recomposition'] as const).map((value) => ({
          value,
          label: o.goal.options[value].label,
        }))}
        value={goal}
        onChange={setGoal}
      />
      <ChoiceGroup
        name="perfil-experiencia"
        legend={o.activity.experience}
        options={(['beginner', 'intermediate', 'advanced'] as const).map((value) => ({
          value,
          label: o.activity.experienceOptions[value],
        }))}
        value={experience}
        onChange={setExperience}
      />
      <ChoiceGroup
        name="perfil-trabajo"
        legend={o.activity.job}
        options={(['sedentary', 'mixed', 'on_feet'] as const).map((value) => ({
          value,
          label: o.activity.jobOptions[value],
        }))}
        value={job}
        onChange={setJob}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="perfil-dias" className="font-medium">
          {o.activity.days}
        </label>
        <select
          id="perfil-dias"
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
          value={days}
          onChange={(event) => setDays(event.target.value)}
        >
          <option value="">{o.activity.choose}</option>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((count) => (
            <option key={count} value={String(count)}>
              {o.activity.daysOption(count)}
            </option>
          ))}
        </select>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {saved ? <SuccessMessage>{t.saved}</SuccessMessage> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {t.save}
        </button>
        <Link to="/plan" className="underline">
          {t.recalculate}
        </Link>
      </div>
    </form>
  )
}
