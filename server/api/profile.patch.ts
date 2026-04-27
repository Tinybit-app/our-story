import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const schema = z.object({
  firstName: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  lastName: z.string().max(100).transform((s) => s.trim()).optional(),
  locale: z.enum(["en", "zh-CN", "fr"]).optional(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid profile data." })
  const { firstName, lastName, locale } = result.data

  // Build update payload — only include fields that were provided
  const patch: Record<string, unknown> = {}
  if (firstName !== undefined) patch.first_name = firstName
  if (lastName !== undefined) patch.last_name = lastName ?? null
  if (locale !== undefined) patch.locale = locale

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await supabase
    .from("user")
    .update(patch)
    .eq("id", user.sub)

  if (error) {
    console.error("[profile] update failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to save profile. Please try again." })
  }

  return { ok: true }
})