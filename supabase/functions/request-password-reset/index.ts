import { createClient } from '@supabase/supabase-js'
import { adminClient } from '../_shared/admin.ts'
import { log } from '../_shared/log.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'
import { rateLimiter, siteUrl } from '../_shared/wiring.ts'
import { handleRequestReset } from './handler.ts'

const admin = adminClient()

// Disponible en el entorno de ejecución de Supabase: mantiene vivo el envío después de responder.
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void }

Deno.serve((req) =>
  handleRequestReset(req, {
    rateLimit: rateLimiter(admin, 10, '1 hour'),
    runInBackground: (task) => EdgeRuntime.waitUntil(task),
    verifyTurnstile: (token, ip) =>
      verifyTurnstile({
        secret: Deno.env.get('TURNSTILE_SECRET_KEY') ?? '',
        token,
        ip,
      }),
    findUser: async (email) => {
      const { data, error } = await admin.rpc('find_user_by_email', { p_email: email })
      if (error) throw new Error('find_user_failed')
      const row = (data as Array<{ id: string; email_verified: boolean }> | null)?.[0]
      return row ? { id: row.id, emailVerified: row.email_verified } : null
    },
    sendRecovery: async (email) => {
      // Se usa la clave pública: el envío lo hace Auth con su configuración de correo.
      const anon = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
      const { error } = await anon.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl()}/restablecer`,
      })
      if (error) throw new Error(error.code ?? 'recovery_failed')
    },
    log,
  })
)
