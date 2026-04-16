import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from("circlemember").select("circle_id").eq("user_id", user.sub).limit(1).maybeSingle(),
    supabase.from("user").select("first_name").eq("id", user.sub).maybeSingle(),
  ])

  return {
    hasMembership: !!membership,
    needsProfile: !profile?.first_name,
  }
})
