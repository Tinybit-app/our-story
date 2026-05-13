# Milestone Suggestions Implementation Plan (12.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily Edge Function that detects upcoming/recent milestones (child birthdays, couple/trip anniversaries) and prompts owner+admins via push, email, and an in-app banner — triple-nudge pattern (T-3, T+0, T+3).

**Architecture:** New `MilestoneNudge` tracking table (idempotency) + `milestone_nudges_enabled` preference. Edge Function `send-milestone-nudges` runs daily at 9am UTC, computes candidate milestones, picks channel per recipient (push if subscribed → email fallback). Pure-function helpers in `server/utils/milestoneCron.ts` (Vitest-tested) mirrored in the Deno function. Timeline GET extended with `upcomingMilestone` for the in-app banner; banner click pre-fills milestone label in upload sheet.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, Resend, Web Push, Vue 3 (Nuxt), Vitest, pgTAP

**Spec:** `docs/superpowers/specs/2026-05-09-milestone-suggestions-design.md`

---

## File Structure

### New

- `supabase/migrations/031_milestone_nudge.sql` — tracking table
- `supabase/migrations/032_milestone_nudges_enabled.sql` — preference
- `supabase/migrations/033_anniversary_date_comment.sql` — generalise comment
- `server/utils/milestoneCron.ts` — pure helpers (calendar math)
- `unit/milestoneCron.test.ts` — TDD tests for helpers
- `unit/milestoneEmail.test.ts` — TDD tests for email builders
- `supabase/functions/send-milestone-nudges/index.ts` — Edge Function
- `supabase/functions/send-milestone-nudges/milestoneCron.ts` — Deno mirror
- `supabase/functions/send-milestone-nudges/milestoneEmail.ts` — Deno mirror
- `app/components/MilestoneBanner.vue` — in-app banner

### Modified

- `server/utils/email.ts` — add `buildChildMilestoneEmail`, `buildAnniversaryEmail`
- `server/api/timeline.get.ts` — include `upcomingMilestone` + `milestoneNudgesEnabledForActiveCircle`
- `app/components/UploadMemory.vue` — accept `prefillMilestoneLabel` prop and use it
- `app/pages/timeline/index.vue` — mount `<MilestoneBanner />`, wire to upload sheet
- `app/pages/notification-settings.vue` — add `milestone_nudges_enabled` toggle
- `app/pages/circle-settings.vue` — show anchor-date input for friends/travel circles too
- `server/api/notification-preferences.patch.ts` — accept `milestone_nudges_enabled` field
- `server/api/notification-preferences.get.ts` — return `milestone_nudges_enabled` field
- `locales/en.json`, `locales/zh-CN.json`, `locales/fr.json` — new keys
- `unit/schema-compliance.test.ts` — verify migrations 031/032/033
- `supabase/tests/rls.test.sql` — RLS for MilestoneNudge
- `docs/build-plan.md`, `docs/design-spec.md` — mark complete

---

## Task 1: Migrations 031, 032, 033

**Files:**

- Create: `supabase/migrations/031_milestone_nudge.sql`
- Create: `supabase/migrations/032_milestone_nudges_enabled.sql`
- Create: `supabase/migrations/033_anniversary_date_comment.sql`
- Modify: `unit/schema-compliance.test.ts`
- Modify: `supabase/tests/rls.test.sql`

- [ ] **Step 1: Write 031 — MilestoneNudge table**

Create `supabase/migrations/031_milestone_nudge.sql`:

```sql
-- 031_milestone_nudge.sql
-- Tracking table for milestone nudge sends — idempotency for the daily cron.

CREATE TABLE public.MilestoneNudge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('child', 'couple', 'trip')),
  scope_id UUID NOT NULL,
  milestone_key TEXT NOT NULL,
  nudge_phase TEXT NOT NULL CHECK (nudge_phase IN ('T-3', 'T0', 'T+3')),
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_milestone_nudge_dedupe
  ON public.MilestoneNudge (user_id, scope_type, scope_id, milestone_key, nudge_phase);

CREATE INDEX idx_milestone_nudge_user ON public.MilestoneNudge (user_id);

ALTER TABLE public.MilestoneNudge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own milestone nudges"
  ON public.MilestoneNudge FOR SELECT USING (user_id = (SELECT auth.uid()));
```

- [ ] **Step 2: Write 032 — milestone_nudges_enabled preference**

Create `supabase/migrations/032_milestone_nudges_enabled.sql`:

```sql
-- 032_milestone_nudges_enabled.sql
-- Adds a granular toggle for milestone nudges (separate from circle_muted).

ALTER TABLE public.NotificationPreference
  ADD COLUMN milestone_nudges_enabled BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 3: Write 033 — generalise anniversary_date comment**

Create `supabase/migrations/033_anniversary_date_comment.sql`:

```sql
-- 033_anniversary_date_comment.sql
-- Generalises Circle.anniversary_date to also serve as the trip-anchor date for
-- friends/travel circles. No structural change — comment + scope only.

COMMENT ON COLUMN public.Circle.anniversary_date IS
  'Yearly anniversary anchor date. For couples: relationship anniversary. For friends/travel: first-trip date. Drives milestone nudge cron (§12.2). Null when not set.';
```

- [ ] **Step 4: Run db:reset and confirm migrations apply**

Run: `pnpm db:reset`
Expected: completes without errors.

- [ ] **Step 5: Add schema-compliance tests**

In `unit/schema-compliance.test.ts`, add to the `allMigrations` array:

```ts
sql("031_milestone_nudge.sql"),
sql("032_milestone_nudges_enabled.sql"),
sql("033_anniversary_date_comment.sql"),
```

Append at the bottom:

```ts
describe('Migration 031 — MilestoneNudge table', () => {
  const m = sql('031_milestone_nudge.sql')

  it('creates MilestoneNudge table', () => {
    expect(m).toContain('CREATE TABLE public.MilestoneNudge')
  })

  it('has scope_type CHECK with three values', () => {
    expect(m).toContain(
      "scope_type TEXT NOT NULL CHECK (scope_type IN ('child', 'couple', 'trip'))",
    )
  })

  it('has nudge_phase CHECK with three values', () => {
    expect(m).toContain(
      "nudge_phase TEXT NOT NULL CHECK (nudge_phase IN ('T-3', 'T0', 'T+3'))",
    )
  })

  it('has unique dedupe index on (user_id, scope_type, scope_id, milestone_key, nudge_phase)', () => {
    expect(m).toContain('CREATE UNIQUE INDEX idx_milestone_nudge_dedupe')
    expect(m).toContain(
      '(user_id, scope_type, scope_id, milestone_key, nudge_phase)',
    )
  })

  it('enables RLS', () => {
    expect(m).toContain('ENABLE ROW LEVEL SECURITY')
  })

  it('has owner-only SELECT policy', () => {
    expect(m).toContain('users can read own milestone nudges')
  })
})

describe('Migration 032 — milestone_nudges_enabled preference', () => {
  const m = sql('032_milestone_nudges_enabled.sql')

  it('adds milestone_nudges_enabled with default true', () => {
    expect(m).toContain(
      'ADD COLUMN milestone_nudges_enabled BOOLEAN NOT NULL DEFAULT true',
    )
  })
})
```

- [ ] **Step 6: Add RLS tests for MilestoneNudge**

In `supabase/tests/rls.test.sql`, append before `SELECT * FROM finish();`:

```sql
-- ============================================================
-- MILESTONE NUDGE — owner-only SELECT (§12.2)
-- ============================================================
RESET ROLE;
INSERT INTO public.MilestoneNudge (id, user_id, scope_type, scope_id, milestone_key, nudge_phase, channel)
VALUES (
  '80000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',  -- user_a
  'child',
  '00000000-0000-0000-0000-000000000099',
  '6mo',
  'T0',
  'push'
);

