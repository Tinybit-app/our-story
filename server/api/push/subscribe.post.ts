import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({
      statusCode: 400,
      message: 'Invalid subscription data.',
    })

  const { endpoint, keys } = result.data

  // Upsert: if endpoint already exists, update the keys (browser may regenerate)
  const { error } = await supabase
    .from('pushsubscription')
    .upsert(
      { user_id: user.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' },
    )

  if (error) {
    console.error('[push/subscribe] upsert error:', error.message)
    throw createError({
      statusCode: 500,
      message: 'Failed to save subscription.',
    })
  }

  return { ok: true }
})
