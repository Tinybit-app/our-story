import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  endpoint: z.string().url(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request.' })

  const { error } = await supabase
    .from('pushsubscription')
    .delete()
    .eq('endpoint', result.data.endpoint)
    .eq('user_id', user.sub)

  if (error) {
    console.error('[push/unsubscribe] delete error:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to remove subscription.' })
  }

  return { ok: true }
})
