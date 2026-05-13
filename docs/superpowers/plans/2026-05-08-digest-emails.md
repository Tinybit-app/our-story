# Digest Emails Implementation Plan (12.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send weekly + monthly activity digest emails to circle members based on their notification preferences.

**Architecture:** One Supabase Edge Function (`send-digest`) keyed by `?frequency=weekly|monthly`. Cron via pg_cron (manual setup in Supabase Studio, same pattern as `purge-deleted-users`). Email composition split: pure-function template builders in `server/utils/email.ts` (testable from Vitest) + a Deno-side renderer in the Edge Function that imports the same logic. Per-circle idempotency via two new `Circle` columns.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, Resend, existing email helpers in Nitro

**Spec:** `docs/superpowers/specs/2026-05-08-digest-emails-design.md`

---

## File Structure

### New

- `supabase/migrations/028_circle_digest_tracking.sql` — `last_weekly_digest_sent_at`, `last_monthly_digest_sent_at`
- `supabase/functions/send-digest/index.ts` — cron-invoked Edge Function
- `supabase/functions/send-digest/digestEmail.ts` — Deno-shareable template logic (mirrored from `server/utils/email.ts` builders)
- `unit/digestEmail.test.ts` — Vitest tests for builders

### Modified

- `server/utils/email.ts` — add `buildWeeklyDigestEmail()` and `buildMonthlyDigestEmail()`. Pure functions, identical signature to existing builders, three locales each.
- `unit/schema-compliance.test.ts` — verify migration 028 columns

### Why two copies of the email builder?

Nitro server code imports from `npm` packages and uses `useRuntimeConfig()`; Deno Edge Function code can't import from Nitro. The pure template builder is duplicated in `supabase/functions/send-digest/digestEmail.ts` so the Edge Function can call it standalone. Both files contain identical pure functions — Vitest tests run against the Nitro version; the Deno copy is a 1:1 mirror committed alongside. Drift risk is low (these change rarely) and the alternative (extracting to a shared package) is heavy for ~150 lines.

---

## Task 1: Migration — Circle digest tracking columns

**Files:**

- Create: `supabase/migrations/028_circle_digest_tracking.sql`
- Modify: `unit/schema-compliance.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/028_circle_digest_tracking.sql
-- Tracking columns to make digest cron idempotent (avoid duplicate sends on retry)

ALTER TABLE Circle
  ADD COLUMN last_weekly_digest_sent_at TIMESTAMPTZ,
  ADD COLUMN last_monthly_digest_sent_at TIMESTAMPTZ;

-- pg_cron schedules (manual setup in Supabase Studio after deploy):
--
-- SELECT cron.schedule(
--   'send-weekly-digest',
--   '0 9 * * 1',
--   $$SELECT net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/send-digest?frequency=weekly',
--     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
--   )$$
-- );
--
-- SELECT cron.schedule(
--   'send-monthly-digest',
--   '0 9 1 * *',
--   $$SELECT net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/send-digest?frequency=monthly',
--     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
--   )$$
-- );
```

- [ ] **Step 2: Reset DB and confirm migration applies**

Run: `pnpm db:reset`
Expected: completes without errors; `pnpm db:test` still passes.

- [ ] **Step 3: Add schema-compliance test**

In `unit/schema-compliance.test.ts`, append:

```ts
describe('Step 12.1 — Circle digest tracking', () => {
  const m028 = sql('028_circle_digest_tracking.sql')

  it('adds last_weekly_digest_sent_at column', () => {
    expect(m028).toContain('last_weekly_digest_sent_at TIMESTAMPTZ')
  })

  it('adds last_monthly_digest_sent_at column', () => {
    expect(m028).toContain('last_monthly_digest_sent_at TIMESTAMPTZ')
  })
})
```

