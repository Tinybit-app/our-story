# 12.2 — Milestone Suggestions (Triple-Nudge)

## Overview

A daily Edge Function (`send-milestone-nudges`) that detects upcoming and recent milestones and prompts circle owner+admins via push, email, and an in-app banner. Three phases per milestone: T-3 (anticipation), T+0 (the day), T+3 (catch-up — only if no memory was uploaded with `milestone_label` set in the window).

The design spec calls this *"the most powerful retention hook in the entire app"*. The T+3 follow-up is the key insight from competitors that don't ship it.

## Decisions

- **Three surfaces:** push (if subscribed + enabled), email (fallback), in-app banner (always when in window)
- **Recipients:** circle members with role `owner` or `admin` only — no nudges to grandparents/extended family
- **Scopes:** parents children (age milestones), couples (anniversary), friends/travel (trip anniversary)
- **Anchor date for friends/travel:** reuse existing `Circle.anniversary_date` column — column stays the same, UI label changes per circle type
- **Idempotency:** new `MilestoneNudge` table with UNIQUE on `(user_id, scope_type, scope_id, milestone_key, nudge_phase)`
- **New preference:** `NotificationPreference.milestone_nudges_enabled` (default true) — granular kill switch separate from `circle_muted`
- **Quiet hours:** skip push silently, send email instead, never reschedule push (no deferred queue)
- **T+3 skip rule:** if any memory with non-null `milestone_label` exists in the ±3 day window, skip
- **Locales:** en, zh-CN, fr — same coverage as existing emails

## 1. Schedule

Single pg_cron job runs daily at 9am UTC, invokes the Edge Function with no query params:

```sql
SELECT cron.schedule(
  'send-milestone-nudges',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-milestone-nudges',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
);
```

Manual setup in Supabase Studio (same pattern as `purge-deleted-users`, `send-digest`).

## 2. Edge Function: `send-milestone-nudges`

**Path:** `supabase/functions/send-milestone-nudges/index.ts`

### High-level flow

```
1. Compute target dates: today, today+3, today-3
2. Find candidates:
   - Children: every ChildProfile in non-deleted circles, compute age at each target date,
     check against milestone calendar (1mo, 2mo, 3mo, 6mo, 9mo, 12mo, 18mo, 2-18yr)
   - Couples: every Circle with circle_type='couple' and anniversary_date set,
     check if next anniversary falls on each target date
   - Friends/Travel: every Circle with circle_type IN ('friends','travel') and anniversary_date set,
     check if trip anniversary falls on each target date
3. For T+3 candidates only: skip if memory exists in circle with milestone_label IS NOT NULL
   AND memory_date BETWEEN milestone_date - 3 AND milestone_date + 3
4. For each remaining candidate, find recipients (owner + admin roles)
5. For each recipient:
   a. Check NotificationPreference: skip if circle_muted OR milestone_nudges_enabled=false
   b. Check MilestoneNudge dedupe: skip if (user_id, scope, milestone_key, phase) row exists
   c. Try push: if push_enabled AND has subscriptions AND not in quiet hours
   d. Else try email: if email_digest_frequency != 'off'
   e. On success, insert MilestoneNudge row
6. Return { ok, sent, skipped, errors }
```

### Per-candidate, per-recipient errors are swallowed and logged

One bad row never aborts the whole run.

### Helpers (unit-testable in Vitest)

- `getMilestoneKeyForAgeInDays(days)` → returns `'1mo' | '2mo' | '3mo' | '6mo' | '9mo' | '12mo' | '18mo' | '2yr' | ... | '18yr' | null`
- `getAnniversaryYear(anniversaryDate, targetDate)` → returns N if `targetDate` is the same MM-DD as `anniversaryDate` and `targetDate.year > anniversaryDate.year`, else null
- Both implemented in `server/utils/milestoneCron.ts` and mirrored to `supabase/functions/send-milestone-nudges/milestoneCron.ts` (Deno-compatible 1:1 copy, same pattern as digest)

### Milestone calendar

```ts
// Months (for children under 24 months)
const MONTH_MILESTONES = [1, 2, 3, 6, 9, 12, 18]

// Years (for older children)
const YEAR_MILESTONES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18]

// Couples / friends / travel
// Yearly anniversary 1..50; capped at 50 for safety
```

