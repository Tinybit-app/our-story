import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('media'),
    storagePath: z.string().min(1),
    fileSize: z.number().int().positive(),
    mediaType: z.enum(['photo', 'video', 'live_photo']),
  }),
  z.object({
    type: z.literal('text'),
    textContent: z.string().min(1).max(2000),
  }),
])

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
  const bodyData = result.data

  const { data: memory } = await supabase
    .from('memory')
    .select('id, owner_user_id, circle_id')
    .eq('id', memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // Compute next display_order
  const { data: maxRow } = await supabase
    .from('memorymedia')
    .select('display_order')
    .eq('memory_id', memoryId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.display_order ?? -1) + 1

  // Build insert payload
  const insertPayload =
    bodyData.type === 'media'
      ? {
          memory_id: memoryId,
          storage_path: bodyData.storagePath,
          file_size: bodyData.fileSize,
          media_type: bodyData.mediaType,
          display_order: nextOrder,
        }
      : {
          memory_id: memoryId,
          media_type: 'text' as const,
          text_content: bodyData.textContent,
          display_order: nextOrder,
        }

  const { data: row, error } = await supabase
    .from('memorymedia')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error || !row) {
    console.error('[items.post] insert error:', error?.message)
    throw createError({ statusCode: 500, message: 'Failed to add item.' })
  }

  return { itemId: row.id }
})
