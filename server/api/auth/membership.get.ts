import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("familymember")
      .select("role, family:family_id(onboarding_completed_at)")
      .eq("user_id", user.sub)
      .limit(1)
      .maybeSingle(),
    supabase.from("user").select("first_name").eq("id", user.sub).maybeSingle(),
  ])

  // Non-owners joined via invite and don't need to complete onboarding
  const onboardingComplete =
    !membership ||
    membership.role !== "owner" ||
    !!(membership.family as any)?.onboarding_completed_at

  return {
    hasMembership: !!membership,
    needsProfile: !profile?.first_name,
    onboardingComplete,
  }
})
