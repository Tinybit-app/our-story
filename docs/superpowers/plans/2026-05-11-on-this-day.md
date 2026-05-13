# On This Day Implementation Plan (10.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily Edge Function sends "On This Day" push notifications to all members of circles with sufficient history; below-threshold circles get a weekly "memory from your first month" fallback (push or email).

**Architecture:** Pure-function helpers in `server/utils/onThisDayCopy.ts` (push titles/bodies, locale-aware) + `server/utils/email.ts` (`buildFirstMonthMemoryEmail`) — both Vitest-tested and mirrored 1:1 in the Deno function. Edge Function classifies each circle (above/below threshold), queries the matching memory, picks channel per recipient, sends. Above-threshold uses push-only daily; below-threshold uses push-or-email and caps once per week via `Circle.last_first_month_memory_sent_at` (new column, migration 034).

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, Resend, Web Push, Vitest

**Spec:** `docs/superpowers/specs/2026-05-11-on-this-day-design.md`

---

## File Structure

### New

- `supabase/migrations/034_on_this_day_tracking.sql` — `last_first_month_memory_sent_at` column
- `server/utils/onThisDayCopy.ts` — pure push title/body builders
- `unit/onThisDayCopy.test.ts` — TDD tests for push copy
- `unit/firstMonthMemoryEmail.test.ts` — TDD tests for the email builder
- `supabase/functions/send-on-this-day/index.ts` — Edge Function
- `supabase/functions/send-on-this-day/onThisDayCopy.ts` — Deno mirror
- `supabase/functions/send-on-this-day/firstMonthMemoryEmail.ts` — Deno mirror

### Modified

- `server/utils/email.ts` — append `buildFirstMonthMemoryEmail`
- `unit/schema-compliance.test.ts` — verify migration 034
- `docs/build-plan.md`, `docs/design-spec.md` — mark complete

---

## Task 1: Migration 034 — tracking column

**Files:**

- Create: `supabase/migrations/034_on_this_day_tracking.sql`
- Modify: `unit/schema-compliance.test.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/034_on_this_day_tracking.sql`:

```sql
-- 034_on_this_day_tracking.sql
-- Track the last time a "memory from your first month" fallback was sent for a circle,
-- to enforce the once-per-week cap when the circle is below the On This Day threshold.

ALTER TABLE public.Circle
  ADD COLUMN last_first_month_memory_sent_at TIMESTAMPTZ;
```

- [ ] **Step 2: Reset DB and confirm migration applies**

Run: `pnpm db:reset`
Expected: completes without errors.

- [ ] **Step 3: Add schema-compliance test**

In `unit/schema-compliance.test.ts`, add `sql("034_on_this_day_tracking.sql")` to the `allMigrations` array.

Append at the bottom:

```ts
describe('Migration 034 — On This Day tracking', () => {
  const m = sql('034_on_this_day_tracking.sql')

  it('adds last_first_month_memory_sent_at column to Circle', () => {
    expect(m).toContain('ADD COLUMN last_first_month_memory_sent_at TIMESTAMPTZ')
  })
})
```

- [ ] **Step 4: Run tests + regenerate types**

```
pnpm db:reset && pnpm db:test && pnpm test && pnpm db:types
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/034_on_this_day_tracking.sql \
        unit/schema-compliance.test.ts \
        app/types/database.ts
git commit -m "feat(on-this-day): migration 034 for first-month-memory tracking"
```

---

## Task 2: Push copy helpers (TDD)

**Files:**

- Create: `unit/onThisDayCopy.test.ts`
- Create: `server/utils/onThisDayCopy.ts`

- [ ] **Step 1: Write the failing tests**

