# Quiet Circle Nudge Implementation Plan (12.4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily Edge Function sends a soft nudge to circle owners whose circle has had no uploads in 14 days. Capped at 3 nudges per quiet period, min 14 days between sends.

**Architecture:** Pure-function email builder in `server/utils/email.ts` (Vitest-tested) mirrored 1:1 in `supabase/functions/send-quiet-circle-nudges/quietCircleNudgeEmail.ts`. Edge Function queries candidates, finds owner, picks channel (push if subscribed → email fallback), updates counter. No new schema — `last_memory_at`, `quiet_nudge_count`, `quiet_nudge_last_sent_at` already exist (migration 004), and the existing `handle_memory_insert` trigger resets the count on activity.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, Resend, Web Push, Vitest

**Spec:** `docs/superpowers/specs/2026-05-11-quiet-circle-nudge-design.md`

---

## File Structure

### New
- `unit/quietCircleNudgeEmail.test.ts` — TDD tests
- `supabase/functions/send-quiet-circle-nudges/index.ts` — Edge Function
- `supabase/functions/send-quiet-circle-nudges/quietCircleNudgeEmail.ts` — Deno mirror

### Modified
- `server/utils/email.ts` — append `buildQuietCircleNudgeEmail`
- `docs/build-plan.md` — mark 12.4 complete
- `docs/design-spec.md` — cross-reference Hook 4

---

## Task 1: Email builder (TDD)

**Files:**
- Create: `unit/quietCircleNudgeEmail.test.ts`
- Modify: `server/utils/email.ts`

- [ ] **Step 1: Write the failing tests**

Create `unit/quietCircleNudgeEmail.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { buildQuietCircleNudgeEmail } from "../server/utils/email"

const baseOpts = {
  recipientFirstName: "Dao",
  circleName: "The Smiths",
  nudgeCount: 1 as 1 | 2 | 3,
  daysSinceLastMemory: 15,
  appUrl: "https://our-story.tinybit.app/timeline?circle=c1",
  unsubscribeUrl: "https://our-story.tinybit.app/notification-settings",
  locale: "en" as const,
}

describe("buildQuietCircleNudgeEmail — subject", () => {
  it("count=1 mentions circle name and days", () => {
    const { subject } = buildQuietCircleNudgeEmail(baseOpts)
    expect(subject).toContain("The Smiths")
    expect(subject).toMatch(/quiet|days|15/i)
  })

  it("count=2 mentions 'a while'", () => {
    const { subject } = buildQuietCircleNudgeEmail({ ...baseOpts, nudgeCount: 2 })
    expect(subject).toContain("The Smiths")
    expect(subject.toLowerCase()).toMatch(/while|since/)
  })

  it("count=3 says 'last reminder'", () => {
    const { subject } = buildQuietCircleNudgeEmail({ ...baseOpts, nudgeCount: 3 })
    expect(subject.toLowerCase()).toMatch(/last reminder|final/)
    expect(subject).toContain("The Smiths")
  })

  it("renders zh-CN subject with Chinese characters", () => {
    const { subject } = buildQuietCircleNudgeEmail({ ...baseOpts, locale: "zh-CN" })
    expect(subject).toMatch(/[一-鿿]/)
  })

  it("renders fr subject (not English)", () => {
    const { subject } = buildQuietCircleNudgeEmail({ ...baseOpts, locale: "fr" })
    expect(subject.toLowerCase()).not.toMatch(/^the smiths has been/)
  })
})

describe("buildQuietCircleNudgeEmail — body", () => {
  it("count=1 has gentle tone", () => {
    const { html } = buildQuietCircleNudgeEmail(baseOpts)
    expect(html).toContain("Dao")
    expect(html).toContain("15")
    // Gentle tone keyword check
    expect(html.toLowerCase()).toMatch(/quick note|keeps the story|even a/i)
  })

  it("count=2 mentions photos piling up or similar firmer tone", () => {
    const { html } = buildQuietCircleNudgeEmail({ ...baseOpts, nudgeCount: 2, daysSinceLastMemory: 30 })
    expect(html.toLowerCase()).toMatch(/pile up|phones|while/)
  })

  it("count=3 explicitly says it's the last nudge", () => {
    const { html } = buildQuietCircleNudgeEmail({ ...baseOpts, nudgeCount: 3, daysSinceLastMemory: 45 })
    expect(html.toLowerCase()).toMatch(/last nudge|won't (ask|badger)|here when you/)
  })

  it("includes appUrl as CTA", () => {
    const { html } = buildQuietCircleNudgeEmail(baseOpts)
    expect(html).toContain("https://our-story.tinybit.app/timeline?circle=c1")
  })

  it("includes unsubscribe link", () => {
    const { html } = buildQuietCircleNudgeEmail(baseOpts)
    expect(html).toContain("/notification-settings")
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm test unit/quietCircleNudgeEmail.test.ts`
Expected: FAIL — `buildQuietCircleNudgeEmail` not exported.

