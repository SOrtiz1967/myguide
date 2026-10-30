import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { HomeSection } from '../home/HomeSection'
import { es } from '../../copy/es'
import { CaloriesBlock } from '../home/CaloriesBlock'
import { TrainingBlock } from '../home/TrainingBlock'
import { formatDay } from '../meals/meals'
import { fetchWeightsBetween } from '../measures/api'
import { formatMeasure } from '../measures/measures'
import { useProfile } from '../profile/useProfile'
import { DaySupplements } from '../supplements/DaySupplements'
import { useDaySessions } from '../training/useCalendar'
import { statusLabel } from '../training/trainingText'
import { WorkoutDayActions } from '../training/WorkoutDayActions'

const p = es.week.panel

function WeightRow({ date, isToday }: { date: string; isToday: boolean }) {
  const { data: profile } = useProfile()
  const weight = useQuery({
    queryKey: ['measures', 'day', date],
    queryFn: () => fetchWeightsBetween(date, date),
  })
  const value = weight.data?.at(-1)

  return (
    <HomeSection tone="body" title={p.weightTitle}>
      {weight.isPending ? <LoadingState /> : null}
      {weight.isError ? (
        <ErrorState message={es.home.loadError} onRetry={() => void weight.refetch()} />
      ) : null}
      {weight.isSuccess && value ? (
        <p className="text-3xl font-extrabold tabular-nums">
          {formatMeasure('weight', value.value)}
        </p>
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
    </HomeSection>
  )
}

function DaySessions({ date, today }: { date: string; today: string }) {
  const sessions = useDaySessions(date)
  return (
    <HomeSection tone="training" className="lg:col-span-2" title={p.trainingTitle}>
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
      <WorkoutDayActions date={date} today={today} showCompleted={false} />
    </HomeSection>
  )
}

/**
 * Lo del día elegido: calorías frente al objetivo (la tarjeta de la spec 004), peso, entrenamiento y accesos
 * para registrar. Un día que no es hoy se distingue con claridad para no confundir sus registros con los de hoy.
 */
export function DayPanel({ date, today }: { date: string; today: string }) {
  const isToday = date === today
  return (
    <section aria-labelledby="panel-dia-titulo" className="flex flex-col gap-4">
      <header>
        <p className={`text-sm font-semibold ${isToday ? 'text-accent-soft' : 'text-warn'}`}>
          {isToday ? p.today : p.notToday}
        </p>
        <h2 id="panel-dia-titulo" className="text-2xl font-extrabold tracking-tight">
          {formatDay(date)}
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CaloriesBlock date={date} />
        {isToday ? <TrainingBlock /> : <DaySessions date={date} today={today} />}
        <WeightRow date={date} isToday={isToday} />
        <HomeSection title={p.actionsTitle} className="md:col-span-2 lg:col-span-3">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
        </HomeSection>
        <DaySupplements date={date} today={today} />
      </div>
    </section>
  )
}
