import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const { firstName, lastName } = await readBody(event)

  if (!user?.sub) throw createError({ statusCode: 401 })
  if (!firstName?.trim()) throw createError({ statusCode: 400, message: "First name is required." })

  const { error } = await supabase
    .from("user")
    .update({ first_name: firstName.trim(), last_name: lastName?.trim() ?? null })
    .eq("id", user.sub)

  if (error) {
    console.error("[profile] update failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to save profile. Please try again." })
  }

  return { ok: true }
})
