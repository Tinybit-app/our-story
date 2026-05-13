import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  if (!circleId)
    throw createError({ statusCode: 400, message: 'Missing circle ID' })

  // Verify membership
  const { data: membership } = await supabase
    .from('circlemember')
    .select('id')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  const { data, error } = await supabase
    .from('childprofile')
    .select('id, name, date_of_birth')
    .eq('circle_id', circleId)
    .order('date_of_birth', { ascending: true })

  if (error) {
    console.error('[children] query failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to load children.' })
  }

  return { children: data ?? [] }
})
