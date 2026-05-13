# 10.2 — On This Day Daily Cron

## Overview

Daily Edge Function that surfaces nostalgia memories from past years to all circle members. Two branches:

- **Above threshold** (`memory_count >= 30 AND first_memory_at <= now() - 90 days`) — find any memory whose `memory_date` matches today's MM-DD from a past year; send daily push notification.
- **Below threshold** — substitute a _"A memory from your first month"_ notification (oldest memory in circle), sent max once per week.

This is the spec's "#1 retention driver." The in-app carousel surface is explicitly Phase 3; only push + below-threshold email are in scope for Phase 1.

## Decisions

- **Schedule:** daily at 9am UTC. pg_cron manual setup.
- **Recipients:** all circle members (nostalgia is communal). Skip muted (`circle_muted = true`).
- **Above-threshold channel:** **push only**. No email fallback — daily emails would be excessive (365/year). Users without push subscriptions miss above-threshold On This Day; they still get the weekly digest (§12.1) and other channels.
- **Below-threshold channel:** **push if subscribed, email fallback** — weekly cadence is appropriate for email.
- **Multiple matches in past years:** pick the **oldest** matching memory. Send one push per circle per day. Deep-link opens the timeline at that memory; user can scroll to see others.
- **No tier check** — build for all users in Phase 1. Plus gate added in Phase 2 alongside Stripe billing.
- **Locales:** en, zh-CN, fr.
- **No in-app banner** — Phase 3.

## 1. Schedule

```sql
SELECT cron.schedule(
  'send-on-this-day',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-on-this-day',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
);
```

Manual setup in Supabase Studio.

## 2. Edge Function

**Path:** `supabase/functions/send-on-this-day/index.ts`

### Flow

```
1. Compute thresholds:
   ninetyDaysAgo = now() - 90 days
   thisYear, todayMonth, todayDay = current date parts (UTC)
   sevenDaysAgo = now() - 7 days  (below-threshold weekly cap)

2. Query all candidate circles (one query, two filters applied per row):
   SELECT id, name, memory_count, first_memory_at,
          last_first_month_memory_sent_at
   FROM circle
   WHERE deleted_at IS NULL
     AND first_memory_at IS NOT NULL

3. For each circle, classify:
   isAboveThreshold = (memory_count >= 30) AND (first_memory_at <= ninetyDaysAgo)

   3a. Above threshold (daily push only):
       - Query memory WHERE circle_id = c.id
                          AND EXTRACT(month FROM memory_date) = todayMonth
                          AND EXTRACT(day FROM memory_date) = todayDay
                          AND EXTRACT(year FROM memory_date) < thisYear
         ORDER BY memory_date ASC LIMIT 1
       - If no match → skip
       - Compute yearsAgo = thisYear - EXTRACT(year FROM memory.memory_date)
       - Build push (title, body, deep_link) via locale-aware helper
       - For each circle member: skip if circle_muted, send push if push_enabled + has subscription + not in quiet hours
       - No counter update needed (push tag dedupes browser-side)

   3b. Below threshold (weekly fallback):
       - If last_first_month_memory_sent_at > sevenDaysAgo → skip
       - Query the oldest memory: SELECT * FROM memory WHERE circle_id = c.id
         ORDER BY memory_date ASC LIMIT 1
       - For each circle member: skip if circle_muted; try push → email fallback;
         email skipped if email_digest_frequency = 'off'
       - After all sends: UPDATE circle SET last_first_month_memory_sent_at = now()

4. Return { ok, sent, skipped, errors }
```

### Idempotency

- **Above threshold:** push tag (`onthisday-{circleId}-{memoryId}`) means a second push on the same day silently replaces the first in the browser. Acceptable — no DB update needed.
- **Below threshold:** `last_first_month_memory_sent_at` enforces 7-day floor. Updated only after attempting all recipients (not per-recipient).

### Failure tolerance

Per-circle and per-recipient errors caught and logged.

## 3. Push payloads

### Above threshold

```json
{
  "title": "On this day, {yearsAgo} years ago",
  "body": "{firstName} added a memory" or "{memoryNote truncated}",
  "tag": "onthisday-{circleId}-{memoryId}",
  "renotify": true,
  "data": { "url": "/timeline?circle={circleId}&memory={memoryId}" }
}
```

Title locales:

- en: `"On this day, {yearsAgo} year{s} ago"` (handles singular for 1 year)
- zh-CN: `"{yearsAgo} 年前的今天"`
- fr: `"Il y a {yearsAgo} an{s} aujourd'hui"`

Body locales:

- en: memory note truncated to 80 chars, fallback: `"{firstName} added a memory"`
- zh-CN: same, fallback: `"{firstName} 添加了一条记忆"`
- fr: same, fallback: `"{firstName} a ajouté un souvenir"`

### Below threshold

