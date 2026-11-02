import { supabase } from '../../../lib/supabase'
import type { Meal } from '../meals'
import type { ManualPayload } from '../schema'

/** Un ítem propuesto por la IA, tal como lo devuelve la función `estimate-meal` (contrato estimate-meal.md). */
export interface EstimatedItem {
  name: string
  quantity_text: string | null
  energy_kcal: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

/** Falla conocida de la estimación: `code` es el del contrato o `offline`/`unknown`. */
export class EstimateError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'EstimateError'
  }
}

async function failure(error: unknown): Promise<EstimateError> {
  const name = (error as { name?: string } | null)?.name
  // La petición no llegó al servidor: se trata como falta de conexión.
  if (name === 'FunctionsFetchError') return new EstimateError('offline')
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    try {
      const body = (await context.json()) as { code?: string }
      return new EstimateError(body.code ?? `http_${context.status}`)
    } catch {
      return new EstimateError(`http_${context.status}`)
    }
  }
  return new EstimateError('unknown')
}

/**
 * Pide a la IA que estime lo descrito. `requestId` hace la consulta idempotente: repetirla con el mismo
 * identificador devuelve el mismo resultado sin gastar cuota. No guarda nada en los registros de comidas.
 */
export async function estimateMeal(text: string, requestId: string): Promise<EstimatedItem[]> {
  const { data, error } = await supabase.functions.invoke<{ items: EstimatedItem[] }>(
    'estimate-meal',
    { method: 'POST', body: { request_id: requestId, text } },
  )
  if (error) throw await failure(error)
  if (!data || !Array.isArray(data.items)) throw new EstimateError('unknown')
  return data.items
}

/** Guarda de una vez los ítems revisados y confirmados. Idempotente por `requestId`. */
export async function confirmEstimate(
  input: { log_date: string; meal: Meal; items: ManualPayload[] },
  requestId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc('add_estimated_entries', {
    entries: input,
    request_id: requestId,
  })
  if (error) throw error
  return data as string[]
}
