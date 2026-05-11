# 12.3 — "Your First Month" Recap Email

## Overview

Send a one-time recap email 30 days after a circle's first memory upload. The email is a positive, nostalgic "look how far you've come" moment: it surfaces the original first memory, summarises the month's activity, and prompts the user to add another memory or invite someone new.

This single email implements both build plan items 12.3 (first-memory anniversary) and 12.3.1 (recap email) — they're the same send per the design spec §7.5.

## Decisions

- **One-time send per circle** — gated by `Circle.first_month_email_sent`. Once set, never retried.
- **Detection window:** `first_memory_at BETWEEN now() - 31 days AND now() - 29 days` (3-day window catches missed cron runs).
- **Recipients:** all circle members (not just owner/admins) — this is a celebration moment for the whole circle, sent once per circle's lifetime.
- **Notification preference filter:** skip recipient if `circle_muted = true` OR `email_digest_frequency = 'off'`. Respect the same opt-out signals as 12.1/12.2.
- **Schedule:** daily at 9am UTC. pg_cron manual setup, same pattern as `send-digest`, `send-milestone-nudges`.
- **No-reactions fallback:** if no reactions exist in the first month, omit the "most-reacted memory" section entirely. Don't substitute another memory.
- **Locales:** en, zh-CN, fr — same coverage as existing emails.

## 1. Schedule

```sql
SELECT cron.schedule(
  'send-first-month-recap',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-first-month-recap',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
);
```

Manual setup in Supabase Studio (same pattern as the other crons).

## 2. Edge Function

**Path:** `supabase/functions/send-first-month-recap/index.ts`

### Flow

```
1. Query candidate circles:
   SELECT id, name, first_memory_at
   FROM circle
   WHERE first_memory_at >= now() - INTERVAL '31 days'
     AND first_memory_at <= now() - INTERVAL '29 days'
     AND first_month_email_sent = false
     AND deleted_at IS NULL

2. For each circle:
   a. Compute stats:
      - memoryCount: COUNT(memory WHERE circle_id = c.id AND created_at >= c.first_memory_at)
      - milestoneCount: COUNT(memory WHERE circle_id = c.id AND milestone_label IS NOT NULL)
      - topReactionMemoryId, topReactionCount: GROUP BY memory_id from memoryreaction
        WHERE circle_id = c.id ORDER BY count DESC LIMIT 1 (null if none)

   b. Fetch first memory (full row: id, note, memory_date, owner_user_id, milestone_label,
      first MemoryMedia thumbnail signed URL, owner first_name)

   c. Fetch all circle members (excluding deleted users without email).
      For each member, check NotificationPreference: skip if circle_muted OR email_digest_frequency = 'off'.
      Use member's locale.

   d. Build email via buildFirstMonthRecapEmail(opts) and send via Resend.

   e. After all sends complete: UPDATE circle SET first_month_email_sent = true WHERE id = c.id.

3. Return { ok, sent, skipped, errors }
```

### Idempotency

