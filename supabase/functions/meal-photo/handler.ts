// T063 (spec 003, FR-030 a FR-035): guardar, reemplazar y eliminar la foto de una comida.
// Contrato: specs/003-registro-de-comidas/contracts/meal-photo.md. La lógica vive aquí para poder
// probarla sin Storage ni base de datos; `index.ts` solo la conecta con los servicios reales.
import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/cors.ts'
import type { LogFn } from '../_shared/log.ts'
import { methodNotAllowed, preflight } from '../_shared/request.ts'
import { cleanJpeg, InvalidImageError } from './jpeg.ts'

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024
/** Margen del cuerpo multipart sobre el archivo (campos y cabeceras de las partes). */
const MULTIPART_OVERHEAD = 64 * 1024
export const MEALS = ['breakfast', 'lunch', 'snack', 'dinner', 'extra'] as const
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface PhotoRecord {
  id: string
  storage_path: string
}

export interface PhotoRow {
  user_id: string
  log_date: string
  meal: string
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
    find(userId: string, logDate: string, meal: string): Promise<PhotoRecord | null>
    /** Inserta o reemplaza la foto de `(user_id, log_date, meal)`. */
    save(row: PhotoRow): Promise<{ id: string }>
    remove(userId: string, logDate: string, meal: string): Promise<void>
  }
  newId(): string
  now(): Date
  log: LogFn
}

function validDate(text: unknown, now: Date): text is string {
  if (typeof text !== 'string' || !DATE_PATTERN.test(text)) return false
  const parsed = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) return false
  // Mismo rango que los ítems: desde 2000 hasta una semana adelante (con un día de margen por la zona).
  const max = new Date(now.getTime() + 8 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  return text >= '2000-01-01' && text <= max
}

const validMeal = (value: unknown): value is (typeof MEALS)[number] =>
  typeof value === 'string' && (MEALS as readonly string[]).includes(value)

function startsAsJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export async function handleMealPhoto(req: Request, deps: PhotoDeps): Promise<Response> {
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
    // Principio IX: ni la persona, ni la ruta, ni la fecha, ni la comida, ni el contenido.
    deps.log(response.status >= 500 ? 'error' : 'info', 'meal_photo', {
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

  if (!(await deps.rateLimit(`meal-photo:${userId}`))) return fail(429, 'rate_limited')

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
  const logDate = form.get('log_date')
  const meal = form.get('meal')
  const photo = form.get('photo')
  if (!validDate(logDate, deps.now()) || !validMeal(meal) || !(photo instanceof File)) {
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

  const path = `${userId}/${deps.newId()}.jpg`
  try {
    await deps.store.upload(path, cleaned.bytes)
  } catch {
    return fail(500, 'storage_error')
  }

  let previous: PhotoRecord | null
  let saved: { id: string }
  try {
    previous = await deps.records.find(userId, logDate, meal)
    saved = await deps.records.save({
      user_id: userId,
      log_date: logDate,
      meal,
      storage_path: path,
      width: cleaned.width,
      height: cleaned.height,
      bytes: cleaned.bytes.length,
    })
  } catch {
    // La fila no se pudo guardar: el objeto recién subido no debe quedar huérfano.
    await removeQuietly(deps, path)
    return fail(500, 'storage_error')
  }

  if (previous && previous.storage_path !== path) await removeQuietly(deps, previous.storage_path)

  return finish(
    jsonResponse(
      {
        id: saved.id,
        log_date: logDate,
        meal,
        width: cleaned.width,
        height: cleaned.height,
        bytes: cleaned.bytes.length,
      },
      200,
      origin,
    ),
    'saved',
    { bytes_in: original.length, bytes_out: cleaned.bytes.length, replaced: previous !== null },
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
  const params = new URL(req.url).searchParams
  const logDate = params.get('log_date')
  const meal = params.get('meal')
  if (!validDate(logDate, deps.now()) || !validMeal(meal)) return fail(400, 'invalid_request')

  try {
    const existing = await deps.records.find(userId, logDate, meal)
    if (existing) {
      await deps.records.remove(userId, logDate, meal)
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
    deps.log('error', 'meal_photo_object_not_removed', { cause: 'storage_error' })
  }
}
