import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const { error } = await supabase
    .from('user')
    .update({ deleted_at: null, deletion_requested_at: null })
    .eq('id', user.sub)

  if (error) {
    console.error('[account/cancel-deletion] update failed:', error.message)
    throw createError({
      statusCode: 500,
      message: 'Failed to cancel deletion. Please try again.',
    })
  }

  return { ok: true }
})