- The query filter `AND first_month_email_sent = false` is the primary guard.
- If the cron runs twice in the same day, the second run finds zero candidates because the first run already set the flag.
- If the cron fails mid-send (some recipients got emails, some didn't), the flag is NOT set — next day's cron retries the whole circle. Recipients who already got the email may receive a duplicate. **Trade-off accepted for Phase 1:** a duplicate "Your First Month" email is mildly annoying but not harmful, and tracking per-recipient state would add a per-recipient table just for one-shot use.

### Failure tolerance

Per-circle errors are caught and logged. One bad circle doesn't abort the run.

## 3. Email Template

New builder in `server/utils/email.ts`:

```ts
buildFirstMonthRecapEmail(opts: {
  recipientFirstName: string
  circleName: string
  firstMemoryUploaderName: string
  firstMemoryNote: string | null
  firstMemoryDate: string
  firstMemoryThumbnailUrl: string | null
  memoryCount: number
  milestoneCount: number
  topReactionMemoryThumbnailUrl: string | null  // null if no reactions
  topReactionMemoryNote: string | null
  topReactionEmoji: string | null
  topReactionCount: number | null
  appUrl: string                // /timeline?circle=<id>
  inviteUrl: string             // /timeline?circle=<id>&invite=1 (or wherever invite flow lives)
  unsubscribeUrl: string        // /notification-settings
  locale: 'en' | 'zh-CN' | 'fr'
}): { subject: string; html: string }
```

### Subject lines (en)

- `"Your first month with {circleName} 💛"`

Localised to zh-CN and fr.

### Body structure

```
[Our Story wordmark]

Hi {recipientFirstName},

One month ago, {firstMemoryUploaderName} added your first memory to {circleName}.

[Hero image: first memory thumbnail, full width, with date underneath]
"{firstMemoryNote}"           ← if not null

In one month:
  📸 {memoryCount} memories
  ✨ {milestoneCount} milestones marked
  ❤️ {topReactionEmoji} {topReactionCount}     ← if topReactionMemoryId is not null

[Add another memory → button]
[Invite someone who hasn't joined →]

You're receiving this because you're a member of {circleName}.
Adjust your email preferences here.
```

## 4. Database Changes

None. The `first_memory_at` (timestamptz) and `first_month_email_sent` (bool, default false) columns already exist in migration 004 on the `Circle` table. The `handle_memory_insert` trigger already populates `first_memory_at` via `COALESCE(first_memory_at, now())`.

## 5. Edge Cases & Guards

- **Soft-deleted circle** (`deleted_at IS NOT NULL`) → filter excludes
- **Circle with no memories** (`first_memory_at IS NULL`) → filter excludes
- **Empty milestone count** → show `0` in stats (acceptable; the "1 month ago" anchor is the focus, not the stats)
- **Empty memory count** → impossible by construction (`first_memory_at` only set when there's at least 1 memory)
- **Recipient has no email** → skip
- **Recipient soft-deleted** (`deletion_requested_at IS NOT NULL`) → skip
- **No `RESEND_API_KEY` in dev** → existing `sendEmail` falls back to `console.log` → safe to run locally

## 6. Testing

### Unit tests (`unit/firstMonthRecapEmail.test.ts`)
- Subject line generation × en/zh-CN/fr (3 cases)
- Body content for `topReactionMemoryId = null` (no reactions section)
- Body content with reactions section
- Recipient name fallback when `recipientFirstName` is empty
- Memory count + milestone count rendering

### No new RLS tests
- The Edge Function uses service role; no new tables.

### No new schema-compliance tests
- No new migrations.

### Manual verification
1. Set a circle's `first_memory_at` to exactly 30 days ago in Supabase Studio
2. Set `first_month_email_sent = false`
3. Trigger: `curl -X POST $SUPABASE_URL/functions/v1/send-first-month-recap -H "Authorization: Bearer $SERVICE_ROLE_KEY"`
4. Verify console output: `[dev] first-month recap to grandma@example.com: Your first month with...`
5. Verify `first_month_email_sent = true` after run
6. Re-run: confirm `{ sent: 0, skipped: 0 }` (no candidates)

## 7. Out of Scope

- **Year in Review** — Phase 2/3 feature (§8). Different email, different cadence, different design.
- **Shareable card from the recap** — Phase 2 feature alongside the Year in Review card system.
- **Per-recipient send tracking** — Phase 1 trade-off: one duplicate-send risk on mid-batch failure is acceptable.
- **Localised time-of-day** — everyone receives at 9am UTC regardless of timezone.
- **A/B testing copy** — Phase 2.

## 8. Build Plan & Design Spec Updates

**Build plan §12.3 and §12.3.1** should both be marked complete (they're the same send). Add cross-reference to spec.

**Design spec §7.5 ("Your First Month" Recap Email)**: append `**[Implemented §12.3]**` cross-reference at end.

## 9. Build order recommendation

1. `buildFirstMonthRecapEmail` in `server/utils/email.ts` with Vitest tests (TDD)
2. Edge Function `send-first-month-recap` + Deno mirror of the builder
3. Build plan + design spec docs
