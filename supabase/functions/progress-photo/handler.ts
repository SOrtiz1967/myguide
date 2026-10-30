// Spec 019 (FR-003 a FR-006, FR-009, FR-010, FR-016, FR-017, FR-019): guardar y eliminar fotos de progreso.
// Contrato: specs/019-fotos-de-progreso/contracts/progress-photo.md. La lógica vive aquí para poder probarla sin
// Storage ni base de datos; `index.ts` solo la conecta con los servicios reales. Misma forma que `meal-photo`.
import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/cors.ts'
import { cleanJpeg, InvalidImageError } from '../_shared/jpeg.ts'
import type { LogFn } from '../_shared/log.ts'
import { methodNotAllowed, preflight } from '../_shared/request.ts'

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024
/** Tope de fotos por cuenta (FR-010): cuida el almacenamiento del plan gratuito. */
export const MAX_PHOTOS = 200
/** Margen del cuerpo multipart sobre el archivo (campos y cabeceras de las partes). */
const MULTIPART_OVERHEAD = 64 * 1024
export const POSES = ['front', 'side', 'back', 'other'] as const
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PhotoRecord {
  id: string
  storage_path: string
}

export interface PhotoRow {
  user_id: string
  taken_on: string
  pose: string | null
  storage_path: string
  width: number
  height: number
  bytes: number
}

export interface PhotoDeps {
  /** Id de la persona si el token es válido y su sesión sigue vigente; si no, `null`. */
  authenticate(jwt: string): Promise<string | null>
  rateLimit(key: string): Promise<boolean>
  store: {
    upload(path: string, bytes: Uint8Array): Promise<void>
    remove(path: string): Promise<void>
  }
  records: {
    count(userId: string): Promise<number>
    find(userId: string, id: string): Promise<PhotoRecord | null>
    save(row: PhotoRow): Promise<{ id: string }>
    remove(userId: string, id: string): Promise<void>
  }
  newId(): string
  now(): Date
  log: LogFn
}

function validDate(text: unknown, now: Date): text is string {
  if (typeof text !== 'string' || !DATE_PATTERN.test(text)) return false
  const parsed = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) return false
  // Hasta mañana (con un día de margen por la zona horaria de la persona).
  const max = new Date(now.getTime() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  return text >= '2000-01-01' && text <= max
}

const validPose = (value: unknown): value is (typeof POSES)[number] =>
  typeof value === 'string' && (POSES as readonly string[]).includes(value)

function startsAsJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export async function handleProgressPhoto(req: Request, deps: PhotoDeps): Promise<Response> {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST' && req.method !== 'DELETE') return methodNotAllowed(req)

  const requestId = deps.newId()
  const started = performance.now()
  const finish = (
    response: Response,
    result: string,
    extra: Record<string, unknown> = {},
  ): Response => {
    // Principio IX: ni la persona, ni la ruta, ni la fecha, ni la pose, ni el contenido.
    deps.log(response.status >= 500 ? 'error' : 'info', 'progress_photo', {
      request_id: requestId,
      method: req.method,
      status: response.status,
      result,
      ms: Math.round(performance.now() - started),
      ...extra,
    })
    return response
  }
  const fail = (status: number, code: string, extra: Record<string, unknown> = {}) =>
    finish(jsonResponse({ code }, status, origin), code, extra)

  if (!isAllowedOrigin(origin)) return fail(403, 'forbidden_origin')

  const authorization = req.headers.get('authorization') ?? ''
  const jwt = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
  const userId = jwt ? await deps.authenticate(jwt) : null
  if (!userId) return fail(401, 'unauthorized')

  if (req.method === 'DELETE') return await handleDelete(req, deps, userId, origin, finish, fail)

  if (!(await deps.rateLimit(`progress-photo:${userId}`))) return fail(429, 'rate_limited')

  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES + MULTIPART_OVERHEAD) {
    return fail(413, 'too_large')
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, 'invalid_request')
  }
  const takenOn = form.get('taken_on')
  const rawPose = form.get('pose')
  const photo = form.get('photo')
  const pose = rawPose === null || rawPose === '' ? null : rawPose
  if (
    !validDate(takenOn, deps.now()) ||
    (pose !== null && !validPose(pose)) ||
    !(photo instanceof File)
  ) {
    return fail(400, 'invalid_request')
  }
  if (photo.size > MAX_PHOTO_BYTES) return fail(413, 'too_large')

  const original = new Uint8Array(await photo.arrayBuffer())
  if (!startsAsJpeg(original)) return fail(415, 'unsupported_type')

  let cleaned
  try {
    cleaned = cleanJpeg(original)
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return fail(422, 'invalid_image', { bytes_in: original.length })
    }
    throw error
  }

  try {
    if ((await deps.records.count(userId)) >= MAX_PHOTOS) return fail(409, 'limit_reached')
  } catch {
    return fail(500, 'storage_error')
  }

  const path = `${userId}/${deps.newId()}.jpg`
  try {
    await deps.store.upload(path, cleaned.bytes)
  } catch {
    return fail(500, 'storage_error')
  }

  let saved: { id: string }
  try {
    saved = await deps.records.save({
      user_id: userId,
      taken_on: takenOn,
      pose,
      storage_path: path,
      width: cleaned.width,
      height: cleaned.height,
      bytes: cleaned.bytes.length,
    })
  } catch {
    // La fila no se pudo guardar: el objeto recién subido no debe quedar huérfano (FR-016).
    await removeQuietly(deps, path)
    return fail(500, 'storage_error')
  }

  return finish(
    jsonResponse(
      {
        id: saved.id,
        taken_on: takenOn,
        pose,
        width: cleaned.width,
        height: cleaned.height,
        bytes: cleaned.bytes.length,
      },
      200,
      origin,
    ),
    'saved',
    { bytes_in: original.length, bytes_out: cleaned.bytes.length },
  )
}

async function handleDelete(
  req: Request,
  deps: PhotoDeps,
  userId: string,
  origin: string | null,
  finish: (response: Response, result: string, extra?: Record<string, unknown>) => Response,
  fail: (status: number, code: string) => Response,
): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id')
  if (!id || !UUID_PATTERN.test(id)) return fail(400, 'invalid_request')

  try {
    const existing = await deps.records.find(userId, id)
    if (existing) {
      await deps.records.remove(userId, id)
      await removeQuietly(deps, existing.storage_path)
    }
    return finish(
      new Response(null, { status: 204, headers: corsHeaders(origin) }),
      existing ? 'deleted' : 'nothing_to_delete',
    )
  } catch {
    return fail(500, 'storage_error')
  }
}

/** Borrar un objeto es de mejor esfuerzo: si falla se registra, sin la ruta, y la respuesta no cambia. */
async function removeQuietly(deps: PhotoDeps, path: string): Promise<void> {
  try {
    await deps.store.remove(path)
  } catch {
    deps.log('error', 'progress_photo_object_not_removed', { cause: 'storage_error' })
  }
}
