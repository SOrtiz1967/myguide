// Spec 009 (FR-001, FR-009 a FR-016): `estimate-meal`. Contrato: specs/009-estimacion-comidas-ia/contracts/estimate-meal.md.
// La lógica vive aquí para poder probarla sin Gemini ni base de datos; `index.ts` solo la conecta con los servicios reales.
import { isAllowedOrigin, jsonResponse } from '../_shared/cors.ts'
import type { EstimatedItem } from '../_shared/estimate.ts'
import { AiError, type MealInput } from '../_shared/gemini.ts'
import type { LogFn } from '../_shared/log.ts'
import { cleanJpeg, InvalidImageError } from '../_shared/jpeg.ts'
import { methodNotAllowed, preflight, readJsonObject } from '../_shared/request.ts'

export const MAX_TEXT = 500
/** Foto del plato (historia 6): el mismo tope que la foto de una comida. */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024
/** Margen del cuerpo multipart sobre el archivo (campos y cabeceras de las partes). */
const MULTIPART_OVERHEAD = 64 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface EstimateDeps {
  /** Id de la persona si el token es válido y su sesión sigue vigente; si no, `null`. */
  authenticate(jwt: string): Promise<string | null>
  /** Hay clave del proveedor configurada. */
  configured(): boolean
  /** Hasta 5 por minuto y por cuenta. */
  rateLimitMinute(key: string): Promise<boolean>
  /** Hasta 30 por día y por cuenta. */
  rateLimitDay(key: string): Promise<boolean>
  cache: {
    /** Resultado de las últimas 24 horas para esa cuenta y solicitud, o `null`. */
    get(userId: string, requestId: string): Promise<EstimatedItem[] | null>
    put(
      userId: string,
      requestId: string,
      kind: 'text' | 'photo',
      items: EstimatedItem[],
    ): Promise<void>
  }
  /** Llama al proveedor; lanza `AiError`. */
  estimate(input: MealInput): Promise<EstimatedItem[]>
  newId(): string
  log: LogFn
}

const startsAsJpeg = (bytes: Uint8Array) =>
  bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff

const AI_ERRORS: Record<AiError['kind'], { status: number; code: string }> = {
  quota: { status: 429, code: 'quota_exhausted' },
  timeout: { status: 504, code: 'ai_timeout' },
  failed: { status: 502, code: 'ai_failed' },
  invalid: { status: 502, code: 'ai_invalid' },
}

export async function handleEstimateMeal(req: Request, deps: EstimateDeps): Promise<Response> {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return methodNotAllowed(req)

  const logId = deps.newId()
  const started = performance.now()
  let kind: 'text' | 'photo' = 'text'
  const finish = (
    response: Response,
    result: string,
    extra: Record<string, unknown> = {},
  ): Response => {
    // Principio IX: ni la persona, ni el texto, ni los ítems, ni los valores.
    deps.log(response.status >= 500 ? 'error' : 'info', 'estimate_meal', {
      request_id: logId,
      method: req.method,
      status: response.status,
      result,
      ms: Math.round(performance.now() - started),
      kind,
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

  let requestId = ''
  let input: MealInput
  const isPhoto = (req.headers.get('content-type') ?? '').toLowerCase().startsWith(
    'multipart/form-data',
  )
  if (isPhoto) {
    kind = 'photo'
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
    const rawId = form.get('request_id')
    const photo = form.get('photo')
    requestId = typeof rawId === 'string' ? rawId : ''
    if (!UUID_PATTERN.test(requestId) || !(photo instanceof File)) {
      return fail(400, 'invalid_request')
    }
    if (photo.size > MAX_PHOTO_BYTES) return fail(413, 'too_large')
    const original = new Uint8Array(await photo.arrayBuffer())
    if (!startsAsJpeg(original)) return fail(415, 'unsupported_type')
    try {
      // Se quitan ubicación y demás metadatos antes de que la foto salga del servidor (FR-020).
      input = { image: cleanJpeg(original).bytes }
    } catch (error) {
      if (error instanceof InvalidImageError) return fail(422, 'invalid_image')
      throw error
    }
  } else {
    const body = await readJsonObject(req)
    requestId = typeof body?.request_id === 'string' ? body.request_id : ''
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!UUID_PATTERN.test(requestId) || text === '' || text.length > MAX_TEXT) {
      return fail(400, 'invalid_request')
    }
    input = { text }
  }

  // Un reintento con la misma solicitud devuelve lo que ya se calculó: sin proveedor y sin gastar cuota.
  try {
    const cached = await deps.cache.get(userId, requestId)
    if (cached) {
      return finish(
        jsonResponse({ items: cached, cached: true }, 200, origin),
        'cached',
        { items: cached.length },
      )
    }
  } catch {
    // Si la caché falla, se consulta igual: es una mejora, no un requisito.
  }

  if (!deps.configured()) return fail(503, 'ai_unavailable')
  if (!(await deps.rateLimitMinute(`estimate-meal:m:${userId}`))) return fail(429, 'rate_limited')
  if (!(await deps.rateLimitDay(`estimate-meal:d:${userId}`))) return fail(429, 'daily_limit')

  let items: EstimatedItem[]
  try {
    items = await deps.estimate(input)
  } catch (error) {
    const mapped = error instanceof AiError ? AI_ERRORS[error.kind] : AI_ERRORS.failed
    return fail(mapped.status, mapped.code)
  }

  if (items.length === 0) return fail(422, 'no_items')

  try {
    await deps.cache.put(userId, requestId, kind, items)
  } catch {
    // No se pudo conservar el resultado: la persona igual lo recibe.
  }
  return finish(jsonResponse({ items, cached: false }, 200, origin), 'ok', { items: items.length })
}
