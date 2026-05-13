import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const schema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((d) => d.name !== undefined || d.dateOfBirth !== undefined, {
    message: 'At least one field must be provided.',
  })

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  const childId = getRouterParam(event, 'childId')
  if (!circleId || !childId) throw createError({ statusCode: 400, message: 'Missing IDs' })

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: parsed.error.issues[0]?.message ?? 'Invalid input',
    })
  }

  // Owner-only
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    throw createError({ statusCode: 403, message: 'Only the circle owner can manage children.' })
  }

  const updates: Record<string, string> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.dateOfBirth !== undefined) updates.date_of_birth = parsed.data.dateOfBirth

  const { data, error } = await supabase
    .from('childprofile')
    .update(updates)
    .eq('id', childId)
    .eq('circle_id', circleId)
    .select('id, name, date_of_birth')
    .single()

  if (error) {
    console.error('[children] patch failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to update child.' })
  }

  return { child: data }
})
