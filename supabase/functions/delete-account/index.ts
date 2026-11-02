import { adminClient, anonClient } from '../_shared/admin.ts'
import { log } from '../_shared/log.ts'
import { rateLimiter } from '../_shared/wiring.ts'
import { handleDeleteAccount } from './handler.ts'

const admin = adminClient()
const SESSION_DAYS = 30
const BATCH = 100
// Tope de vueltas: 200 fotos de progreso más las de comidas caben de sobra; evita un ciclo sin fin.
const MAX_ROUNDS = 100

// Hasta 5 intentos por hora y por cuenta (contrato: privacy.md).
const limit = rateLimiter(admin, 5, '1 hour')

Deno.serve((req) =>
  handleDeleteAccount(req, {
    // El token se verifica con Auth y, además, la sesión debe seguir vigente (30 días de actividad).
    authenticate: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt)
      if (error || !data.user || !data.user.email) return null
      const { data: profile } = await admin
        .from('profiles')
        .select('last_active_at')
        .eq('user_id', data.user.id)
        .maybeSingle()
      const last = profile?.last_active_at ? Date.parse(profile.last_active_at) : NaN
      if (!Number.isFinite(last) || Date.now() - last > SESSION_DAYS * 24 * 3600 * 1000) return null
      return { id: data.user.id, email: data.user.email }
    },
    rateLimit: limit,
    verifyPassword: async (email, password) => {
      const { data, error } = await anonClient().auth.signInWithPassword({ email, password })
      return !error && Boolean(data.session)
    },
    removeFolder: async (bucket, userId) => {
      const storage = admin.storage.from(bucket)
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const { data, error } = await storage.list(userId, { limit: BATCH })
        if (error) throw new Error('list_failed')
        const files = (data ?? []).filter((entry) => entry.name)
        if (files.length === 0) return
        const { error: removeError } = await storage.remove(
          files.map((entry) => `${userId}/${entry.name}`),
        )
        if (removeError) throw new Error('remove_failed')
      }
      throw new Error('too_many_files')
    },
    deleteUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) throw new Error('delete_failed')
    },
    newId: () => crypto.randomUUID(),
    log,
  })
)
