/**
 * Devuelve la dirección solo si es una URL absoluta http(s) sin credenciales; si no, `null`.
 * Las direcciones que vienen de la base (licencia y sitio de cada fuente) no se confían a ciegas:
 * un `javascript:` en un enlace sería una puerta para ejecutar código.
 */
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username !== '' || url.password !== '') return null
    return value
  } catch {
    return null
  }
}
