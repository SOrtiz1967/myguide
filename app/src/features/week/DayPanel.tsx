import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { CaloriesBlock } from '../home/CaloriesBlock'
import { TrainingBlock } from '../home/TrainingBlock'
import { formatDay } from '../meals/meals'
import { fetchWeightsBetween } from '../measures/api'
import { formatMeasure } from '../measures/measures'
import { useProfile } from '../profile/useProfile'
import { useDaySessions } from '../training/useCalendar'
import { statusLabel } from '../training/trainingText'

const p = es.week.panel

function WeightRow({ date, isToday }: { date: string; isToday: boolean }) {
  const { data: profile } = useProfile()
  const weight = useQuery({
    queryKey: ['measures', 'day', date],
    queryFn: () => fetchWeightsBetween(date, date),
  })
  const value = weight.data?.at(-1)

  return (
    <section aria-labelledby={`peso-${date}`} className="flex flex-col gap-1">
      <h3 id={`peso-${date}`} className="text-lg font-semibold">
        {p.weightTitle}
      </h3>
      {weight.isPending ? <LoadingState /> : null}
      {weight.isError ? (
        <ErrorState message={es.home.loadError} onRetry={() => void weight.refetch()} />
      ) : null}
      {weight.isSuccess && value ? (
        <p className="text-xl font-semibold tabular-nums">{formatMeasure('weight', value.value)}</p>
      ) : null}
      {weight.isSuccess && !value ? <p className="text-muted">{p.noWeight}</p> : null}
      {weight.isSuccess && !value && isToday && profile?.weight_reminder ? (
        <p role="note" className="flex flex-wrap items-center gap-x-3 text-sm">
          <span>{p.reminder}</span>
          <Link to="/medidas" className="underline">
            {p.reminderAction}
          </Link>
        </p>
      ) : null}
    </section>
  )
}

function DaySessions({ date }: { date: string }) {
  const sessions = useDaySessions(date)
  return (
    <section aria-labelledby={`entreno-${date}`} className="flex flex-col gap-2">
      <h3 id={`entreno-${date}`} className="text-lg font-semibold">
        {p.trainingTitle}
      </h3>
      {sessions.isPending ? <LoadingState /> : null}
      {sessions.isError ? (
        <ErrorState message={es.home.loadError} onRetry={() => void sessions.refetch()} />
      ) : null}
      {sessions.isSuccess && sessions.data.length === 0 ? (
        <p className="text-muted">{p.noTraining}</p>
      ) : null}
      {sessions.isSuccess && sessions.data.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {sessions.data.map((session) => (
            <li key={session.id}>
              <Link
                to={`/entrenamiento/sesion/${session.id}`}
                className="flex min-h-11 items-center underline"
              >
                {p.sessionRow(statusLabel(session.status), session.routine_name)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/**
 * Lo del día elegido: calorías frente al objetivo (la tarjeta de la spec 004), peso, entrenamiento y accesos
 * para registrar. Un día que no es hoy se distingue con claridad para no confundir sus registros con los de hoy.
 */
export function DayPanel({ date, today }: { date: string; today: string }) {
  const isToday = date === today
  return (
    <aside
      aria-labelledby="panel-dia-titulo"
      className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-4"
    >
      <header>
        <p className={`text-sm ${isToday ? 'text-accent' : 'text-warn'}`}>
          {isToday ? p.today : p.notToday}
        </p>
        <h2 id="panel-dia-titulo" className="text-xl font-semibold">
          {formatDay(date)}
        </h2>
      </header>

      <CaloriesBlock date={date} />
      <WeightRow date={date} isToday={isToday} />
      {isToday ? <TrainingBlock /> : <DaySessions date={date} />}

      <section aria-labelledby={`acciones-${date}`} className="flex flex-col gap-2">
        <h3 id={`acciones-${date}`} className="text-lg font-semibold">
          {p.actionsTitle}
        </h3>
        <ul className="grid grid-cols-1 gap-2">
          <li>
            <Link to="/medidas" className="btn-secondary w-full">
              {p.addWeight}
            </Link>
          </li>
          <li>
            <Link to={`/entrenamiento/dia/${date}`} className="btn-secondary w-full">
              {p.addWorkout}
            </Link>
          </li>
          <li>
            <Link to="/actividad" className="btn-secondary w-full">
              {p.addSleep}
            </Link>
          </li>
        </ul>
      </section>
    </aside>
  )
}
