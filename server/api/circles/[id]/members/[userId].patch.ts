import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const schema = z.object({
  role: z.enum(["admin", "member", "owner"]),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const circleId = getRouterParam(event, "id")
  const targetUserId = getRouterParam(event, "userId")
  if (!circleId || !targetUserId) throw createError({ statusCode: 400, message: "Missing parameters" })

  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })
  const { role: newRole } = result.data

  // Only the owner can change roles
  const { data: myMembership } = await supabase
    .from("circlemember")
    .select("role")
    .eq("user_id", user.sub)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (myMembership?.role !== "owner") {
    throw createError({ statusCode: 403, message: "Only the circle owner can change roles." })
  }

  // Cannot change own role
  if (targetUserId === user.sub) {
    throw createError({ statusCode: 400, message: "You cannot change your own role." })
  }

  const { data: target } = await supabase
    .from("circlemember")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("circle_id", circleId)
    .maybeSingle()

  if (!target) throw createError({ statusCode: 404, message: "Member not found." })
  if (target.role === "owner") throw createError({ statusCode: 400, message: "Cannot change the owner's role directly." })

  if (newRole === "owner") {
    // Transfer ownership: promote target to owner, demote current owner to admin
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("circlemember").update({ role: "owner" }).eq("user_id", targetUserId).eq("circle_id", circleId),
      supabase.from("circlemember").update({ role: "admin" }).eq("user_id", user.sub).eq("circle_id", circleId),
    ])
    if (e1 || e2) {
      console.error("[role-change] transfer ownership failed:", e1?.message ?? e2?.message)
      throw createError({ statusCode: 500, message: "Failed to transfer ownership. Please try again." })
    }
  } else {
    const { error } = await supabase
      .from("circlemember")
      .update({ role: newRole })
      .eq("user_id", targetUserId)
      .eq("circle_id", circleId)

    if (error) {
      console.error("[role-change] update failed:", error.message)
      throw createError({ statusCode: 500, message: "Failed to update role. Please try again." })
    }
  }

  return { ok: true }
})
