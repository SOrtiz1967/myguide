import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { CheckboxField } from '../../components/CheckboxField'
import { ErrorState } from '../../components/ErrorState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { savePreferences, type AthletePreferences, type ItemRow } from './api'
import {
  MAX_PRIORITY_MUSCLES,
  PRIORITY_MUSCLES,
  sleepHours,
  type EffortScale,
  type ItemKind,
  type ItemPreference,
  type PriorityMuscle,
} from './athlete'
import { ItemPicker } from './ItemPicker'
import { athleteKey } from './useAthlete'

const t = es.athlete.preferences
const KINDS: ItemKind[] = ['exercise_favorite', 'exercise_avoided', 'food_avoided']

const toItems = (rows: readonly ItemRow[]): ItemPreference[] =>
  rows.map((row) => ({ kind: row.kind, id: (row.exercise_id ?? row.food_id)!, name: row.name }))

const numberOrNull = (value: string): number | null => (value.trim() === '' ? null : Number(value))

/** Preferencias, contexto de recuperación y escala de esfuerzo (spec 025, FR-004, FR-005 y FR-008). */
export function PreferencesForm({
  preferences,
  items,
}: {
  preferences: AthletePreferences | null
  items: ItemRow[]
}) {
  const queryClient = useQueryClient()
  const [muscles, setMuscles] = useState<PriorityMuscle[]>(preferences?.priority_muscles ?? [])
  const [meals, setMeals] = useState(preferences?.meals_per_day?.toString() ?? '')
  const [sleep, setSleep] = useState(
    preferences?.usual_sleep_minutes ? String(sleepHours(preferences.usual_sleep_minutes)) : '',
  )
  const [recovery, setRecovery] = useState(preferences?.perceived_recovery?.toString() ?? '')
  const [steps, setSteps] = useState(preferences?.approx_steps?.toString() ?? '')
  const [scale, setScale] = useState<EffortScale>(preferences?.effort_scale ?? 'rir')
  const [picked, setPicked] = useState<ItemPreference[]>(toItems(items))
  const [requestId, setRequestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const exerciseTaken = new Set(
    picked.filter((item) => item.kind !== 'food_avoided').map((i) => i.id),
  )
  const foodTaken = new Set(picked.filter((item) => item.kind === 'food_avoided').map((i) => i.id))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    setError(null)
    setBusy(true)
    try {
      await savePreferences(
        {
          priority_muscles: muscles,
          meals_per_day: numberOrNull(meals),
          usual_sleep_minutes:
            sleep.trim() === '' ? null : Math.round(Number(sleep.replace(',', '.')) * 60),
          perceived_recovery: numberOrNull(recovery),
          approx_steps: numberOrNull(steps),
          effort_scale: scale,
          items: picked.map((item) =>
            item.kind === 'food_avoided'
              ? { kind: item.kind, food_id: item.id }
              : { kind: item.kind, exercise_id: item.id },
          ),
        },
        requestId,
      )
      setRequestId(newRequestId())
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: athleteKey })
    } catch (e) {
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="card flex flex-col gap-4">
      <h2 className="text-base font-bold">{t.title}</h2>
      <p className="text-sm text-muted">{t.hint}</p>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold text-muted">{t.muscles}</legend>
        {PRIORITY_MUSCLES.map((muscle) => (
          <CheckboxField
            key={muscle}
            label={t.muscleNames[muscle]}
            checked={muscles.includes(muscle)}
            disabled={!muscles.includes(muscle) && muscles.length >= MAX_PRIORITY_MUSCLES}
            onChange={(event) =>
              setMuscles((list) =>
                event.target.checked ? [...list, muscle] : list.filter((value) => value !== muscle),
              )
            }
          />
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.meals}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={8}
          className="control"
          value={meals}
          onChange={(event) => setMeals(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.sleep}</span>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={16}
          step={0.5}
          className="control"
          value={sleep}
          onChange={(event) => setSleep(event.target.value)}
          aria-describedby="athlete-sleep-hint"
        />
        <span id="athlete-sleep-hint" className="text-sm text-muted">
          {t.sleepHint}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.recovery}</span>
        <select
          className="min-h-11 control px-3 py-2"
          value={recovery}
          onChange={(event) => setRecovery(event.target.value)}
        >
          <option value="">{t.choose}</option>
          {([1, 2, 3, 4, 5] as const).map((value) => (
            <option key={value} value={String(value)}>
              {t.recoveryOptions[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.steps}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100000}
          className="control"
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold text-muted">{t.effortScale}</legend>
        {(['rir', 'rpe'] as const).map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              name="athlete-effort-scale"
              value={value}
              checked={scale === value}
              onChange={() => setScale(value)}
              className="size-4 accent-[var(--color-accent)]"
            />
            <span>{t.effortScales[value]}</span>
          </label>
        ))}
      </fieldset>

      <h3 className="font-semibold">{t.itemsTitle}</h3>
      {KINDS.map((kind) => {
        const list = picked.filter((item) => item.kind === kind)
        return (
          <section key={kind} aria-label={t.kinds[kind]} className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-muted">{t.kinds[kind]}</h4>
            {list.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {list.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span>{item.name}</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label={t.removeItem(item.name)}
                      onClick={() => {
                        setSaved(false)
                        setPicked((current) =>
                          current.filter((other) => !(other.kind === kind && other.id === item.id)),
                        )
                      }}
                    >
                      {es.athlete.goals.remove}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <ItemPicker
              source={kind === 'food_avoided' ? 'food' : 'exercise'}
              taken={kind === 'food_avoided' ? foodTaken : exerciseTaken}
              onPick={(item) => {
                setSaved(false)
                setPicked((current) => [...current, { kind, id: item.id, name: item.name }])
              }}
            />
          </section>
        )
      })}

      {error ? <ErrorState message={error} /> : null}
      {saved ? <SuccessMessage>{t.saved}</SuccessMessage> : null}

      <div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {t.save}
        </button>
      </div>
    </form>
  )
}