### Push payload

```json
{
  "title": "Mia turns 6 months on Thursday 🎉",
  "body": "Ready to capture the moment?",
  "tag": "milestone-{circleId}-{scopeId}-{milestoneKey}-{phase}",
  "renotify": true,
  "data": { "url": "/timeline?circle={circleId}" }
}
```

Tag includes circle, scope (child or couple), milestone key, and phase — so a retry race within the same day is replaced rather than stacked.

### Channel selection (per recipient)

```
hasPush = (push_enabled = true) AND (count(pushsubscription where user_id) > 0)
isQuiet  = isInQuietHours(quiet_hours_start, quiet_hours_end, now())

if hasPush AND NOT isQuiet:
  send push → record { channel: 'push' }
elif email_digest_frequency != 'off':
  send email → record { channel: 'email' }
else:
  // user is fully opted out via prefs (no push, email off)
  skip
```

## 3. Database

### Migration 031: `MilestoneNudge` tracking table

```sql
CREATE TABLE MilestoneNudge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('child', 'couple', 'trip')),
  scope_id UUID NOT NULL,           -- child_id, or circle_id (couple/trip)
  milestone_key TEXT NOT NULL,      -- '1mo', '6mo', '12mo', '2yr', 'anniversary_5', 'trip_anniversary_3'
  nudge_phase TEXT NOT NULL CHECK (nudge_phase IN ('T-3', 'T0', 'T+3')),
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_milestone_nudge_dedupe
  ON MilestoneNudge (user_id, scope_type, scope_id, milestone_key, nudge_phase);

CREATE INDEX idx_milestone_nudge_user ON MilestoneNudge (user_id);

ALTER TABLE MilestoneNudge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own milestone nudges"
  ON MilestoneNudge FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Inserts/deletes only via service role (Edge Function); no member policies needed.
```

### Migration 032: `milestone_nudges_enabled` preference

```sql
ALTER TABLE NotificationPreference
  ADD COLUMN milestone_nudges_enabled BOOLEAN NOT NULL DEFAULT true;
```

### Reuse `Circle.anniversary_date`

No new column. The existing column from migration 020 is generalised:

- `circle_type = 'couple'` → relationship anniversary date (existing)
- `circle_type IN ('friends', 'travel')` → trip start date / first-trip anchor

Migration 033 updates the column comment:

```sql
COMMENT ON COLUMN public.Circle.anniversary_date IS
  'Yearly anniversary anchor date. For couples: relationship anniversary. For friends/travel: first-trip date. Drives milestone nudge cron (§12.2). Null when not set.';
```

## 4. UI Changes

### `/notification-settings` page

Add a third toggle under each circle's preferences:

| Field | Label | Description |
|-------|-------|-------------|
| `milestone_nudges_enabled` | "Milestone reminders" | "Get nudged about upcoming birthdays, anniversaries, and milestones for this circle." |

Same pattern as the existing `push_enabled` and `circle_muted` toggles.

### `/circle-settings` page — anchor date

Currently the anniversary date input is shown only for `circle_type = 'couple'` circles. Extend the visibility:

- `couple` → label: "Anniversary date" (existing)
- `friends` → label: "Trip date"
- `travel` → label: "Trip date"
- Other types → input hidden

UI string changes only; no schema change.

### Timeline `MilestoneBanner.vue`

New component shown on `/timeline` (alongside `PushPromptBanner` and `InstallPromptBanner`).

**Data source:** extend `GET /api/timeline` response with `upcomingMilestone: UpcomingMilestone | null` for the active circle, where:

```ts
interface UpcomingMilestone {
  scopeType: 'child' | 'couple' | 'trip'
  name: string                  // child's first name, or 'your anniversary', or 'your trip anniversary'
  milestoneKey: string          // '6mo', 'anniversary_5'
  phase: 'T-3' | 'T0' | 'T+3'
  daysUntil: number             // -3..3
  milestoneLabelSuggestion: string  // "6 months", "5 years", etc. — for upload-form pre-fill
}
```

The server computes this using the same helpers as the Edge Function. Cheap; runs as part of the existing `/api/timeline` query path.

