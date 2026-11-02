import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { isNetworkError } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { addDaysTo } from '../measures/weightSeries'
import { formatValue } from '../foods/nutrition'
import {
  EDGE_DAYS,
  estimateMaintenance,
  type MaintenanceMissing,
  type MaintenanceWindow,
} from './maintenance'
import { useMaintenanceData } from './useTrends'

const copy = es.trends
const m = copy.maintenance

const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const kg = (value: number) => `${decimal.format(value)} kg`
const kcal = (value: number) => formatValue(Math.round(value), 'kcal')

function Missing({
  window,
  missing,
  calorieDays,
  weighIns,
}: {
  window: MaintenanceWindow
  missing: MaintenanceMissing
  calorieDays: number
  weighIns: number
}) {
  const startTo = addDaysTo(window.from, EDGE_DAYS - 1)
  const endFrom = addDaysTo(window.to, -(EDGE_DAYS - 1))
  return (
    <div className="card-inset flex flex-col gap-2 px-4 py-3">
      <h3 className="font-semibold">{m.missingTitle}</h3>
      <p>{m.progress(calorieDays, weighIns)}</p>
      <ul className="list-disc pl-5 text-sm">
        {missing.calorieDays > 0 ? <li>{m.missingDays(missing.calorieDays)}</li> : null}
        {missing.weighIns > 0 ? <li>{m.missingWeighIns(missing.weighIns)}</li> : null}
        {missing.startEdge ? (
          <li>{m.missingStart(formatDate(window.from), formatDate(startTo))}</li>
        ) : null}
        {missing.endEdge ? (
          <li>{m.missingEnd(formatDate(endFrom), formatDate(window.to))}</li>
        ) : null}
      </ul>
    </div>
  )
}

/**
 * Mantenimiento estimado (spec 010, FR-011 a FR-016): un rango de calorías por día calculado solo con lo registrado en los
 * últimos 21 días, con el método y los sesgos a la vista. Con pocos datos no hay cifra, solo lo que falta. Nunca sugiere
 * cambiar el objetivo.
 */
export function MaintenanceSection({ today }: { today: string }) {
  const { nutrition, weights } = useMaintenanceData(today)
  const result =
    nutrition.data && weights.data ? estimateMaintenance(nutrition.data, weights.data, today) : null
  const failed = nutrition.isError || weights.isError

  return (
    <section aria-labelledby="tendencias-mantenimiento" className="card flex flex-col gap-4">
      <div>
        <h2 id="tendencias-mantenimiento" className="text-lg font-bold">
          {m.title}
        </h2>
        <p className="text-sm text-muted">{m.intro}</p>
      </div>

      {nutrition.isPending || weights.isPending ? <LoadingState /> : null}
      {failed ? (
        <ErrorState
          message={isNetworkError(nutrition.error ?? weights.error) ? copy.offline : copy.loadError}
          onRetry={() => {
            void nutrition.refetch()
            void weights.refetch()
          }}
        />
      ) : null}

      {result && result.ready ? (
        <div className="card-inset flex flex-col gap-2 px-4 py-3">
          <p className="text-xl font-extrabold">
            {m.range(kcal(result.estimate.low), kcal(result.estimate.high))}
          </p>
          <p className="font-semibold">{m.label}</p>
          <p className="text-sm text-muted">
            {m.window(
              formatDate(result.estimate.window.from),
              formatDate(result.estimate.window.to),
            )}
          </p>
          <p className="text-sm">
            {m.basedOn(result.estimate.calorieDays, result.estimate.weighIns)}
          </p>
          <p className="text-sm">{m.averageKcal(kcal(result.estimate.averageKcal))}</p>
          <p className="text-sm">
            {m.weights(kg(result.estimate.startWeight), kg(result.estimate.endWeight))}
          </p>
        </div>
      ) : null}
      {result && !result.ready ? (
        <Missing
          window={result.window}
          missing={result.missing}
          calorieDays={result.calorieDays}
          weighIns={result.weighIns}
        />
      ) : null}

      {result ? (
        <>
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              {m.methodSummary}
            </summary>
            <div className="flex flex-col gap-2 pb-2">
              {m.method.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <h3 className="mt-2 font-semibold">{m.biasesTitle}</h3>
              <ul className="list-disc pl-5">
                {m.biases.map((bias) => (
                  <li key={bias}>{bias}</li>
                ))}
              </ul>
              <p>
                <Link to="/objetivo" className="underline">
                  {m.goalLink}
                </Link>
              </p>
            </div>
          </details>
        </>
      ) : null}
    </section>
  )
}
