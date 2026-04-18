import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const schema = z.object({
  keepCircleMemories: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const body = schema.safeParse(await readBody(event).catch(() => ({})))
  const keepCircleMemories = body.success ? body.data.keepCircleMemories : true

  // Resolve ownership for every circle this user owns
  const { data: ownedMemberships } = await supabase
    .from("circlemember")
    .select("circle_id, circle:circle_id(name)")
    .eq("user_id", user.sub)
    .eq("role", "owner")

  const circlesNeedingTransfer: string[] = []
  const promotions: Array<{ newOwnerId: string; circleName: string }> = []

  for (const m of ownedMemberships ?? []) {
    const circleId = m.circle_id
    const circleName = (m.circle as any)?.name ?? circleId

    // Find the oldest admin in this circle (excluding the deleting user)
    const { data: oldestAdmin } = await supabase
      .from("circlemember")
      .select("user_id")
      .eq("circle_id", circleId)
      .eq("role", "admin")
      .neq("user_id", user.sub)
      .order("created_at")
      .limit(1)
      .maybeSingle()

    if (oldestAdmin) {
      // Auto-promote oldest admin to owner
      const { error } = await supabase
        .from("circlemember")
        .update({ role: "owner" })
        .eq("user_id", oldestAdmin.user_id)
        .eq("circle_id", circleId)

      if (error) {
        console.error("[account/delete] auto-promote failed:", error.message)
        throw createError({ statusCode: 500, message: "Failed to transfer ownership. Please try again." })
      }

      // Notify new owner (best-effort)
      promotions.push({ newOwnerId: oldestAdmin.user_id, circleName })
    } else {
      // Check for other members (non-admin, non-owner)
      const { count: otherMembers } = await supabase
        .from("circlemember")
        .select("*", { count: "exact", head: true })
        .eq("circle_id", circleId)
        .neq("user_id", user.sub)

      if ((otherMembers ?? 0) > 0) {
        // Has members but no admins — owner must manually transfer before deleting
        circlesNeedingTransfer.push(circleName)
      }
      // If no other members: sole owner, OK to proceed (circle stays until purge)
    }
  }

  if (circlesNeedingTransfer.length > 0) {
    throw createError({
      statusCode: 400,
      message: "Some circles need a new owner before you can delete your account.",
      data: { code: "needs_transfer", circles: circlesNeedingTransfer },
    })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("user")
    .update({ deleted_at: now, deletion_requested_at: now })
    .eq("id", user.sub)

  if (error) {
    console.error("[account/delete] update failed:", error.message)
    throw createError({ statusCode: 500, message: "Failed to request account deletion. Please try again." })
  }

  // Revoke all active sessions so the user is immediately signed out everywhere
  await supabase.auth.admin.signOut(user.sub, "global")

  // Handle circle memories based on user's choice.
  // keepCircleMemories=true: detach all their circle memories now (NULL owner_user_id +
  //   snapshot former_owner_name) so the purge cron skips them. Photos stay on timelines.
  // keepCircleMemories=false: leave as-is — the purge cron cascade-deletes them at day 30.
  if (keepCircleMemories) {
    const { data: userProfile } = await (supabase as any)
      .from("user")
      .select("first_name, last_name")
      .eq("id", user.sub)
      .maybeSingle()

    const formerName = [userProfile?.first_name, userProfile?.last_name]
      .filter(Boolean).join(" ") || null

    await supabase
      .from("memory")
      .update({ owner_user_id: null, former_owner_name: formerName, former_owner_user_id: user.sub } as any)
      .eq("owner_user_id", user.sub)
      .eq("visibility", "circle")
  }

  // Send emails best-effort — don't fail the request if they error
  try {
    const config = useRuntimeConfig()
    const purgeDate = new Date(now)
    purgeDate.setDate(purgeDate.getDate() + 30)

    // Fetch deleting user's profile for the confirmation email
    const { data: deletingUser } = await (supabase as any)
      .from("user")
      .select("email, first_name, locale")
      .eq("id", user.sub)
      .maybeSingle()

    if (deletingUser?.email) {
      const formattedDate = purgeDate.toLocaleDateString(
        deletingUser.locale === "zh-CN" ? "zh-CN" : "en",
        { year: "numeric", month: "long", day: "numeric" }
      )
      const { subject, html } = buildAccountDeletionEmail({
        firstName: deletingUser.first_name ?? "",
        purgeDate: formattedDate,
        cancelUrl: `${config.appUrl}/settings/account`,
        locale: deletingUser.locale ?? "en",
      })
      await sendEmail({ to: deletingUser.email, subject, html })
    }

    // Notify each auto-promoted owner
    for (const { newOwnerId, circleName } of promotions) {
      const [{ data: newOwner }, { data: prevOwner }] = await Promise.all([
        (supabase as any).from("user").select("email, first_name, locale").eq("id", newOwnerId).maybeSingle(),
        (supabase as any).from("user").select("first_name, last_name").eq("id", user.sub).maybeSingle(),
      ])
      if (newOwner?.email) {
        const prevName = [prevOwner?.first_name, prevOwner?.last_name].filter(Boolean).join(" ") || "The previous owner"
        const { subject, html } = buildOwnerPromotedEmail({
          newOwnerFirstName: newOwner.first_name ?? "",
          previousOwnerName: prevName,
          circleName,
          appUrl: config.appUrl as string,
          locale: newOwner.locale ?? "en",
        })
        await sendEmail({ to: newOwner.email, subject, html })
      }
    }
  } catch (err) {
    console.error("[account/delete] notification emails failed:", err)
  }

  return { ok: true }
})
