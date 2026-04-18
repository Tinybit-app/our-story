import { serverSupabaseServiceRole } from "#supabase/server"

// Public endpoint — no auth required.
// Returns the current state of an invite so the client can show the right
// error screen without forcing the user through a sign-in flow first.
export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const token = getRouterParam(event, "token")

  if (!token) throw createError({ statusCode: 400, message: "Missing token" })

  const { data: invite } = await supabase
    .from("circleinvite")
    .select("status, expires_at, circle_id")
    .eq("token", token)
    .single()

  if (!invite || invite.status !== "pending") {
    return { status: "expired" as const }
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { status: "expired" as const }
  }

  const { data: circle } = await supabase
    .from("circle")
    .select("deleted_at")
    .eq("id", invite.circle_id)
    .maybeSingle()

  if (!circle || circle.deleted_at) {
    return { status: "circle_deleted" as const }
  }

  return { status: "pending" as const }
})
