import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const schema = z.object({
  firstName: z.string().min(1).max(100).transform((s) => s.trim()),
  lastName: z.string().max(100).transform((s) => s.trim()).optional(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "First name is required." })
  const { firstName, lastName } = result.data

  const { error } = await supabase
    .from("user")
    .update({ first_name: firstName, last_name: lastName ?? null })
    .eq("id", user.sub)

  if (error) {
    console.error("[profile] update failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to save profile. Please try again." })
  }

  return { ok: true }
})
