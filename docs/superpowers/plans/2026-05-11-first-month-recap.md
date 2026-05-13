# "Your First Month" Recap Email Implementation Plan (12.3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a one-time recap email 30 days after a circle's first memory upload — a nostalgic "look how far you've come" moment that combines the original first memory with month-in-numbers stats. Gated by `Circle.first_month_email_sent`.

**Architecture:** Daily Edge Function `send-first-month-recap` runs at 9am UTC. Finds candidate circles (first_memory_at 29–31 days ago, flag false). For each circle: fetch first memory + stats, send to all eligible members, mark flag. Pure-function email builder in `server/utils/email.ts` (Vitest-tested) mirrored 1:1 in the Deno function.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, Resend, Vitest

**Spec:** `docs/superpowers/specs/2026-05-11-first-month-recap-design.md`

---

## File Structure

### New

- `unit/firstMonthRecapEmail.test.ts` — TDD tests
- `supabase/functions/send-first-month-recap/index.ts` — Edge Function
- `supabase/functions/send-first-month-recap/firstMonthRecapEmail.ts` — Deno mirror of the builder

### Modified

- `server/utils/email.ts` — add `buildFirstMonthRecapEmail`
- `docs/build-plan.md` — mark 12.3 + 12.3.1 complete
- `docs/design-spec.md` — cross-reference §7.5

No new migrations needed — `Circle.first_memory_at` and `Circle.first_month_email_sent` already exist (migration 004).

---

## Task 1: Email builder (TDD)

**Files:**

- Create: `unit/firstMonthRecapEmail.test.ts`
- Modify: `server/utils/email.ts`

- [ ] **Step 1: Write failing tests first**

Create `unit/firstMonthRecapEmail.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildFirstMonthRecapEmail } from '../server/utils/email'

const baseOpts = {
  recipientFirstName: 'Dao',
  circleName: 'The Smiths',
  firstMemoryUploaderName: 'Mom',
  firstMemoryNote: 'First steps at the park',
  firstMemoryDate: '2026-04-11',
  firstMemoryThumbnailUrl: 'https://example.com/first.jpg',
  memoryCount: 12,
  milestoneCount: 2,
  topReactionMemoryThumbnailUrl: 'https://example.com/top.jpg',
  topReactionMemoryNote: 'Cake time',
  topReactionEmoji: '❤️',
  topReactionCount: 5,
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1',
  inviteUrl: 'https://our-story.tinybit.app/timeline?circle=c1&invite=1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildFirstMonthRecapEmail — subject', () => {
  it('en subject includes circle name', () => {
    const { subject } = buildFirstMonthRecapEmail(baseOpts)
    expect(subject).toContain('The Smiths')
    expect(subject.toLowerCase()).toMatch(/first month|month with/)
  })

  it('zh-CN subject is in Chinese', () => {
    const { subject } = buildFirstMonthRecapEmail({
      ...baseOpts,
      locale: 'zh-CN',
    })
    expect(subject).toMatch(/[一-鿿]/)
    expect(subject).toContain('The Smiths')
  })

  it('fr subject is in French (not English)', () => {
    const { subject } = buildFirstMonthRecapEmail({ ...baseOpts, locale: 'fr' })
    expect(subject.toLowerCase()).not.toMatch(/^your first month/)
  })
})

describe('buildFirstMonthRecapEmail — body', () => {
  it('includes the first memory thumbnail URL', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('https://example.com/first.jpg')
  })

  it('includes the first memory note', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('First steps at the park')
  })

  it('includes uploader name in the nostalgia hook', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('Mom')
  })

  it('renders memory count and milestone count', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('12')
    expect(html).toContain('2')
  })

  it('includes top reaction section when reactions exist', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('❤️')
    expect(html).toContain('5')
  })

  it('omits top reaction section when topReactionMemoryThumbnailUrl is null', () => {
    const { html } = buildFirstMonthRecapEmail({
      ...baseOpts,
      topReactionMemoryThumbnailUrl: null,
      topReactionMemoryNote: null,
      topReactionEmoji: null,
      topReactionCount: null,
    })
    expect(html).not.toContain('https://example.com/top.jpg')
    // Reaction count of 5 shouldn't appear (would have been the only "5")
  })

  it('includes appUrl as primary CTA', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('https://our-story.tinybit.app/timeline?circle=c1')
  })

  it('includes inviteUrl as secondary CTA', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('invite=1')
  })

  it('includes unsubscribe link', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('/notification-settings')
  })

  it("handles null firstMemoryNote without rendering 'null'", () => {
    const { html } = buildFirstMonthRecapEmail({
      ...baseOpts,
      firstMemoryNote: null,
    })
    expect(html).not.toContain('null')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test unit/firstMonthRecapEmail.test.ts`
