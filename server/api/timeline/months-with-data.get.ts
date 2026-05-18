import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const querySchema = z.object({
  circleId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = querySchema.safeParse(getQuery(event))
  if (!result.success)
    throw createError({
      statusCode: 400,
      message: 'circleId, year, month all required',
    })
  const { circleId, year, month } = result.data

  const supabase = serverSupabaseServiceRole(event)

  // Verify membership
  const { data: membership } = await supabase
    .from('circlemember')
    .select('id')
    .eq('user_id', user.sub)
    .eq('circle_id', circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  // Start of the current month (UTC) — used as the cutoff for prev/next walks
  const currentStart = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const currentEnd = new Date(Date.UTC(year, month, 1)).toISOString()

  // Previous month with data: latest memory_date STRICTLY BEFORE currentStart
  const prevRow = await supabase
    .from('memory')
    .select('memory_date')
    .eq('circle_id', circleId)
    .eq('visibility', 'circle')
    .lt('memory_date', currentStart)
    .order('memory_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Next month with data: earliest memory_date AT OR AFTER currentEnd
  const nextRow = await supabase
    .from('memory')
    .select('memory_date')
    .eq('circle_id', circleId)
    .eq('visibility', 'circle')
    .gte('memory_date', currentEnd)
    .order('memory_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  const toMonth = (d: string | null | undefined) => {
    if (!d) return null
    const date = new Date(d)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
  }

  return {
    prev: toMonth(prevRow.data?.memory_date),
    next: toMonth(nextRow.data?.memory_date),
  }
})
