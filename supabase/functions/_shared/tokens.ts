// Tokens de confirmación de correo (FR-026): el token en claro viaja solo en el enlace;
// en la base de datos se guarda únicamente su hash SHA-256.

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/** 32 bytes aleatorios (256 bits) codificados para usar en una URL. */
export function generateToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

/** SHA-256 en hexadecimal. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