Expected: FAIL — `buildFirstMonthRecapEmail` not exported.

- [ ] **Step 3: Implement builder**

Read `server/utils/email.ts` first to find the existing pattern. Append:

```ts
// ─────────────────────────────────────────────────────────────
// "Your First Month" recap email (12.3)
// ─────────────────────────────────────────────────────────────

export interface FirstMonthRecapEmailOpts {
  recipientFirstName: string
  circleName: string
  firstMemoryUploaderName: string
  firstMemoryNote: string | null
  firstMemoryDate: string
  firstMemoryThumbnailUrl: string | null
  memoryCount: number
  milestoneCount: number
  topReactionMemoryThumbnailUrl: string | null
  topReactionMemoryNote: string | null
  topReactionEmoji: string | null
  topReactionCount: number | null
  appUrl: string
  inviteUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildFirstMonthRecapEmail(opts: FirstMonthRecapEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    circleName,
    firstMemoryUploaderName,
    firstMemoryNote,
    firstMemoryDate,
    firstMemoryThumbnailUrl,
    memoryCount,
    milestoneCount,
    topReactionMemoryThumbnailUrl,
    topReactionEmoji,
    topReactionCount,
    appUrl,
    inviteUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const subject = (() => {
    if (locale === 'zh-CN') return `「${circleName}」的第一个月 💛`
    if (locale === 'fr') return `Votre premier mois avec ${circleName} 💛`
    return `Your first month with ${circleName} 💛`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN')
      return `一个月前，${firstMemoryUploaderName} 在「${circleName}」上传了你们的第一条记忆。`
    if (locale === 'fr')
      return `Il y a un mois, ${firstMemoryUploaderName} a ajouté votre premier souvenir à ${circleName}.`
    return `One month ago, ${firstMemoryUploaderName} added your first memory to ${circleName}.`
  })()

  const dateFormatted = new Date(firstMemoryDate).toLocaleDateString(
    locale === 'zh-CN' ? 'zh-CN' : locale === 'fr' ? 'fr' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  )

  const heroImg = firstMemoryThumbnailUrl
    ? `<img src="${firstMemoryThumbnailUrl}" style="width:100%;border-radius:12px;display:block;margin:0 0 8px;" alt="" />`
    : ''

  const heroNote = firstMemoryNote
    ? `<p style="font-size:14px;color:#444;font-style:italic;margin:0 0 4px;line-height:1.5;">"${firstMemoryNote}"</p>`
    : ''

  const heroDate = `<p style="font-size:11px;color:#888;margin:0 0 24px;">${dateFormatted}</p>`

  const statsLabels = (() => {
    if (locale === 'zh-CN')
      return {
        memories: '条记忆',
        milestones: '个里程碑',
        topReaction: '最受欢迎',
      }
    if (locale === 'fr')
      return {
        memories: 'souvenirs',
        milestones: 'jalons',
        topReaction: 'Le plus aimé',
      }
    return {
      memories: 'memories',
      milestones: 'milestones marked',
      topReaction: 'Most loved',
    }
  })()

  const statsBlock = `
    <div style="background:#f5f0e8;border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="font-size:13px;color:#888;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
        ${locale === 'zh-CN' ? '这一个月' : locale === 'fr' ? 'Ce mois-ci' : 'This month'}
      </p>
      <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">📸 ${memoryCount} ${statsLabels.memories}</p>
      ${milestoneCount > 0 ? `<p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">✨ ${milestoneCount} ${statsLabels.milestones}</p>` : ''}
      ${
        topReactionMemoryThumbnailUrl && topReactionEmoji && topReactionCount
          ? `<p style="font-size:16px;color:#1a1a1a;margin:0;">${topReactionEmoji} ${topReactionCount} ${statsLabels.topReaction}</p>`
          : ''
      }
    </div>
  `

  const ctaPrimary =
    locale === 'zh-CN'
      ? '添加新记忆 →'
      : locale === 'fr'
        ? 'Ajouter un souvenir →'
        : 'Add another memory →'
  const ctaSecondary =
    locale === 'zh-CN'
      ? '邀请还没加入的人 →'
      : locale === 'fr'
        ? "Inviter quelqu'un qui n'a pas encore rejoint →"
        : "Invite someone who hasn't joined yet →"

  const unsubscribe = (() => {
    if (locale === 'zh-CN')
      return `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`
    if (locale === 'fr')
      return `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`
    return `You're receiving this because you're a member of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`
  })()

  const body = `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;">${intro}</p>
    ${heroImg}
    ${heroNote}
    ${heroDate}
    ${statsBlock}
    <p style="margin:0 0 12px;">${primaryButton(appUrl, ctaPrimary)}</p>
    <p style="margin:0 0 32px;text-align:center;"><a href="${inviteUrl}" style="font-size:14px;color:#555;text-decoration:underline;">${ctaSecondary}</a></p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `

  return { subject, html: layout(body) }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test unit/firstMonthRecapEmail.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run full suite + commit**

```bash
pnpm test
git add server/utils/email.ts unit/firstMonthRecapEmail.test.ts
git commit -m "feat(recap): first-month recap email builder (locale-aware)"
```

---

## Task 2: Edge Function `send-first-month-recap`

**Files:**

- Create: `supabase/functions/send-first-month-recap/index.ts`
- Create: `supabase/functions/send-first-month-recap/firstMonthRecapEmail.ts`

- [ ] **Step 1: Mirror the email builder for Deno**

Read `server/utils/email.ts` to find the "Your First Month" recap section just added in Task 1. Create `supabase/functions/send-first-month-recap/firstMonthRecapEmail.ts` containing:

1. The `layout()` and `primaryButton()` helper functions (copy from the top of `server/utils/email.ts`)
2. The `FirstMonthRecapEmailOpts` interface
3. The `buildFirstMonthRecapEmail` function

All copied verbatim. Add `export` to all three of: `layout`, `primaryButton`, `buildFirstMonthRecapEmail` — actually keep `layout` and `primaryButton` non-exported (private to this file). Only `buildFirstMonthRecapEmail` and `FirstMonthRecapEmailOpts` need to be exported.

Reference pattern: `supabase/functions/send-digest/digestEmail.ts` (existing Deno mirror of digest emails).

- [ ] **Step 2: Implement the Edge Function**

Create `supabase/functions/send-first-month-recap/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildFirstMonthRecapEmail } from './firstMonthRecapEmail.ts'