**Banner UX:**
- T-3: *"Mia turns 6 months in 3 days 🎉"* — `[Add a memory]`
- T+0: *"Today is Mia's 6-month birthday 🎉"* — `[Add a memory]`
- T+3: *"Did you capture Mia's 6-month milestone?"* — `[Add now]` `[Dismiss]`

**"Add a memory" click:** opens the upload sheet with `milestone_label` pre-populated to `milestoneLabelSuggestion` (e.g., "6 months", "5 years"). Saves typing.

**Dismiss:** session-level via `localStorage[milestone-banner-dismissed-${milestoneKey}]`. Reappears next session if still in window.

**Visibility logic** (computed in the component):
- Hide if `!props.memory.upcomingMilestone`
- Hide if user has `milestone_nudges_enabled = false` for this circle (need a small fetch to check; or include this in the timeline response)
- Hide if dismissed for this milestone in localStorage

To avoid a separate fetch, include `milestoneNudgesEnabledForActiveCircle: boolean` in the timeline response too.

### `UploadMemory.vue` — milestone pre-fill

When the upload sheet opens with a `pre-populated milestone label` query param or prop (passed from the banner click), set the milestone field to that value. One-line addition.

## 5. Email Templates

New builders in `server/utils/email.ts`:

```ts
buildChildMilestoneEmail(opts: {
  recipientFirstName: string
  childName: string
  milestoneLabel: string        // "6 months", "1 year", "18 months"
  phase: 'T-3' | 'T0' | 'T+3'
  daysUntil: number             // for T-3 specifically: 3
  circleName: string
  appUrl: string                // /timeline?circle=<id>
  unsubscribeUrl: string        // /notification-settings
  locale: 'en' | 'zh-CN' | 'fr'
}): { subject: string; html: string }

buildAnniversaryEmail(opts: {
  recipientFirstName: string
  years: number                 // 5 for 5-year
  scopeType: 'couple' | 'trip'  // affects copy ("relationship" vs "trip")
  phase: 'T-3' | 'T0' | 'T+3'
  circleName: string
  appUrl: string
  unsubscribeUrl: string
  locale: 'en' | 'zh-CN' | 'fr'
}): { subject: string; html: string }
```

Subject lines (en — translate to zh-CN/fr same way as existing emails):

| Phase | Children | Couples | Trip |
|-------|----------|---------|------|
| T-3 | "Mia turns 6 months on {Day}" | "Your anniversary is in 3 days" | "Your trip anniversary is in 3 days" |
| T+0 | "Mia is 6 months old today 🎉" | "Happy 5 years 🥂" | "5 years since your trip 🌍" |
| T+3 | "Did you capture Mia's 6-month milestone?" | "Did you celebrate? Add a memory →" | "Did you mark the trip anniversary?" |

Body shares the same `layout()` and `primaryButton()` helpers as digest emails, with a single CTA linking to `appUrl` (which the timeline reads to open the upload sheet pre-filled). Footer: standard "manage email preferences" link to `/notification-settings`.

The Deno-side mirror lives in `supabase/functions/send-milestone-nudges/milestoneEmail.ts` (1:1 with the Nitro builders, same pattern as digest).

## 6. Edge Cases & Guards

- **Soft-deleted circle** (`deleted_at IS NOT NULL`) → excluded
- **Soft-deleted user** (`deletion_requested_at IS NOT NULL`) → excluded
- **No anniversary_date set on couple/friends/travel** → no anniversary nudges (only child nudges if applicable)
- **Multiple children in same parents circle** → one nudge per child per phase per recipient (handled by dedupe key including child_id)
- **Cron retry race** → unique index on `MilestoneNudge` prevents double-insert; the second attempt errors and is logged
- **User has push subscription but it's stale (HTTP 410)** → `pushNotify.ts` already handles by deleting the subscription row; the milestone send proceeds and the user effectively gets neither push nor email this time. Acceptable edge.
- **Quiet hours overnight (e.g. 22:00–08:00)** → handled by `isInQuietHours` (existing)
- **DST transition day** → milestone calculation uses calendar-day arithmetic (e.g., `today + 3 days`), not seconds. Inherently DST-safe.
- **Banner dismissed but server still nudges via push/email** → expected. The banner is one channel of three; dismissing it doesn't suppress the others. Users can mute the whole nudge category via `milestone_nudges_enabled=false`.

## 7. Testing

