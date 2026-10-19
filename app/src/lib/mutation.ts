import { es } from '../copy/es'
import { isNetworkError } from './errors'

/** Un guardado que no llegó a confirmarse en el servidor. */
export class WriteError extends Error {
  readonly network: boolean

  constructor(network: boolean, message: string) {
    super(message)
    this.name = 'WriteError'
    this.network = network
  }
}

/**
 * Ejecuta un guardado remoto (FR-020): sin conexión no lo intenta, y cualquier fallo se convierte en
 * un `WriteError` con un mensaje seguro. Quien lo usa solo muestra "guardado" si esta función resuelve.
 *
 * `messageFor` es opcional: traduce un error conocido del servidor (por ejemplo, "el alimento ya no
 * existe") a un mensaje claro. Nunca se usa el texto crudo del servidor.
 */
export async function saveRemotely<T>(
  write: () => Promise<T>,
  messageFor?: (error: unknown) => string | null,
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new WriteError(true, es.errors.offline)
  }
  try {
    return await write()
  } catch (error) {
    const network = isNetworkError(error)
    throw new WriteError(
      network,
      network ? es.errors.offline : (messageFor?.(error) ?? es.errors.generic),
    )
  }
}
