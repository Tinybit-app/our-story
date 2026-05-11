# 12.4 — Quiet Circle Nudge

## Overview

If a circle hasn't received any uploads in 14 days, send a soft nudge to the **owner only** prompting them to add a memory. Capped at 3 nudges total per quiet period, with a minimum 14 days between sends. Reset to zero whenever a new memory is uploaded.

This is a retention rescue: the owner is the one who can both upload directly or rally other members. Sending to all members would feel like guilt-tripping.

## Decisions

- **Owner only** — never sent to other members
- **Channels:** push if subscribed → email fallback (consistent with 12.2 pattern). Spec says push, but we extend with email fallback to maximise reach when push isn't available.
- **Caps:** `quiet_nudge_count < 3` AND last sent ≥ 14 days ago. Both must hold.
- **Reset on activity:** existing `handle_memory_insert` trigger sets `quiet_nudge_count = 0` on every memory insert. Already wired (migration 004). No cron-side reset needed.
- **Eligibility filter — must have had a first memory:** require `first_memory_at IS NOT NULL`. Excludes brand-new circles that never started uploading (they're not "quiet", they're stillborn — different problem, different hook later if needed).
- **Notification preferences:** respect `circle_muted = true` as universal kill switch. No separate `quiet_nudge_enabled` preference — frequency is already capped at 3 per quiet period, so the noise level is naturally low.
- **Schedule:** daily at 9am UTC. pg_cron manual setup.
- **Locales:** en, zh-CN, fr.

## 1. Schedule

```sql
SELECT cron.schedule(
  'send-quiet-circle-nudges',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-quiet-circle-nudges',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
);
```

Manual setup in Supabase Studio (same pattern as other crons).

## 2. Edge Function

**Path:** `supabase/functions/send-quiet-circle-nudges/index.ts`

### Flow

```
1. Compute thresholds:
   quietSince  = now() - 14 days   // last_memory_at must be older than this
   lastSentBefore = now() - 14 days   // quiet_nudge_last_sent_at must be older or null

2. Query candidate circles:
   SELECT id, name, last_memory_at, quiet_nudge_count
   FROM circle
   WHERE deleted_at IS NULL
     AND first_memory_at IS NOT NULL
     AND last_memory_at < quietSince
     AND quiet_nudge_count < 3
     AND (quiet_nudge_last_sent_at IS NULL OR quiet_nudge_last_sent_at < lastSentBefore)

3. For each circle:
   a. Find the owner: circlemember WHERE circle_id = c.id AND role = 'owner', joined with user
   b. Skip if owner not found, email missing, or user soft-deleted
   c. Check NotificationPreference: skip if circle_muted = true
   d. Try push (if push_enabled AND has subscriptions AND not in quiet hours)
   e. Else email (if email_digest_frequency != 'off')
   f. On either success: UPDATE circle SET quiet_nudge_count = quiet_nudge_count + 1,
                                          quiet_nudge_last_sent_at = now() WHERE id = c.id

4. Return { ok, sent, skipped, errors }
```

### Idempotency

The 14-day floor on `quiet_nudge_last_sent_at` prevents same-day re-sends if the cron retries. The `quiet_nudge_count < 3` cap is the hard stop.

If the cron fires twice on the same day before the timestamp update lands, both runs could pick the same candidate. Acceptable trade-off for Phase 1 — duplicate quiet-circle nudges are very rare (max 3 per circle ever, and the cron is daily).

### Failure tolerance

Per-circle errors caught and logged; one bad row never aborts the run.

## 3. Push payload

```json
{
  "title": "Your story has been quiet 🕰",
  "body": "Add a memory to keep it alive →",
  "tag": "quiet-nudge-{circleId}-{count}",
  "renotify": true,
  "data": { "url": "/timeline?circle={circleId}" }
}
```

Push copy varies slightly by nudge count (1st nudge is gentle, 3rd is final):

| Count | Title (en) | Body (en) |
|-------|------------|-----------|
| 1 (nudge_count was 0 → becomes 1) | "Your story has been quiet 🕰" | "Add a memory to keep it alive →" |
| 2 | "Your circle is waiting" | "It's been a while — add something this week?" |
| 3 (final) | "One last reminder" | "Your circle hasn't seen anything new in a month. Add a memory? We won't ask again." |

The final nudge being explicit about "we won't ask again" is intentional: it respects the owner's autonomy and prevents the feeling of being badgered.

Locales: en, zh-CN, fr.

