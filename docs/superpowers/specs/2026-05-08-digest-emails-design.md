# 12.1 — Weekly + Monthly Digest Emails

## Overview

Send a periodic activity digest email to circle members summarising new memories. Two cadences (weekly Monday 9am UTC, monthly 1st 9am UTC) driven by the user's `NotificationPreference.email_digest_frequency` setting (default `monthly`). Members only — viewer-link recipients are out of scope (no email captured). Designed grandparent-first: hero image, thumbnail grid, single "Open Our Story" CTA.

## Decisions

- **Members only.** View-only viewers don't have account/email — out of scope.
- **Both cadences in one Edge Function** (`send-digest?frequency=weekly|monthly`) — 95% shared logic.
- **Respect `NotificationPreference`:** skip if `circle_muted = true`; skip if `email_digest_frequency != frequency_being_sent`. (Default is `'monthly'` from §10.3, so most users land on monthly.)
- **Skip zero-upload digests entirely.** No memories in the period → no email. Quiet-circle nudge (§12.4) handles re-engagement separately, owner-only with caps.
- **Login-redirect for reactions, not signed JWTs.** Email links go to `/timeline?circle=X&memory=Y`; auth middleware handles redirect-to-login if needed. CTA copy: "Open Our Story to react ❤️". No new server endpoints.
- **Inline HTML templates** following existing `server/utils/email.ts` pattern (the design spec mentions React Email but current code uses HTML template literals — keep the existing pattern).
- **Idempotency via `last_*_digest_sent_at` columns** on Circle — avoid duplicate sends if cron retries.

## 1. Schedule

Two pg_cron jobs, both invoking the same Edge Function with a `frequency` query parameter:

```sql
-- Weekly: every Monday at 9am UTC
SELECT cron.schedule(
  'send-weekly-digest',
  '0 9 * * 1',
  $$SELECT net.http_post(
    url := '<project-url>/functions/v1/send-digest?frequency=weekly',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )$$
);

-- Monthly: 1st of every month at 9am UTC
SELECT cron.schedule(
  'send-monthly-digest',
  '0 9 1 * *',
  $$SELECT net.http_post(
    url := '<project-url>/functions/v1/send-digest?frequency=monthly',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )$$
);
```

The cron schedules are documented in the migration file (commented) but **not auto-applied** — they're set up manually in Supabase Studio (same pattern as `purge-deleted-users`). This avoids requiring `pg_cron` setup in local dev.

## 2. Edge Function: `send-digest`

**Path:** `supabase/functions/send-digest/index.ts`

**Signature:** Reads `?frequency=weekly|monthly` from URL.

**Logic:**

```
1. Parse frequency from query string. Reject anything except 'weekly' or 'monthly' with 400.
2. Compute period:
   - weekly: now() - 7 days
   - monthly: now() - 30 days
3. For each Circle where deleted_at IS NULL:
   a. Skip if last_<frequency>_digest_sent_at is within last 6 days (weekly) / 25 days (monthly) — idempotency guard
   b. Query memories in the period: SELECT id, memory_date, note, milestone_label, memorymedia(thumbnail signed url, media_type)
      FROM memory WHERE circle_id = X AND created_at >= period_start
      ORDER BY (reactions count) DESC, created_at DESC LIMIT 6
   c. If memories.length === 0 → skip this circle (no zero-upload variant)
   d. Find recipients:
      SELECT user.id, user.email, user.first_name, user.locale
      FROM circlemember
      JOIN user ON user.id = circlemember.user_id
      LEFT JOIN notificationpreference np ON np.user_id = user.id AND np.circle_id = circle.id
      WHERE circlemember.circle_id = X
        AND user.deletion_requested_at IS NULL
        AND COALESCE(np.circle_muted, false) = false
        AND COALESCE(np.email_digest_frequency, 'monthly') = $1  -- the cron's frequency
   e. For each recipient: build email (locale-aware) + send via Resend (fire-and-forget)
   f. UPDATE circle SET last_<frequency>_digest_sent_at = now() WHERE id = X
4. Return { ok: true, sent: N, skipped: M }
```

**Failure tolerance:** Per-circle and per-recipient errors are caught and logged; one bad row never aborts the whole run.

## 3. Email Template

New functions in `server/utils/email.ts`:

```ts
buildWeeklyDigestEmail(opts: DigestEmailOpts): { subject, html }
buildMonthlyDigestEmail(opts: DigestEmailOpts): { subject, html }

interface DigestEmailOpts {
  recipientFirstName: string
  circleName: string
  childName: string | null  // first ChildProfile if any (parents circles); null otherwise
  childAge: string | null   // computed via useBabyAge for the digest period midpoint
  memories: Array<{
    id: string
    note: string | null
    milestoneLabel: string | null
    thumbnailUrl: string  // signed URL, 7-day expiry
    isVideo: boolean
  }>
  totalCount: number       // memories.length (for "+N more" if > 6)
  appUrl: string           // /timeline?circle=<id>
  unsubscribeUrl: string   // /notification-settings
  locale: 'en' | 'zh-CN' | 'fr'
}
```