-- user_a can read own milestone nudges
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
SELECT results_eq(
  $$ SELECT count(*)::int FROM MilestoneNudge WHERE user_id = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY[1],
  'user_a can read own milestone nudges'
);

-- user_b cannot read user_a's milestone nudges
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002"}';
SELECT results_eq(
  $$ SELECT count(*)::int FROM MilestoneNudge WHERE user_id = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY[0],
  'user_b cannot read user_a milestone nudges'
);

-- Cleanup
RESET ROLE;
DELETE FROM public.MilestoneNudge WHERE id = '80000000-0000-0000-0000-000000000001';
```

Bump the `SELECT plan(N)` line by 2.

- [ ] **Step 7: Run all tests + regenerate types**

Run: `pnpm db:reset && pnpm db:test && pnpm test && pnpm db:types`
Expected: all pass; `app/types/database.ts` regenerated to include `MilestoneNudge` and `milestone_nudges_enabled`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/031_milestone_nudge.sql \
        supabase/migrations/032_milestone_nudges_enabled.sql \
        supabase/migrations/033_anniversary_date_comment.sql \
        unit/schema-compliance.test.ts \
        supabase/tests/rls.test.sql \
        app/types/database.ts
git commit -m "feat(milestones): migrations 031/032/033 for milestone nudge schema"
```

---

## Task 2: Calendar helpers (TDD)

**Files:**

- Create: `server/utils/milestoneCron.ts`
- Create: `unit/milestoneCron.test.ts`

- [ ] **Step 1: Write the failing tests first (TDD)**

Create `unit/milestoneCron.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  getMilestoneKeyForAge,
  getAnniversaryYear,
  MONTH_MILESTONES,
  YEAR_MILESTONES,
} from '../server/utils/milestoneCron'

describe('getMilestoneKeyForAge', () => {
  it('returns null for ages with no milestone', () => {
    expect(getMilestoneKeyForAge('2026-01-01', '2026-01-15')).toBeNull() // 14 days, not a milestone
  })

  it("returns '1mo' for exactly 1 month old", () => {
    expect(getMilestoneKeyForAge('2026-01-15', '2026-02-15')).toBe('1mo')
  })

  it("returns '6mo' for exactly 6 months old", () => {
    expect(getMilestoneKeyForAge('2025-08-09', '2026-02-09')).toBe('6mo')
  })

  it("returns '12mo' for exactly 12 months old", () => {
    expect(getMilestoneKeyForAge('2025-02-09', '2026-02-09')).toBe('12mo')
  })

  it("returns '18mo' for exactly 18 months old", () => {
    expect(getMilestoneKeyForAge('2024-08-09', '2026-02-09')).toBe('18mo')
  })

  it("returns '2yr' for exactly 24 months old", () => {
    expect(getMilestoneKeyForAge('2024-02-09', '2026-02-09')).toBe('2yr')
  })

  it("returns '3yr' for exactly 3 years old", () => {
    expect(getMilestoneKeyForAge('2023-02-09', '2026-02-09')).toBe('3yr')
  })

  it('returns null for ages beyond 18yr cap', () => {
    expect(getMilestoneKeyForAge('2007-02-09', '2026-02-09')).toBeNull() // 19yr
  })

  it('returns null when target_date is before dob', () => {
    expect(getMilestoneKeyForAge('2026-06-01', '2026-01-01')).toBeNull()
  })

  it('month milestones list contains expected values', () => {
    expect(MONTH_MILESTONES).toEqual([1, 2, 3, 6, 9, 12, 18])
  })

  it('year milestones list contains expected values', () => {
    expect(YEAR_MILESTONES).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18])
  })
})

describe('getAnniversaryYear', () => {
  it('returns N when targetDate is the same MM-DD as anniversaryDate, year diff = N', () => {
    expect(getAnniversaryYear('2020-05-09', '2026-05-09')).toBe(6)
  })

  it('returns null when MM-DD differs', () => {
    expect(getAnniversaryYear('2020-05-09', '2026-05-10')).toBeNull()
  })

  it('returns null when target is before anniversary date (negative year)', () => {
    expect(getAnniversaryYear('2030-05-09', '2026-05-09')).toBeNull()
  })

  it('returns null when targetDate is the same year as anniversaryDate (year 0)', () => {
    expect(getAnniversaryYear('2026-05-09', '2026-05-09')).toBeNull()
  })

  it('handles leap year Feb 29 — anniversary moves to Feb 28 in non-leap year', () => {
    expect(getAnniversaryYear('2020-02-29', '2025-02-28')).toBe(5)
  })

  it('returns N for Feb 29 anniversary on Feb 29 in leap year', () => {
    expect(getAnniversaryYear('2020-02-29', '2024-02-29')).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm test unit/milestoneCron.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `server/utils/milestoneCron.ts`:

```ts
// Pure helpers for milestone cron — date math and milestone key resolution.
// Mirrored verbatim in supabase/functions/send-milestone-nudges/milestoneCron.ts
// (Deno can't import from Nitro, so the file is duplicated 1:1 like the digest pattern).

export const MONTH_MILESTONES = [1, 2, 3, 6, 9, 12, 18] as const
export const YEAR_MILESTONES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18] as const

/**
 * Given a child's date_of_birth and a target date, return the milestone key
 * (e.g., '6mo', '2yr') if the target date is exactly that age. Else null.
 *
 * "Exactly N months" means: same day-of-month and (target_year * 12 + target_month) - (dob_year * 12 + dob_month) === N.
 * "Exactly N years" means: same MM-DD and year diff === N.
 */
export function getMilestoneKeyForAge(
  dob: string,
  targetDate: string,
): string | null {
  const d = new Date(dob + 'T00:00:00Z')
  const t = new Date(targetDate + 'T00:00:00Z')
  if (Number.isNaN(d.getTime()) || Number.isNaN(t.getTime())) return null
  if (t.getTime() < d.getTime()) return null

  const dy = d.getUTCFullYear()
  const dm = d.getUTCMonth()
  const dd = d.getUTCDate()
  const ty = t.getUTCFullYear()
  const tm = t.getUTCMonth()
  const td = t.getUTCDate()

  // Same day-of-month required for "exact" milestone hit
  if (dd !== td) return null

  const monthsDiff = (ty - dy) * 12 + (tm - dm)

  if (monthsDiff <= 0) return null

  // Year milestones (months divisible by 12)
  if (monthsDiff % 12 === 0) {
    const years = monthsDiff / 12
    if ((YEAR_MILESTONES as readonly number[]).includes(years)) {
      return `${years}yr`
    }
    return null
  }

  // Month milestones (must be < 24 months and in the list)
  if ((MONTH_MILESTONES as readonly number[]).includes(monthsDiff)) {
    return `${monthsDiff}mo`
  }

  return null
}

/**
 * Given an anniversary anchor date and a target date, return the year N if the
 * target is the Nth anniversary (same MM-DD, N years later, N >= 1). Else null.
 *
 * Leap-year Feb 29 special case: if anchor is Feb 29 and target year is non-leap,
 * accept Feb 28 as the matching day.
 */
