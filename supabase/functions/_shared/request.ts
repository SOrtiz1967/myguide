// Utilidades de petición compartidas por las Edge Functions.
import { corsHeaders, jsonResponse } from './cors.ts'

/** IP del cliente según los encabezados que añade el proxy de Supabase; 'unknown' si no hay. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('cf-connecting-ip') || 'unknown'
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
