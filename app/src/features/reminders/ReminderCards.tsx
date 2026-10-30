import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/Card'
import { es } from '../../copy/es'
import { WriteError } from '../../lib/mutation'
import { fetchLastWeight } from '../measures/api'
import { useMarks, useSupplements } from '../supplements/useSupplements'
import { saveReminder, snoozeReminder } from './api'
import { isDue, REMINDER_KINDS, type Reminder, type ReminderKind } from './due'
import { remindersKey, useLastPhotoDate, useReminders } from './useReminders'

const copy = es.reminders.card

const LINKS: Partial<Record<ReminderKind, { to: string; label: string }>> = {
  weight: { to: '/medidas', label: copy.weightAction },
  photos: { to: '/fotos', label: copy.photosAction },
}

/**
 * Los avisos de hoy (spec 021): una tarjeta discreta por cada recordatorio activo que corresponde según su frecuencia y
 * cuyo registro todavía no está. Se puede dejar para más tarde (hasta mañana) o desactivar; nunca insiste ni cuenta días.
 * Si algo falla al calcularlos no se muestra nada: el resto del inicio sigue igual.
 */
export function ReminderCards({ today }: { today: string }) {
  const queryClient = useQueryClient()
  const reminders = useReminders()
  const [error, setError] = useState<string | null>(null)

  const byKind = new Map((reminders.data ?? []).map((r) => [r.kind, r]))
  const active = (kind: ReminderKind) => byKind.get(kind)?.enabled === true

  const weight = useQuery({
    queryKey: ['measures', 'last-weight'],
    queryFn: fetchLastWeight,
    enabled: active('weight'),
  })
  const photo = useLastPhotoDate(active('photos'))
  const supplements = useSupplements()
  const marks = useMarks(today)

  const act = useMutation({
    mutationFn: async ({ reminder, disable }: { reminder: Reminder; disable: boolean }) => {
      if (disable) {
        await saveReminder({
          kind: reminder.kind,
          enabled: false,
          frequency: reminder.frequency,
          everyN: reminder.every_n,
          weekdays: reminder.weekdays,
        })
      } else {
        await snoozeReminder(reminder.kind)
      }
    },
    onMutate: () => setError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remindersKey }),
    onError: (e) => setError(e instanceof WriteError ? e.message : es.errors.generic),
  })

  if (!reminders.isSuccess) return null

  const lastWeight = weight.data?.measured_on ?? null
  const markedToday = new Set(marks.data ?? [])
  const activeSupplements = (supplements.data ?? []).filter((s) => s.archived_at === null)

  const due = REMINDER_KINDS.flatMap((kind) => {
    const reminder = byKind.get(kind)
    if (!reminder) return []
    // Sin los datos que hacen falta para decidir, no se muestra nada (mejor callar que avisar de más).
    if (kind === 'weight' && !weight.isSuccess) return []
    if (kind === 'photos' && !photo.isSuccess) return []
    if (kind === 'supplements' && !(supplements.isSuccess && marks.isSuccess)) return []

    const context =
      kind === 'weight'
        ? { today, lastDoneOn: lastWeight, doneToday: lastWeight === today }
        : kind === 'photos'
          ? { today, lastDoneOn: photo.data ?? null, doneToday: photo.data === today }
          : {
              today,
              lastDoneOn: null,
              doneToday:
                activeSupplements.length === 0 ||
                activeSupplements.every((s) => markedToday.has(s.id)),
            }
    return isDue(reminder, context) ? [reminder] : []
  })

  if (due.length === 0 && !error) return null

  return (
    <section aria-label={copy.region} className="flex flex-col gap-3">
      {due.map((reminder) => {
        const link = LINKS[reminder.kind]
        return (
          <Card key={reminder.kind} as="section" aria-label={copy.names[reminder.kind]}>
            <div className="flex flex-col gap-3">
              <p>{copy.text[reminder.kind]}</p>
              <div className="flex flex-wrap items-center gap-3">
                {link ? (
                  <Link to={link.to} className="btn-primary">
                    {link.label}
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={act.isPending}
                  aria-label={`${copy.later}: ${copy.names[reminder.kind]}`}
                  onClick={() => act.mutate({ reminder, disable: false })}
                >
                  {copy.later}
                </button>
                <button
                  type="button"
                  className="btn-quiet"
                  disabled={act.isPending}
                  aria-label={`${copy.disable}: ${copy.names[reminder.kind]}`}
                  onClick={() => act.mutate({ reminder, disable: true })}
                >
                  {copy.disable}
                </button>
              </div>
            </div>
          </Card>
        )
      })}
      {error ? (
        <p role="alert" className="notice-error px-4 py-3">
          {error}
        </p>
      ) : null}
    </section>
  )
}
