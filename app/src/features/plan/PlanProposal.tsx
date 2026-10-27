import { useState } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { parseGoalInput } from '../goals/schema'
import { computePlan, type PlanInput } from './calorie'

const p = es.plan
const number = (value: number, digits = 0) =>
  value.toLocaleString('es-ES', { useGrouping: 'always', maximumFractionDigits: digits })

interface PlanProposalProps {
  input: PlanInput
  busy?: boolean
  error?: string | null
  /** Se llama con las kcal elegidas; quien lo usa guarda y decide qué sigue. */
  onUse: (kcal: number) => void
  /** Acción opcional para seguir sin fijar un objetivo (por ejemplo, en el primer ingreso). */
  skip?: { label: string; hint: string; onSkip: () => void }
}

/**
 * Presenta el objetivo calórico propuesto con su método (spec 015). Es una estimación aproximada y
 * revisable: la persona confirma, elige otro valor o lo deja para después; nada se guarda solo.
 */
export function PlanProposal({ input, busy = false, error, onUse, skip }: PlanProposalProps) {
  const plan = computePlan(input)
  const [other, setOther] = useState(false)
  const [text, setText] = useState('')
  const [otherError, setOtherError] = useState<string | undefined>()

  const adjustment =
    plan.adjustmentPct === 0
      ? p.adjustment.same
      : input.goal === 'muscle_gain'
        ? p.adjustment.muscle_gain(plan.adjustmentPct)
        : p.adjustment.fat_loss(plan.adjustmentPct)
  const sessions = number(input.sessionsPerWeek, 1)

  function submitOther() {
    const parsed = parseGoalInput(text)
    if (!parsed.ok) {
      setOtherError(parsed.message)
      return
    }
    setOtherError(undefined)
    onUse(parsed.kcal)
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-sm text-muted">{p.maintenanceLabel}</dt>
          <dd className="text-xl font-semibold tabular-nums">{p.kcal(plan.maintenance)}</dd>
        </div>
        <div className="rounded-lg border border-accent bg-surface p-4">
          <dt className="text-sm text-muted">{p.targetLabel}</dt>
          <dd className="text-xl font-semibold tabular-nums">{p.kcal(plan.target)}</dd>
          <dd className="text-sm text-muted">{p.range(plan.low, plan.high)}</dd>
        </div>
      </dl>

      <p>{adjustment}</p>
      <p>{p.protein(plan.proteinMinG, plan.proteinMaxG)}</p>
      {plan.notes.map((note) => (
        <p key={note} role="note" className="rounded-md border border-line bg-surface p-3 text-sm">
          {p.notes[note]}
        </p>
      ))}
      <p className="text-sm text-muted">{p.accuracy}</p>

      <details className="rounded-md border border-line bg-surface p-3">
        <summary className="cursor-pointer font-medium">{p.method.summary}</summary>
        <div className="mt-3 flex flex-col gap-1 text-sm">
          <p>{p.method.intro}</p>
          <p>
            {p.method.inputs(input.ageYears, number(input.heightCm, 1), number(input.weightKg, 1))}
          </p>
          <ul className="list-disc pl-5">
            <li>{p.method.rmr(plan.rmr)}</li>
            <li>{p.method.base(number(plan.baseFactor, 2), plan.baseKcal)}</li>
            <li>{p.method.training(plan.trainingKcalPerDay)}</li>
            <li>{p.method.maintenance(plan.maintenance)}</li>
          </ul>
          <p>{p.basis[input.sessionsBasis](sessions)}</p>
          <p className="text-muted">{p.method.trainingAssumption}</p>
        </div>
      </details>

      {error ? <ErrorState message={`${p.actions.notSaved} ${error}`} /> : null}

      {other ? (
        <div className="flex flex-col gap-3">
          <Field
            label={p.actions.otherLabel}
            hint={p.actions.otherHint}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            error={otherError}
          />
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" disabled={busy} onClick={submitOther}>
              {busy ? p.actions.saving : p.actions.useOther}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setOther(false)}
            >
              {p.actions.cancelOther}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => onUse(plan.target)}
          >
            {busy ? p.actions.saving : p.actions.use}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => setOther(true)}
          >
            {p.actions.other}
          </button>
        </div>
      )}

      {skip ? (
        <div className="flex flex-col gap-1">
          <div>
            <button type="button" className="btn-secondary" disabled={busy} onClick={skip.onSkip}>
              {skip.label}
            </button>
          </div>
          <p className="text-sm text-muted">{skip.hint}</p>
        </div>
      ) : null}
    </div>
  )
}
