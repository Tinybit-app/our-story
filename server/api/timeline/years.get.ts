import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const querySchema = z.object({
  circleId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = querySchema.safeParse(getQuery(event))
  if (!result.success) throw createError({ statusCode: 400, message: "circleId is required" })
  const { circleId } = result.data

  const supabase = serverSupabaseServiceRole(event)

  // Verify membership
  const { data: membership } = await supabase
    .from("circlemember")
    .select("id")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  const visibilityFilter = `visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${user.sub})`

  // Latest memory — gives us the newest year and maxDate
  const firstRow = await supabase
    .from("memory")
    .select("memory_date")
    .eq("circle_id", circleId)
    .or(visibilityFilter)
    .order("memory_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!firstRow.data) return { years: [], minDate: null, maxDate: null }

  const years: number[] = []
  const maxDate = firstRow.data.memory_date.slice(0, 10) // YYYY-MM-DD
  let minDate = maxDate
  let currentYear = new Date(firstRow.data.memory_date).getUTCFullYear()

  // Walk backwards year by year using LIMIT-1 index scans — O(distinct years)
  while (currentYear >= 2000) {
    years.push(currentYear)
    const before = new Date(Date.UTC(currentYear, 0, 1)).toISOString()
    const prev = await supabase
      .from("memory")
      .select("memory_date")
      .eq("circle_id", circleId)
      .or(visibilityFilter)
      .lt("memory_date", before)
      .order("memory_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!prev.data) break
    // The oldest memory found in this iteration is our running minDate
    minDate = prev.data.memory_date.slice(0, 10)
    currentYear = new Date(prev.data.memory_date).getUTCFullYear()
  }

  return { years, minDate, maxDate }
})
