import { adminClient } from '../_shared/admin.ts'
import { log } from '../_shared/log.ts'
import {
  functionsUrl,
  issueVerificationToken,
  sendVerificationMail,
  siteUrl,
} from '../_shared/wiring.ts'
import { handleSendVerification } from './handler.ts'

const admin = adminClient()

async function stats(userId: string) {
  const { data, error } = await admin.rpc('email_token_stats', { p_user_id: userId })
  if (error) throw new Error('token_stats_failed')
  return (data as Array<{ last_created_at: string | null; created_last_day: number }>)[0]
}

Deno.serve((req) =>
  handleSendVerification(req, {
    now: () => new Date(),
    siteUrl: siteUrl(),
    functionsUrl: functionsUrl(),
    getUser: async (authorization) => {
      const jwt = authorization?.replace(/^Bearer\s+/i, '')
      if (!jwt) return null
      // Valida el JWT contra Auth; no se confía en datos enviados por el cliente (FR-010).
      const { data, error } = await admin.auth.getUser(jwt)
      if (error || !data.user?.email) return null
      const { data: profile } = await admin
        .from('profiles')
        .select('email_verified_at')
        .eq('user_id', data.user.id)
        .maybeSingle()
      return {
        id: data.user.id,
        email: data.user.email,
        emailVerified: profile?.email_verified_at != null,
      }
    },
    lastTokenAt: async (userId) => {
      const s = await stats(userId)
      return s?.last_created_at ? new Date(s.last_created_at) : null
    },
    tokensInLastDay: async (userId) => (await stats(userId))?.created_last_day ?? 0,
    createToken: (userId, expiresAt) => issueVerificationToken(admin, userId, expiresAt),
    sendMail: ({ to, link }) => sendVerificationMail(to, link),
    log,
  })
)