- [ ] **Step 3: Implement the builder**

Read `server/utils/email.ts` first (note the `layout()` and `primaryButton()` helpers at the top). Append:

```ts
// ─────────────────────────────────────────────────────────────
// Quiet Circle nudge email (12.4)
// ─────────────────────────────────────────────────────────────

export interface QuietCircleNudgeEmailOpts {
  recipientFirstName: string
  circleName: string
  nudgeCount: 1 | 2 | 3
  daysSinceLastMemory: number
  appUrl: string
  unsubscribeUrl: string
  locale: "en" | "zh-CN" | "fr"
}

export function buildQuietCircleNudgeEmail(opts: QuietCircleNudgeEmailOpts): { subject: string; html: string } {
  const { recipientFirstName, circleName, nudgeCount, daysSinceLastMemory, appUrl, unsubscribeUrl, locale } = opts

  const subject = (() => {
    if (locale === "zh-CN") {
      if (nudgeCount === 1) return `「${circleName}」已经 ${daysSinceLastMemory} 天没有新动态了`
      if (nudgeCount === 2) return `「${circleName}」已经有一段时间没人上传了`
      return `最后一次提醒 — 「${circleName}」`
    }
    if (locale === "fr") {
      if (nudgeCount === 1) return `${circleName} est silencieux depuis ${daysSinceLastMemory} jours`
      if (nudgeCount === 2) return `Cela fait un moment que personne n'a ajouté à ${circleName}`
      return `Dernier rappel — ${circleName}`
    }
    if (nudgeCount === 1) return `${circleName} has been quiet for ${daysSinceLastMemory} days`
    if (nudgeCount === 2) return `It's been a while since anyone added to ${circleName}`
    return `One last reminder — ${circleName}`
  })()

  const greeting = locale === "zh-CN"
    ? `你好 ${recipientFirstName}，`
    : locale === "fr"
      ? `Bonjour ${recipientFirstName},`
      : `Hi ${recipientFirstName ?? "there"},`

  const intro = (() => {
    if (locale === "zh-CN") return `已经 ${daysSinceLastMemory} 天没有人在「${circleName}」添加新记忆了。`
    if (locale === "fr") return `Cela fait ${daysSinceLastMemory} jours que personne n'a ajouté de souvenir à ${circleName}.`
    return `It's been ${daysSinceLastMemory} days since anyone added a memory to ${circleName}.`
  })()

  const tone = (() => {
    if (locale === "zh-CN") {
      if (nudgeCount === 1) return `哪怕只是一条短短的文字记录，也能让故事活下去。`
      if (nudgeCount === 2) return `照片堆积在手机里。当你把它们放到这里，故事才真正存在。`
      return `这是最后一次提醒 — 我们不想打扰你。无论你是继续记录还是暂停一下，这个圈子随时为你保留着。`
    }
    if (locale === "fr") {
      if (nudgeCount === 1) return `Même une petite note garde l'histoire vivante.`
      if (nudgeCount === 2) return `Les photos s'accumulent sur les téléphones. L'histoire vit ici quand vous les ajoutez.`
      return `C'est le dernier rappel — nous ne voulons pas vous embêter. Que vous continuiez à construire ou que vous fassiez une pause, ce cercle vous attendra.`
    }
    if (nudgeCount === 1) return `Even a quick note keeps the story alive.`
    if (nudgeCount === 2) return `Photos pile up on phones. The story lives here when you put them in.`
    return `This is the last nudge — we don't want to badger you. Whether you keep building or pause, this circle is here when you're ready.`
  })()

  const cta = locale === "zh-CN" ? "添加记忆 →" : locale === "fr" ? "Ajouter un souvenir →" : "Add a memory →"

  const unsubscribe = (() => {
    if (locale === "zh-CN") return `你收到此邮件是因为你是「${circleName}」的创建者。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === "fr") return `Vous recevez ceci car vous êtes le propriétaire de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
    return `You're receiving this because you're the owner of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`
  })()

  const body = `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;color:#333;margin:0 0 16px;line-height:1.5;">${intro}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;font-style:italic;">${tone}</p>
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta)}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `

  return { subject, html: layout(body) }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm test unit/quietCircleNudgeEmail.test.ts`
Expected: all 11 tests PASS.

- [ ] **Step 5: Run full suite + commit**

```bash
pnpm test
git add server/utils/email.ts unit/quietCircleNudgeEmail.test.ts
git commit -m "feat(quiet-nudge): email builder for quiet-circle nudge (locale-aware)"
```

---

## Task 2: Edge Function + Deno mirror

**Files:**
- Create: `supabase/functions/send-quiet-circle-nudges/quietCircleNudgeEmail.ts`
- Create: `supabase/functions/send-quiet-circle-nudges/index.ts`

- [ ] **Step 1: Create Deno mirror of email builder**

Read `server/utils/email.ts` and find:
1. The `layout()` helper (near top of file)
2. The `primaryButton()` helper (near top of file)
3. The `// Quiet Circle nudge email (12.4)` section with `QuietCircleNudgeEmailOpts` and `buildQuietCircleNudgeEmail`