export function getAnniversaryYear(
  anniversaryDate: string,
  targetDate: string,
): number | null {
  const a = new Date(anniversaryDate + 'T00:00:00Z')
  const t = new Date(targetDate + 'T00:00:00Z')
  if (Number.isNaN(a.getTime()) || Number.isNaN(t.getTime())) return null

  const ay = a.getUTCFullYear()
  const am = a.getUTCMonth()
  const ad = a.getUTCDate()
  const ty = t.getUTCFullYear()
  const tm = t.getUTCMonth()
  const td = t.getUTCDate()

  const yearDiff = ty - ay
  if (yearDiff < 1) return null

  // Same MM-DD: direct match
  if (am === tm && ad === td) return yearDiff

  // Feb 29 special case: anchor is Feb 29 → match Feb 28 in non-leap years
  const isLeapYear = (y: number) =>
    (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  if (am === 1 && ad === 29 && tm === 1 && td === 28 && !isLeapYear(ty)) {
    return yearDiff
  }

  return null
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm test unit/milestoneCron.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run full suite + commit**

```bash
pnpm test
git add server/utils/milestoneCron.ts unit/milestoneCron.test.ts
git commit -m "feat(milestones): calendar helpers (TDD) for cron candidate detection"
```

---

## Task 3: Email builders (TDD)

**Files:**

- Modify: `server/utils/email.ts`
- Create: `unit/milestoneEmail.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `unit/milestoneEmail.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  buildChildMilestoneEmail,
  buildAnniversaryEmail,
} from '../server/utils/email'

const baseChild = {
  recipientFirstName: 'Dao',
  childName: 'Mia',
  milestoneLabel: '6 months',
  phase: 'T-3' as const,
  daysUntil: 3,
  circleName: 'The Smiths',
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildChildMilestoneEmail — subjects', () => {
  it('T-3 includes child name + milestone label', () => {
    const { subject } = buildChildMilestoneEmail(baseChild)
    expect(subject).toContain('Mia')
    expect(subject).toContain('6 months')
  })

  it('T+0 says today', () => {
    const { subject } = buildChildMilestoneEmail({
      ...baseChild,
      phase: 'T0',
      daysUntil: 0,
    })
    expect(subject.toLowerCase()).toMatch(/today|🎉/)
    expect(subject).toContain('Mia')
  })

  it('T+3 asks if captured', () => {
    const { subject } = buildChildMilestoneEmail({
      ...baseChild,
      phase: 'T+3',
      daysUntil: -3,
    })
    expect(subject.toLowerCase()).toMatch(/capture|did you/)
    expect(subject).toContain('Mia')
  })

  it('renders zh-CN subject with Chinese characters', () => {
    const { subject } = buildChildMilestoneEmail({
      ...baseChild,
      locale: 'zh-CN',
    })
    expect(subject).toMatch(/[一-鿿]/)
  })

  it('renders fr subject (not English)', () => {
    const { subject } = buildChildMilestoneEmail({ ...baseChild, locale: 'fr' })
    expect(subject.toLowerCase()).not.toMatch(/turns/)
  })
})

describe('buildChildMilestoneEmail — body', () => {
  it('contains the appUrl as primary CTA', () => {
    const { html } = buildChildMilestoneEmail(baseChild)
    expect(html).toContain('https://our-story.tinybit.app/timeline?circle=c1')
  })

  it('contains the unsubscribe link', () => {
    const { html } = buildChildMilestoneEmail(baseChild)
    expect(html).toContain('/notification-settings')
  })

  it('includes milestone label in body', () => {
    const { html } = buildChildMilestoneEmail(baseChild)
    expect(html).toContain('6 months')
  })
})

describe('buildAnniversaryEmail — couple', () => {
  const base = {
    recipientFirstName: 'Dao',
    years: 5,
    scopeType: 'couple' as const,
    phase: 'T0' as const,
    circleName: 'Sarah & Dao',
    appUrl: 'https://our-story.tinybit.app/timeline?circle=c2',
    unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
    locale: 'en' as const,
  }

  it('T+0 subject mentions years', () => {
    const { subject } = buildAnniversaryEmail(base)
    expect(subject).toContain('5')
  })

  it('T-3 subject for couple anniversary', () => {
    const { subject } = buildAnniversaryEmail({ ...base, phase: 'T-3' })
    expect(subject.toLowerCase()).toMatch(/anniversary|3 days/)
  })
})

