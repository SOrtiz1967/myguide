import { es } from '../../../copy/es'
import { formatDate } from '../../../lib/format'
import { formatDifference, formatMeasure, type Unit } from './measures'
import type { Comparison, PeriodSummary } from './series'

const copy = es.trainingProgress.compare

function Column({ title, summary, unit }: { title: string; summary: PeriodSummary; unit: Unit }) {
  const { from, to } = summary.range
  return (
    <div className="card-inset flex flex-col gap-1 p-4">
      <h4 className="font-semibold">{title}</h4>
      <p className="text-sm text-muted">
        {copy.dates(from ? formatDate(from) : '', formatDate(to))}
      </p>
      <p className="text-sm">{copy.sessions(summary.sessions)}</p>
      <p className="text-sm text-muted">{copy.average}</p>
      <p className="text-lg font-bold">
        {summary.average === null ? copy.noAverage : formatMeasure(summary.average, unit)}
      </p>
    </div>
  )
}

/**
 * Comparación de dos períodos del mismo largo (spec 012, FR-010 a FR-012): el promedio por sesión de cada uno con su
 * cantidad de sesiones, y la diferencia como número con su unidad. Nunca se califica como mejora ni retroceso.
 */
export function ComparePanel({ comparison, unit }: { comparison: Comparison; unit: Unit }) {
  return (
    <section aria-labelledby="comparar-titulo" className="card flex flex-col gap-4">
      <div>
        <h3 id="comparar-titulo" className="text-base font-bold">
          {copy.title}
        </h3>
        <p className="text-sm text-muted">{copy.intro}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Column title={copy.current} summary={comparison.current} unit={unit} />
        <Column title={copy.previous} summary={comparison.previous} unit={unit} />
      </div>

      {comparison.difference === null ? (
        <p role="status" className="card-inset px-4 py-3">
          {copy.notEnough}
        </p>
      ) : (
        <p role="status" className="font-semibold">
          {copy.difference}: {formatDifference(comparison.difference, unit)}
        </p>
      )}
    </section>
  )
}