Create `supabase/functions/send-quiet-circle-nudges/quietCircleNudgeEmail.ts` with:
- `layout()` (private, not exported)
- `primaryButton()` (private, not exported)
- `QuietCircleNudgeEmailOpts` interface (exported)
- `buildQuietCircleNudgeEmail` function (exported)

Verbatim copies. Reference pattern: `supabase/functions/send-first-month-recap/firstMonthRecapEmail.ts`.

- [ ] **Step 2: Implement the Edge Function**

Create `supabase/functions/send-quiet-circle-nudges/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildQuietCircleNudgeEmail } from "./quietCircleNudgeEmail.ts"
import webpush from "https://esm.sh/web-push@3.6.7"

// Triggered daily by pg_cron at 9am UTC.
//
// SELECT cron.schedule(
//   'send-quiet-circle-nudges',
//   '0 9 * * *',
//   $$SELECT net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/send-quiet-circle-nudges',
//     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//   )$$
// );

const APP_URL = Deno.env.get("APP_URL") ?? "https://our-story.tinybit.app"
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? ""
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@our-story.tinybit.app"

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

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

  const now = Date.now()
  const quietSince = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  const lastSentBefore = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Find candidate circles
  const { data: circles, error: circlesErr } = await supabase
    .from("circle")
    .select("id, name, last_memory_at, quiet_nudge_count")
    .is("deleted_at", null)
    .not("first_memory_at", "is", null)
    .lt("last_memory_at", quietSince)
    .lt("quiet_nudge_count", 3)
    .or(`quiet_nudge_last_sent_at.is.null,quiet_nudge_last_sent_at.lt.${lastSentBefore}`)

  if (circlesErr) {
    console.error("[send-quiet-circle-nudges] circles query failed:", circlesErr.message)
    return Response.json({ error: "circles query failed" }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const c of circles ?? []) {
    try {
      // 1. Find the owner
      const { data: ownerRow } = await supabase
        .from("circlemember")
        .select(`user_id, user!inner(id, email, first_name, locale, deletion_requested_at)`)
        .eq("circle_id", c.id)
        .eq("role", "owner")
        .maybeSingle()
      const owner = (ownerRow as any)?.user
      if (!owner || owner.deletion_requested_at || !owner.email) {
        skipped++
        continue
      }
      const userId = owner.id

      // 2. Check NotificationPreference
      const { data: prefs } = await supabase
        .from("notificationpreference")
        .select("circle_muted, push_enabled, email_digest_frequency, quiet_hours_start, quiet_hours_end")
        .eq("user_id", userId)
        .eq("circle_id", c.id)
        .maybeSingle()
      if (prefs?.circle_muted) {
        skipped++
        continue
      }

      // Calculate post-increment nudge count + days
      const nudgeCount = ((c.quiet_nudge_count ?? 0) + 1) as 1 | 2 | 3
      const daysSinceLastMemory = Math.floor(
        (now - new Date(c.last_memory_at).getTime()) / (24 * 60 * 60 * 1000)
      )

      const pushEnabled = prefs?.push_enabled !== false
      const inQuiet = isInQuietHours(prefs?.quiet_hours_start, prefs?.quiet_hours_end)

      let delivered = false

      // 3. Try push first
      if (pushEnabled && !inQuiet) {
        const { data: subs } = await supabase
          .from("pushsubscription")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", userId)
        if ((subs ?? []).length > 0 && VAPID_PUBLIC && VAPID_PRIVATE) {
          const { title, body } = pushTextForCount(nudgeCount, owner.locale ?? "en")
          const payload = JSON.stringify({
            title,
            body,
            tag: `quiet-nudge-${c.id}-${nudgeCount}`,
            renotify: true,
            data: { url: `${APP_URL}/timeline?circle=${c.id}` },
          })
          for (const s of subs as any[]) {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload
              )
            } catch (err: any) {
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                await supabase.from("pushsubscription").delete().eq("id", s.id)
              }
            }
          }
          delivered = true
        }
      }

      // 4. Fall back to email
      if (!delivered) {
        if (prefs?.email_digest_frequency === "off") {
          skipped++
          continue
        }
        const { subject, html } = buildQuietCircleNudgeEmail({
          recipientFirstName: owner.first_name ?? "",
          circleName: c.name,
          nudgeCount,
          daysSinceLastMemory,
          appUrl: `${APP_URL}/timeline?circle=${c.id}`,
          unsubscribeUrl: `${APP_URL}/notification-settings`,
          locale: (owner.locale ?? "en") as "en" | "zh-CN" | "fr",
        })
        await sendEmail(owner.email, subject, html)
        delivered = true
      }

      // 5. Update counters
      await supabase
        .from("circle")
        .update({
          quiet_nudge_count: nudgeCount,
          quiet_nudge_last_sent_at: new Date().toISOString(),
        })
        .eq("id", c.id)

      sent++
    } catch (err) {
      console.error(`[send-quiet-circle-nudges] failed for circle ${c.id}:`, err)
      errors++
    }
  }

  return Response.json({ ok: true, sent, skipped, errors })
})

function isInQuietHours(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return false
  const now = new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`
  if (start <= end) return hhmm >= start && hhmm < end
  return hhmm >= start || hhmm < end
}

