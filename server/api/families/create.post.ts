import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).max(100),
  circleType: z.string().min(1).max(50),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request" })
  const { name, circleType } = result.data

  const { data: family, error } = await supabase
    .from("family")
    .insert({ name, circle_type: circleType, created_by: user.sub })
    .select()
    .single()

  if (error || !family) {
    console.error("[create-family] family insert failed:", error?.message)
    throw createError({ statusCode: 500, message: "Failed to create family. Please try again." })
  }

  const { error: memberError } = await supabase.from("familymember").insert({
    user_id: user.sub,
    family_id: family.id,
    role: "owner",
  })

  if (memberError) {
    console.error("[create-family] familymember insert failed:", memberError.message)
    // Roll back the family row so the user can try again
    await supabase.from("family").delete().eq("id", family.id)
    throw createError({ statusCode: 500, message: "Failed to create family. Please try again." })
  }

  return { familyId: family.id }
})
