// Clasificación gruesa de errores para los registros técnicos (Principio IX): se registra la
// causa ("timeout", "auth_failed"...) y nunca el texto del error, que podría traer datos personales.

export type ErrorCause = 'timeout' | 'auth_failed' | 'connection' | 'unknown'

export function errorCause(error: unknown): ErrorCause {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  if (/timeout|timed out|etimedout|abort/i.test(text)) return 'timeout'
  if (/\b535\b|auth|credential|unauthori[sz]ed/i.test(text)) return 'auth_failed'
  if (/econn|refused|network|dns|enotfound|socket/i.test(text)) return 'connection'
  return 'unknown'
}
