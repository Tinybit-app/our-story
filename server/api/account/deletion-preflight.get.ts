import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

/**
 * Returns circles that need manual ownership transfer before the user
 * can delete their account. Mirrors the check in POST /api/account/delete
 * but is read-only — no state changes.
 *
 * Used by the settings page to show the ownership warning upfront rather
 * than only after a failed delete attempt.
 */
export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const { data: ownedMemberships } = await supabase
    .from("circlemember")
    .select("circle_id, circle:circle_id(name)")
    .eq("user_id", user.sub)
    .eq("role", "owner")

  const circlesNeedingTransfer: string[] = []

  for (const m of ownedMemberships ?? []) {
    const circleId = m.circle_id
    const circleName = (m.circle as any)?.name ?? circleId

    // Does this circle have at least one admin who can be auto-promoted?
    const { data: oldestAdmin } = await supabase
      .from("circlemember")
      .select("user_id")
      .eq("circle_id", circleId)
      .eq("role", "admin")
      .neq("user_id", user.sub)
      .limit(1)
      .maybeSingle()

    if (!oldestAdmin) {
      // No admin available — check if there are other members who would be orphaned
      const { count: otherMembers } = await supabase
        .from("circlemember")
        .select("*", { count: "exact", head: true })
        .eq("circle_id", circleId)
        .neq("user_id", user.sub)

      if ((otherMembers ?? 0) > 0) {
        circlesNeedingTransfer.push(circleName)
      }
    }
  }

  return { circlesNeedingTransfer }
})
