# Our Story — Phase 1 Build Plan

A step-by-step build order for Phase 1 (0 → 50 users). Each milestone has hard dependencies on the one before it. Do not skip ahead.

**Exit criteria for Phase 1:** One external family (people who don't know you) uses the app weekly for 4 consecutive weeks.

> For implementation details, data models, API specs, and feature behaviour, refer to `docs/design-spec.md`.

---

## Progress Tracker

### Milestone 1: Project Foundation
- [x] 1.1 Create the Nuxt project
- [x] 1.2 Create the Supabase project (upgrade to Pro, set file size limit)
- [x] 1.3 GitHub repo + Vercel deployment
- [x] 1.4 CI/CD pipeline (GitHub Actions)
- [x] 1.5 Sentry error tracking
- [x] 1.6 Security hardening baseline (headers, zod, CORS, Dependabot, audit CI)
- [ ] 1.7 PostHog analytics setup

### Milestone 2: Database Schema & RLS
- [x] 2.1 Initial schema migration (all core tables)
- [x] 2.2 RLS policies migration
- [x] 2.3 RLS policy tests (pgTAP)
- [x] 2.4 Storage bucket setup

### Milestone 3: Authentication
- [x] 3.1 Login page (magic link + Google) — redesigned with warm & nostalgic theme
- [x] 3.2 Auth callback page
- [x] 3.3 Auth middleware (protect routes)
- [x] 3.4 Profile setup page (first_name + last_name collection for magic link users)
- [ ] 3.5 Linked login methods (connect Google OAuth as fallback for magic link users)
- [x] 3.6 Account deletion flow:
  - Member deletion: content choice ("keep as Former member" vs "remove from circles"), reactions always removed
  - Owner deletion: resolve ownership first (auto-promote admin, force transfer, or delete circle)
  - 30-day soft delete + daily hard purge cron
- [x] 3.7 Circle deletion (owner-only): warning screen → type-to-confirm → 30-day soft delete → email all members → hard purge at day 30
  - Danger zone UI moved to dedicated `/circle-settings` page (previously in members page)
  - `useUserState().clear()` called before post-deletion redirect so middleware re-checks membership
- [ ] 3.8 Data export (ExportJob): single-circle scope; members export own uploads only; owners/admins export full circle *(implementation complete — pending end-to-end test)*
  - Circle selector shown in account settings when user belongs to more than one circle; auto-selected when only one
  - Rate limit: 1 active job per (user, circle) — parallel exports of different circles allowed
  - Edge Function resolves role via CircleMember query; full-circle vs own-uploads filter applied server-side
  - Email subject includes circle name; download link expires in 24 hours
  - Migration 012: `circle_id` column added to ExportJob; index on (user_id, circle_id, status)
  - **Blocked:** no trigger wires `process-export` Edge Function yet — `pg_net` INSERT trigger and `pg_cron` 5-min poll both unimplemented; need to wire before testing

### Milestone 3.9: Landing Page + Pricing Page (Cold Discovery)
- [x] 3.9.1 `/` route — landing page for unauthenticated visitors; authenticated users redirect to `/timeline`
- [x] 3.9.2 Hero: headline ("A private space where your circle builds a shared story."), subhead, single CTA ("Start your circle — free")
- [x] 3.9.3 How it works: 3-step explainer (invite → upload → remember) + screenshot placeholder
- [x] 3.9.4 "Who uses it" — per-type feature cards (7 cards, one per circle type):
  - Each card: emoji icon, type name, core differentiation tagline, 3–4 feature bullets, "Start a [type] circle →" CTA
  - Copy source: design spec §Circle-type landing page sections
  - Cards are the primary depth signal — show the product is purpose-built, not generic
- [x] 3.9.5 Privacy proof block: "Your photos never leave your circle. No ads. No algorithm. No AI training on your memories."
- [x] 3.9.6 Pricing summary: one line + link to /pricing
- [x] 3.9.7 SEO: `<title>`, meta description, OG tags via `useSeoMeta()`; `/` and `/pricing` prerendered at build time via `routeRules`
- [x] 3.9.8 `/pricing` route — tier comparison table (Free / Plus / Pro "coming soon"), FAQ (cancel, photos on cancel, privacy, grandparents), CTA per tier
- Note: single focused page — not a multi-page marketing site; lives inside the Nuxt app as the `/` route
- Note: timeline moved from `/` to `/timeline/index.vue`; all internal navigations updated
- Note: screenshot placeholder in "What it looks like" section — replace with real screenshot before launch
- Note: `landing.*` and `pricing.*` i18n keys added to `locales/en.json` (English only)

### Milestone 4: Onboarding & Circle Creation
- [x] 4.1 Onboarding flow (circle type picker → name → invite)
- [x] 4.2 Invite API + email (Resend)
- [x] 4.3 Invite acceptance flow (token → auto-join)
- [x] 4.6 Multi-circle support: circle switcher in nav, active circle via `?circle=<id>` URL param, existing members can create new circles via `/onboarding`, post-creation redirects to `/?circle=<newId>`
- [x] 4.7 No-circle holding screen (`/no-circle`): shown to existing users with no active membership instead of new-user onboarding
  - All redirect logic consolidated in `auth.global.ts` middleware (removed page-level onMounted guards)
  - Fixed bug: `hasMembership` returned true after soft-delete because service role bypasses RLS; fixed by joining circle table and filtering `deleted_at` in JS
- [x] 4.8 Invite pre-validation: `GET /api/invites/[token]/status` (public, no auth) shows circle-deleted or expired error before requiring sign-in
- [x] 4.9 Circle type differentiation:
  - Per-type empty state copy, milestone placeholder, and milestone quick-pick chips (`useCircleTypeConfig` composable)
  - `PATCH /api/circles/[id]` endpoint for owner to update `circle_type` (used in `/circle-settings` type picker)
  - **Design decision:** `circle_type` is a purely UX/marketing signal — sets copy, chips, and empty state only. Does not gate any features. All features available to all circles regardless of type. Invite UI always present. Owner can change type freely from `/circle-settings`.
- [ ] 4.10 Feature roadmap — phase 1 (available to all circles; type influences which are proactively suggested; see design spec §Feature roadmap):
  - [x] 4.10.1 Baby age stamp: `ChildProfile` table (name + date_of_birth per child) + per-memory child tagging + computed age display on memory cards (suggested first for `parents` circles)
    - Migration 014: `date_of_birth DATE` added to `Circle` table (nullable) — superseded by migration 015
    - Migration 015: `ChildProfile` table (id, circle_id, name, date_of_birth) with owner-only RLS; tightened from migration 004's permissive member policies
    - Migration 016: `memory_children` junction table (memory_id, child_id) — maps each memory to the children tagged in it; RLS: members can read, owner can insert/delete
    - `computeBabyAge(dob, memoryDate)` composable in `app/composables/useBabyAge.ts`
    - Age format: days (1–13) → weeks (14d–1mo) → "N months[, W weeks]" (1–11mo) → "N years[, M months]" (1y+)
    - `GET /api/timeline` returns `children[]` (for upload picker) alongside memories; each memory embeds `memory_children(child_id, childprofile(id, name, date_of_birth))`
    - `POST /api/memories/[id]/children` — owner tags/re-tags children on a memory (replace-all semantics: delete + insert)
    - `GET /api/circles/:id/children` — member-accessible list; `POST` — owner adds child; `DELETE /api/circles/:id/children/:childId` — owner removes
    - Children manager in `/circle-settings` (owner only): list existing children with remove, add form with name + DOB
    - Age stamp driven by `memory.memory_children` — only appears when children are explicitly tagged on a specific memory; absent on untagged memories regardless of circle type
    - Age stamp rendered in `PolaroidCard` caption and `MemoryModal` as pill badges: accent-tinted rounded pill with a baby face SVG icon, child name, and computed age (`"Emma · 3 months, 2 weeks"`); hidden when no children are tagged
    - Supports multiple children (e.g. twins, siblings) — one pill per tagged child, displayed in a flex-wrap row
    - Upload form: child chip-picker shown for all circle types; label in accent colour for `parents` circles for visual prominence
    - Edit mode in `MemoryModal`: child chip-picker lets owner update tagged children after upload
    - RLS: members can read ChildProfile and memory_children; only owner can insert/delete
    - Tests: 17 unit tests for `computeBabyAge`, 7 E2E tests (including pill display and modal pill), 3 RLS tests for ChildProfile + 3 for memory_children (total 24)
  - [x] 4.10.6 Member tagging ("Who's in this memory?"): per-memory tagging of circle members via `memory_members` junction table
    - Migration 017: `memory_members` table (memory_id, user_id) — RLS: members can read, uploader can insert/delete
    - `POST /api/memories/[id]/members` — replace-all endpoint; notifies newly-tagged members by email (fire-and-forget); validates userIds are circle members
    - `GET /api/timeline` extended: each memory embeds `memory_members(user_id, user!user_id(id, first_name, last_name, avatar_url))`; response includes `members[]` for the upload-form picker
    - Upload form: member chips (avatar + first name) combined with child chips in a single "Who's in this memory?" section; available on all circle types; batch mode applies shared selection to all items
    - `MemoryModal` view mode: "with" label (small-caps muted) + avatar chips (photo or initials + first name) shown below child age pills
    - `MemoryModal` edit mode: combined chip-picker; `saveEdit` calls PATCH + `/children` + `/members` in parallel
    - `PolaroidCard`: muted "with" label + overlapping avatar bubbles (max 4 + "+N" overflow), below child age pills; clearly separates people-in-photo from date/author metadata
    - Tagged member receives email: "X tagged you in a memory in [Circle]" (en + zh-CN)
    - RLS: members can read `memory_members`; only the uploader (owner_user_id) can insert/delete — same as `memory_children`
    - `memory_members.user_id` FK targets `public.User(id)` (not `auth.users`) so PostgREST can join profile data (migration 019)
    - Tests: 6 E2E tests (`tests/member-tagging.spec.ts`), 3 RLS tests (total 27)
  - [ ] 4.10.2 Location tag: text field on upload + EXIF GPS auto-fill, shown below memory date (suggested first for `travel` circles)
  - [ ] ~~4.10.3 Health event types~~ — **cut from Phase 1.** Caregiving as a circle type serves a fundamentally different emotional use case (health logging, clinical notes, PDF export) that doesn't fit the core product tone and isn't in the 0→50 user target. `circle_type = 'caregiving'` remains in the enum for copy/chips; caregiving-specific features are deferred to Phase 2. The `caregiver` *role* (nanny/babysitter on a parents circle) is unaffected — already implemented.
  - [x] 4.10.4 Anniversary anchoring: `anniversary_date DATE` on `Circle` (migration 020, also drops unused `date_of_birth`); owner sets date in `/circle-settings` (couple circles only); timeline header shows "Year N together · Since [date]" / "X days together" computed from today; `PATCH /api/circles/:id` accepts `anniversaryDate`; RLS tests 16-18 updated to cover `anniversary_date`. Logic extracted to `app/composables/useAnniversaryDisplay.ts` (`computeAnniversaryDisplay`); 13 unit tests (`unit/useAnniversaryDisplay.test.ts`); 6 E2E tests (`tests/anniversary.spec.ts`)
  - [x] 4.10.5 Circle type picker in `/circle-settings`: owner-only 2-column grid of all 8 types (matching onboarding), pre-selected on current type; save button enabled only when selection differs; calls `PATCH /api/circles/:id` with `circleType`; the `custom` type is labelled "Other" (no i18n key needed). No migration required — endpoint already supported `circleType`. 6 E2E tests (`tests/circle-type.spec.ts`); RLS tests 28-29 (total 29) verify owner can update `circle_type` and admin cannot.
- [x] 4.4 Value proposition screens (3 swipeable screens shown once on first open)
- [x] 4.5 Viewer-role UX (first-open splash, swipe nav, guest reactions — applies to viewer role, not grandparents specifically)

### Milestone 5: Media Upload
- [x] 5.1 Upload Edge Function (quota check, size check, storage)
- [x] 5.2 Upload UI component (file picker, preview, progress bar)
- [x] 5.3 Batch upload with automatic mem_date detection (multi-select, EXIF extraction, per-item progress). `multiple` file input; `extractExifDate()` tries `DateTimeOriginal → CreateDate → DateTime → file.lastModified → today`; videos skip EXIF entirely; group-date field shown when N > 1; sequential uploads with per-item progress overlay. No "from photo" source label (spec simplified — date is pre-filled silently). No new API surface — reuses existing `upload-media` edge function per file.


### Milestone 6: Timeline
- [x] 6.1 Signed URL API (cursor-based, memory_date ordering)
- [x] 6.2 Timeline UI — Polaroid Wall (monthly sections, year badge, jump modal, month overflow page)
  - Month overflow page (`/timeline/[year]/[month]`) paginated: 24 memories per page, cursor-based, explicit "Load more" button (replaced IntersectionObserver sentinel); previously fetched up to 100 at once
  - API: `yearMonth` branch accepts `cursor` param and returns `nextCursor`; uses PAGE_SIZE+1 probe to detect last page
  - Main timeline (`/timeline`) loads one calendar year at a time: API auto-detects the latest year on first load (no `year` param), returns `prevYear: number | null` for subsequent "Load older year" calls; `YEAR_LIMIT = 156` safety cap (12 months × 13 memories/month). `getLatestYear` and `getPrevYear` are single LIMIT-1 queries on the indexed `memory_date` column; both run in parallel with `Promise.all`. `timeline/index.vue` uses `prevYear` ref instead of `nextCursor`.
  - Timeline refresh (after quick-note or upload): resets `memoriesFlat` + `prevYear` then calls `fetchTimeline()` directly
  - 7 E2E tests (`tests/month-overflow.spec.ts`), 3 E2E tests (`tests/timeline-year.spec.ts`)

### Milestone 7: Memory Features
- [x] 7.1 ~~Share to circle (visibility toggle)~~ — **cut.** All uploads are `circle`-visible; no private memory concept within a circle. Users who want a personal-only timeline create a `solo` circle. The `private` visibility value remains in the DB enum and RLS for schema continuity but the UI never exposes it.
- [x] 7.2 Milestones (picker + custom milestone) — free-text `milestone_label` field in upload form and `MemoryModal` edit mode; circle-type-aware quick-pick chips via `useCircleTypeConfig`; label stored and displayed with ✦ badge. `milestone_is_custom` is a dead column (chips store display text directly, not i18n keys — drop in a future migration). 7.2.1 triggers on `milestone_label IS NOT NULL`.
- [x] 7.2.1 Milestone share card — after saving a milestone (`milestone_label IS NOT NULL`), offer a branded canvas card (Instagram Stories / WhatsApp format) with "Our Story" watermark CTA — primary acquisition channel for new parents
  - Triggered automatically: single upload with milestone label → share prompt shown after upload completes; MemoryModal edit → shown when milestone label newly added (was null, now non-null)
  - Card generated entirely client-side via Canvas API — no server round-trip, no public URL required
  - Two formats: 9:16 (Instagram Stories, 1080×1920) and 1:1 square (WhatsApp/general, 1080×1080); toggle in UI
  - Card design: full-bleed photo (cover-fit) → bottom vignette gradient → italic serif milestone label (with word-wrap) → month/year date → child age pills (if tagged) → "Our Story" wordmark + `ourstory.tinybit.app` URL
  - Share actions: native Web Share API (files) on mobile; download fallback on desktop; clipboard copy (`navigator.clipboard.write`)
  - CORS: uses `crossOrigin = 'anonymous'` on photo load; graceful error state if signed URL blocks canvas draw (only an issue in MemoryModal — upload uses local blob URL)
  - `MilestoneShareModal` component (`app/components/MilestoneShareModal.vue`); preview canvas renders at device pixel ratio for crispness; download canvas renders at full resolution
  - i18n: `milestone.*` keys in `locales/en.json` and `locales/zh-CN.json`
  - No migration, no API changes — purely client-side feature
- [x] 7.3 Quick note (text-only memory, no photo required)
  - `AddMemorySheet` bottom sheet (choice: "Photo or video" vs "Quick note") replaces direct upload trigger on timeline
  - `QuickNoteForm` modal: textarea (auto-focus), optional milestone label, date picker (defaults today via `toLocaleDateString('en-CA')`), people/child chips; accent stripe matches `AddMemorySheet`
  - `POST /api/memories/quick-note` — creates Memory row with no MemoryMedia; validates membership; optionally tags children/members
  - `todayIso()` helper uses local timezone (not UTC) so date matches user's wall clock
  - i18n: `quickNote.*`, `addMemory.*` keys in `locales/en.json` and `locales/zh-CN.json`
  - Timeline refresh: resets `memoriesFlat` + `prevYear` then calls `fetchTimeline()` directly (not `refreshNuxtData()` which is a no-op for manually fetched data)
  - **`QuickNoteCard`** (`app/components/QuickNoteCard.vue`) — postcard-style card, 210px wide, tilts with same physics as PolaroidCard; red pin, italic "Quick note" label + hairline divider (distinct from milestone stamp), milestone stamp if present, note text (12.5px, line-clamp-5), divider, footer row 1 (date · author + emoji picker button), footer row 2 (reaction chips), child age pills, tagged member avatars
  - **`QuickNoteModal`** (`app/components/QuickNoteModal.vue`) — dedicated detail modal for note-only memories; no tabs; editorial quote top area (warm accent-tinted bg, 130px Georgia `"` mark, italic 17px note text, "Quick note" label top-right, date bottom-right, milestone stamp); slim info row (date · author, edit pencil for owner, child pills, tagged members, reactions with tooltips + emoji picker); edit mode (milestone + note inputs, people picker, save/cancel — no internal scrollbar); full comments section (input + thread with inline editing); same open/close spring animation as `MemoryModal` (flies from card origin rect)
  - Routing: `onOpenMemory` checks `!memory.memorymedia.length && memory.note` → opens `QuickNoteModal`; photo/video memories continue to open `MemoryModal` — wired in both `timeline/index.vue` and `timeline/[year]/[month].vue`
  - Tests: 11 E2E tests (`tests/quick-note.spec.ts` — 7 creation flow + 4 QuickNoteModal), 12 unit validation tests, RLS tests 19-20 (member can insert, non-member blocked)
- [x] 7.4 Image quality: verify originals stored untouched, thumbnails served via Supabase Image Transformations
  - Upload Edge Function stores the raw file buffer without any processing — originals preserved at full quality
  - Main timeline API (`GET /api/timeline`) generates `thumbnailUrl` (800px WebP, 85% quality) alongside `url` (full-res, 1h expiry) for all image media via `createSignedUrl` transform option
  - Viewer timeline API (`GET /api/viewer/timeline`) updated: selects `media_type` from DB (replaces fragile extension parsing); images use 800px WebP transform; videos keep full-res URL
  - PolaroidCard + MemoryCard use `thumbnailUrl` for display; MemoryModal uses `url` (full-res) for the lightbox view
- [x] 7.5 Media download & share (save to device, shareable card with watermark)
  - **Save to device**: download icon button overlaid on the photo/video area in MemoryModal; `fetch()` → Blob → `<a download>` click; works for both photos and videos; button disabled while in-flight
  - **Share with watermark** (images only): draws photo on an offscreen canvas, adds "Our Story" text watermark (bottom-right, bold, semi-transparent white with drop shadow); uses Web Share API with files on mobile, download fallback on desktop; gracefully falls back to plain download if CORS blocks the canvas draw or share is cancelled
  - Share button hidden for video memories (canvas cannot watermark video in the browser)
  - No server changes — purely client-side, no new API routes
  - i18n: `modal.saveToDevice` and `modal.sharePhoto` added to `locales/en.json` and `locales/zh-CN.json`
  - Tests: 4 E2E tests (`tests/media-download.spec.ts`) verifying button presence per media type

### Milestone 8: Comments & Reactions
- [x] 8.1 Comments (post, read, delete own)
  - DB schema: `MemoryComment(id, memory_id, user_id, body, created_at)` with RLS — members can read/post, users can delete own (migration 001/002)
  - `GET /api/memories/[id]/comments` — verifies circle membership, returns comments with user profile
  - `POST /api/memories/[id]/comments` — verifies circle membership, inserts comment, returns updated list
  - `PATCH /api/memories/[id]/comments/[commentId]` — verifies ownership, updates body
  - `DELETE /api/memories/[id]/comments/[commentId]` — verifies ownership, deletes comment
  - `MemoryModal` comments tab: load on open, post (textarea + Enter or Post button), edit own (pencil icon on hover), delete own (trash icon on hover); "View N older" pagination (show last 5, expand on click)
  - `QuickNoteModal` comment section: same functionality at the bottom of the modal
  - Delete button rendered via `v-if` (absent from DOM for others' comments), appears alongside edit pencil on hover as a pair of icon buttons
  - i18n: `modal.deleteComment` added to `locales/en.json` and `locales/zh-CN.json`
  - **"Edited" indicator**: `updated_at TIMESTAMPTZ` column added to `MemoryComment` (migration 022, nullable — NULL = never edited); PATCH API sets it on every edit; GET/POST APIs return it; UI shows `· edited` label next to timestamp when non-null
  - **UPDATE RLS**: migration 022 adds `users can update own comments` policy (previously missing — PATCH worked via service role bypass but RLS was incomplete)
  - **Delete confirmation**: trash icon now triggers an inline confirmation row ("Delete this comment? Delete | Cancel") rather than deleting immediately; Cancel dismisses it, Delete calls the API
  - Tests: 7 E2E tests (`tests/comments.spec.ts`) covering load, post, delete confirmation flow, ownership-conditional button checks, QuickNoteModal parity
- [x] 8.2 Emoji reactions (toggle on/off)
  - `POST /api/memories/:id/reactions` — toggle semantics: delete if own reaction already exists for that emoji, insert if not; returns fresh reactions for the memory
  - RLS: circle members can read and insert reactions; users can only delete their own; non-members blocked (policies in migration 002)
  - `PolaroidCard`: reaction overlay (`v-if="isHovered"`) at bottom of photo — chips per emoji group (count + mine highlight) + `+` picker button (12 preset emojis); optimistic toggle with server reconciliation
  - `QuickNoteCard`: always-visible footer reaction chips + `+` picker trigger; same toggle logic
  - `MemoryModal`: inline reactions row with chips (tooltip shows reactors' names) + `+` picker; toggles via same API
  - `QuickNoteModal`: identical reactions row at bottom of info area
  - Tests: 7 E2E tests (`tests/reactions.spec.ts`) covering chip render on hover, picker open, POST called on pick, toggle-off (own reaction), MemoryModal and QuickNoteModal parity
  - RLS tests 38–40 (total 40): member can insert, non-member blocked, user cannot delete another's reaction

### Milestone 8.5: Localization (i18n — English + Chinese)
- [x] 8.5.1 Install `@nuxtjs/i18n`, configure `en` + `zh-CN` locales (lazy-loaded JSON files)
- [x] 8.5.2 Extract all UI strings to `locales/en.json` — replace every hardcoded string with `t('key')`
- [x] 8.5.3 Translate `locales/zh-CN.json` (Simplified Chinese)
- [x] 8.5.5 Language toggle in header + avatar dropdown (persisted to `User.locale` in DB)
- [x] 8.5.4 Translate `locales/fr.json` (French — Canadian bilingual requirement)
  - Migration 023: expands `user_locale_check` to `('en', 'zh-CN', 'fr')`
  - `locales/fr.json` — full Canadian French translation of all 21 key groups
  - `nuxt.config.ts` updated: `{ code: 'fr', name: 'Français', shortLabel: 'FR', file: 'fr.json' }`
  - `LocalePicker.vue`: added `data-testid="locale-picker"` for E2E targeting
  - Tests: 8 E2E tests (`tests/language.spec.ts`) covering picker visibility, FR/zh-CN/EN switching, label update, and PATCH /api/profile call; RLS tests 41-43 verify user can update own locale (lives_ok + is), cannot update another user's locale (total 43)
- Note: use `Intl.DateTimeFormat` for all dates from day one — never hardcode `MM/DD/YYYY`
- Note: see design spec §Localization for full setup code and priority language rationale

### Milestone 9: Viewer-Role Access
- [x] 9.1 Generate view-only JWT link (UI in app — "Share link" button on timeline header, owner-only)
  - `viewer_link` table: nonce-based revocation, three modes (`full`, `date_range`, `selection`), 30-day expiry, `notified_expiry_at` for future cron
  - JWT payload extended: `viewer_link_id` + `nonce`; viewer API verifies both on every request (row deleted = instant revocation)
  - API: `GET/POST/DELETE /api/circles/[id]/viewer-links` (owner-only); `DELETE` revokes link immediately
  - `ShareLinksSheet.vue` — bottom sheet: link list with copy/revoke/renew, expired badge, inline revoke confirm
  - `CreateLinkSheet.vue` — mode picker, label input, create/edit flow; uses `useMemoryPicker` composable via provide/inject
  - `MemoryPicker.vue` — timeline-style grouped memory grid (year/month headers, collapse, selection checkboxes); injects composable, zero props
  - `useMemoryPicker.ts` — data loading, selection state, grouping logic, batch loading with cursor pagination
  - `view.vue` updated: mode banner, empty state, referral CTA after 3+ memories scrolled, all strings i18n'd
  - i18n: 40+ `viewerLink.*` keys in en/zh-CN/fr
  - RLS: owner-only SELECT/INSERT/DELETE; member, admin, cross-circle all blocked (53 pgTAP tests)
  - 9 E2E tests (`tests/viewer-link.spec.ts`); 372 unit tests
  - Deferred: 3-day expiry email cron (requires `notified_expiry_at` column — already in migration); guest reaction globe indicator (needs tooltip redesign)
  - See spec: `docs/superpowers/specs/2026-04-24-viewer-link-design.md`
- [x] 9.2 View-only page `/view?token=<jwt>` (no auth required) — implemented in §4.5
  - Shows circle-visible memories, newest first, max 50, ordered by memory_date
  - Photos and videos supported (mediaType detected server-side from file extension)
  - First-open splash, guest reactions with name prompt, expired-link UX
- Note: tech-savvy family members should be invited as full members — viewer role is for anyone who won't create an account, not a grandparent-specific path

### Milestone 9.5: Guest Contributor / Event QR Code *(Phase 3 — do not build in Phase 1)*

> **Do not build this in Phase 1.** The spec classifies Guest Contributor as a Phase 3 viral/growth mechanic — it requires active users and events to generate acquisition value. Build Milestone 9 (Viewer-Role) instead. See design spec §Phase 3 build list.

- [ ] 9.5.1 *(Phase 3)* Circle owner generates a guest upload token (scoped to one event, expires in 7 days)
- [ ] 9.5.2 *(Phase 3)* Guest upload page at `/event?token=abc` — name entry + photo upload, no account required
- [ ] 9.5.3 *(Phase 3)* Uploaded photos appear on the timeline tagged as guest contributions
- [ ] 9.5.4 *(Phase 3)* Post-upload CTA: "Want your own family circle? Create one free →"
- Note: every event (wedding, birthday, reunion) becomes an acquisition moment — guests experience the product before being asked to sign up
- Note: see design spec §Guest Contributor for full token flow

### Milestone 10: Push Notifications & On This Day
- [ ] 10.1 Basic push (new upload, comment, reaction) — Web Push via VAPID + service worker; inline dispatch from Nitro routes; upload notifications triggered by client post-upload; batch coalescing via notification tags (30-min rolling window, silent replacement); contextual permission prompt banner on timeline; push_enabled + circle_muted toggles in circle settings *(implementation complete — pending end-to-end test)*
  - PWA foundation: manifest.json, service worker (push + notificationclick), app icons, client plugin for SW registration
  - PushSubscription table with RLS (migration 026); subscribe/unsubscribe API routes
  - `usePushNotifications` composable (requestPermission, unsubscribe, isSupported, permissionState)
  - `sendPushToCircle` utility checks NotificationPreference (push_enabled, circle_muted, quiet hours) before dispatch
  - `buildPushPayload` with batch coalescing: counts uploads in last 30 min; singular/plural title; `renotify: false` for silent updates
  - Triggers: `POST /api/push/notify` (client calls after upload), inline in comments.post, reactions.post, quick-note.post
  - Notification settings moved to dedicated `/notification-settings` page (10.3) — accessible to all members via bell icon in timeline header
  - **E2E test plan** (manual, two browsers on localhost — Chrome allows Web Push on localhost without HTTPS):
    1. Open `http://localhost:3001/timeline` in Chrome as User A → push prompt banner should appear → click "Enable" → allow browser permission → verify `pushsubscription` table has a row for User A
    2. Open incognito/different browser as User B (same circle) → upload a photo or post a quick note
    3. Verify User A receives push notification: *"{name} added a memory"* → click it → should open timeline with the memory
    4. Batch coalescing: User B uploads 3 photos quickly → User A should see one notification that silently updates to *"{name} added 3 memories"* (buzzes once, updates silently)
    5. Comment: User B comments on a memory → User A notification: *"{name} commented"* with comment text
    6. Reaction: User B reacts with emoji → User A notification: *"{name} reacted {emoji}"*
    7. Mute: User A (if owner) goes to `/circle-settings` → toggle "Mute this circle" on → User B uploads → User A gets no notification → toggle off → User B uploads → notification appears
    8. Snooze banner: clear localStorage → refresh timeline → banner appears → click "Later" → refresh → banner stays hidden → clear `push_prompt_snoozed_at` from localStorage → banner reappears
    9. Note: Web Push requires HTTPS in production; `localhost` is an exception for dev. If testing on a non-localhost domain, HTTPS is required
- [ ] 10.2 On This Day daily cron — activates at 30+ memories and 90+ days since first upload; below threshold substitutes weekly "A memory from your first month" notification — build for all users in Phase 1 (no tier check); add Plus gate in Phase 2 alongside Stripe billing
- [x] 10.3 Notification preferences page — dedicated `/notification-settings` page accessible to all members; per-circle push toggle, mute toggle, email digest frequency (weekly/monthly/off, default monthly); circle selector for multi-circle users; bell icon in timeline header; notification toggles removed from circle-settings
  - Migration 027: `email_digest_frequency` CHECK constraint updated to include `'monthly'`; default changed from `'weekly'` to `'monthly'`
  - Quiet hours UI deferred (backend already checks in `sendPushToCircle`); daily digest option dropped
  - **Phase 2 Capacitor migration note:** When adding native push (FCM/APNs), the 10.1 architecture stays intact. Changes needed: (1) add `platform` column to PushSubscription (`'web' | 'fcm' | 'apns'`), (2) `sendPushToCircle` branches on platform — web → `web-push`, FCM/APNs → respective APIs, (3) `usePushNotifications` detects `Capacitor.isNativePlatform()` and uses `@capacitor/push-notifications` plugin instead of PushManager, (4) deep links handled by Capacitor `appUrlOpen` listener instead of SW `notificationclick`. Web Push keeps working for browser users — both paths coexist.

### Milestone 11: PWA & Mobile Polish
- [ ] 11.1 PWA offline asset caching — service worker upgraded with install/activate/fetch handlers; cache-first for Nuxt build assets (`_nuxt/*`) and static files (images, fonts, icons); network-first with cache fallback for HTML pages; API/Supabase calls bypass cache; manifest enriched (description, scope, orientation, categories, maskable icons)
  - Manifest and SW registration already existed from 10.1 (push notifications); this step adds caching strategies
  - `CACHE_NAME` versioned (`our-story-v1`) — bump on breaking changes to purge old caches
  - `skipWaiting()` + `clients.claim()` for immediate activation
  - No offline upload queue (Phase 2 with Capacitor)
- [ ] 11.2 Mobile-first CSS (tap targets, safe areas, no zoom)
- [ ] 11.3 Performance targets (Lighthouse CI)
- [ ] 11.4 Add to Home Screen prompt

### Milestone 12: Early Retention Hooks
- [ ] 12.1 Weekly digest email — grandparent-first design, one-tap email reactions
- [ ] 12.2 Milestone suggestions — triple-nudge (T-3, T+0, T+3 follow-up), auto-calculated from ChildProfile.date_of_birth
- [ ] 12.3 First-memory anniversary (30-day cron)
- [ ] 12.3.1 "Your first month" recap email — sent 30 days after first upload, shows memory count, milestone highlights, and top reaction; simpler than Year in Review but creates a felt delight moment early
- [ ] 12.4 Quiet circle nudge (14-day inactivity → owner push only, max 3 nudges, min 14 days between, hard stop after 3 ignored — add `quiet_nudge_count` + `quiet_nudge_last_sent_at` to Circle table)

### Milestone 13: Pre-Launch Checklist
- [ ] Auth: verify magic link on device 2 does not invalidate existing session on device 1 — test with two devices simultaneously; if it does, switch to PKCE flow (see design spec §Magic link session behavior)
- [ ] Security: RLS tests passing + manual privacy breach tests
- [ ] Security: HTTP headers verified (securityheaders.com)
- [ ] Security: `pnpm audit --audit-level high` zero high/critical vulnerabilities
- [ ] Security: OWASP ZAP scan on staging — all critical/high resolved
- [ ] Security: service role key absent from client code
- [ ] Data: quota enforcement, memory date ordering, invite single-use
- [ ] Testing: unit + E2E passing (Stripe webhook tests belong in Phase 2 pre-launch — no billing in Phase 1)
- [ ] UX: onboarding tested on real iOS + Android devices
- [ ] UX: Lighthouse ≥ 80, axe-core zero critical violations
- [ ] Email: SPF / DKIM / DMARC configured + inbox delivery verified
- [ ] Legal: privacy policy + ToS live, age gate, GDPR deletion tested
- [ ] UX: privacy dashboard in settings — "Your photos are stored privately. 0 third parties have access. No ads. No AI training." — something users can screenshot and share as social proof
- [ ] Monitoring: Sentry, Better Uptime, Vercel alerts all configured
- [ ] Support: Crisp working, support email confirmed

---