// Triggered daily by pg_cron at 9am UTC.
//
// SELECT cron.schedule(
//   'send-first-month-recap',
//   '0 9 * * *',
//   $$SELECT net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/send-first-month-recap',
//     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//   )$$
// );

const APP_URL = Deno.env.get('APP_URL') ?? 'https://our-story.tinybit.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = Date.now()
  const lower = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString()
  const upper = new Date(now - 29 * 24 * 60 * 60 * 1000).toISOString()

  // Find candidate circles
  const { data: circles, error: circlesErr } = await supabase
    .from('circle')
    .select('id, name, first_memory_at')
    .gte('first_memory_at', lower)
    .lte('first_memory_at', upper)
    .eq('first_month_email_sent', false)
    .is('deleted_at', null)

  if (circlesErr) {
    console.error(
      '[send-first-month-recap] circles query failed:',
      circlesErr.message,
    )
    return Response.json({ error: 'circles query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const c of circles ?? []) {
    try {
      // 1. Fetch the first memory (oldest by created_at) with media + uploader
      const { data: firstMemoryRows } = await supabase
        .from('memory')
        .select(
          `
          id, note, memory_date, owner_user_id, milestone_label,
          memorymedia(storage_path, media_type),
          user!memory_owner_user_id_fkey(first_name)
        `,
        )
        .eq('circle_id', c.id)
        .order('created_at', { ascending: true })
        .limit(1)
      const firstMemory = (firstMemoryRows ?? [])[0] as any

      if (!firstMemory) {
        skipped++
        continue
      }

      // Sign thumbnail URL if present
      let firstThumbnailUrl: string | null = null
      const fmm = (firstMemory.memorymedia ?? [])[0]
      if (fmm?.storage_path) {
        const { data: signed } = await supabase.storage
          .from('memories-private')
          .createSignedUrl(fmm.storage_path, 7 * 24 * 60 * 60)
        firstThumbnailUrl = signed?.signedUrl ?? null
      }

      const firstUploaderName = firstMemory.user?.first_name ?? 'someone'

      // 2. Memory count + milestone count
      const { count: memoryCount } = await supabase
        .from('memory')
        .select('id', { count: 'exact', head: true })
        .eq('circle_id', c.id)

      const { count: milestoneCount } = await supabase
        .from('memory')
        .select('id', { count: 'exact', head: true })
        .eq('circle_id', c.id)
        .not('milestone_label', 'is', null)

      // 3. Top-reacted memory in this circle
      const { data: reactionRows } = await supabase
        .from('memoryreaction')
        .select('memory_id, emoji, memory!inner(circle_id)')
        .eq('memory.circle_id', c.id)

      // Tally reactions per memory_id
      const counts = new Map<string, { count: number; emoji: string }>()
      for (const r of (reactionRows ?? []) as any[]) {
        const memId = r.memory_id as string
        const prev = counts.get(memId)
        if (prev) {
          counts.set(memId, { count: prev.count + 1, emoji: prev.emoji })
        } else {
          counts.set(memId, { count: 1, emoji: r.emoji ?? '❤️' })
        }
      }
      let topReactionMemoryId: string | null = null
      let topReactionEmoji: string | null = null
      let topReactionCount: number | null = null
      for (const [memId, { count, emoji }] of counts.entries()) {
        if (topReactionCount === null || count > topReactionCount) {
          topReactionMemoryId = memId
          topReactionCount = count
          topReactionEmoji = emoji
        }
      }

      // Top reaction memory thumbnail (if any reactions)
      let topReactionThumbnailUrl: string | null = null
      let topReactionMemoryNote: string | null = null
      if (topReactionMemoryId) {
        const { data: topMem } = await supabase
          .from('memory')
          .select('note, memorymedia(storage_path)')
          .eq('id', topReactionMemoryId)
          .maybeSingle()
        topReactionMemoryNote = topMem?.note ?? null
        const tmm = (topMem as any)?.memorymedia?.[0]
        if (tmm?.storage_path) {
          const { data: signed } = await supabase.storage
            .from('memories-private')
            .createSignedUrl(tmm.storage_path, 7 * 24 * 60 * 60)
          topReactionThumbnailUrl = signed?.signedUrl ?? null
        }
      }

      // 4. Recipients — all circle members, filtered by notification prefs
      const { data: members } = await supabase
        .from('circlemember')
        .select(
          `
          user_id,
          user!inner(id, email, first_name, locale, deletion_requested_at),
          notificationpreference(circle_muted, email_digest_frequency)
        `,
        )
        .eq('circle_id', c.id)

      const recipients = (members ?? []).filter((row: any) => {
        const u = row.user
        if (!u || u.deletion_requested_at) return false
        if (!u.email) return false
        const np = Array.isArray(row.notificationpreference)
          ? row.notificationpreference[0]
          : row.notificationpreference
        if (np?.circle_muted) return false
        if (np?.email_digest_frequency === 'off') return false
        return true
      })

      if (recipients.length === 0) {
        skipped++
        // Still mark the flag — circle is processed, just no recipients
        await supabase
          .from('circle')
          .update({ first_month_email_sent: true })
          .eq('id', c.id)
        continue
      }

      // 5. Send to each recipient
      for (const r of recipients as any[]) {
        const opts = {
          recipientFirstName: r.user.first_name ?? '',
          circleName: c.name,
          firstMemoryUploaderName: firstUploaderName,
          firstMemoryNote: firstMemory.note ?? null,
          firstMemoryDate: firstMemory.memory_date,
          firstMemoryThumbnailUrl: firstThumbnailUrl,
          memoryCount: memoryCount ?? 0,
          milestoneCount: milestoneCount ?? 0,
          topReactionMemoryThumbnailUrl: topReactionThumbnailUrl,
          topReactionMemoryNote,
          topReactionEmoji,
          topReactionCount,
          appUrl: `${APP_URL}/timeline?circle=${c.id}`,
          inviteUrl: `${APP_URL}/timeline?circle=${c.id}&invite=1`,
          unsubscribeUrl: `${APP_URL}/notification-settings`,
          locale: (r.user.locale ?? 'en') as 'en' | 'zh-CN' | 'fr',
        }
        const { subject, html } = buildFirstMonthRecapEmail(opts)
        await sendEmail(r.user.email, subject, html)
      }

      // 6. Mark sent
      await supabase
        .from('circle')
        .update({ first_month_email_sent: true })
        .eq('id', c.id)
      sent++
    } catch (err) {
      console.error(`[send-first-month-recap] failed for circle ${c.id}:`, err)
      errors++
    }
  }

  return Response.json({ ok: true, sent, skipped, errors })
})

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] first-month recap to ${to}: ${subject}`)
    return
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Our Story <hello@our-story.tinybit.app>',
        to,
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error('[send-first-month-recap] Resend send failed:', err)
  }
}
```

