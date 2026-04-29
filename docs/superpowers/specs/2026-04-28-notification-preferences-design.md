# 10.3 — Notification Preferences Page

## Overview

Add a dedicated `/notification-settings` page accessible to all circle members for managing notification preferences per circle. Replaces the notification toggles currently embedded in the owner-only circle-settings page. Surfaces push toggle, mute toggle, and email digest frequency (weekly/monthly/off) with immediate-save UX.

## Decisions

- **Dedicated page** — not embedded in circle-settings. Notification preferences are "how I receive updates" (member concern), not "manage this circle" (owner concern).
- **Per-circle settings** — `NotificationPreference` table is keyed on `(user_id, circle_id)`. Circle selector shown only for multi-circle users.
- **No quiet hours UI** — backend already checks quiet hours in `sendPushToCircle`, but the UI is deferred. Too few users to justify the complexity (time pickers, timezone handling).
- **Email digest: weekly / monthly / off** — daily dropped (too frequent for small circles). Monthly is default (push is the primary real-time channel; digest is a re-engagement tool for inactive members).
- **Default changed from weekly to monthly** — migration updates the DB default.

## 1. Route & Navigation

**Route:** `/notification-settings`

**Page layout:** Standard app page — `max-w-[1280px] mx-auto`, sticky header with back button. Same pattern as `circle-settings.vue`.

**Navigation entry points:**
- Timeline header: bell icon next to the existing circle settings gear icon. Visible to **all members** (the gear is owner-only). Links to `/notification-settings`.
- Remove the notification toggles section from `circle-settings.vue` (added in 10.1). Replace with nothing — the bell icon in the timeline header is the entry point.

## 2. Circle Selector

Shown only when the user belongs to 2+ circles. Same pattern as the data export circle selector in account settings.

- **Single circle:** no selector shown, preferences load automatically for the one circle.
- **Multi-circle:** pill/tab row at the top. Each pill shows the circle name. Clicking a pill loads that circle's preferences. First circle selected by default.

Circle list comes from the existing membership data (same source as the circle switcher in the timeline header).

## 3. Preferences UI

Three settings per circle, displayed in a card-style section:

### Push notifications
- On/off toggle
- Label: "Push notifications"
- Description: "Get notified when members share memories, comment, or react."
- Maps to `NotificationPreference.push_enabled`

### Mute this circle
- On/off toggle
- Label: "Mute this circle"
- Description: "Pause all notifications from this circle."
- Maps to `NotificationPreference.circle_muted`
- When enabled, show a subtle note below: "Push notifications and email digests from this circle are paused."

### Email digest
- Segmented control with three options: **Weekly** / **Monthly** / **Off**
- Label: "Email digest"
- Description: "A summary of new memories and activity."
- Maps to `NotificationPreference.email_digest_frequency`
- Default: `'monthly'` (changed from `'weekly'`)

## 4. Save Behavior

- Each preference change saves **immediately** on interaction (no Save button).
- Upsert on `(user_id, circle_id)` — creates the row on first interaction if it doesn't exist.
- Uses `useSupabaseClient()` for client-side DB calls (same pattern as current circle-settings implementation).
- No explicit success feedback needed — the toggle/control state is the feedback. If the save fails, revert the UI state and show a toast error.

## 5. Empty State / Defaults

If no `NotificationPreference` row exists for a (user, circle) pair, the UI shows defaults:
- Push notifications: on
- Mute: off
- Email digest: monthly

First interaction creates the row via upsert.

## 6. Database Migration

Migration to update the default for `email_digest_frequency`:

```sql
ALTER TABLE NotificationPreference
  ALTER COLUMN email_digest_frequency SET DEFAULT 'monthly';
```

No data migration needed — existing rows keep their current value (`'weekly'`). Only new rows get the `'monthly'` default.

Validation in API routes: `z.enum(['weekly', 'monthly', 'off'])` — `'daily'` is no longer accepted.

## 7. Cleanup

- Remove the notification preferences section (push toggle + mute toggle) from `circle-settings.vue`
- Remove the associated script code (`pushEnabled`, `circleMuted`, `loadingPrefs`, `loadNotificationPrefs`, `saveNotificationPref`, watch)
- Keep the i18n keys — they'll be reused in the new page

## 8. i18n

New keys under `"notificationSettings"`:
- Page title, circle selector label
- Push/mute/digest labels and descriptions
- Mute active note
- Digest options (weekly/monthly/off)

Move existing `circleSettings.pushNotifications*` and `circleSettings.muteCircle*` keys to `notificationSettings.*` namespace. Remove the old keys from `circleSettings` since the circle-settings page no longer has a notification section.

## 9. Build Plan Updates

Update 10.3 description in the progress tracker. Note: the Capacitor migration path (adding `platform` column to PushSubscription) remains a separate future task and is not part of 10.3.

## Out of Scope

- Quiet hours UI (backend ready, UI deferred)
- Daily digest option (dropped — too frequent)
- Email digest send logic (table/preferences exist, actual cron + email template is a separate step)
- Notification history / in-app notification center
