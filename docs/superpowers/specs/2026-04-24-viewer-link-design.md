# Viewer Link Generation — Design Spec (Milestone 9.1)

**Date:** 2026-04-24
**Status:** Approved

---

## Overview

Milestone 9.1 adds the owner-side UI and API for generating shareable view-only links. The viewer page (`/view`) and JWT verification utility already exist (built in §4.5). This spec covers everything needed to let a circle owner create, manage, and revoke viewer links from within the app.

---

## What Already Exists

- `server/utils/viewerJwt.ts` — `signViewerToken` / `verifyViewerToken`
- `server/api/viewer/timeline.get.ts` — public viewer timeline API
- `app/pages/view.vue` — the viewer page (first-open splash, expired UX, guest reactions, CTA)

---

## Decisions

- **Owner-only** — only the circle owner can create, copy, and revoke viewer links. Members and admins have no access.
- **Multiple links per circle** — an owner can have a permanent "Full timeline" link for grandma and a separate "Christmas 2024" link for a specific event. Each is independently revocable.
- **Separate `viewer_link` table** (Approach B) — supports multiple links, future extensibility.
- **Nonce-based revocation** — each link has a UUID nonce stored in the DB and embedded in the JWT. Revoking deletes the row; the old JWT is immediately invalid on next viewer API call.
- **Three selection modes:** `full`, `date_range`, `selection` (hand-picked memories).
- **Localization** — all UI strings use `t('key')` with keys in `en.json`, `zh-CN.json`, and `fr.json`.

---

## Data Model

### New table: `viewer_link`

```sql
CREATE TABLE viewer_link (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id   UUID NOT NULL REFERENCES circle(id) ON DELETE CASCADE,
  nonce       UUID NOT NULL DEFAULT gen_random_uuid(),
  mode        TEXT NOT NULL CHECK (mode IN ('full', 'date_range', 'selection')),
  memory_ids  UUID[],          -- selection mode only; NULL otherwise
  date_from   DATE,            -- date_range mode only; NULL otherwise
  date_to     DATE,            -- date_range mode only; NULL otherwise
  label       TEXT NOT NULL,   -- owner-editable; auto-generated default
  expires_at  TIMESTAMPTZ NOT NULL,  -- default: created_at + 30 days
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON viewer_link (circle_id);
CREATE INDEX ON viewer_link (id, nonce);  -- viewer API lookup path
```

**Default labels (auto-generated, owner can edit):**
- `full` → "Full timeline"
- `date_range` → "Jan 2024 – Jun 2024" (formatted via `Intl.DateTimeFormat`, locale-aware)
- `selection` → "5 memories" (count of selected IDs)

### JWT payload (updated)

```json
{
  "circle_id": "uuid",
  "viewer_link_id": "uuid",
  "nonce": "uuid",
  "role": "viewer",
  "exp": 1234567890
}
```

`viewer_link_id` + `nonce` allow a direct indexed lookup on the `viewer_link` table. Both must match — mismatched nonce means the link was revoked and regenerated.

---

## RLS Policies

| Policy | Table | Who | Operation |
|---|---|---|---|
| Owner can manage own viewer links | `viewer_link` | Circle owner | SELECT, INSERT, DELETE |
| Members blocked | `viewer_link` | Circle members | all — denied |
| Admins blocked | `viewer_link` | Circle admins | all — denied |
| Cross-circle blocked | `viewer_link` | Any user | cannot access another circle's links |

Viewer API uses service role (existing pattern in `viewer/timeline.get.ts`) — bypasses RLS.

---

## API Surface

### Owner-side (authenticated, owner-only)

**`GET /api/circles/[id]/viewer-links`**
Returns all viewer links for the circle, ordered by `created_at DESC`.

Response per link:
```ts
{
  id: string
  mode: 'full' | 'date_range' | 'selection'
  label: string
  expiresAt: string       // ISO timestamp
  isExpired: boolean      // server-computed: expiresAt < now
  memoryCount: number | null  // null for full mode
  dateRange: { from: string, to: string } | null  // for date_range and selection modes
  token: string           // the signed JWT — client uses this to build the /view URL
}
```

**`POST /api/circles/[id]/viewer-links`**
Creates a new viewer link. Owner-only.

