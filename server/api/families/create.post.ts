import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const { name, circleType } = await readBody(event)

  if (!user?.sub) throw createError({ statusCode: 401 })
  if (!name || !circleType) throw createError({ statusCode: 400, message: "name and circleType are required" })

  const { data: family, error } = await supabase
    .from("family")
    .insert({ name, circle_type: circleType, created_by: user.sub })
    .select()
    .single()

  if (error || !family) {
    throw createError({ statusCode: 500, message: error?.message ?? "Failed to create family" })
  }

  await supabase.from("familymember").insert({
    user_id: user.sub,
    family_id: family.id,
    role: "owner",
  })

  return { familyId: family.id }
})
