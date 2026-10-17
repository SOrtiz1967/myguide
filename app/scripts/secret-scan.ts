// Detección de secretos (Principio I). Lógica pura, sin acceso a archivos, para poder probarla.
// Nunca devuelve el secreto encontrado: solo la regla y la línea.

export interface KnownSecret {
  name: string
  value: string
}

export interface Finding {
  rule: string
  line: number
}

const MIN_KNOWN_SECRET_LENGTH = 8
const JWT_PATTERN = /eyJ[\w-]+\.(eyJ[\w-]+)\.[\w-]+/g

const PREFIX_RULES: Array<{ rule: string; pattern: RegExp }> = [
  { rule: 'clave secreta de Supabase (sb_secret_)', pattern: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { rule: 'clave SMTP de Brevo', pattern: /xsmtpsib-[A-Za-z0-9-]{20,}/ },
  { rule: 'API key de Brevo', pattern: /xkeysib-[A-Za-z0-9-]{20,}/ },
]

function jwtRole(payload: string): string | null {
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      role?: string
    }
    return json.role ?? null
  } catch {
    return null
  }
}

/** Busca secretos en `text`. `known` son valores exactos del entorno del servidor (supabase/.env). */
export function findSecrets(text: string, known: KnownSecret[]): Finding[] {
  const findings: Finding[] = []
  const lineOf = (index: number) => text.slice(0, index).split('\n').length

  for (const { rule, pattern } of PREFIX_RULES) {
    const match = pattern.exec(text)
    if (match) findings.push({ rule, line: lineOf(match.index) })
  }

  for (const match of text.matchAll(JWT_PATTERN)) {
    if (jwtRole(match[1] ?? '') === 'service_role') {
      findings.push({
        rule: 'clave de servicio (JWT service_role)',
        line: lineOf(match.index ?? 0),
      })
    }
  }

  for (const { name, value } of known) {
    if (value.length < MIN_KNOWN_SECRET_LENGTH) continue
    const index = text.indexOf(value)
    if (index !== -1) findings.push({ rule: `valor de ${name}`, line: lineOf(index) })
  }

  return findings
}
