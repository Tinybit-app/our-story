import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  // Return circles that this user deleted (deletion_initiated_by = user.id) and are within the 30-day window
  const { data, error } = await supabase
    .from('circle')
    .select('id, name, circle_type, deleted_at')
    .eq('deletion_initiated_by', user.sub)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) {
    console.error('[circles/deleted] query failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to load deleted circles.' })
  }

  // Filter to only those within the 30-day window
  const now = Date.now()
  const restorable = (data ?? []).filter((c) => {
    const days = (now - new Date(c.deleted_at!).getTime()) / (1000 * 60 * 60 * 24)
    return days < 30
  })

  return {
    circles: restorable.map((c) => ({
      id: c.id,
      name: c.name,
      circle_type: c.circle_type,
      deleted_at: c.deleted_at,
      purge_date: new Date(
        new Date(c.deleted_at!).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })),
  }
})
