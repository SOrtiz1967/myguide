// Cabeceras CORS de las Edge Functions. El origen permitido sale de la configuracion del servidor.

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
  const allow = origin && allowed.includes(origin) ? origin : (allowed[0] ?? '')
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    Vary: 'Origin',
  }
}

/** Un navegador que llega desde un origen no autorizado es rechazado; sin cabecera `Origin` (no es un navegador) pasa. */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
  return allowed.includes(origin)
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}