describe('buildAnniversaryEmail — trip', () => {
  const base = {
    recipientFirstName: 'Dao',
    years: 5,
    scopeType: 'trip' as const,
    phase: 'T0' as const,
    circleName: 'Barcelona Crew',
    appUrl: 'https://our-story.tinybit.app/timeline?circle=c3',
    unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
    locale: 'en' as const,
  }

  it('trip anniversary subject differs from couple', () => {
    const { subject } = buildAnniversaryEmail(base)
    expect(subject.toLowerCase()).toMatch(/trip|years/)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm test unit/milestoneEmail.test.ts`
Expected: FAIL — `buildChildMilestoneEmail` / `buildAnniversaryEmail` not exported.

- [ ] **Step 3: Implement builders**

Append to `server/utils/email.ts` (read the file first to keep style consistent — uses existing `layout()` and `primaryButton()` helpers):

```ts
// ─────────────────────────────────────────────────────────────
// Milestone nudge emails (12.2)
// ─────────────────────────────────────────────────────────────

export interface ChildMilestoneEmailOpts {
  recipientFirstName: string
  childName: string
  milestoneLabel: string // e.g. "6 months", "1 year", "18 months"
  phase: 'T-3' | 'T0' | 'T+3'
  daysUntil: number // 3 for T-3, 0 for T0, -3 for T+3
  circleName: string
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildChildMilestoneEmail(opts: ChildMilestoneEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    childName,
    milestoneLabel,
    phase,
    circleName,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts

  const subject = (() => {
    if (locale === 'zh-CN') {
      if (phase === 'T-3') return `${childName}还有 3 天就 ${milestoneLabel} 了`
      if (phase === 'T0') return `${childName}今天 ${milestoneLabel} 啦 🎉`
      return `${childName}的 ${milestoneLabel} 你拍到了吗？`
    }
    if (locale === 'fr') {
      if (phase === 'T-3')
        return `${childName} aura ${milestoneLabel} dans 3 jours`
      if (phase === 'T0')
        return `${childName} a ${milestoneLabel} aujourd'hui 🎉`
      return `Avez-vous capturé les ${milestoneLabel} de ${childName} ?`
    }
    if (phase === 'T-3') return `${childName} turns ${milestoneLabel} in 3 days`
    if (phase === 'T0') return `${childName} is ${milestoneLabel} today 🎉`
    return `Did you capture ${childName}'s ${milestoneLabel}?`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN') {
      if (phase === 'T-3')
        return `${childName} 还有 3 天就 ${milestoneLabel} 了 — 准备好记录这一刻了吗？`
      if (phase === 'T0')
        return `今天是 ${childName} ${milestoneLabel} 的日子！添加一条记忆吧。`
      return `${childName} 的 ${milestoneLabel} 已经过去了 — 在这一刻消逝前添加一条记忆吧。`
    }
    if (locale === 'fr') {
      if (phase === 'T-3')
        return `${childName} aura ${milestoneLabel} dans 3 jours — prêt à capturer le moment ?`
      if (phase === 'T0')
        return `Aujourd'hui ${childName} a ${milestoneLabel} ! Ajoutez un souvenir.`
      return `${childName} a eu ${milestoneLabel} il y a quelques jours — ajoutez un souvenir avant que le moment ne s'efface.`
    }
    if (phase === 'T-3')
      return `${childName} turns ${milestoneLabel} in 3 days — ready to capture the moment?`
    if (phase === 'T0')
      return `Today is ${childName}'s ${milestoneLabel} milestone 🎉 Add a memory.`
    return `${childName}'s ${milestoneLabel} just passed — add a memory before the moment fades.`
  })()

  const cta =
    locale === 'zh-CN'
      ? '添加记忆 →'
      : locale === 'fr'
        ? 'Ajouter un souvenir →'
        : 'Add a memory →'

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
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta)}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `
  return { subject, html: layout(body) }
}

export interface AnniversaryEmailOpts {
  recipientFirstName: string
  years: number
  scopeType: 'couple' | 'trip'
  phase: 'T-3' | 'T0' | 'T+3'
  circleName: string
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}

export function buildAnniversaryEmail(opts: AnniversaryEmailOpts): {
  subject: string
  html: string
} {
  const {
    recipientFirstName,
    years,
    scopeType,
    phase,
    circleName,
    appUrl,
    unsubscribeUrl,
    locale,
  } = opts
  const isCouple = scopeType === 'couple'

  const subject = (() => {
    if (locale === 'zh-CN') {
      if (isCouple) {
        if (phase === 'T-3') return `你们的纪念日还有 3 天`
        if (phase === 'T0') return `${years} 周年快乐 🥂`
        return `你们庆祝纪念日了吗？`
      }
      if (phase === 'T-3') return `你们的旅行纪念日还有 3 天`
      if (phase === 'T0') return `这次旅行已经 ${years} 年了 🌍`
      return `你们记录了这次旅行的纪念吗？`
    }
    if (locale === 'fr') {
      if (isCouple) {
        if (phase === 'T-3') return `Votre anniversaire est dans 3 jours`
        if (phase === 'T0') return `Joyeux ${years} ans ensemble 🥂`
        return `Avez-vous célébré votre anniversaire ?`
      }
      if (phase === 'T-3')
        return `L'anniversaire de votre voyage est dans 3 jours`
      if (phase === 'T0') return `${years} ans depuis votre voyage 🌍`
      return `Avez-vous célébré l'anniversaire du voyage ?`
    }
    if (isCouple) {
      if (phase === 'T-3') return `Your anniversary is in 3 days`
      if (phase === 'T0') return `Happy ${years} years 🥂`
      return `Did you celebrate? Add a memory →`
    }
    if (phase === 'T-3') return `Your trip anniversary is in 3 days`
    if (phase === 'T0') return `${years} years since your trip 🌍`
    return `Did you mark the trip anniversary?`
  })()

  const greeting =
    locale === 'zh-CN'
      ? `你好 ${recipientFirstName}，`
      : locale === 'fr'
        ? `Bonjour ${recipientFirstName},`
        : `Hi ${recipientFirstName ?? 'there'},`

  const intro = (() => {
    if (locale === 'zh-CN') {
      if (isCouple) {
        if (phase === 'T-3')
          return `你们的 ${years} 周年还有 3 天 — 准备好捕捉这一刻吗？`
        if (phase === 'T0')
          return `今天是你们 ${years} 周年纪念日 🥂 添加一条记忆吧。`
        return `你们的 ${years} 周年纪念日刚过 — 添加一条记忆吧。`
      }
      if (phase === 'T-3')
        return `这次旅行的 ${years} 周年还有 3 天 — 准备好回顾了吗？`
      if (phase === 'T0') return `这次旅行已经 ${years} 年了 — 添加一条回忆吧。`
      return `旅行 ${years} 周年刚过 — 添加一条回忆吧。`
    }
    if (locale === 'fr') {
      if (isCouple) {
        if (phase === 'T-3')
          return `Vos ${years} ans approchent dans 3 jours — prêt à capturer le moment ?`
        if (phase === 'T0')
          return `Aujourd'hui c'est vos ${years} ans 🥂 Ajoutez un souvenir.`
        return `Votre anniversaire de ${years} ans vient de passer — ajoutez un souvenir.`
      }
      if (phase === 'T-3')
        return `L'anniversaire de votre voyage de ${years} ans est dans 3 jours.`
      if (phase === 'T0')
        return `${years} ans depuis votre voyage — ajoutez un souvenir.`
      return `L'anniversaire du voyage de ${years} ans vient de passer — ajoutez un souvenir.`
    }
    if (isCouple) {
      if (phase === 'T-3')
        return `Your ${years}-year anniversary is in 3 days — ready to capture the moment?`
      if (phase === 'T0')
        return `Today is your ${years}-year anniversary 🥂 Add a memory.`
      return `Your ${years}-year anniversary just passed — add a memory before the moment fades.`
    }
    if (phase === 'T-3')
      return `Your ${years}-year trip anniversary is in 3 days — ready to look back?`
    if (phase === 'T0') return `${years} years since your trip — add a memory.`
    return `${years} years since your trip — add a memory before the moment fades.`
  })()

  const cta =
    locale === 'zh-CN'
      ? '添加记忆 →'
      : locale === 'fr'
        ? 'Ajouter un souvenir →'
        : 'Add a memory →'

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
    <p style="margin:0 0 32px;">${primaryButton(appUrl, cta)}</p>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:24px 0 0;">${unsubscribe}</p>
  `
  return { subject, html: layout(body) }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm test unit/milestoneEmail.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run full suite + commit**

```bash
pnpm test
git add server/utils/email.ts unit/milestoneEmail.test.ts
git commit -m "feat(milestones): child + anniversary email builders (locale-aware)"
```

---

## Task 4: Edge Function `send-milestone-nudges`

**Files:**

- Create: `supabase/functions/send-milestone-nudges/index.ts`
- Create: `supabase/functions/send-milestone-nudges/milestoneCron.ts`
- Create: `supabase/functions/send-milestone-nudges/milestoneEmail.ts`

- [ ] **Step 1: Mirror calendar helpers for Deno**

Create `supabase/functions/send-milestone-nudges/milestoneCron.ts` containing the **exact** same code as `server/utils/milestoneCron.ts` (Task 2 Step 3). Read the Nitro version and copy it verbatim, including the `MONTH_MILESTONES`, `YEAR_MILESTONES`, `getMilestoneKeyForAge`, and `getAnniversaryYear` exports.

- [ ] **Step 2: Mirror email builders for Deno**

Create `supabase/functions/send-milestone-nudges/milestoneEmail.ts`. Read the Nitro `server/utils/email.ts` builders (Task 3 Step 3) and copy verbatim — including the helper `layout()` and `primaryButton()` functions, since Deno can't import from Nitro. The builders to copy: `buildChildMilestoneEmail`, `buildAnniversaryEmail`, plus the helpers and types.

- [ ] **Step 3: Implement the Edge Function**

Create `supabase/functions/send-milestone-nudges/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getMilestoneKeyForAge, getAnniversaryYear } from './milestoneCron.ts'
import {
  buildChildMilestoneEmail,
  buildAnniversaryEmail,
} from './milestoneEmail.ts'
import webpush from 'https://esm.sh/web-push@3.6.7'

// Triggered daily by pg_cron at 9am UTC.
//
// SELECT cron.schedule(
//   'send-milestone-nudges',
//   '0 9 * * *',
//   $$SELECT net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/send-milestone-nudges',
//     headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//   )$$
// );

const APP_URL = Deno.env.get('APP_URL') ?? 'https://our-story.tinybit.app'
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT =
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@our-story.tinybit.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

interface MilestoneCandidate {
  scope_type: 'child' | 'couple' | 'trip'
  scope_id: string // child_id or circle_id
  circle_id: string
  milestone_key: string
  phase: 'T-3' | 'T0' | 'T+3'
  display_name: string // child first name, or "your anniversary", or "your trip anniversary"
  years_or_label: string // e.g. "6 months" or "5"
  milestone_date: string // ISO date the milestone falls on
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

  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const plus3 = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const minus3 = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const phaseTargets: Array<['T-3' | 'T0' | 'T+3', string]> = [
    ['T-3', plus3],
    ['T0', todayISO],
    ['T+3', minus3],
  ]

  const candidates: MilestoneCandidate[] = []

