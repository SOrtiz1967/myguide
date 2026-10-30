import { adminClient } from '../_shared/admin.ts'
import { log } from '../_shared/log.ts'
import { rateLimiter } from '../_shared/wiring.ts'
import { handleProgressPhoto } from './handler.ts'

const admin = adminClient()
const BUCKET = 'progress-photos'
const SESSION_DAYS = 30

// Hasta 30 fotos por hora y por cuenta (contrato: progress-photo.md).
const limit = rateLimiter(admin, 30, '1 hour')

Deno.serve((req) =>
  handleProgressPhoto(req, {
    // El token se verifica con Auth y, además, la sesión debe seguir vigente (30 días de actividad).
    authenticate: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt)
      if (error || !data.user) return null
      const { data: profile } = await admin
        .from('profiles')
        .select('last_active_at')
        .eq('user_id', data.user.id)
        .maybeSingle()
      const last = profile?.last_active_at ? Date.parse(profile.last_active_at) : NaN
      if (!Number.isFinite(last) || Date.now() - last > SESSION_DAYS * 24 * 3600 * 1000) return null
      return data.user.id
    },
    rateLimit: limit,
    store: {
      upload: async (path, bytes) => {
        const { error } = await admin.storage
          .from(BUCKET)
          .upload(path, bytes, {
            contentType: 'image/jpeg',
            cacheControl: 'private, max-age=0',
            upsert: false,
          })
        if (error) throw new Error('upload_failed')
      },
      remove: async (path) => {
        const { error } = await admin.storage.from(BUCKET).remove([path])
        if (error) throw new Error('remove_failed')
      },
    },
    records: {
      count: async (userId) => {
        const { count, error } = await admin
          .from('progress_photos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
        if (error || count === null) throw new Error('count_failed')
        return count
      },
      find: async (userId, id) => {
        const { data, error } = await admin
          .from('progress_photos')
          .select('id, storage_path')
          .eq('user_id', userId)
          .eq('id', id)
          .maybeSingle()
        if (error) throw new Error('find_failed')
        return data
      },
      save: async (row) => {
        const { data, error } = await admin
          .from('progress_photos')
          .insert(row)
          .select('id')
          .single()
        if (error || !data) throw new Error('save_failed')
        return data
      },
      remove: async (userId, id) => {
        const { error } = await admin
          .from('progress_photos')
          .delete()
          .eq('user_id', userId)
          .eq('id', id)
        if (error) throw new Error('delete_failed')
      },
    },
    newId: () => crypto.randomUUID(),
    now: () => new Date(),
    log,
  })
)
