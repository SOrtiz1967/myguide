import { z } from 'zod'

// Solo variables PÚBLICAS: todo lo que empiece con VITE_ queda dentro del bundle del navegador.
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ error: 'VITE_SUPABASE_URL debe ser una URL válida' }),
  VITE_SUPABASE_ANON_KEY: z
    .string({ error: 'Falta VITE_SUPABASE_ANON_KEY' })
    .min(1, 'Falta VITE_SUPABASE_ANON_KEY'),
  VITE_TURNSTILE_SITE_KEY: z.string().optional(),
})

export type PublicEnv = z.infer<typeof envSchema>

const FORBIDDEN_PUBLIC_NAME = /(service|secret|private|smtp|password)/i

/**
 * Valida las variables públicas al arrancar (Principio VII) y rechaza cualquier variable
 * pública con pinta de secreto, para que una clave de servicio nunca llegue al bundle (Principio I).
 */
export function parseEnv(raw: Record<string, string | undefined>): PublicEnv {
  for (const name of Object.keys(raw)) {
    if (name.startsWith('VITE_') && FORBIDDEN_PUBLIC_NAME.test(name)) {
      throw new Error(
        `La variable pública ${name} parece un secreto de servidor (clave de servicio o similar). ` +
          'Los secretos viven solo en el servidor; no uses el prefijo VITE_.',
      )
    }
  }

  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`Configuración inválida del frontend. ${details.join('; ')}`)
  }
  return result.data
}
