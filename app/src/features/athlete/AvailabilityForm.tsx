import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { CheckboxField } from '../../components/CheckboxField'
import { ErrorState } from '../../components/ErrorState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { newRequestId } from '../../lib/ids'
import { WriteError } from '../../lib/mutation'
import { saveAvailability, type AvailabilityEntry } from './api'
import {
  EQUIPMENT,
  PLACES,
  USUAL_TIMES,
  validateAvailability,
  type AthleteEquipment,
  type Place,
  type UsualTime,
} from './athlete'
import { athleteKey } from './useAthlete'

const t = es.athlete.availability

/** Disponibilidad con vigencia (spec 025, FR-003 y FR-007). Es orientativa y nunca una restricción. */
export function AvailabilityForm({
  current,
  history,
}: {
  current: AvailabilityEntry | null
  history: AvailabilityEntry[]
}) {
  const queryClient = useQueryClient()
  const [days, setDays] = useState(current ? String(current.days_per_week) : '')
  const [minutes, setMinutes] = useState(
    current?.session_minutes ? String(current.session_minutes) : '',
  )
  const [usualTime, setUsualTime] = useState<string>(current?.usual_time ?? '')
  const [place, setPlace] = useState<string>(current?.place ?? '')
  const [equipment, setEquipment] = useState<AthleteEquipment[]>(current?.equipment ?? [])
  const [requestId, setRequestId] = useState(newRequestId)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    if (
      days === '' &&
      minutes === '' &&
      usualTime === '' &&
      place === '' &&
      equipment.length === 0
    ) {
      setError(null)
      return
    }
    const values = {
      days_per_week: Number(days),
      session_minutes: minutes === '' ? null : Number(minutes),
      usual_time: (usualTime || null) as UsualTime | null,
      place: (place || null) as Place | null,
      equipment,
    }
    const problem = validateAvailability(values)
    if (problem) {
      setError(
        problem === 'days'
          ? es.athlete.errors.out_of_range
          : problem === 'minutes'
            ? es.athlete.errors.out_of_range
            : es.athlete.errors.too_many,
      )
      return
    }
    setError(null)
    setBusy(true)
    try {
      await saveAvailability(
        {
          days: values.days_per_week,
          minutes: values.session_minutes,
          usualTime: values.usual_time,
          place: values.place,
          equipment: values.equipment,
          effectiveFrom: null,
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

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.days}</span>
        <select
          className="min-h-11 control px-3 py-2"
          value={days}
          onChange={(event) => setDays(event.target.value)}
        >
          <option value="">{t.choose}</option>
          {[1, 2, 3, 4, 5, 6, 7].map((count) => (
            <option key={count} value={String(count)}>
              {t.daysOption(count)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.minutes}</span>
        <input
          type="number"
          inputMode="numeric"
          min={15}
          max={240}
          className="control"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.usualTime}</span>
        <select
          className="min-h-11 control px-3 py-2"
          value={usualTime}
          onChange={(event) => setUsualTime(event.target.value)}
        >
          <option value="">{t.choose}</option>
          {USUAL_TIMES.map((value) => (
            <option key={value} value={value}>
              {t.times[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.place}</span>
        <select
          className="min-h-11 control px-3 py-2"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
        >
          <option value="">{t.choose}</option>
          {PLACES.map((value) => (
            <option key={value} value={value}>
              {t.places[value]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold text-muted">{t.equipment}</legend>
        {EQUIPMENT.map((item) => (
          <CheckboxField
            key={item}
            label={t.equipmentOptions[item]}
            checked={equipment.includes(item)}
            onChange={(event) =>
              setEquipment((list) =>
                event.target.checked ? [...list, item] : list.filter((value) => value !== item),
              )
            }
          />
        ))}
      </fieldset>

      {error ? <ErrorState message={error} /> : null}
      {saved ? <SuccessMessage>{t.saved}</SuccessMessage> : null}

      <div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {t.save}
        </button>
      </div>

      {history.length > 1 ? (
        <section aria-label={t.history} className="flex flex-col gap-1 text-sm text-muted">
          <h3 className="font-semibold">{t.history}</h3>
          <ul className="flex flex-col gap-1">
            {history.map((entry) => (
              <li key={entry.created_at}>
                {entry.effective_from}: {t.daysOption(entry.days_per_week)}
                {entry.session_minutes ? `, ${entry.session_minutes} min` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </form>
  )
}
