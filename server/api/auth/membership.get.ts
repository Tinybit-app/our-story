import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase
      .from("circlemember")
      .select("circle_id, circle:circle_id(deleted_at)")
      .eq("user_id", user.sub),
    supabase.from("user").select("first_name, deleted_at").eq("id", user.sub).maybeSingle(),
  ])

  // Exclude memberships in soft-deleted or missing circles — service role bypasses
  // RLS so we must filter deleted_at manually here.
  const hasMembership = (memberships ?? []).some((m: any) => m.circle && !m.circle.deleted_at)

  return {
    hasMembership,
    needsProfile: !profile?.first_name,
    deletedAt: profile?.deleted_at ?? null,
  }
})