Create `unit/onThisDayCopy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  buildOnThisDayPushTitle,
  buildOnThisDayPushBody,
  buildFirstMonthMemoryPushTitle,
  buildFirstMonthMemoryPushBody,
} from '../server/utils/onThisDayCopy'

describe('buildOnThisDayPushTitle', () => {
  it("en uses 'year' singular for 1 year", () => {
    expect(buildOnThisDayPushTitle(1, 'en')).toBe('On this day, 1 year ago')
  })

  it("en uses 'years' plural for 2+ years", () => {
    expect(buildOnThisDayPushTitle(2, 'en')).toBe('On this day, 2 years ago')
    expect(buildOnThisDayPushTitle(7, 'en')).toBe('On this day, 7 years ago')
  })

  it('zh-CN renders Chinese', () => {
    expect(buildOnThisDayPushTitle(3, 'zh-CN')).toBe('3 年前的今天')
  })

  it("fr uses 'an' singular for 1", () => {
    expect(buildOnThisDayPushTitle(1, 'fr')).toBe("Il y a 1 an aujourd'hui")
  })

  it("fr uses 'ans' plural for 2+", () => {
    expect(buildOnThisDayPushTitle(5, 'fr')).toBe("Il y a 5 ans aujourd'hui")
  })
})

describe('buildOnThisDayPushBody', () => {
  it('returns note when present', () => {
    expect(buildOnThisDayPushBody('Emma', 'First steps at the park', 'en')).toBe(
      'First steps at the park',
    )
  })

  it('truncates note longer than 80 chars to ~80 with ellipsis', () => {
    const long = 'A'.repeat(120)
    const result = buildOnThisDayPushBody('Emma', long, 'en')
    expect(result.length).toBeLessThanOrEqual(81)
    expect(result.endsWith('…')).toBe(true)
  })

  it('falls back to uploader name (en) when note is null', () => {
    expect(buildOnThisDayPushBody('Emma', null, 'en')).toBe('Emma added a memory')
  })

  it('falls back to uploader name (zh-CN) when note is null', () => {
    expect(buildOnThisDayPushBody('Emma', null, 'zh-CN')).toBe('Emma 添加了一条记忆')
  })

  it('falls back to uploader name (fr) when note is null', () => {
    expect(buildOnThisDayPushBody('Emma', null, 'fr')).toBe('Emma a ajouté un souvenir')
  })

  it('falls back to uploader name when note is empty string', () => {
    expect(buildOnThisDayPushBody('Emma', '', 'en')).toBe('Emma added a memory')
  })
})

describe('buildFirstMonthMemoryPushTitle', () => {
  it('en', () => {
    expect(buildFirstMonthMemoryPushTitle('en')).toBe('A memory from your first month')
  })

  it('zh-CN renders Chinese', () => {
    expect(buildFirstMonthMemoryPushTitle('zh-CN')).toMatch(/[一-鿿]/)
  })

  it('fr is not English', () => {
    const t = buildFirstMonthMemoryPushTitle('fr')
    expect(t.toLowerCase()).not.toContain('memory from')
  })
})

describe('buildFirstMonthMemoryPushBody', () => {
  it('returns note when present', () => {
    expect(buildFirstMonthMemoryPushBody('Mom', 'First steps', 'en')).toBe('First steps')
  })

  it('falls back to uploader name in en', () => {
    expect(buildFirstMonthMemoryPushBody('Mom', null, 'en')).toBe('Mom added a memory')
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm test unit/onThisDayCopy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `server/utils/onThisDayCopy.ts`:

```ts
// Pure helpers for On This Day push notification copy — locale-aware.
// Mirrored verbatim in supabase/functions/send-on-this-day/onThisDayCopy.ts
// (Deno can't import from Nitro, so the file is duplicated 1:1).

export type Locale = 'en' | 'zh-CN' | 'fr'

export function buildOnThisDayPushTitle(yearsAgo: number, locale: Locale): string {
  if (locale === 'zh-CN') return `${yearsAgo} 年前的今天`
  if (locale === 'fr') return `Il y a ${yearsAgo} an${yearsAgo === 1 ? '' : 's'} aujourd'hui`
  return `On this day, ${yearsAgo} year${yearsAgo === 1 ? '' : 's'} ago`
}

export function buildOnThisDayPushBody(
  uploaderName: string,
  note: string | null,
  locale: Locale,
): string {
  if (note && note.trim().length > 0) {
    return truncate(note, 80)
  }
  if (locale === 'zh-CN') return `${uploaderName} 添加了一条记忆`
  if (locale === 'fr') return `${uploaderName} a ajouté un souvenir`
  return `${uploaderName} added a memory`
}

