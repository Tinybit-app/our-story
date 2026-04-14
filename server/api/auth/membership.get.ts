import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const { data } = await supabase
    .from("familymember")
    .select("family_id")
    .eq("user_id", user.sub)
    .limit(1)
    .maybeSingle()

  return { hasMembership: !!data }
})
