import { adminClient } from '../_shared/admin.ts'
import type { EstimatedItem } from '../_shared/estimate.ts'
import { estimateMeal } from '../_shared/gemini.ts'
import { log } from '../_shared/log.ts'
import { rateLimiter } from '../_shared/wiring.ts'
import { handleEstimateMeal } from './handler.ts'

const admin = adminClient()
const SESSION_DAYS = 30
const CACHE_HOURS = 24

// Hasta 5 consultas por minuto y 30 por día, por cuenta (contrato: estimate-meal.md).
const perMinute = rateLimiter(admin, 5, '1 minute')
const perDay = rateLimiter(admin, 30, '1 day')

const apiKey = () => Deno.env.get('GEMINI_API_KEY')?.trim() ?? ''

Deno.serve((req) =>
  handleEstimateMeal(req, {
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
    configured: () => apiKey() !== '',
    rateLimitMinute: perMinute,
    rateLimitDay: perDay,
    cache: {
      get: async (userId, requestId) => {
        const since = new Date(Date.now() - CACHE_HOURS * 3600 * 1000).toISOString()
        const { data, error } = await admin
          .from('ai_estimates')
          .select('result')
          .eq('user_id', userId)
          .eq('request_id', requestId)
          .gt('created_at', since)
          .maybeSingle()
        if (error) throw new Error('cache_failed')
        const items = (data?.result as { items?: EstimatedItem[] } | undefined)?.items
        return Array.isArray(items) ? items : null
      },
      put: async (userId, requestId, kind, items) => {
        // Se borran los resultados vencidos de todas las cuentas (no se conservan más de 24 horas) y se guarda el nuevo (reemplaza uno vencido de la misma solicitud).
        const since = new Date(Date.now() - CACHE_HOURS * 3600 * 1000).toISOString()
        await admin.from('ai_estimates').delete().lt('created_at', since)
        const { error } = await admin.from('ai_estimates').upsert({
          user_id: userId,
          request_id: requestId,
          kind,
          result: { items },
          created_at: new Date().toISOString(),
        })
        if (error) throw new Error('cache_failed')
      },
    },
    estimate: (input) =>
      estimateMeal(input, { apiKey: apiKey(), model: Deno.env.get('GEMINI_MODEL')?.trim() }),
    newId: () => crypto.randomUUID(),
    log,
  })
)