- [ ] **Step 3: Sanity check + commit**

Read the file end-to-end. Confirm:

- No Nitro-only imports (no `useRuntimeConfig`, no `~/`, no `#supabase/server`)
- All env vars use `Deno.env.get(...)`
- Imports are either relative `.ts` files or `https://esm.sh/...`

```bash
git add supabase/functions/send-first-month-recap/
git commit -m "feat(recap): send-first-month-recap Edge Function with Deno mirror"
```

---

## Task 3: Docs

**Files:**

- Modify: `docs/build-plan.md`
- Modify: `docs/design-spec.md`

- [ ] **Step 1: Update build plan**

Replace these two lines in `docs/build-plan.md`:

```
- [ ] 12.3 First-memory anniversary (30-day cron)
- [ ] 12.3.1 "Your first month" recap email — sent 30 days after first upload, shows memory count, milestone highlights, and top reaction; simpler than Year in Review but creates a felt delight moment early
```

With:

```
- [x] 12.3 First-memory anniversary (30-day cron) — implemented as one send with 12.3.1 *(implementation complete — pg_cron pending manual setup in Supabase Studio)*
- [x] 12.3.1 "Your first month" recap email — sent 30 days after first upload; nostalgia hook (original first memory) + month stats (memory count, milestone count, top reaction) + dual CTA (add memory / invite). One send per circle, gated by `Circle.first_month_email_sent`.
  - Edge Function `send-first-month-recap` runs daily at 9am UTC; window: first_memory_at 29–31 days ago
  - Recipients: all circle members (not just owner+admins) — celebration moment, sent once per circle's lifetime
  - Notification preference filter: skip if `circle_muted = true` OR `email_digest_frequency = 'off'`
  - No-reactions fallback: omit the top-reaction section entirely (no substitute)
  - Locales: en, zh-CN, fr
  - No new migrations needed — `Circle.first_memory_at` (auto-populated by `handle_memory_insert` trigger) and `Circle.first_month_email_sent` already exist (migration 004)
  - Tests: 12 unit tests for the email builder
  - Manual setup remaining: schedule `send-first-month-recap` in Supabase Studio (`0 9 * * *`)
  - Known issue: mid-batch failure may cause duplicate sends on retry (flag set only after all recipients processed). Acceptable for Phase 1 — duplicate is mildly annoying but not harmful.
  - See spec: `docs/superpowers/specs/2026-05-11-first-month-recap-design.md`
```

