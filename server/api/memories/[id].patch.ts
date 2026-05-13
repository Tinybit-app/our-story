import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  note: z.string().max(500).nullable().optional(),
  milestone_label: z.string().max(40).nullable().optional(),
  memory_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  coverMediaId: z.uuid().nullable().optional(),
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
  const { coverMediaId, ...rest } = result.data

  // Verify ownership — only the uploader may edit their own memory
  const { data: memory } = await supabase
    .from('memory')
    .select('id, owner_user_id')
    .eq('id', memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  const updatePayload = {
    ...rest,
    ...(coverMediaId !== undefined ? { cover_media_id: coverMediaId } : {}),
  }

  const { data: updated, error } = await supabase
    .from('memory')
    .update(updatePayload)
    .eq('id', memoryId)
    .select('id, note, milestone_label, memory_date, cover_media_id')
    .maybeSingle()

  if (error) {
    console.error('[memory patch] update error:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to update memory.' })
  }

  return { memory: updated }
})