  // ── Child milestones ───────────────────────────────────────
  const { data: children } = await supabase
    .from('childprofile')
    .select('id, name, date_of_birth, circle_id, circle!inner(id, deleted_at)')
  for (const child of (children ?? []) as any[]) {
    if (child.circle?.deleted_at) continue
    for (const [phase, target] of phaseTargets) {
      const key = getMilestoneKeyForAge(child.date_of_birth, target)
      if (!key) continue
      candidates.push({
        scope_type: 'child',
        scope_id: child.id,
        circle_id: child.circle_id,
        milestone_key: key,
        phase,
        display_name: child.name,
        years_or_label: humanizeMilestoneKey(key),
        milestone_date: target,
      })
    }
  }

  // ── Couple / Trip anniversaries ────────────────────────────
  const { data: circles } = await supabase
    .from('circle')
    .select('id, name, anniversary_date, circle_type, deleted_at')
    .in('circle_type', ['couple', 'friends', 'travel'])
    .not('anniversary_date', 'is', null)
    .is('deleted_at', null)
  for (const c of (circles ?? []) as any[]) {
    for (const [phase, target] of phaseTargets) {
      const year = getAnniversaryYear(c.anniversary_date, target)
      if (!year) continue
      const isCouple = c.circle_type === 'couple'
      candidates.push({
        scope_type: isCouple ? 'couple' : 'trip',
        scope_id: c.id,
        circle_id: c.id,
        milestone_key: isCouple
          ? `anniversary_${year}`
          : `trip_anniversary_${year}`,
        phase,
        display_name: c.name,
        years_or_label: String(year),
        milestone_date: target,
      })
    }
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const cand of candidates) {
    try {
      // T+3 skip rule: skip if any memory in ±3 days has milestone_label set
      if (cand.phase === 'T+3') {
        const lo = addDaysISO(cand.milestone_date, -3)
        const hi = addDaysISO(cand.milestone_date, +3)
        const { count } = await supabase
          .from('memory')
          .select('id', { count: 'exact', head: true })
          .eq('circle_id', cand.circle_id)
          .gte('memory_date', lo)
          .lte('memory_date', hi)
          .not('milestone_label', 'is', null)
        if ((count ?? 0) > 0) {
          skipped++
          continue
        }
      }

      // Recipients: owner + admins of the circle
      const { data: members } = await supabase
        .from('circlemember')
        .select(
          `user_id, role, user!inner(id, email, first_name, locale, deletion_requested_at)`,
        )
        .eq('circle_id', cand.circle_id)
        .in('role', ['owner', 'admin'])
      const recipients = (members ?? []).filter(
        (m: any) => !m.user.deletion_requested_at && m.user.email,
      )

      // Get circle name once
      const { data: circle } = await supabase
        .from('circle')
        .select('name')
        .eq('id', cand.circle_id)
        .single()
      const circleName = circle?.name ?? ''

      for (const r of recipients as any[]) {
        const userId = r.user.id

        // Check NotificationPreference
        const { data: prefs } = await supabase
          .from('notificationpreference')
          .select(
            'circle_muted, milestone_nudges_enabled, push_enabled, email_digest_frequency, quiet_hours_start, quiet_hours_end',
          )
          .eq('user_id', userId)
          .eq('circle_id', cand.circle_id)
          .maybeSingle()
        if (prefs?.circle_muted) {
          skipped++
          continue
        }
        if (prefs && prefs.milestone_nudges_enabled === false) {
          skipped++
          continue
        }

        // Idempotency check
        const { count: existing } = await supabase
          .from('milestonenudge')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('scope_type', cand.scope_type)
          .eq('scope_id', cand.scope_id)
          .eq('milestone_key', cand.milestone_key)
          .eq('nudge_phase', cand.phase)
        if ((existing ?? 0) > 0) {
          skipped++
          continue
        }

        const pushEnabled = prefs?.push_enabled !== false
        const inQuiet = isInQuietHours(
          prefs?.quiet_hours_start,
          prefs?.quiet_hours_end,
        )

        // Try push first
        if (pushEnabled && !inQuiet) {
          const { data: subs } = await supabase
            .from('pushsubscription')
            .select('id, endpoint, p256dh, auth')
            .eq('user_id', userId)
          if ((subs ?? []).length > 0) {
            const payload = JSON.stringify({
              title: pushTitle(cand),
              body: pushBody(cand),
              tag: `milestone-${cand.circle_id}-${cand.scope_id}-${cand.milestone_key}-${cand.phase}`,
              renotify: true,
              data: { url: `${APP_URL}/timeline?circle=${cand.circle_id}` },
            })
            for (const s of subs as any[]) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: s.endpoint,
                    keys: { p256dh: s.p256dh, auth: s.auth },
                  },
                  payload,
                )
              } catch (err: any) {
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                  await supabase
                    .from('pushsubscription')
                    .delete()
                    .eq('id', s.id)
                }
              }
            }
            await supabase.from('milestonenudge').insert({
              user_id: userId,
              scope_type: cand.scope_type,
              scope_id: cand.scope_id,
              milestone_key: cand.milestone_key,
              nudge_phase: cand.phase,
              channel: 'push',
            })
            sent++
            continue
          }
        }

        // Fallback to email
        if (prefs?.email_digest_frequency === 'off') {
          skipped++
          continue
        }

        const opts = {
          recipientFirstName: r.user.first_name ?? '',
          circleName,
          appUrl: `${APP_URL}/timeline?circle=${cand.circle_id}`,
          unsubscribeUrl: `${APP_URL}/notification-settings`,
          locale: (r.user.locale ?? 'en') as 'en' | 'zh-CN' | 'fr',
        }
        const { subject, html } =
          cand.scope_type === 'child'
            ? buildChildMilestoneEmail({
                ...opts,
                childName: cand.display_name,
                milestoneLabel: cand.years_or_label,
                phase: cand.phase,
                daysUntil: phaseDays(cand.phase),
              })
            : buildAnniversaryEmail({
                ...opts,
                years: Number(cand.years_or_label),
                scopeType: cand.scope_type as 'couple' | 'trip',
                phase: cand.phase,
              })

        await sendEmail(r.user.email, subject, html)
        await supabase.from('milestonenudge').insert({
          user_id: userId,
          scope_type: cand.scope_type,
          scope_id: cand.scope_id,
          milestone_key: cand.milestone_key,
          nudge_phase: cand.phase,
          channel: 'email',
        })
        sent++
      }
    } catch (err) {
      console.error('[send-milestone-nudges] candidate failed:', err)
      errors++
    }
  }

  return Response.json({ ok: true, sent, skipped, errors })
})

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isInQuietHours(
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!start || !end) return false
  const now = new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  if (start <= end) return hhmm >= start && hhmm < end
  return hhmm >= start || hhmm < end
}

function phaseDays(phase: 'T-3' | 'T0' | 'T+3'): number {
  return phase === 'T-3' ? 3 : phase === 'T0' ? 0 : -3
}

function humanizeMilestoneKey(key: string): string {
  if (key.endsWith('mo')) {
    const n = parseInt(key, 10)
    return n === 1 ? '1 month' : `${n} months`
  }
  if (key.endsWith('yr')) {
    const n = parseInt(key, 10)
    return n === 1 ? '1 year' : `${n} years`
  }
  return key
}

function pushTitle(c: MilestoneCandidate): string {
  if (c.scope_type === 'child') {
    if (c.phase === 'T-3')
      return `${c.display_name} turns ${c.years_or_label} in 3 days 🎉`
    if (c.phase === 'T0')
      return `${c.display_name} is ${c.years_or_label} today 🎉`
    return `Did you capture ${c.display_name}'s ${c.years_or_label}?`
  }
  if (c.scope_type === 'couple') {
    if (c.phase === 'T-3') return `Your anniversary is in 3 days`
    if (c.phase === 'T0') return `Happy ${c.years_or_label} years 🥂`
    return `Did you celebrate?`
  }
  // trip
  if (c.phase === 'T-3') return `Your trip anniversary is in 3 days`
  if (c.phase === 'T0') return `${c.years_or_label} years since your trip 🌍`
  return `Did you mark the trip anniversary?`
}

