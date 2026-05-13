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

const schema = z.object({
  name: z.string().min(1).max(100),
  circleType: z.enum(CIRCLE_TYPES),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = schema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, message: 'Invalid request' })
  const { name, circleType } = result.data

  const { data: circle, error } = await supabase
    .from('circle')
    .insert({ name, circle_type: circleType, created_by: user.sub })
    .select()
    .single()

  if (error || !circle) {
    console.error('[create-circle] circle insert failed:', error?.message)
    throw createError({
      statusCode: 500,
      message: 'Failed to create circle. Please try again.',
    })
  }

  const { error: memberError } = await supabase.from('circlemember').insert({
    user_id: user.sub,
    circle_id: circle.id,
    role: 'owner',
  })

  if (memberError) {
    console.error(
      '[create-circle] circlemember insert failed:',
      memberError.message,
    )
    // Roll back the circle row so the user can try again
    await supabase.from('circle').delete().eq('id', circle.id)
    throw createError({
      statusCode: 500,
      message: 'Failed to create circle. Please try again.',
    })
  }

  return { circleId: circle.id }
})
