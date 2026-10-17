// Utilidades de petición compartidas por las Edge Functions.
import { corsHeaders, jsonResponse } from './cors.ts'

/**
 * IP del cliente para el límite de solicitudes (FR-008). El cliente puede inventar el contenido de
 * `X-Forwarded-For`, así que NO se usa su primera entrada: se prefiere `cf-connecting-ip`, que fija
 * Cloudflare y el cliente no puede alterar, y como respaldo la ÚLTIMA entrada de `X-Forwarded-For`,
 * que es la que agrega el proxy confiable más cercano. 'unknown' si no hay ninguna.
 */
export function clientIp(req: Request): string {
  const cloudflare = req.headers.get('cf-connecting-ip')?.trim()
  if (cloudflare) return cloudflare
  const forwarded = req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
  return forwarded || 'unknown'
}

/** Respuesta al preflight de CORS. */
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export function methodNotAllowed(req: Request): Response {
  return jsonResponse({ code: 'method_not_allowed' }, 405, req.headers.get('origin'))
}

/** Lee un cuerpo JSON; devuelve null si no es JSON válido o no es un objeto. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await req.json()
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
