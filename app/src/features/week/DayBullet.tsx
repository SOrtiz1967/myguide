import { barScale, type CalorieState } from './week'

const HEIGHT = 44
const WIDTH = 14

/**
 * Barra vertical del día: la franja es el rango del objetivo (±10 %), la barra lo registrado. En rango va
 * rellena en azul, por debajo solo con contorno y por encima rellena en ocre. Sin objetivo o sin registro
 * solo queda la pista vacía.
 */
export function DayBullet({
  state,
  goal,
  registered,
}: {
  state: CalorieState
  goal: number | null
  registered: number
}) {
  const scale = goal === null ? null : barScale(goal, registered)
  const y = (fraction: number) => HEIGHT - fraction * HEIGHT
  const hasValue = scale !== null && registered > 0 && state !== 'future'
  const barHeight = scale ? scale.value * HEIGHT : 0
  const tone =
    state === 'in-range' || state === 'in-progress'
      ? 'var(--color-accent)'
      : state === 'above'
        ? 'var(--color-warn)'
        : 'var(--color-muted)'
  const filled = state !== 'below'

  return (
    <svg aria-hidden="true" width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="2" fill="var(--color-surface-2)" />
      {scale ? (
        <>
          <rect
            x="0"
            y={y(scale.high)}
            width={WIDTH}
            height={y(scale.low) - y(scale.high)}
            fill="var(--color-line)"
            opacity="0.55"
          />
          <line
            x1="0"
            x2={WIDTH}
            y1={y(scale.high)}
            y2={y(scale.high)}
            stroke="var(--color-mark)"
          />
          <line x1="0" x2={WIDTH} y1={y(scale.low)} y2={y(scale.low)} stroke="var(--color-mark)" />
        </>
      ) : null}
      {hasValue ? (
        <rect
          x="3.5"
          y={HEIGHT - barHeight}
          width={WIDTH - 7}
          height={Math.max(barHeight, 1)}
          fill={filled ? tone : 'none'}
          stroke={tone}
          strokeWidth="1.5"
        />
      ) : null}
    </svg>
  )
}