Request body:
```ts
{
  mode: 'full' | 'date_range' | 'selection'
  label?: string          // optional override; server generates default if omitted
  memoryIds?: string[]    // required for selection mode
  dateFrom?: string       // required for date_range mode (ISO date)
  dateTo?: string         // required for date_range mode (ISO date)
}
```

Response: same shape as GET list item.

**`DELETE /api/circles/[id]/viewer-links/[linkId]`**
Deletes the viewer link row. Owner-only. The JWT becomes immediately invalid on next viewer API call.

### Viewer-side (public, no auth)

**`GET /api/viewer/timeline?token=<jwt>`** — existing route, updated:

1. Decode JWT → extract `viewer_link_id` + `nonce`
2. Look up `viewer_link` by `id` — if missing → 401 `"revoked"`; if nonce mismatch → 401 `"revoked"`; if `expires_at` past → 401 `"expired"`
3. Apply memory filter:
   - `full` → no filter (all circle-visible memories, max 50, ordered by `memory_date DESC`)
   - `date_range` → `WHERE memory_date BETWEEN date_from AND date_to`
   - `selection` → `WHERE id = ANY(memory_ids)`
4. Response gains new fields:
   ```ts
   mode: 'full' | 'date_range' | 'selection'
   linkLabel: string
   selectionDateRange: { from: string, to: string } | null  // derived from returned memories
   ```

### Guest reactions (existing route, minor update)

**`POST /api/reactions/guest`** — no change to request. Response updated: each reactor object gains `isGuest: boolean` so the UI can render the globe indicator in tooltips.

---

## Owner-side UI

### Share button — timeline header

A "Share" icon button in the timeline header, visible only to the circle owner. Hidden from members and admins. Tapping opens `ShareLinksSheet`.

i18n key: `viewerLink.shareButton`

### `ShareLinksSheet.vue`

Bottom sheet. Two states:

**Empty state (no links):**
- Headline: `t('viewerLink.emptyHeadline')` — "Share your circle"
- Body: `t('viewerLink.emptyBody')` — "Create a viewer link — anyone with it can browse your memories without an account."
- CTA: `t('viewerLink.createLink')` — "Create a link"

**List state (one or more links):**
Each link renders as a card:
- Label (bold)
- Mode badge: `t('viewerLink.modeFull')` / `t('viewerLink.modeDateRange')` / `t('viewerLink.modeSelection')` — with date range or count suffix where applicable
- Created date (locale-aware `Intl.DateTimeFormat`)
- Expiry: shows "Expires [date]" normally; shows red "Expired" badge if past
- Copy button → copies the full `/view?token=...` URL + brief "Copied!" toast (`t('viewerLink.copied')`)
- Renew button (shown only on expired links) → calls POST to create a replacement link
- Revoke button → inline confirmation: `t('viewerLink.revokeConfirm')` "Revoke this link? Anyone with it will lose access." + Revoke / Cancel

"+ Create another link" button at the bottom: `t('viewerLink.createAnother')`

### Create link flow — layered sheet

Slides over `ShareLinksSheet`. Steps:

1. **Mode selector** (segmented control or radio):
   - `t('viewerLink.modeFull')` "Full timeline"
   - `t('viewerLink.modeDateRange')` "Date range"
   - `t('viewerLink.modeSelection')` "Select memories"

2. **Date range picker** (shown for `date_range` mode):
   - Quick-select chips: "This year", specific year buttons, specific month buttons
   - Custom from/to date inputs as fallback
   - Dates formatted locale-aware

3. **Memory picker grid** (shown for `selection` mode):
   - Scrollable grid of memory thumbnails
   - Tap to select — checkmark overlay, accent border
   - Count badge: `t('viewerLink.selectedCount', { count })` "3 selected"

4. **Label field** (always shown):
   - Pre-filled with auto-generated default
   - Owner can edit freely
   - Placeholder: `t('viewerLink.labelPlaceholder')` "e.g. Grandma's link"

5. **Create button**: `t('viewerLink.createLink')` — calls POST, closes create sheet, new link appears in list with "Copied!" toast auto-triggered

---

## Viewer Page Updates (`view.vue`)

### Link label + mode banner

Slim banner below the circle name:
- `full` mode: no banner (or optional subtle pill — omit for now)
- `date_range`: `t('viewerLink.dateRangeBanner', { from, to })` — "Memories from Jan 2024 – Jun 2024"
- `selection`: `t('viewerLink.selectionBanner', { count, from, to })` — "5 selected memories · Mar 2024 – Dec 2024"

