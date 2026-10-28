import { ErrorState } from '../../components/ErrorState'
import { es } from '../../copy/es'
import { addDays, formatDay, formatDayMonth } from '../meals/meals'
import { DayBullet } from './DayBullet'
import { Glyph } from './Glyph'
import { glyphTone } from './glyphTone'
import { useWeek, type DayInfo } from './useWeek'
import { weekDays } from './week'

const w = es.week
const WEEKDAY_LETTER = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const kcal = new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 0 })

function dayText(day: DayInfo): { calories: string; training: string } {
  const state = day.calorie
  let calories: string = w.noKcal
  if (state === 'future') {
    calories = (w.calorie.future ?? '').toLowerCase()
  } else if (state !== null) {
    const base = (w.calorie[state] ?? '').toLowerCase()
    const amount =
      day.entries === 0
        ? null
        : day.goal === null
          ? w.kcalOnly(kcal.format(day.registered))
          : w.kcalOf(kcal.format(day.registered), kcal.format(day.goal))
    calories = amount ? `${amount}, ${base}` : base
  }
  const training = day.training === null ? w.noKcal : (w.training[day.training] ?? '').toLowerCase()
  return { calories, training }
}

interface WeekStripProps {
  anchor: string
  today: string
  selected: string
  onSelect: (date: string) => void
  onAnchorChange: (anchor: string) => void
}

/**
 * La semana (lunes a domingo): un control por día con las calorías frente al rango del objetivo y el estado del
 * entrenamiento, en forma y texto además del color (spec 016). Describe sin juzgar.
 */
export function WeekStrip({ anchor, today, selected, onSelect, onAnchorChange }: WeekStripProps) {
  const week = useWeek(anchor, today)
  const days = weekDays(anchor)
  const isCurrentWeek = weekDays(today)[0] === days[0]

  return (
    <section aria-labelledby="semana-titulo" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="semana-titulo" className="text-xl font-semibold">
            {w.title}
          </h2>
          <p className="text-sm text-muted tabular-nums">
            {w.range(formatDayMonth(days[0]!), formatDayMonth(days[6]!))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentWeek ? (
            <button type="button" className="btn-secondary" onClick={() => onAnchorChange(today)}>
              {w.current}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            aria-label={w.prev}
            onClick={() => onAnchorChange(addDays(anchor, -7))}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            aria-label={w.next}
            onClick={() => onAnchorChange(addDays(anchor, 7))}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <ul
        aria-label={w.daysLabel}
        className="grid grid-cols-7 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface"
      >
        {week.days.map((day) => {
          const text = dayText(day)
          const isToday = day.date === today
          const isSelected = day.date === selected
          const calorie = day.calorie ?? 'none'
          const training = day.training ?? 'none'
          const letter = WEEKDAY_LETTER[days.indexOf(day.date)]
          const label = w.dayLabel(
            `${formatDay(day.date)}${isToday ? `, ${w.today}` : ''}`,
            text.calories,
            text.training,
          )
          return (
            <li key={day.date} className="min-w-0">
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(day.date)}
                className={`flex min-h-32 w-full flex-col items-center gap-1 px-0.5 py-2 ${
                  isSelected ? 'bg-surface-2 shadow-[inset_0_-2px_0_var(--color-accent)]' : ''
                }`}
              >
                <span aria-hidden="true" className="flex w-full flex-col items-center gap-1">
                  <span className="text-xs text-muted">{letter}</span>
                  <span
                    className={`grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums ${
                      isToday ? 'bg-accent text-accent-ink' : ''
                    }`}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                  <DayBullet
                    state={day.calorie ?? 'future'}
                    goal={day.goal}
                    registered={day.registered}
                  />
                  <span className="text-[11px] tabular-nums text-ink">
                    {day.calorie !== null && day.calorie !== 'future' && day.entries > 0
                      ? kcal.format(day.registered)
                      : '–'}
                  </span>
                  <span className={`flex flex-col items-center gap-0.5 ${glyphTone(calorie)}`}>
                    <Glyph kind={calorie} />
                    <span className="hidden text-[11px] sm:block">{w.calorieShort[calorie]}</span>
                  </span>
                  <span className={`flex flex-col items-center gap-0.5 ${glyphTone(training)}`}>
                    <Glyph kind={training} />
                    <span className="hidden text-[11px] sm:block">{w.training[training]}</span>
                  </span>
                </span>
                <span className="sr-only">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {week.entries.isError || week.goals.isError ? (
        <ErrorState
          message={w.loadErrorCalories}
          onRetry={() => {
            void week.entries.refetch()
            void week.goals.refetch()
          }}
        />
      ) : null}
      {week.sessions.isError ? (
        <ErrorState message={w.loadErrorTraining} onRetry={() => void week.sessions.refetch()} />
      ) : null}

      <details className="rounded-md border border-line bg-surface p-3 text-sm">
        <summary className="cursor-pointer font-medium">{w.legend.title}</summary>
        <div className="mt-2 flex flex-col gap-1 text-muted">
          <p>{w.legend.calories}</p>
          <p>{w.legend.noRecord}</p>
          <p>{w.legend.single}</p>
        </div>
      </details>
    </section>
  )
}