- [ ] **Step 2: Update design spec**

In `docs/design-spec.md`, find `### 7.5. "Your First Month" Recap Email` (around line 220). Append at end of that section:

```
**[Implemented §12.3 + §12.3.1]** — Edge Function `send-first-month-recap` runs daily at 9am UTC. Recipients: all circle members (excluding muted or digest-off). One send per circle, gated by `Circle.first_month_email_sent`. Top-reaction section omitted entirely if no reactions exist.
```

Also find `### Hook 3: First-memory anniversary (month 1)` (around line 3767). Append:

```
**[Implemented §12.3]** — see §7.5 cross-reference. Same Edge Function, same `first_month_email_sent` flag.
```

- [ ] **Step 3: Commit**

```bash
git add docs/build-plan.md docs/design-spec.md
git commit -m "docs: mark 12.3 + 12.3.1 complete, cross-reference recap implementation"
```

---

## Verification (after all tasks)

- [ ] `pnpm test` passes — 12 new builder tests
- [ ] `pnpm db:reset && pnpm db:test` still passes (no schema changes)
- [ ] Manual: set a circle's `first_memory_at` to exactly 30 days ago in Supabase Studio, ensure `first_month_email_sent = false`, then `curl -X POST $SUPABASE_URL/functions/v1/send-first-month-recap -H "Authorization: Bearer $SERVICE_ROLE_KEY"` → verify console output `[dev] first-month recap to <email>: Your first month with...`
- [ ] Verify `first_month_email_sent = true` after run
- [ ] Re-run: confirm `{ sent: 0, skipped: 0, errors: 0 }` — no candidates remaining
