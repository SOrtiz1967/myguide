import { adminClient } from '../_shared/admin.ts'
import { log } from '../_shared/log.ts'
import { hashToken } from '../_shared/tokens.ts'
import { siteUrl } from '../_shared/wiring.ts'
import { handleConfirmEmail } from './handler.ts'

const admin = adminClient()

Deno.serve((req) =>
  handleConfirmEmail(req, {
    siteUrl: siteUrl(),
    hashToken,
    consumeToken: async (hash) => {
      const { data, error } = await admin.rpc('consume_email_token', { p_token_hash: hash })
      if (error) throw new Error('consume_token_failed')
      return typeof data === 'string' ? { userId: data } : null
    },
    markVerified: async (userId) => {
      const { error } = await admin.rpc('mark_email_verified', { p_user_id: userId })
      if (error) throw new Error('mark_verified_failed')
    },
    log,
  })
)
