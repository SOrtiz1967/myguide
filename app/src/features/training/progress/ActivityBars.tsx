import { es } from '../../../copy/es'
import { formatDate } from '../../../lib/format'
import type { Bucket, Grouping } from './activity'

const copy = es.trainingActivity

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function labelOf(bucket: Bucket, grouping: Grouping): string {
  if (grouping === 'week') return copy.weekLabel(formatDate(bucket.start), formatDate(bucket.end))
  const [year, month] = bucket.start.split('-').map(Number) as [number, number]
  return copy.monthLabel(`${MONTHS[month - 1]} de ${year}`)
}

/**
 * Sesiones realizadas por tramo (spec 012, FR-013). Cada fila dice su cantidad en texto, así la barra es solo un apoyo
 * visual: no depende del color ni hace falta otra tabla. Los tramos sin sesiones figuran con cero registradas, sin mensajes.
 */
export function ActivityBars({ buckets, grouping }: { buckets: Bucket[]; grouping: Grouping }) {
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <ul aria-label={copy.chartLabel} className="flex flex-col gap-2">
      {[...buckets].reverse().map((bucket) => (
        <li key={bucket.start} className="card-inset flex flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="break-words">{labelOf(bucket, grouping)}</span>
            <span className="font-semibold">
              {bucket.count === 0 ? copy.none : copy.sessions(bucket.count)}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 rounded-full bg-surface-3">
            <div
              className="h-2 rounded-full bg-mark"
              style={{ width: `${(bucket.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
