import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { isMuscle, muscleLabel } from '../exercises/exerciseLists'
import { StackedWeeks } from './StackedWeeks'
import { buildSleepWeeks } from './sleep'
import { ALL_GROUPS, availableGroups, buildTrainingWeeks, NO_GROUP } from './training'
import { useSleepBetween, useTrainingSets } from './useTrends'
import type { Week } from './weeks'

const copy = es.trends
const t = copy.training

const groupName = (group: string): string => {
  if (group === ALL_GROUPS) return t.all
  if (group === NO_GROUP) return t.noGroup
  return isMuscle(group) ? muscleLabel(group) : group
}

/**
 * Entrenamiento y sueño (spec 010, FR-017 a FR-022): las series registradas de un grupo muscular y el sueño promedio, por
 * semana y en el mismo eje de fechas. Sin coeficientes, sin frases causales y sin rangos recomendados.
 */
export function TrainingSleepSection({
  weeks,
  from,
  to,
}: {
  weeks: Week[]
  from: string
  to: string
}) {
  const training = useTrainingSets(from, to)
  const sleep = useSleepBetween(from, to)
  const [chosen, setChosen] = useState<string>(ALL_GROUPS)

  const rows = training.data ?? []
  const groups = availableGroups(rows, weeks)
  const group =
    chosen === ALL_GROUPS || groups.some((item) => item.group === chosen) ? chosen : ALL_GROUPS
  const setWeeks = buildTrainingWeeks(rows, weeks, group)
  const sleepWeeks = buildSleepWeeks(sleep.data ?? [], weeks)
  const hasSets = setWeeks.some((week) => week.sets > 0)
  const hasSleep = sleepWeeks.some((week) => week.averageMinutes !== null)
  const ready = training.isSuccess && sleep.isSuccess

  return (
    <section aria-labelledby="tendencias-entrenamiento" className="card flex flex-col gap-4">
      <div>
        <h2 id="tendencias-entrenamiento" className="text-lg font-bold">
          {t.title}
        </h2>
        <p className="text-sm text-muted">{t.intro}</p>
      </div>

      {training.isPending || sleep.isPending ? <LoadingState /> : null}
      {training.isError || sleep.isError ? (
        <ErrorState
          message={isNetworkError(training.error ?? sleep.error) ? copy.offline : copy.loadError}
          onRetry={() => {
            void training.refetch()
            void sleep.refetch()
          }}
        />
      ) : null}

      {ready ? (
        <>
          {hasSets ? (
            <div className="flex flex-col gap-2">
              <div role="group" aria-label={t.groupLabel} className="flex flex-wrap gap-2">
                {[{ group: ALL_GROUPS }, ...groups].map((item) => (
                  <button
                    key={item.group}
                    type="button"
                    className="chip"
                    aria-pressed={group === item.group}
                    onClick={() => setChosen(item.group)}
                  >
                    {groupName(item.group)}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">{t.groupNote}</p>
            </div>
          ) : (
            <p role="status" className="card-inset px-4 py-3">
              {t.emptyTraining}
            </p>
          )}
          {!hasSleep ? (
            <p role="status" className="card-inset px-4 py-3">
              {t.emptySleep}{' '}
              <Link to="/actividad" className="underline">
                {t.addSleep}
              </Link>
            </p>
          ) : null}
          {hasSets || hasSleep ? (
            <StackedWeeks
              sets={setWeeks}
              sleep={sleepWeeks}
              groupLabel={hasSets ? groupName(group) : ''}
            />
          ) : null}
        </>
      ) : null}
    </section>
  )
}
