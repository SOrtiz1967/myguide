import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { CheckboxField } from '../../components/CheckboxField'
import { ErrorState } from '../../components/ErrorState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { saveGoals, type GoalsEntry } from './api'
import {
  GOAL_KINDS,
  MAX_CUSTOM_LABEL,
  MAX_GOALS,
  profileGoalFor,
  validateGoals,
  withPriorities,
  type AthleteGoal,
  type GoalKind,
} from './athlete'
import { athleteKey } from './useAthlete'

const t = es.athlete.goals

interface Row {
  kind: GoalKind | ''
  label: string
}

const toRows = (goals: readonly AthleteGoal[]): Row[] =>
  [...goals]
    .sort((a, b) => a.priority - b.priority)
    .map((goal) => ({ kind: goal.kind, label: goal.label ?? '' }))

/** Objetivos con prioridad y vigencia (spec 025, FR-002 y FR-007). */
export function GoalsForm({
  current,
  history,
}: {
  current: GoalsEntry | null
  history: GoalsEntry[]
}) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<Row[]>(current ? toRows(current.goals) : [])
  const [apply, setApply] = useState(false)
  const [from, setFrom] = useState('')
  const [requestId, setRequestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const top = rows[0]?.kind ? rows[0].kind : null
  const topProfileGoal = top ? profileGoalFor(top) : null

  function update(index: number, patch: Partial<Row>) {
    setSaved(false)
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  function move(index: number, delta: -1 | 1) {
    setSaved(false)
    setRows((list) => {
      const target = index + delta
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item!)
      return next
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    if (rows.some((row) => row.kind === '')) {
      setError(es.athlete.errors.incompleteGoal)
      return
    }
    const goals = withPriorities(rows as { kind: GoalKind; label?: string }[])
    const problem = validateGoals(goals)
    if (problem) {
      setError(
        problem === 'repeated_kind'
          ? es.athlete.errors.kind_repeated
          : problem === 'label_required' || problem === 'label_too_long'
            ? es.athlete.errors.label
            : es.athlete.errors.count,
      )
      return
    }
    setError(null)
    setBusy(true)
    try {
      await saveGoals(
        {
          goals,
          effectiveFrom: from === '' ? null : from,
          applyToProfile: apply && !!topProfileGoal,
        },
        requestId,
      )
      setRequestId(newRequestId())
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: athleteKey })
      if (apply) await queryClient.invalidateQueries({ queryKey: ['profile'] })
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

      {rows.map((row, index) => (
        <fieldset key={index} className="flex flex-col gap-2 rounded-lg bg-surface p-3">
          <legend className="font-medium">
            {index === 0 ? t.principal : t.priority(index + 1)}
          </legend>
          <select
            aria-label={t.priority(index + 1)}
            className="min-h-11 control px-3 py-2"
            value={row.kind}
            onChange={(event) => update(index, { kind: event.target.value as GoalKind | '' })}
          >
            <option value="">{es.athlete.availability.choose}</option>
            {GOAL_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t.kinds[kind]}
              </option>
            ))}
          </select>
          {row.kind === 'custom' ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-muted">{t.customLabel}</span>
              <input
                className="control"
                maxLength={MAX_CUSTOM_LABEL}
                value={row.label}
                onChange={(event) => update(index, { label: event.target.value })}
              />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              {t.moveUp}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              {t.moveDown}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSaved(false)
                setRows((list) => list.filter((_, i) => i !== index))
              }}
            >
              {t.remove}
            </button>
          </div>
        </fieldset>
      ))}

      {rows.length < MAX_GOALS ? (
        <button
          type="button"
          className="btn-secondary self-start"
          onClick={() => {
            setSaved(false)
            setRows((list) => [...list, { kind: '', label: '' }])
          }}
        >
          {t.add}
        </button>
      ) : null}

      {topProfileGoal ? (
        <CheckboxField
          label={t.applyToProfile(es.onboarding.goal.options[topProfileGoal].label)}
          checked={apply}
          onChange={(event) => setApply(event.target.checked)}
        />
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.effectiveFrom}</span>
        <input
          type="date"
          className="control"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          aria-describedby="athlete-goals-from-hint"
        />
        <span id="athlete-goals-from-hint" className="text-sm text-muted">
          {t.effectiveFromHint}
        </span>
      </label>

      {error ? <ErrorState message={error} /> : null}
      {saved ? (
        <SuccessMessage>
          {t.saved}{' '}
          <Link to="/plan" className="underline">
            {t.reviewCalories}
          </Link>
        </SuccessMessage>
      ) : null}

      <div>
        <button type="submit" className="btn-primary" disabled={busy || rows.length === 0}>
          {t.save}
        </button>
      </div>

      {history.length > 1 ? (
        <section aria-label={t.history} className="flex flex-col gap-1 text-sm text-muted">
          <h3 className="font-semibold">{t.history}</h3>
          <ul className="flex flex-col gap-1">
            {history.map((entry) => (
              <li key={entry.created_at}>
                {entry.effective_from}:{' '}
                {[...entry.goals]
                  .sort((a, b) => a.priority - b.priority)
                  .map((goal) => (goal.kind === 'custom' ? goal.label : t.kinds[goal.kind]))
                  .join(', ')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </form>
  )
}
