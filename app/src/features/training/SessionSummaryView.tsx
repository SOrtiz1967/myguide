import { Link } from 'react-router'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { measurementLabel } from '../exercises/exerciseLists'
import type { WorkoutSession } from './api'
import { effortLabel, markLabels, setsCountLabel, statusLabel, summarizeSet } from './trainingText'

const t = es.training
const s = t.session

/** Encabezado común de una sesión: fecha, estado y marcas. */
export function SessionHeader({ session }: { session: WorkoutSession }) {
  const marks = markLabels(session)
  return (
    <header className="flex flex-col gap-1">
      <h1 className="break-words text-2xl font-semibold tracking-tight">
        {s.title(formatDate(session.session_date))}
      </h1>
      <p className="text-muted">{[statusLabel(session.status), ...marks].join(' · ')}</p>
      {session.routine_name ? <p className="text-muted">{session.routine_name}</p> : null}
    </header>
  )
}

/** Lo realizado: cada ejercicio con sus series (con unidades), su esfuerzo percibido y su nota. */
export function DoneList({ session }: { session: WorkoutSession }) {
  const exercises = [...session.session_exercises].sort((a, b) => a.position - b.position)
  if (exercises.length === 0) return <p className="text-muted">{s.noExercises}</p>
  return (
    <ul className="flex flex-col gap-4">
      {exercises.map((exercise) => {
        const sets = [...exercise.session_sets].sort((a, b) => a.position - b.position)
        return (
          <li
            key={exercise.id}
            className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
          >
            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold">{exercise.exercise_name}</h3>
              <p className="text-sm text-muted">
                {measurementLabel(exercise.measurement_type)} · {setsCountLabel(sets.length)}
              </p>
            </div>
            {sets.length > 0 ? (
              <ol className="ml-5 list-decimal">
                {sets.map((set) => (
                  <li key={set.id}>{summarizeSet(exercise.measurement_type, set)}</li>
                ))}
              </ol>
            ) : null}
            <p className="text-sm">
              {s.effort}: {effortLabel(exercise.effort)}
            </p>
            {exercise.note ? (
              <p className="whitespace-pre-line break-words">{exercise.note}</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Vista de una sesión que no se está editando (realizada, planificada o cancelada). */
export function SessionSummaryView({ session }: { session: WorkoutSession }) {
  const plan = [...session.session_plan_items].sort((a, b) => a.position - b.position)
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/entrenamiento" className="inline-flex min-h-11 items-center underline">
          {s.back}
        </Link>
      </div>
      <SessionHeader session={session} />

      {plan.length > 0 ? (
        <section aria-labelledby="plan-titulo" className="flex flex-col gap-2">
          <h2 id="plan-titulo" className="text-xl font-semibold">
            {s.planTitle}
          </h2>
          <ul className="ml-5 list-disc">
            {plan.map((item) => (
              <li key={item.id}>{s.planItem(item.exercise_name, item.sets)}</li>
            ))}
          </ul>
        </section>
      ) : session.status === 'planned' || session.status === 'cancelled' ? (
        <p className="text-muted">{t.noPlan}</p>
      ) : null}

      {session.status === 'completed' ? (
        <section aria-labelledby="realizado-titulo" className="flex flex-col gap-3">
          <h2 id="realizado-titulo" className="text-xl font-semibold">
            {s.doneTitle}
          </h2>
          <DoneList session={session} />
        </section>
      ) : null}

      {session.note ? (
        <section aria-labelledby="nota-titulo" className="flex flex-col gap-1">
          <h2 id="nota-titulo" className="text-xl font-semibold">
            {s.note}
          </h2>
          <p className="whitespace-pre-line break-words">{session.note}</p>
        </section>
      ) : null}
    </div>
  )
}
