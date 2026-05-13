import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const { data, error } = await supabase
    .from('user')
    .select('first_name, last_name, avatar_url, locale, deleted_at')
    .eq('id', user.sub)
    .maybeSingle()

  if (error) {
    console.error('[profile] query failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to load profile.' })
  }

  return {
    firstName: data?.first_name ?? null,
    lastName: data?.last_name ?? null,
    avatarUrl: data?.avatar_url ?? null,
    locale: data?.locale ?? null,
    deletedAt: data?.deleted_at ?? null,
  }
})
