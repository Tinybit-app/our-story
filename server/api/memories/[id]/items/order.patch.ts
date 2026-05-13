import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  orderedIds: z.array(z.uuid()).min(1),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, 'id')
  if (!memoryId)
    throw createError({ statusCode: 400, message: 'Missing memory id' })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, message: 'Invalid request body.' })
  const { orderedIds } = result.data

  const { data: memory } = await supabase
    .from('memory')
    .select('id, owner_user_id')
    .eq('id', memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  const updates = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('memorymedia')
        .update({ display_order: index })
        .eq('id', id)
        .eq('memory_id', memoryId),
    ),
  )

  const failed = updates.find((r) => r.error)
  if (failed?.error) {
    console.error('[items.order] update error:', failed.error.message)
    throw createError({ statusCode: 500, message: 'Failed to reorder items.' })
  }

  return { ok: true }
})