function pushBody(c: MilestoneCandidate): string {
  if (c.phase === 'T-3') return 'Ready to capture the moment?'
  if (c.phase === 'T0') return 'Add a memory →'
  return 'Add it before the moment fades →'
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.log(`[dev] milestone email to ${to}: ${subject}`)
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
    console.error('[send-milestone-nudges] Resend send failed:', err)
  }
}
```

- [ ] **Step 4: Sanity check + commit**

The Edge Function isn't auto-tested. Read the file end-to-end after writing it; ensure imports are valid Deno (no Nitro-only `useRuntimeConfig`).

```bash
git add supabase/functions/send-milestone-nudges/
git commit -m "feat(milestones): send-milestone-nudges Edge Function"
```

---

## Task 5: Timeline GET extension — `upcomingMilestone` + `milestoneNudgesEnabled`

**Files:**

- Modify: `server/api/timeline.get.ts`

- [ ] **Step 1: Read existing file**

Find where the response is assembled. The current handler returns memories + circle metadata. We need to add two top-level fields to the response:

- `upcomingMilestone: UpcomingMilestone | null`
- `milestoneNudgesEnabledForActiveCircle: boolean`

- [ ] **Step 2: Implement the additions**

Inside the handler (after auth + circleId resolution, before returning), add:

```ts
import {
  getMilestoneKeyForAge,
  getAnniversaryYear,
} from '~/server/utils/milestoneCron'

// ... after circleId is known and authenticated:

// Compute the user's milestone_nudges_enabled for this circle
const { data: prefRow } = await supabase
  .from('notificationpreference')
  .select('milestone_nudges_enabled')
  .eq('user_id', user.sub)
  .eq('circle_id', circleId)
  .maybeSingle()
const milestoneNudgesEnabledForActiveCircle =
  prefRow?.milestone_nudges_enabled !== false

// Compute upcomingMilestone (look across T-3, T+0, T+3 windows; prefer the one closest to today)
let upcomingMilestone: any = null
if (milestoneNudgesEnabledForActiveCircle) {
  const today = new Date().toISOString().slice(0, 10)
  const targets: Array<['T-3' | 'T0' | 'T+3', string, number]> = [
    ['T0', today, 0],
    ['T-3', isoAddDays(today, 3), 3],
    ['T+3', isoAddDays(today, -3), -3],
  ]

  // Children
  const { data: children } = await supabase
    .from('childprofile')
    .select('id, name, date_of_birth')
    .eq('circle_id', circleId)
  for (const child of children ?? []) {
    for (const [phase, target, days] of targets) {
      const key = getMilestoneKeyForAge(child.date_of_birth, target)
      if (!key) continue
      const label = humanizeMilestoneKey(key)
      upcomingMilestone = {
        scopeType: 'child',
        name: child.name,
        milestoneKey: key,
        phase,
        daysUntil: days,
        milestoneLabelSuggestion: label,
      }
      break
    }
    if (upcomingMilestone) break
  }

  // Anniversary (couple / trip) if no child milestone found
  if (!upcomingMilestone) {
    const { data: circleRow } = await supabase
      .from('circle')
      .select('circle_type, anniversary_date')
      .eq('id', circleId)
      .single()
    if (
      circleRow?.anniversary_date &&
      ['couple', 'friends', 'travel'].includes(circleRow.circle_type)
    ) {
      for (const [phase, target, days] of targets) {
        const year = getAnniversaryYear(circleRow.anniversary_date, target)
        if (!year) continue
        const isCouple = circleRow.circle_type === 'couple'
        upcomingMilestone = {
          scopeType: isCouple ? 'couple' : 'trip',
          name: isCouple ? 'your anniversary' : 'your trip anniversary',
          milestoneKey: isCouple
            ? `anniversary_${year}`
            : `trip_anniversary_${year}`,
          phase,
          daysUntil: days,
          milestoneLabelSuggestion: `${year} years`,
        }
        break
      }
    }
  }
}

// helpers (place at module scope or just inline above the return)
function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function humanizeMilestoneKey(key: string): string {
  if (key.endsWith('mo')) {
    const n = parseInt(key, 10)
    return n === 1 ? '1 month' : `${n} months`
  }
  if (key.endsWith('yr')) {
    const n = parseInt(key, 10)
    return n === 1 ? '1 year' : `${n} years`
  }
  return key
}
```

In the return statement, add these two fields alongside the existing payload:

```ts
return {
  // ... existing fields
  upcomingMilestone,
  milestoneNudgesEnabledForActiveCircle,
}
```

- [ ] **Step 3: Run tests + commit**

```bash
pnpm test
git add server/api/timeline.get.ts
git commit -m "feat(milestones): timeline returns upcomingMilestone + nudges-enabled flag"
```

---

## Task 6: `MilestoneBanner.vue` + UploadMemory pre-fill + i18n

**Files:**

- Create: `app/components/MilestoneBanner.vue`
- Modify: `app/components/UploadMemory.vue` — accept `prefillMilestoneLabel` prop
- Modify: `app/pages/timeline/index.vue` — mount banner, wire to upload sheet
- Modify: `locales/en.json`, `locales/zh-CN.json`, `locales/fr.json`

- [ ] **Step 1: Add i18n keys (en)**

In `locales/en.json`, add a new top-level `milestone` section:

```json
"milestone": {
  "childT-3": "{name} turns {label} in {days} days 🎉",
  "childT0": "Today is {name}'s {label} milestone 🎉",
  "childT+3": "Did you capture {name}'s {label}?",
  "coupleT-3": "Your {years}-year anniversary is in {days} days",
  "coupleT0": "Happy {years} years 🥂",
  "coupleT+3": "Did you celebrate {years} years together?",
  "tripT-3": "Your {years}-year trip anniversary is in {days} days",
  "tripT0": "{years} years since your trip 🌍",
  "tripT+3": "Did you mark {years} years since the trip?",
  "addMemory": "Add a memory",
  "addNow": "Add now",
  "dismiss": "Dismiss"
}
```

- [ ] **Step 2: Add i18n keys (zh-CN)**

In `locales/zh-CN.json`, add:

```json
"milestone": {
  "childT-3": "{name} 还有 {days} 天就 {label} 了 🎉",
  "childT0": "今天是 {name} 的 {label} 🎉",
  "childT+3": "{name} 的 {label} 你拍到了吗？",
  "coupleT-3": "你们的 {years} 周年还有 {days} 天",
  "coupleT0": "{years} 周年快乐 🥂",
  "coupleT+3": "你们庆祝 {years} 周年了吗？",
  "tripT-3": "旅行 {years} 周年还有 {days} 天",
  "tripT0": "这次旅行已经 {years} 年了 🌍",
  "tripT+3": "你们记录了旅行 {years} 周年了吗？",
  "addMemory": "添加记忆",
  "addNow": "现在添加",
  "dismiss": "稍后"
}
```

- [ ] **Step 3: Add i18n keys (fr)**

In `locales/fr.json`, add:

```json
"milestone": {
  "childT-3": "{name} aura {label} dans {days} jours 🎉",
  "childT0": "Aujourd'hui {name} a {label} 🎉",
  "childT+3": "Avez-vous capturé les {label} de {name} ?",
  "coupleT-3": "Vos {years} ans approchent dans {days} jours",
  "coupleT0": "Joyeux {years} ans 🥂",
  "coupleT+3": "Avez-vous célébré vos {years} ans ?",
  "tripT-3": "L'anniversaire de votre voyage de {years} ans est dans {days} jours",
  "tripT0": "{years} ans depuis votre voyage 🌍",
  "tripT+3": "Avez-vous marqué {years} ans depuis le voyage ?",
  "addMemory": "Ajouter un souvenir",
  "addNow": "Ajouter maintenant",
  "dismiss": "Plus tard"
}
```

- [ ] **Step 4: Create the banner component**

Create `app/components/MilestoneBanner.vue`:

```vue
<template>
  <div
    v-if="shouldShow && milestone"
    class="mx-5 mb-4 flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3"
  >
    <div class="mt-0.5 flex-shrink-0">
      <svg
        class="h-5 w-5 text-accent"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        viewBox="0 0 24 24"
      >
        <path d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium leading-snug text-foreground">
        {{ headline }}
      </p>
      <div class="mt-3 flex items-center gap-2">
        <button
          class="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          @click="onAdd"
        >
          {{
            milestone.phase === 'T+3'
              ? t('milestone.addNow')
              : t('milestone.addMemory')
          }}
        </button>
        <button
          v-if="milestone.phase === 'T+3'"
          class="rounded-lg px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          @click="onDismiss"
        >
          {{ t('milestone.dismiss') }}
        </button>
      </div>
    </div>
    <button
      class="flex-shrink-0 p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
      @click="onDismiss"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Milestone {
  scopeType: 'child' | 'couple' | 'trip'
  name: string
  milestoneKey: string
  phase: 'T-3' | 'T0' | 'T+3'
  daysUntil: number
  milestoneLabelSuggestion: string
}

