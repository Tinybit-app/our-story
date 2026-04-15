import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const { familyId } = await readBody(event)

  if (!user?.sub) throw createError({ statusCode: 401 })
  if (!familyId) throw createError({ statusCode: 400 })

  // Only the family owner can complete onboarding
  const { data: membership } = await supabase
    .from("familymember")
    .select("id")
    .eq("user_id", user.sub)
    .eq("family_id", familyId)
    .eq("role", "owner")
    .maybeSingle()

  if (!membership) throw createError({ statusCode: 403 })

  await supabase
    .from("family")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", familyId)

  return { ok: true }
})