**Subject lines (en):**
- Weekly with child: `"{Child name} this week — {N} new memories"`
- Weekly without child: `"The {Circle name} added {N} memories this week"`
- Monthly with child: `"{Child name}'s {Month} — {N} memories"`
- Monthly without child: `"{Circle name}'s memories from {Month}"`

**Body structure:**

```
[Circle name wordmark]

Hello {firstName},

[Hero image — first memory thumbnail, full width]

{Child name} · {Age}        ← only if child exists

This week, {Circle name} shared {N} new memor{y/ies}.

[Memory thumb 1] [Memory thumb 2] [Memory thumb 3]
[Memory thumb 4] [Memory thumb 5] [Memory thumb 6]
                                                    Each is <a href={app/timeline?circle=X&memory=Y}>

[Open Our Story to react ❤️] ← primary button → /timeline?circle=X

You're receiving this because you're a member of {Circle name}.
Adjust your email preferences here.   ← link to /notification-settings
```

Locales `zh-CN` and `fr` follow the same translation pattern used in existing email functions.

## 4. Database Changes

Migration `028_circle_digest_tracking.sql`:

```sql
ALTER TABLE Circle
  ADD COLUMN last_weekly_digest_sent_at TIMESTAMPTZ,
  ADD COLUMN last_monthly_digest_sent_at TIMESTAMPTZ;
```

No RLS changes (these columns are written only by the service-role Edge Function and never exposed to clients).

Index already covers `circle_id` lookups; no new index needed.

## 5. Frontend Changes

None for the digest send itself. The existing `/notification-settings` page (§10.3) already lets users change `email_digest_frequency` between `weekly`, `monthly`, and `off` — that's the unsubscribe path.

The email's "Adjust your email preferences" link points to `/notification-settings`.

## 6. Edge Cases & Guards

- **User soft-deleted** (`deletion_requested_at IS NOT NULL`) — excluded from recipients
- **Circle soft-deleted** (`deleted_at IS NOT NULL`) — excluded
- **Recipient has `email_digest_frequency = 'off'`** — excluded
- **Circle muted by recipient** — excluded
- **Cron retry / re-run** — `last_<frequency>_digest_sent_at` guard prevents duplicate sends within the period
- **No `Resend` API key in dev** — existing `sendEmail` falls back to `console.log`, so dev runs are safe
- **Recipient has no `first_name`** — fall back to "Hi there" / locale equivalent
- **Memory's media has expired thumbnail URL** — signed at email send time with 7-day TTL (matches typical email open window)
- **Best photo selection ranking** — `ORDER BY (reactions count) DESC, created_at DESC LIMIT 6`. The first row in the result is used as the hero image; the next 5 fill the thumbnail grid. If no reactions exist across all memories, the most recent memory becomes the hero.

## 7. Testing

- **Unit tests** (`unit/digestEmail.test.ts`):
  - Subject line generation for both frequencies × with/without child × all 3 locales (12 cases)
  - Recipient filter logic: muted + frequency mismatch + soft-deleted user/circle exclusion (table-driven test)
  - Idempotency window math (weekly = 6-day skip threshold; monthly = 25-day)
- **Schema compliance** test: migration 028 adds the two columns
- **No E2E**: cron-driven; manually verifiable by triggering the function via curl in dev with `RESEND_API_KEY` unset (should log emails to console)
- **Manual verification path** documented in build plan: invoke `curl <fn-url>?frequency=weekly` against local Supabase, confirm console output for one circle

## 8. Build Plan & Design Spec Updates

- Mark 12.1 as `*(implementation complete — pending production cron setup in Supabase Studio)*`
- Add note to design spec §3850 ("Weekly digest") cross-referencing the actual implementation
- Note in spec §1252 (Email notifications): templates are inline HTML, not React Email — `server/utils/email.ts`. Update the spec to reflect actual implementation (or fix later if React Email migration ever happens)

## Out of Scope

- Viewer-link recipient digests (no email captured for viewers — Phase 2 if it becomes important)
- Daily digest option (dropped in §10.3)
- Quiet-circle re-engagement nudge (§12.4 — separate, owner-only with caps)
- Local-time scheduling (everyone gets 9am UTC; refine later if data shows engagement issues)
- React Email template migration (existing inline-HTML pattern preserved)
- "On This Day" memory inclusion in digests (separate §10.2 feature)
- A/B testing subject lines (manual judgement only at Phase 1 scale)