const props = defineProps<{
  milestone: Milestone | null
  enabled: boolean
}>()

const emit = defineEmits<{
  add: [labelSuggestion: string]
}>()

const { t } = useI18n()
const dismissed = ref(false)

const dismissKey = computed(() =>
  props.milestone
    ? `milestone-banner-dismissed-${props.milestone.milestoneKey}`
    : null,
)

watch(
  () => props.milestone?.milestoneKey,
  (key) => {
    if (!key) {
      dismissed.value = false
      return
    }
    dismissed.value =
      import.meta.client &&
      localStorage.getItem(`milestone-banner-dismissed-${key}`) === 'true'
  },
  { immediate: true },
)

const shouldShow = computed(
  () =>
    import.meta.client &&
    props.enabled &&
    props.milestone !== null &&
    !dismissed.value,
)

const headline = computed(() => {
  if (!props.milestone) return ''
  const m = props.milestone
  const key = `milestone.${m.scopeType}${m.phase}`
  if (m.scopeType === 'child') {
    return t(key, {
      name: m.name,
      label: m.milestoneLabelSuggestion,
      days: Math.abs(m.daysUntil),
    })
  }
  // couple / trip
  return t(key, {
    years: m.milestoneLabelSuggestion.replace(/\D/g, ''),
    days: Math.abs(m.daysUntil),
  })
})

function onAdd() {
  if (!props.milestone) return
  emit('add', props.milestone.milestoneLabelSuggestion)
  // Don't auto-dismiss — let the upload completion clear it naturally next reload
}

function onDismiss() {
  dismissed.value = true
  if (dismissKey.value) localStorage.setItem(dismissKey.value, 'true')
}
</script>
```

- [ ] **Step 5: Add `prefillMilestoneLabel` prop to UploadMemory.vue**

In `app/components/UploadMemory.vue`, find the `defineProps` block. Add `prefillMilestoneLabel?: string` to the props. When the upload sheet opens (existing watcher on `items` count from 0 → >0, or whatever the existing trigger is), set the relevant `milestoneLabel` field to this value if it's set. Apply it to:

- the per-item milestone label fields (single + multi mode)
- the group milestone label field (multi mode "post as one memory")

Search for "milestoneLabel" in the file to find the existing fields. The change is one-line per call site:

```ts
item.milestoneLabel = props.prefillMilestoneLabel ?? ''
```

For the group field:

```ts
groupMilestoneLabel.value = props.prefillMilestoneLabel ?? ''
```

- [ ] **Step 6: Wire MilestoneBanner into timeline page**

In `app/pages/timeline/index.vue`, mount the banner where the other banners are (look for `<PushPromptBanner />` and `<InstallPromptBanner />`):

```vue
<MilestoneBanner
  :milestone="timelineData?.upcomingMilestone ?? null"
  :enabled="timelineData?.milestoneNudgesEnabledForActiveCircle ?? true"
  @add="onMilestoneAdd"
/>
<PushPromptBanner />
<InstallPromptBanner />
```

Add a ref + handler in script setup:

```ts
const prefillMilestoneLabel = ref<string | undefined>(undefined)
const uploadOpenSignal = ref(0)

function onMilestoneAdd(labelSuggestion: string) {
  prefillMilestoneLabel.value = labelSuggestion
  uploadOpenSignal.value++
}
```

Pass `:prefillMilestoneLabel="prefillMilestoneLabel"` and a v-model or open trigger to the existing `<UploadMemory />` component. Read the file first to see how the upload sheet is currently triggered — adapt accordingly. The simplest approach: emit an event from MilestoneBanner that bubbles up to whatever currently opens the upload sheet, plus pass the prefill prop.

If `<UploadMemory>` lives elsewhere, extract a method on its ref:

```ts
const uploadRef = ref<InstanceType<typeof UploadMemory> | null>(null)
// ... after onMilestoneAdd, call uploadRef.value?.openWith({ milestoneLabel: labelSuggestion })
```

Either approach works; pick whichever fits the existing pattern. Document in commit message which approach was taken.

- [ ] **Step 7: Run tests + commit**

```bash
pnpm test
git add app/components/MilestoneBanner.vue \
        app/components/UploadMemory.vue \
        app/pages/timeline/index.vue \
        locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(milestones): in-app banner + upload-sheet prefill + i18n"
```

---

## Task 7: Notification settings toggle + circle settings anchor-date

**Files:**

- Modify: `app/pages/notification-settings.vue`
- Modify: `app/pages/circle-settings.vue`
- Modify: `server/api/notification-preferences.get.ts`
- Modify: `server/api/notification-preferences.patch.ts`
- Modify: `unit/api-validation.test.ts`
- Modify: `locales/en.json`, `locales/zh-CN.json`, `locales/fr.json`

- [ ] **Step 1: Update GET /api/notification-preferences to return new field**

Read `server/api/notification-preferences.get.ts`. Add `milestone_nudges_enabled` to the SELECT and return value, with default `true` when no row exists.

```ts
// In the supabase select:
.select("push_enabled, circle_muted, email_digest_frequency, milestone_nudges_enabled")
// In the return:
return {
  push_enabled: data?.push_enabled ?? true,
  circle_muted: data?.circle_muted ?? false,
  email_digest_frequency: data?.email_digest_frequency ?? "monthly",
  milestone_nudges_enabled: data?.milestone_nudges_enabled ?? true,
}
```

- [ ] **Step 2: Update PATCH /api/notification-preferences to accept new field**

Read `server/api/notification-preferences.patch.ts`. Add `milestone_nudges_enabled: z.boolean().optional()` to the zod schema. In the upsert payload, add `milestone_nudges_enabled` if defined.

- [ ] **Step 3: Add zod tests for the new field**

In `unit/api-validation.test.ts`, append to the notification-preferences PATCH section:

```ts
it('accepts milestone_nudges_enabled boolean', () => {
  const r = notificationPrefsSchema.safeParse({
    circleId: VALID_CIRCLE_UUID,
    milestone_nudges_enabled: false,
  })
  expect(r.success).toBe(true)
})