```json
{
  "title": "A memory from your first month",
  "body": "{firstName} added a memory" or "{memoryNote truncated}",
  "tag": "first-month-memory-{circleId}",
  "renotify": true,
  "data": { "url": "/timeline?circle={circleId}&memory={memoryId}" }
}
```

Same pattern as above for locale variants.

## 4. Email template (below-threshold only)

New builder in `server/utils/email.ts`:

```ts
buildFirstMonthMemoryEmail(opts: {
  recipientFirstName: string
  circleName: string
  uploaderName: string
  memoryNote: string | null
  memoryDate: string
  memoryThumbnailUrl: string | null
  appUrl: string                // /timeline?circle=<id>&memory=<memId>
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}): { subject: string; html: string }
```

### Subject (en)

`"A memory from your first month with {circleName}"`

Locales translated.

### Body

```
Hi {recipientFirstName},

Here's a memory from your circle's earliest days.

[Hero image: thumbnail if present]
"{memoryNote}"    ← if not null
{uploaderName} · {memoryDate}

[Open in Our Story →]

You're receiving this because you're a member of {circleName}.
Adjust your email preferences here.
```

## 5. Database changes

### Migration 034: `last_first_month_memory_sent_at` column

```sql
-- 034_on_this_day_tracking.sql
-- Track the last time a "memory from your first month" fallback was sent for a circle,
-- to enforce the once-per-week cap when the circle is below the On This Day threshold.

ALTER TABLE public.Circle
  ADD COLUMN last_first_month_memory_sent_at TIMESTAMPTZ;
```

No new RLS — service-role-only writes from the Edge Function. Owner-only reads not needed (this column is internal cron state, never exposed to clients).

## 6. Edge cases & guards

- **Circle with `first_memory_at IS NULL`** → excluded (no memories at all)
- **Soft-deleted circle** → excluded
- **All-time memory_count is 30+ but `first_memory_at` is recent (e.g., circle created yesterday with 30 imported memories on the same day)** → still below threshold per `first_memory_at <= now() - 90 days`. The 90-day gate guarantees enough historical breadth, not just count.
- **Memory match falls on the same calendar year as today** → excluded by `EXTRACT(year FROM memory_date) < thisYear`. We only surface memories from _past_ years.
- **Leap day (Feb 29)** → memories with `memory_date = Feb 29` only match on actual Feb 29s. We accept this — no Feb 28 fallback for the above-threshold case. (For Feb 29 birthday anniversaries, see §12.2 milestones.)
- **No reaction-based ranking** — pick by oldest year, not most-reacted. Simplest and most nostalgic.
- **Quiet hours** — skip push silently for both branches (consistent with §12.2, §12.4)
- **No push subscriptions for any member** of an above-threshold circle → silently skip (no email fallback for daily)
- **Email digest off** → skip email fallback for below-threshold variant

## 7. Testing

### Unit tests

- `unit/onThisDayCopy.test.ts` — push title/body locale variants, year pluralisation, note truncation, fallback when note is null
- `unit/firstMonthMemoryEmail.test.ts` — subject + body + locale variants

### Schema compliance

- `unit/schema-compliance.test.ts` — verify migration 034 adds the column

### No new RLS tests

- New column has no RLS surface (service-role only).

### Manual verification

1. Create a circle with `first_memory_at` 100 days ago, `memory_count = 35`. Insert a memory with `memory_date` exactly 1 year ago today (matching MM-DD).
2. Trigger: `curl -X POST $SUPABASE_URL/functions/v1/send-on-this-day -H "Authorization: Bearer $SERVICE_ROLE_KEY"`
3. Verify push log: `[dev] on-this-day push to user_X: On this day, 1 year ago`
4. Trigger again: push tag dedupes browser-side (no DB change to verify, but no error).
5. Below-threshold test: set `memory_count = 5` on a circle with `first_memory_at` 30 days ago, `last_first_month_memory_sent_at = NULL`. Trigger.
6. Verify push or email log: `[dev] first-month-memory push/email to user_X`
7. Verify `last_first_month_memory_sent_at = now()` after run.
8. Re-trigger within 7 days: confirm circle excluded.

## 8. Out of Scope

- **In-app On This Day carousel** — Phase 3 (per spec §3914)
- **Local-timezone-aware scheduling** — 9am UTC for all; Phase 2 polish
- **Reaction-ranked memory selection** — pick by oldest year, not most-reacted
- **Plus tier gate** — Phase 1 builds for all users; Plus gate is Phase 2 work alongside Stripe
- **Multiple pushes for multiple year matches** — one push per circle per day, oldest match
- **Per-recipient send tracking** — circle-level tracking only

## 9. Build Plan & Design Spec Updates

- Build plan §10.2 → mark complete with implementation notes
- Design spec § On This Day → append `**[Implemented §10.2]**` cross-reference

## 10. Build order

1. Migration 034 + schema-compliance test
2. Push copy helpers + email builder (TDD, single test file each)
3. Edge Function `send-on-this-day` + Deno mirrors
4. Docs
