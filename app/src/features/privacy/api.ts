import { supabase } from '../../lib/supabase'
import type { ExportData, PhotoFile } from './exportData'

/** Falla conocida de la eliminación: `code` es el del contrato o `offline`/`unknown`. */
export class DeleteAccountError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'DeleteAccountError'
  }
}

/** Todos los registros de la cuenta, leídos con sus propios permisos (contrato privacy.md). */
export async function fetchExport(): Promise<ExportData> {
  const { data, error } = await supabase.rpc('export_my_data')
  if (error) throw error
  return data as unknown as ExportData
}

/** Un archivo de foto de la cuenta; la política del depósito solo deja leer lo propio. */
export async function downloadPhoto(file: PhotoFile): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(file.bucket).download(file.path)
  if (error || !data) throw error ?? new Error('sin archivo')
  return new Uint8Array(await data.arrayBuffer())
}

async function failure(error: unknown): Promise<DeleteAccountError> {
  const name = (error as { name?: string } | null)?.name
  if (name === 'FunctionsFetchError') return new DeleteAccountError('offline')
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    try {
      const body = (await context.json()) as { code?: string }
      return new DeleteAccountError(body.code ?? `http_${context.status}`)
    } catch {
      return new DeleteAccountError(`http_${context.status}`)
    }
  }
  return new DeleteAccountError('unknown')
}

/** Elimina la cuenta, con sus archivos, tras comprobar la contraseña en el servidor. Definitivo. */
export async function deleteAccount(password: string): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    body: { password },
  })
  if (error) throw await failure(error)
}
