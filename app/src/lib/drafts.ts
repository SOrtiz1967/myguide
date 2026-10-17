// Borradores locales de formularios (FR-021, FR-022). Viven en localStorage hasta que el servidor
// confirma el guardado, y se eliminan todos al cerrar sesión o al vencer la sesión. Esto NO es un
// modo sin conexión: no se sincroniza nada ni se muestra como guardado.
import type { z } from 'zod'

const PREFIX = 'draft:'
// Defensa en profundidad: aunque un formulario lo intente, estos campos jamás se persisten.
const SENSITIVE_FIELD = /(password|contrasena|contraseña|secret|token)/i

export const draftKey = (userId: string, formId: string) => `${PREFIX}v1:${userId}:${formId}`

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* almacenamiento no disponible: nada que limpiar */
  }
}

/** Guarda un borrador. Devuelve false si el almacenamiento no está disponible (sin lanzar). */
export function saveDraft(
  userId: string,
  formId: string,
  values: Record<string, unknown>,
): boolean {
  try {
    const safe = Object.fromEntries(
      Object.entries(values).filter(([field]) => !SENSITIVE_FIELD.test(field)),
    )
    localStorage.setItem(
      draftKey(userId, formId),
      JSON.stringify({ savedAt: Date.now(), values: safe }),
    )
    return true
  } catch {
    return false
  }
}

/** Recupera un borrador validado con `schema`. Uno corrupto o inválido se descarta. */
export function loadDraft<T>(
  userId: string,
  formId: string,
  schema: z.ZodType<T>,
): { values: T; savedAt: number } | null {
  const key = draftKey(userId, formId)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    let parsed: { savedAt?: unknown; values?: unknown }
    try {
      parsed = JSON.parse(raw)
    } catch {
      remove(key)
      return null
    }
    const result = schema.safeParse(parsed?.values)
    if (!result.success) {
      remove(key)
      return null
    }
    return { values: result.data, savedAt: Number(parsed.savedAt) || 0 }
  } catch {
    return null
  }
}

export function discardDraft(userId: string, formId: string): void {
  remove(draftKey(userId, formId))
}

/** Elimina los borradores de TODAS las cuentas de este navegador (cierre de sesión, FR-022). */
export function purgeAllDrafts(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach(remove)
  } catch {
    /* almacenamiento no disponible */
  }
}
