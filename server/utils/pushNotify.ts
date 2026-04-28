import webpush from "web-push"

// ─────────────────────────────────────────────────────────────
// Payload builder (exported for unit tests)
// ─────────────────────────────────────────────────────────────

interface PushPayloadInput {
  type: "upload" | "comment" | "reaction"
  actorName: string
  circleId: string
  actorUserId: string
  memoryId: string
  bodyText?: string | null
  emoji?: string
  recentUploadCount?: number
}

interface PushPayload {
  title: string
  body: string
  tag: string
  renotify: boolean
  data: { url: string }
}

export function buildPushPayload(input: PushPayloadInput): PushPayload {
  const { type, actorName, circleId, actorUserId, memoryId } = input

  const url = `/timeline?circle=${circleId}&memory=${memoryId}`
  const tag = `${type}-${circleId}-${actorUserId}`

  let title: string
  let body: string
  let renotify = true

  switch (type) {
    case "upload": {
      const count = input.recentUploadCount ?? 1
      renotify = count <= 1
      title = count > 1
        ? `${actorName} added ${count} memories`
        : `${actorName} added a memory`
      body = count > 1
        ? "Check out what's new"
        : input.bodyText
          ? truncate(input.bodyText, 100)
          : "Shared a new memory"
      break
    }
    case "comment":
      title = `${actorName} commented`
      body = input.bodyText ? truncate(input.bodyText, 100) : ""
      break
    case "reaction":
      title = `${actorName} reacted ${input.emoji ?? ""}`
      body = ""
      break
  }

  return { title, body, tag, renotify, data: { url } }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text
}

// ─────────────────────────────────────────────────────────────
// Push dispatcher
// ─────────────────────────────────────────────────────────────

export async function sendPushToCircle(
  supabase: any,
  circleId: string,
  excludeUserId: string,
  payload: PushPayload
): Promise<void> {
  const config = useRuntimeConfig()

  webpush.setVapidDetails(
    config.vapidSubject as string,
    config.public.vapidPublicKey as string,
    config.vapidPrivateKey as string
  )

  // 1. Get all circle members except the actor
  const { data: members } = await supabase
    .from("circlemember")
    .select("user_id")
    .eq("circle_id", circleId)
    .neq("user_id", excludeUserId)

  if (!members?.length) return

  const memberIds = members.map((m: any) => m.user_id)

  // 2. Check notification preferences — skip muted or push-disabled
  const { data: prefs } = await supabase
    .from("notificationpreference")
    .select("user_id, push_enabled, circle_muted, quiet_hours_start, quiet_hours_end")
    .eq("circle_id", circleId)
    .in("user_id", memberIds)

  const prefsMap = new Map<string, any>()
  for (const p of prefs ?? []) {
    prefsMap.set(p.user_id, p)
  }

  // Filter to users who should receive push
  const eligibleUserIds = memberIds.filter((uid: string) => {
    const pref = prefsMap.get(uid)
    if (!pref) return true // no prefs row → defaults (push_enabled=true, not muted)
    if (pref.circle_muted) return false
    if (!pref.push_enabled) return false
    if (pref.quiet_hours_start && pref.quiet_hours_end) {
      if (isWithinQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)) return false
    }
    return true
  })

  if (!eligibleUserIds.length) return

  // 3. Get push subscriptions for eligible users
  const { data: subscriptions } = await supabase
    .from("pushsubscription")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", eligibleUserIds)

  if (!subscriptions?.length) return

  // 4. Send push to each subscription (fire-and-forget)
  const pushPayload = JSON.stringify(payload)

  for (const sub of subscriptions) {
    webpush
      .sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload
      )
      .catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — clean up
          await supabase.from("pushsubscription").delete().eq("id", sub.id)
        } else {
          console.error("[push] send failed:", err.message)
        }
      })
  }
}

function isWithinQuietHours(start: string, end: string): boolean {
  const now = new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`

  // Handle overnight ranges (e.g., 22:00 – 08:00)
  if (start <= end) {
    return hhmm >= start && hhmm < end
  }
  return hhmm >= start || hhmm < end
}