### Unit tests (`unit/milestoneCron.test.ts`)
- `getMilestoneKeyForAgeInDays`: edge cases at month boundaries (29 days = null, 30 days = '1mo'), year boundaries, beyond cap (`>18yr` returns null)
- `getAnniversaryYear`: same MM-DD different year returns N, leap year edge cases (Feb 29 → next valid Feb 28 in non-leap years), null for date that's not anniversary
- `getTripAnniversaryYear`: same as anniversary

### Schema compliance (`unit/schema-compliance.test.ts`)
- Migration 031 creates `MilestoneNudge` with correct columns + unique index + RLS
- Migration 032 adds `milestone_nudges_enabled` column with default true

### RLS tests (`supabase/tests/rls.test.sql`)
- User can SELECT own MilestoneNudge rows
- User cannot SELECT other users' rows

### E2E (`tests/milestone-banner.spec.ts`)
- Banner renders when API returns `upcomingMilestone`
- Banner does not render when `milestone_nudges_enabled = false`
- Click "Add a memory" pre-fills milestone label in upload sheet
- Dismiss persists across page reload (localStorage)

### Manual verification checklist (in build plan)
1. Create circle with parents type, add ChildProfile with DOB exactly 6 months ago
2. Curl the function: `POST /functions/v1/send-milestone-nudges` with service role
3. Verify console output: dev mode logs push/email per recipient
4. Verify MilestoneNudge row inserted
5. Re-run: verify dedupe (same response with skipped=N)
6. Set `circle_muted = true` for one user → verify they're skipped
7. Set `milestone_nudges_enabled = false` → verify skipped
8. Set DOB to 3 days ago, with milestone_label memory present → verify T+3 skipped
9. Banner manual test: same DOB scenarios → banner shows correct phase + days_until

## 8. Out of Scope

- **Deferred queue for quiet hours** — naive skip-push-and-email-instead is sufficient for Phase 1
- **Friend-group "no upload in 14 days" nudge** — separate retention hook (§12.4 quiet circle nudge), not a milestone
- **Custom user-defined milestones** — only auto-calculated dates from ChildProfile + anniversary_date
- **In-app push prompt acknowledgement** — already handled by §10.1 PushPromptBanner
- **Per-child anchor for parents circles** — currently the calendar is per-child via DOB, no overrides
- **Internationalising the milestone calendar** — month/year cadence is universal; copy is locale-aware
- **A/B testing nudge copy** — Phase 2

## 9. Build Plan & Design Spec Updates

**Build plan §12.2** (mark complete on ship):

```
- [x] 12.2 Milestone suggestions — triple-nudge (T-3, T+0, T+3) for child age + couple/friend/travel anniversaries *(implementation complete — pg_cron pending manual setup)*
  - Migration 031: MilestoneNudge tracking table; Migration 032: milestone_nudges_enabled preference
  - Channels: push (if subscribed) → email (fallback) → in-app banner (always when in window)
  - Recipients: circle owner + admins only
  - T+3 skip rule: skip if any memory with non-null milestone_label in ±3 day window
  - In-app: MilestoneBanner.vue on /timeline; click opens upload with milestone label pre-filled
  - Reuses Circle.anniversary_date for couple/friends/travel anchor (no new column)
  - Locales: en, zh-CN, fr
  - Manual setup remaining: schedule send-milestone-nudges in Supabase Studio
  - Tests: unit (calendar math), schema compliance (migrations 031/032), RLS, E2E (banner)
  - See spec: docs/superpowers/specs/2026-05-09-milestone-suggestions-design.md
```

**Design spec § Hook 2 (Milestone suggestions)**: append `**[Implemented §12.2]**` cross-reference.

## 10. Build order recommendation

1. Migrations 031, 032
2. `milestoneCron.ts` helpers + unit tests (TDD: get the calendar math right first)
3. Edge Function `send-milestone-nudges` + Deno-mirror utilities
4. Email builders in `server/utils/email.ts` + Vitest tests
5. Extend `/api/timeline` to include `upcomingMilestone` + `milestoneNudgesEnabled`
6. `MilestoneBanner.vue` + click-to-prefill in `UploadMemory.vue`
7. `/notification-settings` toggle + `/circle-settings` anchor-date generalisation
8. RLS tests + E2E
9. Build plan + design spec docs