export function buildFirstMonthMemoryPushTitle(locale: Locale): string {
  if (locale === 'zh-CN') return '你们最初的一段回忆'
  if (locale === 'fr') return 'Un souvenir de votre premier mois'
  return 'A memory from your first month'
}

export function buildFirstMonthMemoryPushBody(
  uploaderName: string,
  note: string | null,
  locale: Locale,
): string {
  if (note && note.trim().length > 0) {
    return truncate(note, 80)
  }
  if (locale === 'zh-CN') return `${uploaderName} 添加了一条记忆`
  if (locale === 'fr') return `${uploaderName} a ajouté un souvenir`
  return `${uploaderName} added a memory`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm test unit/onThisDayCopy.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run full suite + commit**

```bash
pnpm test
git add server/utils/onThisDayCopy.ts unit/onThisDayCopy.test.ts
git commit -m "feat(on-this-day): push copy helpers (TDD) for daily nostalgia"
```

---

## Task 3: First-month-memory email builder (TDD)

**Files:**

- Create: `unit/firstMonthMemoryEmail.test.ts`
- Modify: `server/utils/email.ts`

- [ ] **Step 1: Write the failing tests**

Create `unit/firstMonthMemoryEmail.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildFirstMonthMemoryEmail } from '../server/utils/email'

const baseOpts = {
  recipientFirstName: 'Dao',
  circleName: 'The Smiths',
  uploaderName: 'Mom',
  memoryNote: 'First steps at the park',
  memoryDate: '2025-08-15',
  memoryThumbnailUrl: 'https://example.com/photo.jpg',
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1&memory=m1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildFirstMonthMemoryEmail — subject', () => {
  it('en mentions circle name + first month', () => {
    const { subject } = buildFirstMonthMemoryEmail(baseOpts)
    expect(subject).toContain('The Smiths')
    expect(subject.toLowerCase()).toMatch(/first month|memory/)
  })

  it('zh-CN is in Chinese', () => {
    const { subject } = buildFirstMonthMemoryEmail({ ...baseOpts, locale: 'zh-CN' })
    expect(subject).toMatch(/[一-鿿]/)
  })

  it('fr is not English', () => {
    const { subject } = buildFirstMonthMemoryEmail({ ...baseOpts, locale: 'fr' })
    expect(subject.toLowerCase()).not.toMatch(/^a memory from/)
  })
})

describe('buildFirstMonthMemoryEmail — body', () => {
  it('includes the memory thumbnail URL', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('https://example.com/photo.jpg')
  })

  it('includes the memory note in quotes', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('First steps at the park')
  })

  it('includes uploader name and a formatted date', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('Mom')
    // Either localized month name or the raw date should appear
    expect(html).toMatch(/August|2025/)
  })

  it('includes appUrl as primary CTA', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('https://our-story.tinybit.app/timeline?circle=c1&memory=m1')
  })

  it('includes unsubscribe link', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('/notification-settings')
  })

  it("handles null memoryNote without rendering 'null'", () => {
    const { html } = buildFirstMonthMemoryEmail({ ...baseOpts, memoryNote: null })
    expect(html).not.toContain('null')
  })

  it("handles null memoryThumbnailUrl without rendering 'null'", () => {
    const { html } = buildFirstMonthMemoryEmail({ ...baseOpts, memoryThumbnailUrl: null })
    expect(html).not.toContain('null')
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm test unit/firstMonthMemoryEmail.test.ts`
Expected: FAIL — builder not exported.

- [ ] **Step 3: Implement builder**

Append to `server/utils/email.ts` (use existing `layout()` and `primaryButton()` helpers):

```ts
// ─────────────────────────────────────────────────────────────
// "A memory from your first month" email (10.2 below-threshold fallback)
// ─────────────────────────────────────────────────────────────

export interface FirstMonthMemoryEmailOpts {
  recipientFirstName: string
  circleName: string
  uploaderName: string
  memoryNote: string | null
  memoryDate: string
  memoryThumbnailUrl: string | null
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildFirstMonthMemoryEmail(opts: FirstMonthMemoryEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    circleName,
    uploaderName,
    memoryNote,
    memoryDate,
    memoryThumbnailUrl,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const subject = (() => {
    if (locale === 'zh-CN') return `「${circleName}」最初的一段回忆`
    if (locale === 'fr') return `Un souvenir de vos premiers jours avec ${circleName}`
    return `A memory from your first month with ${circleName}`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN') return `这是你们圈子最早期的一段回忆。`
    if (locale === 'fr') return `Voici un souvenir des tout débuts de votre cercle.`
    return `Here's a memory from your circle's earliest days.`
  })()

  const dateFormatted = new Date(memoryDate).toLocaleDateString(
    locale === 'zh-CN' ? 'zh-CN' : locale === 'fr' ? 'fr' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  )

  const heroImg = memoryThumbnailUrl
    ? `<img src="${memoryThumbnailUrl}" style="width:100%;border-radius:12px;display:block;margin:0 0 8px;" alt="" />`
    : ''

  const heroNote = memoryNote
    ? `<p style="font-size:14px;color:#444;font-style:italic;margin:0 0 4px;line-height:1.5;">"${memoryNote}"</p>`
    : ''

  const heroByline = `<p style="font-size:12px;color:#888;margin:0 0 24px;">${uploaderName} · ${dateFormatted}</p>`

  const cta =
    locale === 'zh-CN'
      ? '在 Our Story 中打开 →'
      : locale === 'fr'
        ? 'Ouvrir dans Our Story →'
        : 'Open in Our Story →'

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
    ${heroByline}
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta)}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `

  return { subject, html: layout(body) }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm test unit/firstMonthMemoryEmail.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run full suite + commit**

```bash
pnpm test
git add server/utils/email.ts unit/firstMonthMemoryEmail.test.ts
git commit -m "feat(on-this-day): first-month-memory email builder (locale-aware)"
```

---

## Task 4: Edge Function `send-on-this-day`

**Files:**

- Create: `supabase/functions/send-on-this-day/onThisDayCopy.ts` (Deno mirror)
- Create: `supabase/functions/send-on-this-day/firstMonthMemoryEmail.ts` (Deno mirror)
- Create: `supabase/functions/send-on-this-day/index.ts` (Edge Function)

- [ ] **Step 1: Mirror the copy helpers for Deno**

Read `server/utils/onThisDayCopy.ts`. Copy verbatim to `supabase/functions/send-on-this-day/onThisDayCopy.ts`. No imports to change — pure functions.

- [ ] **Step 2: Mirror the email builder for Deno**

Read `server/utils/email.ts` to find the `// "A memory from your first month" email` section and the `layout()` and `primaryButton()` helpers near the top of the file.

Create `supabase/functions/send-on-this-day/firstMonthMemoryEmail.ts` with:

- `layout()` (private, no `export`)
- `primaryButton()` (private, no `export`)
- `FirstMonthMemoryEmailOpts` (exported)
- `buildFirstMonthMemoryEmail` (exported)

Verbatim copies. Reference pattern: `supabase/functions/send-first-month-recap/firstMonthRecapEmail.ts`.

- [ ] **Step 3: Implement the Edge Function**

Create `supabase/functions/send-on-this-day/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildOnThisDayPushTitle,
  buildOnThisDayPushBody,
  buildFirstMonthMemoryPushTitle,
  buildFirstMonthMemoryPushBody,
} from './onThisDayCopy.ts'
import { buildFirstMonthMemoryEmail } from './firstMonthMemoryEmail.ts'
import webpush from 'https://esm.sh/web-push@3.6.7'

// Triggered daily by pg_cron at 9am UTC.
//
// SELECT cron.schedule(
//   'send-on-this-day',
//   '0 9 * * *',
//   $$SELECT net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/send-on-this-day',
//     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//   )$$
// );

const APP_URL = Deno.env.get('APP_URL') ?? 'https://our-story.tinybit.app'
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@our-story.tinybit.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

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

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const thisYear = now.getUTCFullYear()
  const todayMonth = now.getUTCMonth() + 1
  const todayDay = now.getUTCDate()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: circles, error: circlesErr } = await supabase
    .from('circle')
    .select('id, name, memory_count, first_memory_at, last_first_month_memory_sent_at')
    .is('deleted_at', null)
    .not('first_memory_at', 'is', null)

  if (circlesErr) {
    console.error('[send-on-this-day] circles query failed:', circlesErr.message)
    return Response.json({ error: 'circles query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const c of circles ?? []) {
    try {
      const isAboveThreshold =
        (c.memory_count ?? 0) >= 30 &&
        new Date(c.first_memory_at).getTime() <= new Date(ninetyDaysAgo).getTime()

      if (isAboveThreshold) {
        // ── Above threshold: find a matching past-year memory by MM-DD ──
        const { data: rows } = await supabase
          .from('memory')
          .select(
            `
            id, note, memory_date, owner_user_id,
            memorymedia(storage_path),
            user!owner_user_id(first_name)
          `,
          )
          .eq('circle_id', c.id)
          .order('memory_date', { ascending: true })

        // Filter rows where MM-DD matches today and year < thisYear (server-side filter is awkward; JS filter is fine)
        const matchingMemories = (rows ?? []).filter((m: any) => {
          const d = new Date(m.memory_date)
          if (Number.isNaN(d.getTime())) return false
          if (d.getUTCFullYear() >= thisYear) return false
          return d.getUTCMonth() + 1 === todayMonth && d.getUTCDate() === todayDay
        })

        if (matchingMemories.length === 0) {
          skipped++
          continue
        }

        const memory = matchingMemories[0] as any // oldest (we ordered ASC)
        const yearsAgo = thisYear - new Date(memory.memory_date).getUTCFullYear()
        const uploaderName = memory.user?.first_name ?? 'someone'

        await sendPushToAllMembers(supabase, c.id, {
          buildTitle: (locale) => buildOnThisDayPushTitle(yearsAgo, locale),
          buildBody: (locale) => buildOnThisDayPushBody(uploaderName, memory.note ?? null, locale),
          tag: `onthisday-${c.id}-${memory.id}`,
          memoryId: memory.id,
        })
        sent++
      } else {
        // ── Below threshold: weekly fallback, oldest memory ──
        if (c.last_first_month_memory_sent_at && c.last_first_month_memory_sent_at > sevenDaysAgo) {
          skipped++
          continue
        }

        const { data: oldestRows } = await supabase
          .from('memory')
          .select(
            `
            id, note, memory_date, owner_user_id,
            memorymedia(storage_path),
            user!owner_user_id(first_name)
          `,
          )
          .eq('circle_id', c.id)
          .order('memory_date', { ascending: true })
          .limit(1)

        const memory = (oldestRows ?? [])[0] as any
        if (!memory) {
          skipped++
          continue
        }

        const uploaderName = memory.user?.first_name ?? 'someone'

        // Sign thumbnail URL for the email path
        let memoryThumbnailUrl: string | null = null
        const fmm = (memory.memorymedia ?? [])[0]
        if (fmm?.storage_path) {
          const { data: signed } = await supabase.storage
            .from('memories-private')
            .createSignedUrl(fmm.storage_path, 7 * 24 * 60 * 60)
          memoryThumbnailUrl = signed?.signedUrl ?? null
        }

        await sendPushOrEmailToAllMembers(supabase, c.id, {
          buildPushTitle: (locale) => buildFirstMonthMemoryPushTitle(locale),
          buildPushBody: (locale) =>
            buildFirstMonthMemoryPushBody(uploaderName, memory.note ?? null, locale),
          tag: `first-month-memory-${c.id}`,
          memoryId: memory.id,
          buildEmail: (recipientFirstName, locale) =>
            buildFirstMonthMemoryEmail({
              recipientFirstName,
              circleName: c.name,
              uploaderName,
              memoryNote: memory.note ?? null,
              memoryDate: memory.memory_date,
              memoryThumbnailUrl,
              appUrl: `${APP_URL}/timeline?circle=${c.id}&memory=${memory.id}`,
              unsubscribeUrl: `${APP_URL}/notification-settings`,
              locale,
            }),
        })

        await supabase
          .from('circle')
          .update({ last_first_month_memory_sent_at: new Date().toISOString() })
          .eq('id', c.id)
        sent++
      }
    } catch (err) {
      console.error(`[send-on-this-day] failed for circle ${c.id}:`, err)
      errors++
    }
  }

  return Response.json({ ok: true, sent, skipped, errors })
})

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface PushSpec {
  buildTitle: (locale: 'en' | 'zh-CN' | 'fr') => string
  buildBody: (locale: 'en' | 'zh-CN' | 'fr') => string
  tag: string
  memoryId: string
}

async function sendPushToAllMembers(supabase: any, circleId: string, spec: PushSpec) {
  const { data: members } = await supabase
    .from('circlemember')
    .select(`user_id, user!inner(id, locale, deletion_requested_at)`)
    .eq('circle_id', circleId)

  for (const m of (members ?? []) as any[]) {
    const u = m.user
    if (!u || u.deletion_requested_at) continue

    const { data: prefs } = await supabase
      .from('notificationpreference')
      .select('circle_muted, push_enabled, quiet_hours_start, quiet_hours_end')
      .eq('user_id', u.id)
      .eq('circle_id', circleId)
      .maybeSingle()
    if (prefs?.circle_muted) continue
    if (prefs?.push_enabled === false) continue
    if (isInQuietHours(prefs?.quiet_hours_start, prefs?.quiet_hours_end)) continue

    const { data: subs } = await supabase
      .from('pushsubscription')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', u.id)
    if (!subs || subs.length === 0) continue
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) continue

    const locale = (u.locale ?? 'en') as 'en' | 'zh-CN' | 'fr'
    const payload = JSON.stringify({
      title: spec.buildTitle(locale),
      body: spec.buildBody(locale),
      tag: spec.tag,
      renotify: true,
      data: { url: `${APP_URL}/timeline?circle=${circleId}&memory=${spec.memoryId}` },
    })

    for (const s of subs as any[]) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('pushsubscription').delete().eq('id', s.id)
        }
      }
    }
  }
}

interface PushOrEmailSpec {
  buildPushTitle: (locale: 'en' | 'zh-CN' | 'fr') => string
  buildPushBody: (locale: 'en' | 'zh-CN' | 'fr') => string
  tag: string
  memoryId: string
  buildEmail: (
    recipientFirstName: string,
    locale: 'en' | 'zh-CN' | 'fr',
  ) => { subject: string; html: string }
}

async function sendPushOrEmailToAllMembers(supabase: any, circleId: string, spec: PushOrEmailSpec) {
  const { data: members } = await supabase
    .from('circlemember')
    .select(`user_id, user!inner(id, email, first_name, locale, deletion_requested_at)`)
    .eq('circle_id', circleId)

  for (const m of (members ?? []) as any[]) {
    const u = m.user
    if (!u || u.deletion_requested_at) continue

    const { data: prefs } = await supabase
      .from('notificationpreference')
      .select(
        'circle_muted, push_enabled, email_digest_frequency, quiet_hours_start, quiet_hours_end',
      )
      .eq('user_id', u.id)
      .eq('circle_id', circleId)
      .maybeSingle()
    if (prefs?.circle_muted) continue

    const locale = (u.locale ?? 'en') as 'en' | 'zh-CN' | 'fr'
    let delivered = false

    const pushEnabled = prefs?.push_enabled !== false
    const inQuiet = isInQuietHours(prefs?.quiet_hours_start, prefs?.quiet_hours_end)

    if (pushEnabled && !inQuiet && VAPID_PUBLIC && VAPID_PRIVATE) {
      const { data: subs } = await supabase
        .from('pushsubscription')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', u.id)
      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: spec.buildPushTitle(locale),
          body: spec.buildPushBody(locale),
          tag: spec.tag,
          renotify: true,
          data: { url: `${APP_URL}/timeline?circle=${circleId}&memory=${spec.memoryId}` },
        })
        for (const s of subs as any[]) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            )
          } catch (err: any) {
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await supabase.from('pushsubscription').delete().eq('id', s.id)
            }
          }
        }
        delivered = true
      }
    }

    if (!delivered) {
      if (prefs?.email_digest_frequency === 'off') continue
      if (!u.email) continue
      const { subject, html } = spec.buildEmail(u.first_name ?? '', locale)
      await sendEmail(u.email, subject, html)
    }
  }
}

function isInQuietHours(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return false
  const now = new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  if (start <= end) return hhmm >= start && hhmm < end
  return hhmm >= start || hhmm < end
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] first-month-memory email to ${to}: ${subject}`)
    return
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Our Story <hello@our-story.tinybit.app>',
        to,
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error('[send-on-this-day] Resend send failed:', err)
  }
}
```

- [ ] **Step 4: Sanity check + commit**

Read all three files end-to-end. Confirm no Nitro-only imports.

```bash
git add supabase/functions/send-on-this-day/
git commit -m "feat(on-this-day): send-on-this-day Edge Function with Deno mirrors"
```

---

## Task 5: Docs

**Files:**

- Modify: `docs/build-plan.md`
- Modify: `docs/design-spec.md`

- [ ] **Step 1: Update build plan**

Replace the `- [ ] 10.2 ...` line in `docs/build-plan.md`:

```
- [x] 10.2 On This Day daily cron — activates at 30+ memories AND 90+ days since first upload; below threshold substitutes weekly "A memory from your first month" notification *(implementation complete — pg_cron pending manual setup in Supabase Studio)*
  - Edge Function `send-on-this-day` runs daily at 9am UTC
  - **Above threshold:** find oldest memory whose MM-DD matches today from a past year; push to all members (no email fallback — daily cadence)
  - **Below threshold:** weekly "memory from your first month" fallback (oldest memory in circle); push if subscribed → email fallback; capped at once per 7 days via `Circle.last_first_month_memory_sent_at` (migration 034)
  - Recipients: all circle members (skip muted)
  - One push per circle per day, oldest matching year (most nostalgic)
  - Locales: en, zh-CN, fr
  - Migration 034: `last_first_month_memory_sent_at TIMESTAMPTZ` on Circle
  - Tests: 15 push-copy unit tests + 8 email-builder unit tests + 1 schema-compliance
  - Manual setup remaining: schedule `send-on-this-day` in Supabase Studio (`0 9 * * *`)
  - No Plus tier check — build for all users in Phase 1; gate added in Phase 2 with Stripe billing
  - In-app carousel is Phase 3 (deliberately not built)
  - See spec: `docs/superpowers/specs/2026-05-11-on-this-day-design.md`
