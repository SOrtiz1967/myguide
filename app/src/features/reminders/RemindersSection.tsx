import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { CheckboxField } from '../../components/CheckboxField'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { WriteError } from '../../lib/mutation'
import { saveReminder } from './api'
import {
  MAX_EVERY_N,
  MIN_EVERY_N,
  REMINDER_KINDS,
  type Frequency,
  type Reminder,
  type ReminderKind,
} from './due'
import { remindersKey, useReminders } from './useReminders'

const copy = es.reminders

/** «Recordatorios» del perfil (spec 021): para cada tipo, si se activa y cada cuánto. Cada uno se guarda por separado. */
export function RemindersSection() {
  const reminders = useReminders()
  const byKind = new Map((reminders.data ?? []).map((r) => [r.kind, r]))

  return (
    <section aria-labelledby="recordatorios-titulo" className="card flex flex-col gap-4">
      <div>
        <h2 id="recordatorios-titulo" className="text-base font-bold">
          {copy.title}
        </h2>
        <p className="text-sm text-muted">{copy.intro}</p>
      </div>
      {reminders.isPending ? <LoadingState /> : null}
      {reminders.isError ? (
        <ErrorState message={copy.loadError} onRetry={() => void reminders.refetch()} />
      ) : null}
      {reminders.isSuccess ? (
        <ul className="flex flex-col gap-3">
          {REMINDER_KINDS.map((kind) => (
            <li key={kind} className="card-inset">
              <ReminderForm kind={kind} saved={byKind.get(kind)} />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted">{copy.limitNote}</p>
    </section>
  )
}

function ReminderForm({ kind, saved }: { kind: ReminderKind; saved: Reminder | undefined }) {
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(saved?.enabled ?? false)
  const [frequency, setFrequency] = useState<Frequency>(saved?.frequency ?? 'daily')
  const [everyN, setEveryN] = useState(String(saved?.every_n ?? 7))
  const [days, setDays] = useState<number[]>(saved?.weekdays ?? [])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = copy.names[kind]
  const id = `recordatorio-${kind}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setDone(false)
    const n = Number(everyN)
    if (
      enabled &&
      frequency === 'every_n_days' &&
      !(Number.isInteger(n) && n >= MIN_EVERY_N && n <= MAX_EVERY_N)
    ) {
      setError(copy.errors.every_n_invalid)
      return
    }
    if (enabled && frequency === 'weekdays' && days.length === 0) {
      setError(copy.errors.weekdays_invalid)
      return
    }
    setError(null)
    setBusy(true)
    try {
      await saveReminder({
        kind,
        enabled,
        frequency,
        everyN: Number.isInteger(n) ? n : null,
        weekdays: days,
      })
      await queryClient.invalidateQueries({ queryKey: remindersKey })
      setDone(true)
    } catch (e) {
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  const frequencies: Frequency[] =
    kind === 'supplements' ? ['daily', 'weekdays'] : ['daily', 'every_n_days', 'weekdays']

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      aria-label={name}
      className="flex flex-col gap-3"
    >
      <CheckboxField
        label={copy.enable[kind]}
        checked={enabled}
        onChange={(event) => {
          setEnabled(event.target.checked)
          setDone(false)
        }}
      />

      {enabled ? (
        <div className="flex flex-col gap-3 pl-8">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-frecuencia`} className="text-sm font-semibold text-muted">
              {copy.frequencyLabel}
            </label>
            <select
              id={`${id}-frecuencia`}
              className="control"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as Frequency)}
            >
              {frequencies.map((value) => (
                <option key={value} value={value}>
                  {copy.frequencies[value]}
                </option>
              ))}
            </select>
          </div>

          {frequency === 'every_n_days' ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-cada`} className="text-sm font-semibold text-muted">
                {copy.everyN}
              </label>
              <input
                id={`${id}-cada`}
                type="number"
                inputMode="numeric"
                min={MIN_EVERY_N}
                max={MAX_EVERY_N}
                className="control w-28"
                value={everyN}
                onChange={(event) => setEveryN(event.target.value)}
              />
              <p className="text-sm text-muted">{copy.everyNHint(MIN_EVERY_N, MAX_EVERY_N)}</p>
            </div>
          ) : null}

          {frequency === 'weekdays' ? (
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm font-semibold text-muted">{copy.weekdaysLabel}</legend>
              <div className="flex flex-wrap gap-x-4">
                {es.training.weeklyPlan.weekdays.map((label, index) => {
                  const weekday = index + 1
                  return (
                    <label key={weekday} className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-5 accent-accent"
                        checked={days.includes(weekday)}
                        onChange={(event) =>
                          setDays((current) =>
                            event.target.checked
                              ? [...current, weekday].sort((a, b) => a - b)
                              : current.filter((d) => d !== weekday),
                          )
                        }
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="notice-error px-4 py-3">
          {copy.notSaved} {error}
        </p>
      ) : null}
      {done ? <SuccessMessage>{copy.saved(name)}</SuccessMessage> : null}

      <div>
        <button type="submit" className="btn-secondary" disabled={busy}>
          {busy ? copy.saving : copy.save(name)}
        </button>
      </div>
    </form>
  )
}
