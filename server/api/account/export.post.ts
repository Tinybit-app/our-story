import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  // One active job per user — prevent duplicate exports
  const { data: existing } = await supabase
    .from("exportjob")
    .select("id, status")
    .eq("user_id", user.sub)
    .in("status", ["pending", "processing"])
    .maybeSingle()

  if (existing) {
    throw createError({ statusCode: 409, message: "An export is already in progress." })
  }

  const { error } = await supabase
    .from("exportjob")
    .insert({ user_id: user.sub })

  if (error) {
    console.error("[account/export] insert failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to start export. Please try again." })
  }

  return {
    ok: true,
    message: "Export started — you'll receive a download link by email within a few minutes.",
  }
})
