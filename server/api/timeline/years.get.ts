import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const querySchema = z.object({
  circleId: z.string().uuid(),
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

  // Single indexed scan — memory_date is ordered descending so years come out newest-first
  const { data, error } = await supabase
    .from("memory")
    .select("memory_date")
    .eq("circle_id", circleId)
    .or(`visibility.eq.circle,and(visibility.eq.private,owner_user_id.eq.${user.sub})`)
    .order("memory_date", { ascending: false })

  if (error) {
    console.error("[timeline/years] query failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to load years." })
  }

  const years = [...new Set(
    (data ?? []).map((m) => new Date(m.memory_date).getUTCFullYear())
  )]

  return { years }
})
