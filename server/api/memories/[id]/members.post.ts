import { serverSupabaseServiceRole, serverSupabaseUser } from "#supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  userIds: z.array(z.uuid()).max(20),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const memoryId = getRouterParam(event, "id")
  if (!memoryId) throw createError({ statusCode: 400, message: "Missing memory id" })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: "Invalid request body." })
  const { userIds } = result.data

  // Verify the caller uploaded this memory
  const { data: memory } = await supabase
    .from("memory")
    .select("id, owner_user_id, circle_id")
    .eq("id", memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // Validate every userId is an active member of the same circle
  if (userIds.length > 0) {
    const { data: validMembers } = await supabase
      .from("circlemember")
      .select("user_id")
      .eq("circle_id", memory.circle_id)
      .in("user_id", userIds)

    const validSet = new Set((validMembers ?? []).map((m: any) => m.user_id))
    if (!userIds.every((id) => validSet.has(id))) {
      throw createError({ statusCode: 400, message: "One or more user IDs are not circle members." })
    }
  }

  // Capture existing tags before replace-all so we know who's newly tagged
  const { data: existingTags } = await (supabase as any)
    .from("memory_members")
    .select("user_id")
    .eq("memory_id", memoryId)

  const existingUserIds = new Set((existingTags ?? []).map((t: any) => t.user_id))
  const newlyTaggedIds = userIds.filter((id) => !existingUserIds.has(id) && id !== user.sub)

  // Replace: delete all existing tags, then insert new ones
  const { error: deleteError } = await (supabase as any)
    .from("memory_members")
    .delete()
    .eq("memory_id", memoryId)

  if (deleteError) {
    console.error("[memory members] delete failed:", deleteError.message)
    throw createError({ statusCode: 500, message: "Failed to update member tags." })
  }

  if (userIds.length > 0) {
    const { error: insertError } = await (supabase as any)
      .from("memory_members")
      .insert(userIds.map((userId) => ({ memory_id: memoryId, user_id: userId })))

    if (insertError) {
      console.error("[memory members] insert failed:", insertError.message)
      throw createError({ statusCode: 500, message: "Failed to tag members." })
    }
  }

  // Notify newly tagged members (fire-and-forget — don't block the response)
  if (newlyTaggedIds.length > 0) {
    sendTagNotifications(supabase, user.sub, memory.circle_id, newlyTaggedIds).catch((err) =>
      console.error("[memory members] notification failed:", err)
    )
  }

  return { ok: true }
})

async function sendTagNotifications(
  supabase: any,
  taggerUserId: string,
  circleId: string,
  newlyTaggedIds: string[],
) {
  const config = useRuntimeConfig()
  const appUrl = (config.public.appUrl as string | undefined) ?? "https://our-story.tinybit.app"

  // Fetch tagger name and circle name in parallel
  const [taggerResult, circleResult] = await Promise.all([
    supabase.from("user").select("first_name, last_name").eq("id", taggerUserId).maybeSingle(),
    supabase.from("circle").select("name").eq("id", circleId).maybeSingle(),
  ])

  const taggerName =
    [taggerResult.data?.first_name, taggerResult.data?.last_name].filter(Boolean).join(" ") ||
    "Someone"
  const circleName = circleResult.data?.name ?? "your circle"

  // Fetch tagged users' profiles (locale) + their auth emails
  const { data: taggedProfiles } = await supabase
    .from("user")
    .select("id, locale")
    .in("id", newlyTaggedIds)

  for (const profile of taggedProfiles ?? []) {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
    const email = authUser?.user?.email
    if (!email) continue

    const { subject, html } = buildTaggedInMemoryEmail({
      taggedByName: taggerName,
      circleName,
      appUrl,
      locale: profile.locale ?? "en",
    })

    await sendEmail({ to: email, subject, html })
  }
}
