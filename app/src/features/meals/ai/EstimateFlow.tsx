import { useRef, useState } from 'react'
import { ErrorState } from '../../../components/ErrorState'
import { es } from '../../../copy/es'
import { newRequestId } from '../../../lib/ids'
import { type EstimatedItem, estimateMeal } from './api'
import { EstimateReview } from './EstimateReview'
import { estimateErrorMessage, MAX_TEXT } from './estimate'
import type { Meal } from '../meals'

const copy = es.meals.ai

interface EstimateFlowProps {
  userId: string
  date: string
  meal: Meal
  /** Vuelve a la pantalla de elegir alimento. */
  onCancel: () => void
  /** Pasa a escribir a mano; el texto escrito se conserva en la pantalla anterior. */
  onManual: () => void
  /** Se llama solo cuando el servidor confirmó el guardado. */
  onAdded: () => void
}

/**
 * «Describir con IA» (spec 009): la persona escribe lo que comió, recibe una propuesta, la corrige y recién
 * al confirmar se guarda. Si la IA falla, lo escrito se conserva y el camino manual sigue a la vista.
 */
export function EstimateFlow({ date, meal, onCancel, onManual, onAdded }: EstimateFlowProps) {
  const [text, setText] = useState('')
  const [requestId, setRequestId] = useState(newRequestId)
  const [items, setItems] = useState<EstimatedItem[] | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  // Cada espera tiene su marca: si la persona la cancela, una respuesta tardía se ignora.
  const attempt = useRef(0)

  async function estimate() {
    if (waiting) return
    const trimmed = text.trim()
    if (trimmed === '') {
      setFieldError(copy.errors.textRequired)
      return
    }
    if (trimmed.length > MAX_TEXT) {
      setFieldError(copy.errors.textTooLong(MAX_TEXT))
      return
    }
    setFieldError(null)
    setError(null)
    setWaiting(true)
    const mine = ++attempt.current
    try {
      const result = await estimateMeal(trimmed, requestId)
      if (mine !== attempt.current) return
      setItems(result)
    } catch (e) {
      if (mine !== attempt.current) return
      setError(estimateErrorMessage(e))
    } finally {
      if (mine === attempt.current) setWaiting(false)
    }
  }

  function cancelWait() {
    attempt.current++
    setWaiting(false)
  }

  if (items) {
    return (
      <EstimateReview
        date={date}
        meal={meal}
        initial={items}
        onBack={() => setItems(null)}
        onAdded={onAdded}
      />
    )
  }

  const errorId = 'estimar-texto-error'
  return (
    <section aria-labelledby="estimar-titulo" className="card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="estimar-titulo" className="text-lg font-extrabold">
          {copy.title}
        </h2>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {copy.cancel}
        </button>
      </div>
      <p className="text-muted">{copy.intro}</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="estimar-texto" className="text-sm font-semibold text-muted">
          {copy.textLabel}
        </label>
        <textarea
          id="estimar-texto"
          className="control min-h-28"
          rows={4}
          value={text}
          maxLength={MAX_TEXT + 100}
          aria-required="true"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={`estimar-texto-ayuda${fieldError ? ` ${errorId}` : ''}`}
          onChange={(event) => {
            setText(event.target.value)
            setFieldError(null)
            // Otro texto es otra consulta: no puede reutilizar el resultado de la anterior.
            setRequestId(newRequestId())
          }}
        />
        <p id="estimar-texto-ayuda" className="text-sm text-muted">
          {copy.textHint} {copy.textCount(text.trim().length, MAX_TEXT)}
        </p>
        {fieldError ? (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {fieldError}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-muted">{copy.privacyNote}</p>

      {error ? <ErrorState message={error} /> : null}

      {waiting ? (
        <div role="status" className="flex items-center gap-3 text-muted">
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
          />
          <span>{copy.estimating}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={waiting}
          onClick={() => void estimate()}
        >
          {copy.estimate}
        </button>
        {waiting ? (
          <button type="button" className="btn-secondary" onClick={cancelWait}>
            {copy.cancelWait}
          </button>
        ) : null}
        <button type="button" className="btn-secondary" onClick={onManual}>
          {copy.writeByHand}
        </button>
      </div>
    </section>
  )
}
