import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, 'id')
  const commentId = getRouterParam(event, 'commentId')
  if (!memoryId || !commentId) throw createError({ statusCode: 400, message: 'Missing id' })

  // Verify the comment exists, belongs to this memory, and is owned by the caller
  const { data: comment } = await supabase
    .from('memorycomment')
    .select('id, user_id')
    .eq('id', commentId)
    .eq('memory_id', memoryId)
    .maybeSingle()

  if (!comment) throw createError({ statusCode: 404 })
  if (comment.user_id !== user.sub) throw createError({ statusCode: 403 })

  const { error } = await supabase.from('memorycomment').delete().eq('id', commentId)

  if (error) {
    console.error('[comment delete] error:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to delete comment.' })
  }

  return { success: true }
})
