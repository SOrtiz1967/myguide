import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { es } from '../../../copy/es'
import { formatDate } from '../../../lib/format'
import { dateTicks, daysBetween, niceTicks, shortDate, xRatio } from '../../measures/weightSeries'
import { formatMeasure, type Unit } from './measures'
import type { ProgressPoint } from './series'

const copy = es.trainingProgress
const HEIGHT = 260
const MARGIN = { left: 52, right: 14, top: 12, bottom: 30 }
const DEFAULT_WIDTH = 600

const axisNumber = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const axisUnit: Record<Unit, string> = { kg: 'kg', reps: 'repeticiones', s: 'segundos', km: 'km' }

/** El ancho real del contenedor, para dibujar el texto a su tamaño y no escalado. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry?.contentRect.width ?? 0)
      if (next > 0) setWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/** Eje vertical: el rango de los datos con un margen del 10 %, sin bajar de cero (las medidas no son negativas). */
function domain(points: ProgressPoint[]): { min: number; max: number } {
  const values = points.map((p) => p.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max((high - low) * 0.1, high === low ? Math.max(Math.abs(high) * 0.1, 1) : 0)
  return { min: Math.max(low - pad, 0), max: high + pad }
}

interface ProgressChartProps {
  points: ProgressPoint[]
  unit: Unit
  /** Une los puntos con una línea; solo con 3 o más sesiones con dato (Principio V). */
  showTrend: boolean
  /** Primer y último día del eje horizontal. */
  from: string
  to: string
  stale?: boolean
}

/**
 * La evolución de un ejercicio (spec 012): un punto por sesión y, con 3 o más, una línea que las une en orden de fecha.
 * Se lee con el puntero, con las flechas del teclado y en una tabla alternativa; el punto y la línea se distinguen por
 * forma, no solo por color. Mismo estilo que el gráfico del peso.
 */
export function ProgressChart({
  points,
  unit,
  showTrend,
  from,
  to,
  stale = false,
}: ProgressChartProps) {
  const [box, width] = useWidth()
  const readoutId = useId()
  const [active, setActive] = useState<number | null>(null)

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 40)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const { min, max } = domain(points)
  const x = (date: string) => MARGIN.left + xRatio(date, from, to) * plotWidth
  const y = (value: number) => MARGIN.top + (1 - (value - min) / (max - min)) * plotHeight
  const withYear = daysBetween(from, to) > 330
  const yTicks = niceTicks(min, max)
  const xTicks = dateTicks(from, to, width < 420 ? 3 : 5)
  const radius = points.length > 120 ? 3 : 4

  const current = active !== null && active < points.length ? active : null
  const shown = current !== null ? points[current]! : null

  function nearest(clientX: number, rect: DOMRect): number {
    const px = clientX - rect.left
    let best = 0
    let distance = Infinity
    points.forEach((point, index) => {
      const d = Math.abs(x(point.date) - px)
      if (d < distance) {
        distance = d
        best = index
      }
    })
    return best
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (points.length === 0) return
    setActive(nearest(event.clientX, event.currentTarget.getBoundingClientRect()))
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (points.length === 0) return
    const last = points.length - 1
    const start = current ?? last
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = Math.max(start - 1, 0)
    else if (event.key === 'ArrowRight') next = Math.min(start + 1, last)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    setActive(next)
  }

  const effortText = (point: ProgressPoint) =>
    point.effort === null ? copy.effortNone : copy.effort(point.effort)

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label={copy.legend}>
        <li className="flex items-center gap-2">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="4" fill="var(--color-mark)" />
          </svg>
          {copy.legendPoint}
        </li>
        {showTrend ? (
          <li className="flex items-center gap-2">
            <svg aria-hidden="true" width="24" height="16" viewBox="0 0 24 16">
              <path
                d="M2 8h20"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            {copy.legendLine}
          </li>
        ) : null}
      </ul>

      <div
        ref={box}
        role="group"
        tabIndex={0}
        aria-label={copy.chartLabel(points.length, formatDate(from), formatDate(to))}
        aria-describedby={readoutId}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((value) => value ?? points.length - 1)}
        className={`touch-pan-y rounded-lg transition-opacity ${stale ? 'opacity-60' : ''}`}
      >
        <svg
          aria-hidden="true"
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block max-w-full select-none"
        >
          <text
            x={MARGIN.left - 8}
            y={MARGIN.top - 2}
            textAnchor="end"
            fontSize="11"
            fill="var(--color-muted)"
          >
            {axisUnit[unit]}
          </text>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-line)"
                strokeOpacity="0.25"
                strokeWidth="1"
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-muted)"
              >
                {axisNumber.format(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick, index) => (
            <text
              key={tick}
              x={x(tick)}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill="var(--color-muted)"
            >
              {shortDate(tick, withYear)}
            </text>
          ))}

          {shown ? (
            <line
              x1={x(shown.date)}
              x2={x(shown.date)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
          ) : null}

          {showTrend ? (
            <path
              d={points
                .map(
                  (p, i) =>
                    `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`,
                )
                .join(' ')}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {points.map((point, index) => (
            <circle
              key={point.key}
              cx={x(point.date)}
              cy={y(point.value)}
              r={index === current ? radius + 2 : radius}
              fill={index === current ? 'var(--color-ink)' : 'var(--color-mark)'}
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>

      <p id={readoutId} role="status" className="min-h-6 text-sm">
        {shown
          ? copy.reading(
              formatDate(shown.date),
              formatMeasure(shown.value, unit),
              effortText(shown),
            )
          : copy.readingHint}
      </p>

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">
          {copy.table.summary}
        </summary>
        <div
          role="region"
          tabIndex={0}
          aria-label={copy.table.summary}
          className="max-h-72 overflow-auto rounded-lg bg-surface-3"
        >
          <table className="w-full text-left">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2">
                  {copy.table.date}
                </th>
                <th scope="col" className="px-3 py-2">
                  {copy.table.value}
                </th>
                <th scope="col" className="px-3 py-2">
                  {copy.table.effort}
                </th>
                <th scope="col" className="px-3 py-2">
                  {copy.table.sets}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((point) => (
                <tr key={point.key} className="border-t border-line/25">
                  <th scope="row" className="px-3 py-2 font-normal">
                    {formatDate(point.date)}
                  </th>
                  <td className="px-3 py-2">{formatMeasure(point.value, unit)}</td>
                  <td className="px-3 py-2">{effortText(point)}</td>
                  <td className="px-3 py-2">{point.usedSets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