```

- [ ] **Step 2: Update design spec cross-references**

In `docs/design-spec.md`, find `## On This Day (Nostalgia Engine)` (around line 3832). Append at end of the "Implementation: scheduled Edge Function (daily cron)" subsection:

```
**[Implemented §10.2]** — Edge Function `send-on-this-day` runs daily at 9am UTC. Above-threshold circles get a push-only nostalgia notification (one per circle per day, oldest matching year). Below-threshold circles fall back to a weekly "memory from your first month" notification with push-or-email channel selection, capped via `Circle.last_first_month_memory_sent_at` (migration 034). All circle members are recipients (skip muted). No Plus tier check in Phase 1.
```

- [ ] **Step 3: Commit**

```bash
git add docs/build-plan.md docs/design-spec.md
git commit -m "docs: mark 10.2 complete, cross-reference on-this-day implementation"
```

---

## Verification (after all tasks)

- [ ] `pnpm db:reset && pnpm db:test` passes
- [ ] `pnpm test` passes — new unit tests
- [ ] Manual above-threshold: set a circle's `memory_count = 35`, `first_memory_at` 100 days ago; insert a memory with `memory_date` exactly 1 year ago today; trigger function; verify push log/notification
- [ ] Manual below-threshold: set a circle's `memory_count = 5`, `first_memory_at` 30 days ago, `last_first_month_memory_sent_at = NULL`; trigger; verify push or email
- [ ] Verify `last_first_month_memory_sent_at` updated after below-threshold run
- [ ] Re-trigger same day: below-threshold circles skipped (last-sent < 7 days)
