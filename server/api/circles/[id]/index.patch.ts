import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const CIRCLE_TYPES = [
  'parents',
  'couple',
  'family',
  'friends',
  'caregiving',
  'travel',
  'solo',
  'custom',
] as const

const schema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    circleType: z.enum(CIRCLE_TYPES).optional(),
    anniversaryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.circleType !== undefined || d.anniversaryDate !== undefined,
    {
      message: 'At least one field (name, circleType, or anniversaryDate) must be provided.',
    },
  )

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, 'id')
  if (!circleId) throw createError({ statusCode: 400, message: 'Missing circle ID' })

  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request body.' })
  const { name, circleType, anniversaryDate } = result.data

  // Requesting user must be the owner
  const { data: membership } = await supabase
    .from('circlemember')
    .select('role')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    throw createError({
      statusCode: 403,
      message: 'Only the circle owner can update circle settings.',
    })
  }

  const updates: { name?: string; circle_type?: string; anniversary_date?: string | null } = {}
  if (name !== undefined) updates.name = name
  if (circleType !== undefined) updates.circle_type = circleType
  if (anniversaryDate !== undefined) updates.anniversary_date = anniversaryDate

  const { error } = await supabase
    .from('circle')
    .update(updates as any)
    .eq('id', circleId)

  if (error) {
    console.error('[circle-patch] update failed:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to update circle. Please try again.' })
  }

  return { ok: true }
})
