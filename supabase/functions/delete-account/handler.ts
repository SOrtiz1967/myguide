// Spec 011 (FR-007 a FR-012): `delete-account`. Contrato: specs/011-privacidad-ciclo-de-vida/contracts/privacy.md.
// Primero los archivos y después la cuenta: si algo falla a mitad, la persona conserva el acceso y puede reintentar.
// La lógica vive aquí para probarla sin Storage ni Auth; `index.ts` solo la conecta con los servicios reales.
import { isAllowedOrigin, jsonResponse } from '../_shared/cors.ts'
import type { LogFn } from '../_shared/log.ts'
import { methodNotAllowed, preflight, readJsonObject } from '../_shared/request.ts'

export interface AuthenticatedUser {
  id: string
  email: string
}

export interface DeleteDeps {
  /** La persona si el token es válido y su sesión sigue vigente; si no, `null`. */
  authenticate(jwt: string): Promise<AuthenticatedUser | null>
  rateLimit(key: string): Promise<boolean>
  /** `true` si la contraseña es la de la cuenta. */
  verifyPassword(email: string, password: string): Promise<boolean>
  /** Borra todos los archivos de la carpeta `<userId>/` del depósito; lanza si no pudo. */
  removeFolder(bucket: string, userId: string): Promise<void>
  /** Elimina la cuenta (y con ella sus filas); lanza si no pudo. */
  deleteUser(userId: string): Promise<void>
  newId(): string
  log: LogFn
}

export const BUCKETS = ['meal-photos', 'progress-photos'] as const

export async function handleDeleteAccount(req: Request, deps: DeleteDeps): Promise<Response> {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return methodNotAllowed(req)

  const requestId = deps.newId()
  const started = performance.now()
  const finish = (response: Response, result: string): Response => {
    // Principio IX: ni la persona, ni el correo, ni la contraseña, ni rutas.
    deps.log(response.status >= 500 ? 'error' : 'info', 'delete_account', {
      request_id: requestId,
      method: req.method,
      status: response.status,
      result,
      ms: Math.round(performance.now() - started),
    })
    return response
  }
  const fail = (status: number, code: string) =>
    finish(jsonResponse({ code }, status, origin), code)

  if (!isAllowedOrigin(origin)) return fail(403, 'forbidden_origin')

  const authorization = req.headers.get('authorization') ?? ''
  const jwt = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
  const user = jwt ? await deps.authenticate(jwt) : null
  if (!user) return fail(401, 'unauthorized')

  if (!(await deps.rateLimit(`delete-account:${user.id}`))) return fail(429, 'rate_limited')

  const body = await readJsonObject(req)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (password === '' || password.length > 200) return fail(400, 'invalid_request')

  if (!(await deps.verifyPassword(user.email, password))) return fail(403, 'invalid_password')

  try {
    for (const bucket of BUCKETS) await deps.removeFolder(bucket, user.id)
  } catch {
    return fail(500, 'storage_error')
  }

  try {
    await deps.deleteUser(user.id)
  } catch {
    return fail(500, 'delete_failed')
  }

  return finish(jsonResponse({ deleted: true }, 200, origin), 'deleted')
}