it('rejects non-boolean milestone_nudges_enabled', () => {
  const r = notificationPrefsSchema.safeParse({
    circleId: VALID_CIRCLE_UUID,
    milestone_nudges_enabled: 'no',
  })
  expect(r.success).toBe(false)
})
```

(Adapt the schema reference to match how the existing tests are structured. If the schema isn't already exported/referenced by `notificationPrefsSchema` in that file, copy the schema inline as the existing tests do.)

- [ ] **Step 4: Add toggle UI to /notification-settings page**

In `app/pages/notification-settings.vue`, find the existing two toggles (push_enabled, circle_muted) and the digest segmented control. Add a third toggle:

```vue
<!-- Milestone reminders toggle -->
<label class="flex cursor-pointer items-center justify-between gap-3">
  <div>
    <p class="text-sm font-medium text-foreground">{{ t('notificationSettings.milestoneNudges') }}</p>
    <p class="text-xs text-muted-foreground mt-0.5">{{ t('notificationSettings.milestoneNudgesDesc') }}</p>
  </div>
  <input
    type="checkbox"
    :checked="milestoneNudgesEnabled"
    class="w-5 h-5 rounded border-border accent-primary cursor-pointer"
    @change="toggleMilestoneNudges"
  />
</label>
```

Add to the script setup:

```ts
const milestoneNudgesEnabled = ref(true)

// In loadPrefs(): also set this from data
milestoneNudgesEnabled.value = data.milestone_nudges_enabled

// Where defaults are reset on error: also reset this
milestoneNudgesEnabled.value = true

function toggleMilestoneNudges() {
  milestoneNudgesEnabled.value = !milestoneNudgesEnabled.value
  savePref({ milestone_nudges_enabled: milestoneNudgesEnabled.value })
}
```

Add i18n keys:

`locales/en.json` under `notificationSettings`:

```json
"milestoneNudges": "Milestone reminders",
"milestoneNudgesDesc": "Get nudged about upcoming birthdays, anniversaries, and milestones."
```

`locales/zh-CN.json`:

```json
"milestoneNudges": "里程碑提醒",
"milestoneNudgesDesc": "在生日、纪念日等里程碑临近时收到提醒。"
```

`locales/fr.json`:

```json
"milestoneNudges": "Rappels de jalons",
"milestoneNudgesDesc": "Recevez un rappel pour les anniversaires et autres jalons à venir."
```

- [ ] **Step 5: Generalise circle-settings anchor-date input**

In `app/pages/circle-settings.vue`, find the `circle.circle_type === 'couple'` gating around the `anniversary_date` input. Change it to allow `couple`, `friends`, and `travel`. Also adapt the label per circle_type.

```vue
<div v-if="['couple', 'friends', 'travel'].includes(circle.circle_type)">
  <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
    {{ circle.circle_type === 'couple' ? t('circleSettings.anniversaryDate') : t('circleSettings.tripDate') }}
  </h2>
  <p class="text-xs text-muted-foreground mb-4">
    {{ circle.circle_type === 'couple' ? t('circleSettings.anniversaryDateDesc') : t('circleSettings.tripDateDesc') }}
  </p>
  <!-- existing input + save button -->
</div>
```

Add new keys:

`locales/en.json` under `circleSettings`:

```json
"tripDate": "Trip date",
"tripDateDesc": "When did this group first travel together? Used for milestone reminders."
```

`locales/zh-CN.json`:

```json
"tripDate": "旅行日期",
"tripDateDesc": "这个团体第一次一起旅行是什么时候？用于里程碑提醒。"
```

`locales/fr.json`:

```json
"tripDate": "Date du voyage",
"tripDateDesc": "Quand ce groupe a-t-il voyagé ensemble pour la première fois ? Utilisé pour les rappels de jalons."
```

(Add `anniversaryDate` and `anniversaryDateDesc` keys if they don't already exist — match existing copy.)

- [ ] **Step 6: Run tests + commit**

```bash
pnpm test
git add app/pages/notification-settings.vue \
        app/pages/circle-settings.vue \
        server/api/notification-preferences.get.ts \
        server/api/notification-preferences.patch.ts \
        unit/api-validation.test.ts \
        locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(milestones): notification + circle settings UI for milestone nudges"
```

---

## Task 8: Build plan + design spec docs

**Files:**

- Modify: `docs/build-plan.md`
- Modify: `docs/design-spec.md`

- [ ] **Step 1: Mark 12.2 complete in build plan**

Replace the `- [ ] 12.2 Milestone suggestions...` line with:

```
- [x] 12.2 Milestone suggestions — triple-nudge (T-3, T+0, T+3) for child age + couple/friend/travel anniversaries *(implementation complete — pg_cron pending manual setup in Supabase Studio)*
  - Migration 031: MilestoneNudge tracking table; Migration 032: milestone_nudges_enabled preference; Migration 033: anniversary_date COMMENT generalised
  - Channels: push (if subscribed) → email (fallback) → in-app banner (always when in window)
  - Recipients: circle owner + admins only
  - T+3 skip rule: skip if any memory with non-null milestone_label in ±3 day window
  - In-app: MilestoneBanner.vue on /timeline; click opens upload with milestone label pre-filled
  - Reuses Circle.anniversary_date for couple/friends/travel anchor (no new column)
  - Locales: en, zh-CN, fr
  - Manual setup remaining: schedule send-milestone-nudges in Supabase Studio
  - Tests: unit (calendar math, email builders), schema compliance (migrations 031/032/033), RLS, E2E (banner)
  - See spec: docs/superpowers/specs/2026-05-09-milestone-suggestions-design.md
```

- [ ] **Step 2: Add cross-reference to design spec Hook 2**

In `docs/design-spec.md`, find `### Hook 2: Milestone suggestions (proactive, date-driven)` (around line 3720). Append at the end of the section:

```
**[Implemented §12.2]** — Edge Function `send-milestone-nudges` runs daily at 9am UTC. Channel selection: push if subscribed → email fallback → in-app banner (always). T+3 skip rule based on `milestone_label IS NOT NULL` in ±3 day window. Recipients: owner + admins only. New `MilestoneNudge` table (migration 031) ensures dedupe. New `milestone_nudges_enabled` preference (migration 032) gives users a granular toggle separate from `circle_muted`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/build-plan.md docs/design-spec.md
git commit -m "docs: mark 12.2 complete, cross-reference milestone implementation"
```

---

## Verification (after all tasks)

- [ ] `pnpm db:reset && pnpm db:test` passes (RLS)
- [ ] `pnpm test` passes (unit) — including new `unit/milestoneCron.test.ts` and `unit/milestoneEmail.test.ts`
- [ ] Manual smoke: create child with DOB 6 months ago today, curl `POST /functions/v1/send-milestone-nudges`, verify console output `[dev] milestone email to <addr>: Mia is 6 months old today 🎉`
- [ ] Manual: timeline shows MilestoneBanner with correct phase (T-3 / T+0 / T+3) for the matching window
- [ ] Manual: click banner "Add a memory" → upload sheet opens with milestone field pre-filled
- [ ] Manual: notification-settings page shows "Milestone reminders" toggle; flipping it off causes the banner to hide and the cron to skip the user
- [ ] Manual: circle-settings page shows "Trip date" input for friends/travel circles (was hidden before)
- [ ] Manual: idempotency — run the cron twice in a row, second run reports `sent: 0, skipped: N`

## Deferred / known issues

- **pg_cron schedule** must be added manually in Supabase Studio post-deploy
- **Quiet hours rescheduling** — push silently skipped during quiet hours, no deferred queue
- **Friend-group "no upload in 14 days" nudge** — separate retention hook (12.4 quiet circle nudge), not a milestone
- **Custom user-defined milestones** — only auto-calculated dates from ChildProfile + anniversary_date