(The `sql()` helper at the top of the file already accepts a filename and reads `supabase/migrations/<filename>`. Add `sql("028_circle_digest_tracking.sql")` to the `allMigrations` join if that variable is consumed elsewhere — check the file's existing structure before editing.)

- [ ] **Step 4: Run unit tests**

Run: `pnpm test unit/schema-compliance.test.ts`
Expected: all pass, including the 2 new ones.

- [ ] **Step 5: Regenerate types and commit**

Run: `pnpm db:types`

```bash
git add supabase/migrations/028_circle_digest_tracking.sql unit/schema-compliance.test.ts app/types/database.ts
git commit -m "feat(digest): add Circle digest tracking columns"
```

---

## Task 2: Email template builders (testable side)

**Files:**

- Modify: `server/utils/email.ts`
- Create: `unit/digestEmail.test.ts`

- [ ] **Step 1: Write the unit test first (TDD)**

Create `unit/digestEmail.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  buildWeeklyDigestEmail,
  buildMonthlyDigestEmail,
} from '../server/utils/email'

const baseOpts = {
  recipientFirstName: 'Dao',
  circleName: 'The Smiths',
  childName: null,
  childAge: null,
  memories: [
    {
      id: 'm1',
      note: null,
      milestoneLabel: null,
      thumbnailUrl: 'https://example.com/1.jpg',
      isVideo: false,
    },
  ],
  totalCount: 1,
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildWeeklyDigestEmail — subject line', () => {
  it('uses circle name when no child', () => {
    const { subject } = buildWeeklyDigestEmail({ ...baseOpts, totalCount: 5 })
    expect(subject).toContain('The Smiths')
    expect(subject).toContain('5')
    expect(subject).toMatch(/week/i)
  })

  it('uses child name when child exists', () => {
    const { subject } = buildWeeklyDigestEmail({
      ...baseOpts,
      childName: 'Mia',
      totalCount: 3,
    })
    expect(subject).toContain('Mia')
    expect(subject).toContain('3')
  })

  it('singularises 1 memory', () => {
    const { subject } = buildWeeklyDigestEmail({ ...baseOpts, totalCount: 1 })
    expect(subject).toMatch(/1 (new )?memory\b/i)
  })

  it('renders zh-CN', () => {
    const { subject } = buildWeeklyDigestEmail({
      ...baseOpts,
      locale: 'zh-CN',
      totalCount: 4,
    })
    expect(subject).toMatch(/[一-鿿]/) // contains Chinese chars
  })

  it('renders fr', () => {
    const { subject } = buildWeeklyDigestEmail({
      ...baseOpts,
      locale: 'fr',
      totalCount: 4,
    })
    expect(subject.toLowerCase()).not.toMatch(/^the smiths added/) // not English
  })
})

describe('buildMonthlyDigestEmail — subject line', () => {
  it('uses month name when no child', () => {
    const { subject } = buildMonthlyDigestEmail({ ...baseOpts, totalCount: 12 })
    expect(subject).toContain('The Smiths')
    expect(subject).toMatch(/[A-Z][a-z]+/) // some month name capitalised
  })

  it('uses child name when child exists', () => {
    const { subject } = buildMonthlyDigestEmail({
      ...baseOpts,
      childName: 'Mia',
      totalCount: 12,
    })
    expect(subject).toContain('Mia')
  })
})

describe('digest body — content', () => {
  it('renders all 3 memory thumbnails as deep links', () => {
    const { html } = buildWeeklyDigestEmail({
      ...baseOpts,
      memories: [
        {
          id: 'm1',
          note: null,
          milestoneLabel: null,
          thumbnailUrl: 'https://example.com/1.jpg',
          isVideo: false,
        },
        {
          id: 'm2',
          note: null,
          milestoneLabel: null,
          thumbnailUrl: 'https://example.com/2.jpg',
          isVideo: false,
        },
        {
          id: 'm3',
          note: null,
          milestoneLabel: null,
          thumbnailUrl: 'https://example.com/3.jpg',
          isVideo: false,
        },
      ],
      totalCount: 3,
    })
    expect(html).toContain('https://example.com/1.jpg')
    expect(html).toContain('https://example.com/2.jpg')
    expect(html).toContain('https://example.com/3.jpg')
    expect(html).toContain('circle=c1')
  })

  it('includes child name and age when set', () => {
    const { html } = buildWeeklyDigestEmail({
      ...baseOpts,
      childName: 'Mia',
      childAge: '8 months',
    })
    expect(html).toContain('Mia')
    expect(html).toContain('8 months')
  })

  it('contains unsubscribe link to /notification-settings', () => {
    const { html } = buildWeeklyDigestEmail(baseOpts)
    expect(html).toContain('/notification-settings')
  })

  it('contains main CTA linking to circle timeline', () => {
    const { html } = buildWeeklyDigestEmail(baseOpts)
    expect(html).toContain(
      'href="https://our-story.tinybit.app/timeline?circle=c1"',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test unit/digestEmail.test.ts`
Expected: FAIL — `buildWeeklyDigestEmail`/`buildMonthlyDigestEmail` not exported.

- [ ] **Step 3: Implement the builders in `server/utils/email.ts`**

Append to `server/utils/email.ts` (read the file first to keep style consistent — re-uses the existing `layout()` and `primaryButton()` helpers):

```ts
// ─────────────────────────────────────────────────────────────
// Weekly / Monthly digest emails (12.1)
// ─────────────────────────────────────────────────────────────

interface DigestMemoryItem {
  id: string
  note: string | null
  milestoneLabel: string | null
  thumbnailUrl: string
  isVideo: boolean
}

export interface DigestEmailOpts {
  recipientFirstName: string
  circleName: string
  childName: string | null
  childAge: string | null
  memories: DigestMemoryItem[]
  totalCount: number
  appUrl: string // /timeline?circle=<id>
  unsubscribeUrl: string // /notification-settings
  locale: 'en' | 'zh-CN' | 'fr'
}

function digestBody(
  opts: DigestEmailOpts,
  periodLabel: { en: string; zh: string; fr: string },
): string {
  const {
    recipientFirstName,
    circleName,
    childName,
    childAge,
    memories,
    totalCount,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const greetings = {
    en: `Hi ${recipientFirstName ?? 'there'},`,
    'zh-CN': `你好 ${recipientFirstName ?? ''}，`,
    fr: `Bonjour ${recipientFirstName ?? ''},`,
  }
  const intro = {
    en: `${circleName} shared ${totalCount} new memor${totalCount === 1 ? 'y' : 'ies'} ${periodLabel.en}.`,
    'zh-CN': `${circleName}${periodLabel.zh}分享了 ${totalCount} 条新回忆。`,
    fr: `${circleName} a partagé ${totalCount} nouveau${totalCount === 1 ? '' : 'x'} souvenir${totalCount === 1 ? '' : 's'} ${periodLabel.fr}.`,
  }
  const cta = {
    en: 'Open Our Story to react ❤️',
    'zh-CN': '打开 Our Story 表达喜欢 ❤️',
    fr: 'Ouvrir Our Story pour réagir ❤️',
  }
  const unsubscribe = {
    en: `You're receiving this because you're a member of ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Manage email preferences</a>.`,
    'zh-CN': `你收到此邮件是因为你是「${circleName}」的成员。<a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">管理邮件偏好</a>。`,
    fr: `Vous recevez ceci car vous êtes membre de ${circleName}. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Gérer les préférences email</a>.`,
  }

  const heroMemory = memories[0]
  const restMemories = memories.slice(1, 6)

  const childLine =
    childName && childAge
      ? `<p style="font-size:13px;color:#888;margin:0 0 16px;text-align:center;">${childName} · ${childAge}</p>`
      : ''

  const heroImg = heroMemory
    ? `<a href="${appUrl}&memory=${heroMemory.id}" style="display:block;margin:0 0 24px;"><img src="${heroMemory.thumbnailUrl}" style="width:100%;border-radius:12px;display:block;" alt="" /></a>`
    : ''

  const grid = restMemories.length
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 24px;"><tr>${restMemories
        .map(
          (m) =>
            `<td style="padding:2px;width:33.33%;"><a href="${appUrl}&memory=${m.id}"><img src="${m.thumbnailUrl}" style="width:100%;border-radius:6px;display:block;" alt="" /></a></td>`,
        )
        .join('')}</tr></table>`
    : ''

  return `
    <p style="font-size:15px;color:#333;margin:0 0 16px;">${greetings[locale]}</p>
    <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.5;">${intro[locale]}</p>
    ${heroImg}
    ${childLine}
    ${grid}
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta[locale])}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe[locale]}</p>
  `
}

export function buildWeeklyDigestEmail(opts: DigestEmailOpts): {
  subject: string
  html: string
} {
  const { circleName, childName, totalCount, locale } = opts

  const subject = (() => {
    if (locale === 'zh-CN') {
      return childName
        ? `${childName}本周 — ${totalCount} 条新回忆`
        : `${circleName}本周新增 ${totalCount} 条回忆`
    }
    if (locale === 'fr') {
      return childName
        ? `${childName} cette semaine — ${totalCount} nouveau${totalCount === 1 ? '' : 'x'} souvenir${totalCount === 1 ? '' : 's'}`
        : `${circleName} a ajouté ${totalCount} souvenir${totalCount === 1 ? '' : 's'} cette semaine`
    }
    return childName
      ? `${childName} this week — ${totalCount} new memor${totalCount === 1 ? 'y' : 'ies'}`
      : `${circleName} added ${totalCount} memor${totalCount === 1 ? 'y' : 'ies'} this week`
  })()

  const periodLabel = { en: 'this week', zh: '本周', fr: 'cette semaine' }
  return { subject, html: layout(digestBody(opts, periodLabel)) }
}

export function buildMonthlyDigestEmail(opts: DigestEmailOpts): {
  subject: string
  html: string
} {
  const { circleName, childName, totalCount, locale } = opts

  // Use the previous month name (the digest covers the trailing 30 days but is sent on the 1st)
  const lastMonth = new Date()
  lastMonth.setDate(0) // sets to last day of previous month
  const monthName = lastMonth.toLocaleString(
    locale === 'zh-CN' ? 'zh-CN' : locale === 'fr' ? 'fr' : 'en',
    { month: 'long' },
  )

  const subject = (() => {
    if (locale === 'zh-CN') {
      return childName
        ? `${childName}的${monthName} — ${totalCount} 条回忆`
        : `${circleName}的${monthName}回忆`
    }
    if (locale === 'fr') {
      return childName
        ? `${monthName} de ${childName} — ${totalCount} souvenir${totalCount === 1 ? '' : 's'}`
        : `Les souvenirs de ${monthName} — ${circleName}`
    }
    return childName
      ? `${childName}'s ${monthName} — ${totalCount} memor${totalCount === 1 ? 'y' : 'ies'}`
      : `${circleName}'s memories from ${monthName}`
  })()

  const periodLabel = { en: 'this month', zh: '本月', fr: 'ce mois-ci' }
  return { subject, html: layout(digestBody(opts, periodLabel)) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test unit/digestEmail.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: 0 regressions.

- [ ] **Step 6: Commit**

```bash
git add server/utils/email.ts unit/digestEmail.test.ts
git commit -m "feat(digest): add weekly/monthly digest email builders"
```

---

## Task 3: Edge Function — `send-digest`

**Files:**

- Create: `supabase/functions/send-digest/index.ts`
- Create: `supabase/functions/send-digest/digestEmail.ts`

- [ ] **Step 1: Mirror the email builder for Deno**

Create `supabase/functions/send-digest/digestEmail.ts` containing **exactly** the same `buildWeeklyDigestEmail`, `buildMonthlyDigestEmail`, `digestBody`, and supporting types from `server/utils/email.ts`. Also copy the `layout()` and `primaryButton()` helpers (they're tiny):

```ts
// supabase/functions/send-digest/digestEmail.ts
// IMPORTANT: keep in sync with server/utils/email.ts builders.
// Deno Edge Functions can't import from Nitro, so this is a 1:1 mirror.

function layout(body: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #fffdf8; color: #1a1a1a;">
      <p style="font-size: 11px; font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase; color: #888; margin: 0 0 28px;">Our Story</p>
      ${body}
      <p style="color: #bbb; font-size: 11px; margin-top: 40px; text-align: center;">Private, invite-only · No ads</p>
    </div>
  `
}

function primaryButton(href: string, label: string): string {
  return `<a href="${href}" style="display: block; background: #1a1a1a; color: #fff; text-align: center; padding: 16px 24px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">${label}</a>`
}

interface DigestMemoryItem {
  id: string
  note: string | null
  milestoneLabel: string | null
  thumbnailUrl: string
  isVideo: boolean
}

export interface DigestEmailOpts {
  recipientFirstName: string
  circleName: string
  childName: string | null
  childAge: string | null
  memories: DigestMemoryItem[]
  totalCount: number
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

// PASTE the exact bodies of digestBody, buildWeeklyDigestEmail, buildMonthlyDigestEmail
// from server/utils/email.ts (Task 2 Step 3) into this file.
```

(Copy-paste verbatim from Task 2 Step 3 — including the `digestBody`, `buildWeeklyDigestEmail`, and `buildMonthlyDigestEmail` function bodies.)

- [ ] **Step 2: Implement the Edge Function**

Create `supabase/functions/send-digest/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildWeeklyDigestEmail,
  buildMonthlyDigestEmail,
  type DigestEmailOpts,
} from './digestEmail.ts'

// Triggered by pg_cron — see migration 028 for schedule definitions.
// curl -X POST '<project-url>/functions/v1/send-digest?frequency=weekly' \
//   -H 'Authorization: Bearer <service-role-key>'

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

  const url = new URL(req.url)
  const frequency = url.searchParams.get('frequency')
  if (frequency !== 'weekly' && frequency !== 'monthly') {
    return Response.json(
      { error: "frequency must be 'weekly' or 'monthly'" },
      { status: 400 },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const periodDays = frequency === 'weekly' ? 7 : 30
  const idempotencyDays = frequency === 'weekly' ? 6 : 25
  const idempotencyCutoff = new Date(
    Date.now() - idempotencyDays * 24 * 60 * 60 * 1000,
  ).toISOString()
  const periodStart = new Date(
    Date.now() - periodDays * 24 * 60 * 60 * 1000,
  ).toISOString()
  const tracker =
    frequency === 'weekly'
      ? 'last_weekly_digest_sent_at'
      : 'last_monthly_digest_sent_at'

  // Find candidate circles (not soft-deleted, not sent recently)
  const { data: circles, error: circlesErr } = await supabase
    .from('circle')
    .select(`id, name, ${tracker}`)
    .is('deleted_at', null)

  if (circlesErr) {
    console.error('[send-digest] circles query failed:', circlesErr.message)
    return Response.json({ error: 'circles query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const c of circles ?? []) {
    try {
      // Idempotency: skip if recently sent
      const lastSent = (c as any)[tracker] as string | null
      if (lastSent && lastSent > idempotencyCutoff) {
        skipped++
        continue
      }

      // Memories in the period, ordered by recency.
      // (Spec mentions "best photo by reaction count" — that's a Phase 2 refinement;
      // for Phase 1, recency works fine and avoids needing a custom RPC.)
      const { data: memories } = await supabase
        .from('memory')
        .select(
          'id, note, milestone_label, memorymedia(storage_path, media_type)',
        )
        .eq('circle_id', c.id)
        .gte('created_at', periodStart)
        .order('created_at', { ascending: false })
        .limit(6)
      const mems = memories ?? []

      if (mems.length === 0) {
        skipped++
        continue
      }

      // Sign thumbnail URLs (7-day TTL — matches typical email open window)
      const memoryItems = await Promise.all(
        mems.map(async (m: any) => {
          const media = m.memorymedia?.[0] ?? null
          let thumbnailUrl = ''
          if (media?.storage_path) {
            const { data: signed } = await supabase.storage
              .from('memories-private')
              .createSignedUrl(media.storage_path, 7 * 24 * 60 * 60)
            thumbnailUrl = signed?.signedUrl ?? ''
          }
          return {
            id: m.id,
            note: m.note ?? null,
            milestoneLabel: m.milestone_label ?? null,
            thumbnailUrl,
            isVideo: media?.media_type === 'video',
          }
        }),
      )

      // Optional: child name + age for the digest period midpoint
      const { data: children } = await supabase
        .from('childprofile')
        .select('name, date_of_birth')
        .eq('circle_id', c.id)
        .order('created_at', { ascending: true })
        .limit(1)
      const child = children?.[0] ?? null
      const periodMidpoint = new Date(
        Date.now() - (periodDays / 2) * 24 * 60 * 60 * 1000,
      )
      const childAge = child
        ? computeAge(child.date_of_birth, periodMidpoint)
        : null

      // Recipients — joined to NotificationPreference, filtered by frequency match
      const { data: recipients } = await supabase
        .from('circlemember')
        .select(
          `
          user_id,
          user!inner(id, email, first_name, locale, deletion_requested_at),
          notificationpreference(circle_muted, email_digest_frequency)
        `,
        )
        .eq('circle_id', c.id)

      const eligible = (recipients ?? []).filter((row: any) => {
        const u = row.user
        if (!u || u.deletion_requested_at) return false
        if (!u.email) return false
        const np = Array.isArray(row.notificationpreference)
          ? row.notificationpreference[0]
          : row.notificationpreference
        if (np?.circle_muted) return false
        const userFrequency = np?.email_digest_frequency ?? 'monthly'
        return userFrequency === frequency
      })

      if (eligible.length === 0) {
        skipped++
        continue
      }

      // Send to each recipient
      for (const row of eligible) {
        const u = (row as any).user
        const opts: DigestEmailOpts = {
          recipientFirstName: u.first_name ?? '',
          circleName: c.name,
          childName: child?.name ?? null,
          childAge,
          memories: memoryItems,
          totalCount: memoryItems.length,
          appUrl: `${APP_URL}/timeline?circle=${c.id}`,
          unsubscribeUrl: `${APP_URL}/notification-settings`,
          locale: (u.locale as 'en' | 'zh-CN' | 'fr') ?? 'en',
        }
        const { subject, html } =
          frequency === 'weekly'
            ? buildWeeklyDigestEmail(opts)
            : buildMonthlyDigestEmail(opts)

        await sendEmail(u.email, subject, html)
      }

      // Idempotency: mark sent
      await supabase
        .from('circle')
        .update({ [tracker]: new Date().toISOString() })
        .eq('id', c.id)
      sent++
    } catch (err) {
      console.error(`[send-digest] failed for circle ${c.id}:`, err)
    }
  }

  return Response.json({ ok: true, frequency, sent, skipped })
})

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] digest email to ${to}: ${subject}`)
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
    console.error(`[send-digest] Resend send failed for ${to}:`, err)
  }
}

function computeAge(dob: string, at: Date): string {
  // Mirrors useBabyAge composable's logic (basic version — months/years only)
  const birth = new Date(dob)
  const months =
    (at.getFullYear() - birth.getFullYear()) * 12 +
    (at.getMonth() - birth.getMonth())
  if (months < 1) return 'newborn'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (years < 2 && remMonths > 0)
    return `${years} year, ${remMonths} month${remMonths === 1 ? '' : 's'}`
  return `${years} year${years === 1 ? '' : 's'}`
}
```

- [ ] **Step 3: Verify the function deploys cleanly**

Run: `supabase functions serve send-digest --no-verify-jwt --env-file .env.local`
Expected: starts without TypeScript errors. Stop with Ctrl-C.

(Skip this step if local Supabase functions runtime is not set up — verify in CI / staging.)

- [ ] **Step 4: Manual smoke test (dev)**

With local Supabase running and a test circle that has at least 1 memory in the last 7 days:

```bash
curl -X POST 'http://127.0.0.1:54321/functions/v1/send-digest?frequency=weekly' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected response: `{ "ok": true, "frequency": "weekly", "sent": N, "skipped": M }`. With `RESEND_API_KEY` unset, console output shows `[dev] digest email to <addr>: <subject>` per recipient.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-digest/
git commit -m "feat(digest): send-digest Edge Function with frequency routing"
```

---

## Task 4: Build plan + design spec docs

**Files:**

- Modify: `docs/build-plan.md`
- Modify: `docs/design-spec.md`

- [ ] **Step 1: Mark 12.1 as complete**

In `docs/build-plan.md`, replace:

```
- [ ] 12.1 Weekly digest email — grandparent-first design, one-tap email reactions
```

with:

```
- [x] 12.1 Weekly + monthly digest emails — grandparent-first design, login-redirect for reactions *(implementation complete — pg_cron schedules pending manual setup in Supabase Studio)*
  - Migration 028: `last_weekly_digest_sent_at` + `last_monthly_digest_sent_at` columns on Circle (idempotency)
  - Edge Function `send-digest?frequency=weekly|monthly` — single function, two cron schedules
  - Email builders in `server/utils/email.ts` (Vitest-tested) mirrored in `supabase/functions/send-digest/digestEmail.ts` (Deno-side)
  - Subject personalisation: child name + age when `ChildProfile` exists; otherwise circle name
  - Locales: en, zh-CN, fr
  - Recipient filter: `circle_muted = false` AND `email_digest_frequency = <cron's frequency>` AND `user.deletion_requested_at IS NULL`
  - Zero-upload weeks/months: skip entirely (let §12.4 quiet-circle nudge handle re-engagement)
  - Reactions from email: login-redirect (no signed JWTs); CTA "Open Our Story to react ❤️" deep-links to `/timeline?circle=X&memory=Y`
  - Manual setup remaining: schedule `send-weekly-digest` and `send-monthly-digest` jobs in Supabase Studio (SQL in migration 028 comment block)
```

- [ ] **Step 2: Update design spec cross-references**

In `docs/design-spec.md` around line 3850 (the Weekly digest section), append:

```
**[Implemented §12.1]** — Edge Function `send-digest?frequency=weekly|monthly`; templates in `server/utils/email.ts` and `supabase/functions/send-digest/digestEmail.ts`. Login-redirect for reactions (no signed JWTs in Phase 1).
```

In `docs/design-spec.md` around line 1252 (Email notifications), add a note that the existing email helpers use inline HTML (not React Email):

```
> Note: existing email helpers in `server/utils/email.ts` use inline HTML template literals, not React Email. The "React Email" mention above is aspirational; templates are pure HTML strings for now (works fine, no migration needed unless we hit complexity).
```

- [ ] **Step 3: Commit**

```bash
git add docs/build-plan.md docs/design-spec.md
git commit -m "docs: mark 12.1 complete, cross-reference digest implementation"
```

---

## Verification checklist (after all tasks)

- [ ] `pnpm test` — all unit tests green (incl. new digest email + schema-compliance tests)
- [ ] `pnpm db:reset && pnpm db:test` — RLS tests still pass
- [ ] `supabase functions serve send-digest` — Edge Function starts without TS errors
- [ ] Manual curl smoke test against local Supabase produces a `{ ok: true }` response
- [ ] In dev (no `RESEND_API_KEY`), digest emails log to console with correct subject lines for both frequencies
- [ ] Build plan §12.1 marked done with manual-cron-setup caveat
