interface MeterProps {
  /** Lo registrado hasta ahora. */
  value: number
  /** Meta de referencia: el extremo de la barra es el mayor entre ella, el rango y lo registrado. */
  goal: number
  /** Rango de referencia opcional (por ejemplo ±10 % de la meta), sombreado en la barra. */
  low?: number
  high?: number
  /** Texto que dice las cifras: la barra es un apoyo visual y no la única fuente del dato. */
  caption: string
}

/** Barra de avance con rango. Sin colores de juicio: el dato está en `caption`. */
export function Meter({ value, goal, low, high, caption }: MeterProps) {
  const top = Math.max(goal, high ?? 0, value, 1) * 1.05
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / top) * 100))}%`
  return (
    <div>
      <div
        aria-hidden="true"
        className="relative h-3 rounded-full bg-tone-calorie-deep"
        data-testid="meter-bar"
      >
        {low !== undefined && high !== undefined ? (
          <div
            className="absolute inset-y-0 rounded-full bg-tone-calorie-range"
            style={{ left: pct(low), width: `${Math.max(0, ((high - low) / top) * 100)}%` }}
          />
        ) : null}
        <div
          className="relative h-3 rounded-full bg-tone-calorie-bar"
          style={{ width: pct(value) }}
        />
      </div>
      <p className="mt-2 text-sm text-tone-calorie-ink">{caption}</p>
    </div>
  )
}
