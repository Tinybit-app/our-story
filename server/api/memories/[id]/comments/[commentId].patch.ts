import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  body: z.string().min(1).max(2000).trim(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, 'id')
  const commentId = getRouterParam(event, 'commentId')
  if (!memoryId || !commentId)
    throw createError({ statusCode: 400, message: 'Missing id' })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, message: 'Comment body is required.' })
  const { body } = result.data

  // Verify ownership — only the comment author may edit
  const { data: comment } = await supabase
    .from('memorycomment')
    .select('id, user_id')
    .eq('id', commentId)
    .eq('memory_id', memoryId)
    .maybeSingle()

  if (!comment) throw createError({ statusCode: 404 })
  if (comment.user_id !== user.sub) throw createError({ statusCode: 403 })

  // updated_at is a new column (migration 022) — cast until types are regenerated
  const { error } = await supabase
    .from('memorycomment')
    .update({ body, updated_at: new Date().toISOString() } as any)
    .eq('id', commentId)

  if (error) {
    console.error('[comment patch] update error:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to update comment.' })
  }

  return { comment: { id: commentId, body } }
})
