import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { formatActivity } from '../activity/activity'
import { niceTicks, shortDate } from '../measures/weightSeries'
import type { SleepWeek } from './sleep'
import type { TrainingWeek } from './training'

const copy = es.trends.training
const PANEL_HEIGHT = 110
const GAP = 34
const MARGIN = { left: 48, right: 12, top: 18, bottom: 26 }
const DEFAULT_WIDTH = 600

const axisNumber = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

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

const sleepText = (week: SleepWeek) =>
  week.averageMinutes === null
    ? es.trends.noData.toLowerCase()
    : copy.sleep(formatActivity('sleep', Math.round(week.averageMinutes)), week.nights)

interface StackedWeeksProps {
  sets: TrainingWeek[]
  sleep: SleepWeek[]
  /** Nombre del grupo mostrado, para la lectura. */
  groupLabel: string
}

/**
 * Series y sueño por semana (spec 010, FR-017 a FR-022): dos paneles con las mismas semanas en el mismo eje horizontal,
 * uno debajo del otro. No hay un eje vertical compartido ni líneas que unan las series: cada una se lee por separado, así
 * el gráfico no sugiere ninguna relación. Se recorre con el puntero y las flechas, y trae una tabla equivalente. Las
 * semanas sin sueño no dibujan barra (sin dato, no cero).
 */
export function StackedWeeks({ sets, sleep, groupLabel }: StackedWeeksProps) {
  const [box, width] = useWidth()
  const readoutId = useId()
  const [active, setActive] = useState<number | null>(null)
  const count = sets.length

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 40)
  const band = plotWidth / Math.max(count, 1)
  const barWidth = Math.max(Math.min(band * 0.6, 28), 2)
  const x = (index: number) => MARGIN.left + band * index + band / 2

  const setsMax = Math.max(1, ...sets.map((row) => row.sets))
  const sleepMax = Math.max(1, ...sleep.map((row) => (row.averageMinutes ?? 0) / 60))
  const setsTicks = niceTicks(0, setsMax, 3)
  const sleepTicks = niceTicks(0, sleepMax, 3)
  const setsTop = Math.max(...setsTicks, setsMax)
  const sleepTop = Math.max(...sleepTicks, sleepMax)

  const topSets = MARGIN.top
  const topSleep = MARGIN.top + PANEL_HEIGHT + GAP
  const height = topSleep + PANEL_HEIGHT + MARGIN.bottom
  const ySets = (value: number) => topSets + PANEL_HEIGHT * (1 - value / setsTop)
  const ySleep = (hours: number) => topSleep + PANEL_HEIGHT * (1 - hours / sleepTop)
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(Math.floor(plotWidth / 56), 1)))

  const current = active !== null && active < count ? active : null
  const shown = current !== null ? { sets: sets[current]!, sleep: sleep[current]! } : null
  const first = sets[0]?.week.start ?? ''
  const last = sets[count - 1]?.week.end ?? ''

  const weekText = (row: TrainingWeek) =>
    es.trends.weekLabel(formatDate(row.week.start), formatDate(row.week.end))

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (count === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const index = Math.floor((event.clientX - rect.left - MARGIN.left) / band)
    setActive(Math.min(Math.max(index, 0), count - 1))
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (count === 0) return
    const end = count - 1
    const start = current ?? end
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = Math.max(start - 1, 0)
    else if (event.key === 'ArrowRight') next = Math.min(start + 1, end)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = end
    if (next === null) return
    event.preventDefault()
    setActive(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={box}
        role="group"
        tabIndex={0}
        aria-label={copy.chartLabel(count, formatDate(first), formatDate(last))}
        aria-describedby={readoutId}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((value) => value ?? count - 1)}
        className="touch-pan-y rounded-lg"
      >
        <svg
          aria-hidden="true"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full select-none"
        >
          {[
            { title: copy.setsPanel, top: topSets, ticks: setsTicks, y: ySets, unit: 'series' },
            { title: copy.sleepPanel, top: topSleep, ticks: sleepTicks, y: ySleep, unit: 'horas' },
          ].map((panel) => (
            <g key={panel.title}>
              <text x={MARGIN.left} y={panel.top - 6} fontSize="11" fill="var(--color-muted)">
                {`${panel.title} (${panel.unit})`}
              </text>
              {panel.ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={panel.y(tick)}
                    y2={panel.y(tick)}
                    stroke="var(--color-line)"
                    strokeOpacity="0.25"
                  />
                  <text
                    x={MARGIN.left - 8}
                    y={panel.y(tick) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--color-muted)"
                  >
                    {axisNumber.format(tick)}
                  </text>
                </g>
              ))}
            </g>
          ))}

          {shown ? (
            <rect
              x={x(current!) - band / 2}
              y={topSets}
              width={band}
              height={topSleep + PANEL_HEIGHT - topSets}
              fill="var(--color-line)"
              fillOpacity="0.15"
            />
          ) : null}

          {sets.map((row, index) => (
            <rect
              key={`s-${row.week.start}`}
              x={x(index) - barWidth / 2}
              y={ySets(row.sets)}
              width={barWidth}
              height={Math.max(topSets + PANEL_HEIGHT - ySets(row.sets), 0)}
              fill="var(--color-mark)"
            />
          ))}
          {sleep.map((row, index) =>
            row.averageMinutes === null ? null : (
              <rect
                key={`z-${row.week.start}`}
                x={x(index) - barWidth / 2}
                y={ySleep(row.averageMinutes / 60)}
                width={barWidth}
                height={Math.max(topSleep + PANEL_HEIGHT - ySleep(row.averageMinutes / 60), 0)}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2"
              />
            ),
          )}

          {sets.map((row, index) =>
            index % labelEvery === 0 ? (
              <text
                key={`l-${row.week.start}`}
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-muted)"
              >
                {shortDate(row.week.start)}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <p id={readoutId} role="status" className="min-h-6 text-sm">
        {shown
          ? copy.reading(
              weekText(shown.sets),
              `${copy.sets(shown.sets.sets)}${groupLabel ? ` (${groupLabel})` : ''}`,
              sleepText(shown.sleep),
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
                  {copy.table.week}
                </th>
                <th scope="col" className="px-3 py-2">
                  {copy.table.sets}
                </th>
                <th scope="col" className="px-3 py-2">
                  {copy.table.sleep}
                </th>
                <th scope="col" className="px-3 py-2">
                  {copy.table.nights}
                </th>
              </tr>
            </thead>
            <tbody>
              {sets
                .map((row, index) => ({ row, night: sleep[index]! }))
                .reverse()
                .map(({ row, night }) => (
                  <tr key={row.week.start} className="border-t border-line/25">
                    <th scope="row" className="px-3 py-2 font-normal">
                      {weekText(row)}
                    </th>
                    <td className="px-3 py-2">{row.sets}</td>
                    <td className="px-3 py-2">
                      {night.averageMinutes === null
                        ? es.trends.noData
                        : formatActivity('sleep', Math.round(night.averageMinutes))}
                    </td>
                    <td className="px-3 py-2">{night.nights}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
