// T021 (Principio IX): registro estructurado sin datos personales, tokens ni secretos.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const SENSITIVE_KEY =
  /(mail|correo|pass|token|secret|authorization|apikey|api_key|cookie|jwt|credential)/i
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g
const BEARER = /Bearer\s+\S+/gi
const OPAQUE_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g
const MAX_DEPTH = 6

function redactText(text: string): string {
  return text
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(EMAIL, '[correo]')
    .replace(OPAQUE_TOKEN, '[token]')
}

/** Devuelve una copia segura de `value`: sin correos, tokens ni valores de claves sensibles. */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactText(value)
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return '[omitido]'
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) }
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redactado]' : redact(inner, depth + 1)
  }
  return out
}

/** Una sola linea JSON con nivel, evento y hora, mas los campos tecnicos ya depurados. */
export function formatLog(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): string {
  const safe = redact(fields) as Record<string, unknown>
  return JSON.stringify({ level, event: redactText(event), ts: new Date().toISOString(), ...safe })
}

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = formatLog(level, event, fields)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
