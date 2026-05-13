import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(100).trim(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  if (!circleId)
    throw createError({ statusCode: 400, message: 'Missing circle ID' })

  const result = schema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, message: 'Invalid name or date.' })
  const { name, dateOfBirth } = result.data

  // Owner-only
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    throw createError({
      statusCode: 403,
      message: 'Only the circle owner can manage children.',
    })
  }

  // Limit to 10 children per circle
  const { count } = await supabase
    .from('childprofile')
    .select('id', { count: 'exact', head: true })
    .eq('circle_id', circleId)

  if ((count ?? 0) >= 10) {
    throw createError({
      statusCode: 422,
      message: 'Maximum of 10 children per circle.',
    })
  }

  const { data, error } = await supabase
    .from('childprofile')
    .insert({ circle_id: circleId, name, date_of_birth: dateOfBirth })
    .select('id, name, date_of_birth')
    .single()

  if (error) {
    console.error('[children] insert failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to add child.' })
  }

  return { child: data }
})