## 4. Email template

New builder in `server/utils/email.ts`:

```ts
buildQuietCircleNudgeEmail(opts: {
  recipientFirstName: string
  circleName: string
  nudgeCount: 1 | 2 | 3       // post-increment count (1st send = 1)
  daysSinceLastMemory: number
  appUrl: string                // /timeline?circle=<id>
  unsubscribeUrl: string        // /notification-settings
  locale: 'en' | 'zh-CN' | 'fr'
}): { subject: string; html: string }
```

### Subject lines (en)

| Count | Subject |
|-------|---------|
| 1 | "{circleName} has been quiet for {daysSinceLastMemory} days" |
| 2 | "It's been a while since anyone added to {circleName}" |
| 3 | "One last reminder — {circleName}" |

### Body

```
Hi {recipientFirstName},

It's been {daysSinceLastMemory} days since anyone added a memory to {circleName}.

[Tone varies by count:]
- count 1: Gentle nudge — "Even a quick note keeps the story alive."
- count 2: Slightly firmer — "Photos pile up on phones. The story lives here when you put them in."
- count 3: Final — "This is the last nudge — we don't want to badger you. Whether you keep building or pause, this circle is here when you're ready."

[Add a memory →]

You're receiving this because you're the owner of {circleName}.
Adjust your email preferences here.
```

## 5. Database changes

None. `last_memory_at`, `quiet_nudge_count`, `quiet_nudge_last_sent_at` columns are already in `Circle` (migration 004), and the `handle_memory_insert` trigger already resets the count on any upload.

## 6. Edge cases & guards

- **Brand-new circles without any memories** → excluded via `first_memory_at IS NOT NULL`
- **Soft-deleted circles** → excluded
- **Owner soft-deleted** → skip (no fallback to admin — spec is owner-only)
- **Owner has no email and no push subscription** → skip silently. The nudge is best-effort.
- **`circle_muted = true`** → skip
- **`email_digest_frequency = 'off'` AND no push** → skip (user opted out of both channels)
- **Quiet hours** → skip push, try email instead. Don't reschedule.
- **Cron runs same day twice** → 14-day floor on last-sent prevents double-fire; race window <1 day acceptable

## 7. Testing

### Unit tests (`unit/quietCircleNudgeEmail.test.ts`)
- Subject + body × 3 counts × 3 locales = 9 cases
- Tone differentiation (count 1 vs count 3 body wording differs)
- Includes appUrl + unsubscribeUrl in body

### No new schema-compliance tests (no migration)

### No new RLS tests (no new tables)

### Manual verification
1. Set a circle's `last_memory_at` to 15 days ago in Supabase Studio
2. Set `first_memory_at` to something non-null and `quiet_nudge_count = 0`
3. Trigger: `curl -X POST $SUPABASE_URL/functions/v1/send-quiet-circle-nudges -H "Authorization: Bearer $SERVICE_ROLE_KEY"`
4. Verify console output `[dev] quiet-nudge to <owner-email>: Your story...`
5. Verify `quiet_nudge_count = 1`, `quiet_nudge_last_sent_at = now()`
6. Re-run: confirm circle is excluded (last_sent < 14 days)
7. Reset timestamp to 15 days ago: re-run, verify `quiet_nudge_count = 2`
8. Continue → `count = 3` → next run, circle should be excluded (cap reached)
9. Insert a memory in the circle → trigger should reset `quiet_nudge_count = 0`

## 8. Out of Scope

- **Custom nudge cadence** — fixed 14-day floor for Phase 1
- **Multi-channel send** (push AND email simultaneously) — pick one, push preferred
- **Per-nudge tracking table** — no need; the Circle counter is sufficient for caps
- **Resume after pause** — if owner ignores all 3 nudges, circle stays "quiet" forever unless someone uploads again (which resets via trigger). That's the intended behaviour.
- **Friend-group "no upload in 14 days" variant** — same nudge applies to all circle types where the owner is the natural retention anchor. No type-specific copy in Phase 1.

## 9. Build Plan & Design Spec Updates

**Build plan §12.4** — mark complete with implementation notes.
**Design spec § Hook 4** — append `**[Implemented §12.4]**` cross-reference.

## 10. Build order

1. `buildQuietCircleNudgeEmail` in `server/utils/email.ts` + Vitest tests (TDD)
2. Edge Function `send-quiet-circle-nudges` + Deno mirror of the builder
3. Build plan + design spec docs
