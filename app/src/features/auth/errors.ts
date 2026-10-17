import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import type { AppErrorInput } from '../../lib/errors'

/** Error de un flujo de autenticación, ya normalizado para poder traducirlo a un mensaje seguro. */
export class AuthFlowError extends Error implements AppErrorInput {
  code?: string
  status?: number
  network?: boolean
  context?: AppErrorInput['context']

  constructor(input: Omit<AppErrorInput, 'message'> = {}) {
    super(input.code ?? `http_${input.status ?? 'error'}`)
    this.name = 'AuthFlowError'
    this.code = input.code
    this.status = input.status
    this.network = input.network
    this.context = input.context
  }
}

/**
 * Normaliza un error de Supabase Auth o de una Edge Function. Nunca conserva el texto del
 * proveedor: solo el código, el estado HTTP y si el pedido no llegó al servidor.
 */
export async function toAuthFlowError(
  error: unknown,
  context?: AppErrorInput['context'],
): Promise<AuthFlowError> {
  if (error instanceof AuthFlowError) return error

  if (error instanceof FunctionsFetchError) return new AuthFlowError({ network: true, context })

  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response
    let code: string | undefined
    try {
      code = ((await response.clone().json()) as { code?: string }).code
    } catch {
      code = undefined
    }
    return new AuthFlowError({ code, status: response.status, context })
  }

  const e = error as { code?: string; status?: number; name?: string }
  // Los fallos de red de Auth llegan como AuthRetryableFetchError con estado 0.
  if (e?.name === 'AuthRetryableFetchError' || e?.status === 0) {
    return new AuthFlowError({ network: true, context })
  }
  return new AuthFlowError({ code: e?.code, status: e?.status, context })
}
