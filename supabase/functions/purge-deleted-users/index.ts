import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Triggered daily at 3am UTC via pg_cron:
// SELECT cron.schedule(
//   'purge-deleted-users',
//   '0 3 * * *',
//   $$SELECT net.http_post(
//     url := 'https://[project].supabase.co/functions/v1/purge-deleted-users',
//     headers := '{"Authorization": "Bearer [service_role_key]"}'::jsonb
//   )$$
// );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Find users whose deletion grace period has expired (deleted_at > 30 days ago)
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Day-27 warning: users whose deletion_requested_at is between 27–28 days ago
  const warnCutoffEnd = new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString()
  const warnCutoffStart = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()

  const { data: warningUsers } = await supabase
    .from("user")
    .select("email, first_name, locale, deletion_requested_at")
    .not("deletion_requested_at", "is", null)
    .lt("deletion_requested_at", warnCutoffEnd)
    .gt("deletion_requested_at", warnCutoffStart)

  const resendKey = Deno.env.get("RESEND_API_KEY")
  const appUrl = Deno.env.get("APP_URL") ?? "https://our-story.tinybit.app"

  for (const u of warningUsers ?? []) {
    if (!u.email) continue
    const purgeDate = new Date(u.deletion_requested_at)
    purgeDate.setDate(purgeDate.getDate() + 30)
    const locale = u.locale ?? "en"
    const formatted = purgeDate.toLocaleDateString(
      locale === "zh-CN" ? "zh-CN" : "en",
      { year: "numeric", month: "long", day: "numeric" }
    )
    const isCN = locale === "zh-CN"
    const subject = isCN ? "你的账户将在 3 天后永久删除" : "Your account will be permanently deleted in 3 days"
    const body = isCN
      ? `<p>你好，${u.first_name ?? ""}，</p><p>这是你最后取消删除的机会。你的账户将于 <strong>${formatted}</strong> 永久删除，届时所有数据将无法恢复。</p><a href="${appUrl}/settings/account">取消删除 →</a>`
      : `<p>Hi ${u.first_name ?? ""},</p><p>This is your last chance to cancel. Your account will be permanently deleted on <strong>${formatted}</strong> and all your data will be gone forever.</p><a href="${appUrl}/settings/account">Cancel deletion →</a>`

    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Our Story <hello@our-story.tinybit.app>",
            to: u.email,
            subject,
            html: `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fffdf8;color:#1a1a1a;">${body}</div>`,
          }),
        })
      } catch (err) {
        console.error(`[purge-deleted-users] warning email failed for ${u.email}:`, err)
      }
    } else {
      console.log(`[dev] day-27 warning email to ${u.email}: ${subject}`)
    }
  }

  const { data: expiredUsers, error: fetchError } = await supabase
    .from("user")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)

  if (fetchError) {
    console.error("[purge-deleted-users] fetch failed:", fetchError.message)
    return Response.json({ error: "Failed to fetch expired users" }, { status: 500 })
  }

  const purged: string[] = []

  for (const user of expiredUsers ?? []) {
    try {
      // 1. Delete storage objects for memories still owned by this user.
      //    Memories detached via keepContent (owner_user_id = NULL) are skipped —
      //    their files stay in place so the circle can keep them.
      const { data: ownedMemories } = await supabase
        .from("memory")
        .select("id")
        .eq("owner_user_id", user.id)

      const ownedMemoryIds = (ownedMemories ?? []).map((m: { id: string }) => m.id)

      if (ownedMemoryIds.length > 0) {
        const { data: media } = await supabase
          .from("memorymedia")
          .select("storage_path")
          .in("memory_id", ownedMemoryIds)

        for (const obj of media ?? []) {
          await supabase.storage
            .from("memories-private")
            .remove([(obj as { storage_path: string }).storage_path])
        }
      }

      // 2. Hard delete User row (cascades to CircleMember, Memory where owner_user_id = user.id, AccountStorage, etc.)
      await supabase.from("user").delete().eq("id", user.id)

      // 3. Delete the auth.users entry
      await supabase.auth.admin.deleteUser(user.id)

      purged.push(user.id)
    } catch (err) {
      console.error(`[purge-deleted-users] failed for user ${user.id}:`, err)
    }
  }

  // ── Hard-purge circles whose 30-day window has expired ─────
  const { data: expiredCircles, error: circleFetchError } = await supabase
    .from("circle")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)

  if (circleFetchError) {
    console.error("[purge-deleted-users] circle fetch failed:", circleFetchError.message)
  }

  const purgedCircles: string[] = []

  for (const circle of expiredCircles ?? []) {
    try {
      // 1. Fetch all memory IDs for this circle
      const { data: memories } = await supabase
        .from("memory")
        .select("id")
        .eq("circle_id", circle.id)

      const memoryIds = (memories ?? []).map((m: { id: string }) => m.id)

      // 2. Delete storage objects
      if (memoryIds.length > 0) {
        const { data: media } = await supabase
          .from("memorymedia")
          .select("storage_path")
          .in("memory_id", memoryIds)

        for (const obj of media ?? []) {
          await supabase.storage
            .from("memories-private")
            .remove([(obj as { storage_path: string }).storage_path])
        }

        // 3. Delete memory rows (cascades to memorymedia, memorycomment, memoryreaction)
        await supabase.from("memory").delete().in("id", memoryIds)
      }

      // 4. Delete CircleMember rows
      await supabase.from("circlemember").delete().eq("circle_id", circle.id)

      // 5. Delete the circle itself
      await supabase.from("circle").delete().eq("id", circle.id)

      purgedCircles.push(circle.id)
    } catch (err) {
      console.error(`[purge-deleted-users] circle purge failed for ${circle.id}:`, err)
    }
  }

  return Response.json({ ok: true, purged: purged.length, purgedCircles: purgedCircles.length })
})