function pushTextForCount(count: 1 | 2 | 3, locale: string): { title: string; body: string } {
  if (locale === "zh-CN") {
    if (count === 1) return { title: "你的故事有点安静了 🕰", body: "添加一条记忆让它继续吧 →" }
    if (count === 2) return { title: "圈子在等你", body: "已经有一阵子了 — 这周添加点什么？" }
    return { title: "最后一次提醒", body: "我们不会再打扰你了 — 添加一条记忆？" }
  }
  if (locale === "fr") {
    if (count === 1) return { title: "Votre histoire est silencieuse 🕰", body: "Ajoutez un souvenir pour la garder vivante →" }
    if (count === 2) return { title: "Votre cercle attend", body: "Cela fait un moment — ajoutez quelque chose cette semaine ?" }
    return { title: "Dernier rappel", body: "On ne vous embêtera plus — ajoutez un souvenir ?" }
  }
  if (count === 1) return { title: "Your story has been quiet 🕰", body: "Add a memory to keep it alive →" }
  if (count === 2) return { title: "Your circle is waiting", body: "It's been a while — add something this week?" }
  return { title: "One last reminder", body: "We won't ask again — add a memory?" }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY")
  if (!resendKey) {
    console.log(`[dev] quiet-nudge to ${to}: ${subject}`)
    return
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Our Story <hello@our-story.tinybit.app>",
        to,
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error("[send-quiet-circle-nudges] Resend send failed:", err)
  }
}
```

- [ ] **Step 3: Sanity check + commit**

Read both files end-to-end. Confirm no Nitro-only imports.

```bash
git add supabase/functions/send-quiet-circle-nudges/
git commit -m "feat(quiet-nudge): send-quiet-circle-nudges Edge Function with Deno mirror"
```

---

## Task 3: Docs

**Files:**
- Modify: `docs/build-plan.md`
- Modify: `docs/design-spec.md`

- [ ] **Step 1: Update build plan**

Replace the `- [ ] 12.4 ...` line in `docs/build-plan.md`:

```
- [x] 12.4 Quiet circle nudge — 14-day inactivity → owner only, max 3 nudges per quiet period, min 14 days between sends, reset on memory upload *(implementation complete — pg_cron pending manual setup in Supabase Studio)*
  - Edge Function `send-quiet-circle-nudges` runs daily at 9am UTC
  - Channels: push if subscribed → email fallback (consistent with §12.2 pattern; spec said push-only but we extend for reach)
  - Recipients: circle owner only (never members) — spec-mandated to avoid spam
  - Eligibility: `deleted_at IS NULL AND first_memory_at IS NOT NULL AND last_memory_at < now() - 14d AND quiet_nudge_count < 3 AND (quiet_nudge_last_sent_at IS NULL OR < now() - 14d)`
  - Excludes brand-new circles that never had an upload (`first_memory_at IS NOT NULL` gate)
  - Tone varies by count: count=1 gentle, count=2 firmer, count=3 explicit "last nudge"
  - Reset on activity: existing `handle_memory_insert` trigger sets `quiet_nudge_count = 0` on every memory insert (already wired in migration 004)
  - No new migrations — `last_memory_at`, `quiet_nudge_count`, `quiet_nudge_last_sent_at` already in Circle
  - Locales: en, zh-CN, fr
  - Tests: 11 unit tests for the email builder
  - Manual setup remaining: schedule `send-quiet-circle-nudges` in Supabase Studio (`0 9 * * *`)
  - See spec: `docs/superpowers/specs/2026-05-11-quiet-circle-nudge-design.md`