Link label shown in the page header alongside circle name (e.g. "The Johnson Family · Christmas 2024").

Dates formatted via `Intl.DateTimeFormat` using the viewer's browser locale (no account → no stored preference).

### Empty state

When the filtered memory list is empty (selection or date_range with no matching memories):

```
[icon]
t('viewerLink.emptyState')  — "No memories to show here."
t('viewerLink.emptyStateBody')  — "The owner may not have added any yet."
```

### Guest reaction globe indicator

Reaction tooltip already lists reactor names. For guest reactors (`isGuest: true`), append a globe icon (🌐 or inline SVG) after their name. e.g. "❤️ Grandma 🌐, Emma, James".

i18n key: `viewerLink.guestSuffix` — "(viewer)" as accessible alt text.

### Referral CTA

After the viewer has scrolled through 3+ memories (tracked with an `IntersectionObserver` on the 3rd memory card), show a soft prompt card:

```
t('viewerLink.referralHeadline')  — "Know someone who'd love this?"
t('viewerLink.referralBody')      — "Share this app with them →"
```

Tapping opens Web Share API with the app's landing page URL. Shown at most once per session (dismissed on share or tap-outside).

### Expiry notification

The existing expired-link screen (`errorType === 'expired'`) already shows "This link has expired." No changes needed here — the existing UX handles it.

### 3-day expiry email to owner

A daily cron job queries `viewer_link` for rows where `expires_at BETWEEN now() AND now() + interval '3 days'` and `notified_expiry_at IS NULL`. Sends an email via Resend: "Your viewer link '[label]' expires in 3 days — renew it so your family doesn't lose access." Sets `notified_expiry_at = now()` to prevent duplicate sends.

Requires adding `notified_expiry_at TIMESTAMPTZ` column to `viewer_link`.

---

## Migration

One new migration file. Contents:
1. `CREATE TABLE viewer_link` (schema above)
2. Add `notified_expiry_at TIMESTAMPTZ` column
3. RLS policies (owner-only SELECT/INSERT/DELETE)
4. Indexes on `circle_id` and `(id, nonce)`

No changes to existing tables.

---

## Tests

### RLS tests (pgTAP)

- Owner can insert a viewer_link for their own circle
- Owner can select viewer_links for their own circle
- Owner can delete a viewer_link from their own circle
- Admin cannot insert viewer_links
- Admin cannot select viewer_links
- Member cannot insert viewer_links
- Member cannot select viewer_links
- Owner of circle A cannot select viewer_links for circle B

### E2E tests (Playwright)

- Owner sees "Share" button in timeline header; member does not
- Create full-timeline link → copy URL → `/view?token=` loads successfully
- Create date_range link → viewer sees date range banner + memories filtered by date
- Create selection link → viewer sees selection banner + only selected memories shown
- Revoke link → old `/view?token=` returns invalid/revoked error
- Expired link badge shown in ShareLinksSheet; Renew creates a new link
- Guest reaction tooltip shows globe indicator
- Referral CTA appears after scrolling 3+ memories (shown once per session)
- Empty state rendered when selection/date_range returns 0 memories

### Unit tests (Vitest)

- `signViewerToken` / `verifyViewerToken` updated to include `viewer_link_id` + `nonce` fields
- Verify nonce mismatch throws
- Verify expired JWT throws

---

## i18n Keys

All keys added to `en.json`, `zh-CN.json`, and `fr.json`:

```
viewerLink.shareButton
viewerLink.emptyHeadline
viewerLink.emptyBody
viewerLink.createLink
viewerLink.createAnother
viewerLink.modeFull
viewerLink.modeDateRange
viewerLink.modeSelection
viewerLink.selectedCount        -- "{ count } selected"
viewerLink.labelPlaceholder
viewerLink.copied
viewerLink.revokeConfirm
viewerLink.revokeConfirmBody
viewerLink.dateRangeBanner      -- "Memories from { from } – { to }"
viewerLink.selectionBanner      -- "{ count } selected memories · { from } – { to }"
viewerLink.emptyState
viewerLink.emptyStateBody
viewerLink.guestSuffix
viewerLink.referralHeadline
viewerLink.referralBody
viewerLink.expires              -- "Expires { date }"
viewerLink.expired              -- "Expired"
viewerLink.renew
```