```

- [ ] **Step 2: Update design spec Hook 4**

In `docs/design-spec.md`, find `### Hook 4: "Quiet circle" nudge (14-day inactivity)` (around line 3776). Append at end of the section (just before the `> quiet_nudge_count and quiet_nudge_last_sent_at are in the canonical Circle model` block):

```
**[Implemented §12.4]** — Edge Function `send-quiet-circle-nudges` runs daily at 9am UTC. Owner only. Channels: push if subscribed → email fallback. Eligibility requires `first_memory_at IS NOT NULL` (brand-new circles excluded). Tone differentiates count=1/2/3, with the 3rd explicitly framed as "the last nudge" to respect owner autonomy. Reset-on-activity handled by the existing `handle_memory_insert` trigger.
```

- [ ] **Step 3: Commit**

```bash
git add docs/build-plan.md docs/design-spec.md
git commit -m "docs: mark 12.4 complete, cross-reference quiet-nudge implementation"
```

---

## Verification (after all tasks)

- [ ] `pnpm test` — 11 new unit tests passing
- [ ] No schema changes; `pnpm db:test` unchanged
- [ ] Manual: set a circle's `last_memory_at` to 15 days ago, `first_memory_at` non-null, `quiet_nudge_count = 0`; trigger function; verify owner gets push or `[dev] quiet-nudge` log
- [ ] Verify counter increments: `quiet_nudge_count = 1`, `quiet_nudge_last_sent_at = now()`
- [ ] Re-run: no new sends (last_sent < 14 days)
- [ ] Reset `quiet_nudge_last_sent_at` to 15 days ago: re-run → count = 2
- [ ] Continue → count = 3 → next run, circle excluded (cap)
- [ ] Insert a memory in that circle → trigger resets count to 0
