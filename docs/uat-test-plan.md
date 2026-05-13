# Our Story — Phase 1 UAT Test Plan

**Scope:** every user-facing feature in `docs/build-plan.md` Milestones 1–12.
**Out of scope:** Stripe (Phase 2), Capacitor native (Phase 2), Guest contributor (Phase 3), Linked logins (Phase 2).

**Priority key:**

- **P0** — blocks launch (auth, upload, timeline, RLS-sensitive paths)
- **P1** — important for credibility (notifications, sharing, i18n)
- **P2** — polish (PWA install, edge-case copy)

**Test environments to cover:**

- Desktop Chrome (primary)
- Desktop Safari (canvas/share quirks)
- iOS Safari on real iPhone (most fragile)
- Android Chrome on real device (push, install, EXIF)

**How to use:** walk each section sequentially with at least 2 accounts (Owner = O, Member = M). Use a third Viewer (V) browser/incognito for the guest tests.

---

## A. Authentication & Onboarding

### A.1 — Sign up with magic link (P0)

1. Open `/` in clean browser → click "Start your circle — free"
2. Enter a fresh email → "Send magic link"
3. Open inbox → click the magic link
4. Land on `/confirm` → wait for redirect
5. If first-time: complete profile (first name, last name)
   **Expected:** email arrives < 60s; clicking lands authenticated; PostHog Live Events shows `user_signed_up`; redirected to `/onboarding` (no circle yet).

### A.2 — Returning user login (P0)

1. Log out → revisit `/login` → enter same email
2. Click link from inbox
   **Expected:** redirected to `/timeline` (NOT to `/onboarding`); NO `user_signed_up` event in PostHog this time.

### A.3 — Direct visit to `/confirm` without auth (P1)

1. Log out → manually navigate to `/confirm`
   **Expected:** spinner shows briefly → redirect to `/login` after 5s (no infinite spinner).

### A.4 — Auth middleware on protected route (P0)

1. Log out → manually navigate to `/timeline`
   **Expected:** redirected to `/login`.

### A.5 — Profile completion required for magic-link signups (P1)

1. Sign up with new email (A.1) but bail BEFORE completing first/last name
2. Refresh / revisit any page
   **Expected:** routed back to profile setup until name is saved.

### A.6 — Onboarding: circle-type picker (P0)

1. Pick each circle type one-by-one (parents, couple, family, friends, caregiving, travel, solo, custom)
   **Expected:** each card highlights on tap; "Continue" advances.

### A.7 — Onboarding: circle name + create (P0)

1. After picker → name your circle → "Continue"
   **Expected:** circle created; PostHog `circle_created` event fires with correct `circle_type`; Solo type redirects straight to `/timeline`, others go to `/onboarding/invite`.

### A.8 — Onboarding: skip invite (P1)

1. On `/onboarding/invite` → click "Skip for now"
   **Expected:** lands on `/timeline`; empty state shown.

### A.9 — Onboarding: send invite (P0)

1. On `/onboarding/invite` → enter Member email → "Send"
   **Expected:** "Sent to <email>" confirmation; PostHog `member_invited` event; M's inbox receives invite.

### A.10 — Value-proposition screens shown on first open (P1)

1. New user lands on `/timeline` for the first time
   **Expected:** 3 swipeable value-prop screens before timeline; dismissible; never shown again after dismiss.

---

## B. Invites & Joining

### B.1 — Accept invite (new user) (P0)

1. M (new email, not registered) clicks invite link in inbox
2. Pre-validates → "Sign in to join"
3. Enters email → magic link → completes profile
   **Expected:** auto-added to O's circle; lands on `/timeline?circle=...&welcome=1`; PostHog `member_joined` event.

### B.2 — Accept invite (existing user) (P0)

1. M already has an account; O sends them an invite for a different circle
2. M clicks link while logged in
   **Expected:** added to new circle; no re-auth required; circle switcher in nav shows both circles.

### B.3 — Expired invite link (P1)

1. Manually expire (or wait 7 days) → click link
   **Expected:** "This invite has expired" page with "Go to sign-in" CTA; never asked to sign in first.

### B.4 — Circle-deleted invite link (P1)

1. O deletes circle → click old invite link
   **Expected:** "This circle no longer exists" message.

### B.5 — Cannot reuse an accepted invite (P0)

1. Accept invite as M.1 → try same link in another browser
   **Expected:** error/already-used state; no duplicate membership.

### B.6 — Owner cap: 10 pending invites per circle (P1)

1. As O, send 10 invites to distinct emails → try 11th
   **Expected:** 429 error message "Max 10 pending invites per circle".

### B.7 — Resend invite to same email (P1)

1. Send invite to email X → before X accepts, send again
   **Expected:** old invite expires, new 7-day window starts, only 1 pending row counts toward the cap.

---

## C. Multi-Circle

### C.1 — Switch active circle (P0)

1. User belongs to 2+ circles → click circle switcher → pick the other
   **Expected:** URL `?circle=` updates; timeline reloads with that circle's memories.

### C.2 — Create a second circle (P1)

1. As existing user, go through `/onboarding` again
   **Expected:** New circle created; redirected to `/?circle=<newId>`; both circles in switcher.

### C.3 — No-circle holding screen (P1)

1. As user with no active membership (e.g. owner deleted circle, member kicked) → visit any protected route
   **Expected:** lands on `/no-circle` (not the new-user onboarding); shows "Create a circle" + "Wait for invite" CTAs.

---

## D. Memory Upload

### D.1 — Single photo upload (P0)

1. From `/timeline` → tap "+" → "Photo or video" → pick a photo
2. Optional: note, milestone, child/member tags, date
3. Upload
   **Expected:** progress overlay; success; new polaroid appears on timeline; PostHog `memory_uploaded` (`memory_type: photo`) and `memory_shared_to_circle` events.

### D.2 — Single video upload (P1)

1. Same as D.1 but pick a video (under 50MB)
   **Expected:** uploads; thumbnail/preview shows in card; modal plays video.

### D.3 — Quick note (text-only memory) (P0)

1. "+" → "Quick note" → type something → save
   **Expected:** new postcard-style card on timeline (red pin, italic "Quick note" label); PostHog event with `memory_type: note`; opens `QuickNoteModal` (not `MemoryModal`).

### D.4 — Multi-item: "Post as one memory" mixed (P0)

1. "+" → "Photo or video" → select 3 files (photos + video) → toggle "Post as one memory" → add a text slide
2. Reorder, set a cover → upload
   **Expected:** single timeline card with stack visual and ⊕N count badge; modal shows swipe carousel; PostHog `memory_type: mixed`.

### D.5 — Multi-item: "Post separately" (P0)

1. Same as D.4 but toggle OFF "Post as one memory"
   **Expected:** N separate memories created; each fires its own `memory_uploaded` event.

### D.6 — EXIF date auto-fill (P1)

1. Pick a photo with EXIF GPS+date metadata
   **Expected:** memory date pre-fills from EXIF `DateTimeOriginal`, NOT today's date.

### D.7 — File too large (P1)

1. Upload a photo >20MB or video >50MB
   **Expected:** clear error toast with locale-aware message; upload blocked.

### D.8 — Storage quota full (P1) — _skip if storage well under cap_

1. Upload until storage tier exhausted
   **Expected:** "storage full" error; no half-uploaded rows.

### D.9 — Edit memory: change note, milestone, date (P0)

1. Open a memory you own → pencil icon → change fields → save
   **Expected:** values update on modal and timeline card; `updated_at` reflected.

### D.10 — Edit memory: tag children (P1)

1. Open own memory → edit → pick children from chip-picker → save
   **Expected:** age pill appears (`Emma · 3 months, 2 weeks`); multiple children = multiple pills.

### D.11 — Edit memory: tag members (P1)

1. Edit memory → "Who's in this memory?" → pick members
   **Expected:** tagged members get an email; "with" label + avatar chips on card/modal.

### D.12 — Edit slides on multi-item (P1)

1. Open a multi-item memory you own → edit
2. Add a text slide, remove one, reorder, set new cover
   **Expected:** each action persists; carousel order updates; cover thumbnail changes on timeline.

### D.13 — Non-owner cannot edit (P0 — privacy)

1. As M, open a memory uploaded by O
   **Expected:** no edit pencil, no delete, no chip-pickers in edit mode.

---

## E. Milestones

### E.1 — Add milestone from chip (P1)

1. Upload memory → tap a milestone chip (e.g. "First steps")
   **Expected:** label fills text field; ✦ badge on card after upload; PostHog `milestone_created` event with `milestone_type: "suggested"`.

### E.2 — Add free-form milestone (P1)

1. Upload memory → type custom milestone like "Emma's first day at school"
   **Expected:** ✦ badge shows the custom text; PostHog event with `milestone_type: "custom"` (NOT raw text).

### E.3 — Milestone share card (P0 — acquisition channel)

1. Upload memory with a milestone OR edit existing memory to add milestone
   **Expected:** `MilestoneShareModal` auto-opens after save; full-bleed photo + italic milestone + date + child age pills + "Our Story" wordmark; toggle 9:16 ↔ 1:1; "Share" uses Web Share API on mobile, downloads on desktop.

### E.4 — Milestone label persists on edit (P2)

1. Edit a memory that already has a milestone → don't change it → save
   **Expected:** no duplicate `milestone_created` event (only fires when label goes from null → non-null).

---

## F. Timeline

### F.1 — Polaroid wall renders (P0)

1. Open `/timeline` with several memories across months
   **Expected:** monthly sections with year badge; photos tilt with slight rotation; cards never cropped weirdly.

### F.2 — Year jump modal (P1)

1. Tap year badge in nav → pick another year
   **Expected:** scrolls/loads that year's data.

### F.3 — Load older year (P1)

1. Scroll to bottom → "Load older year"
   **Expected:** previous calendar year's memories append; button hides when no more.

### F.4 — Month overflow page (P1)

1. Open a month with >13 memories → tap "View all N memories"
   **Expected:** `/timeline/<year>/<month>` shows 24 per page; "Load more" button paginates cursor-based.

### F.5 — Memory date ordering (P0)

1. Upload a photo with `memory_date` = 5 years ago
   **Expected:** appears in the correct historical month, NOT today.

### F.6 — Image quality: thumbnail vs full-res (P1)

1. Scroll the timeline → open a memory modal
   **Expected:** timeline cards use 800px WebP thumbnails; modal lightbox uses full-resolution signed URL.

### F.7 — Timeline updates immediately after upload (P0)

1. Upload a new memory → return to timeline
   **Expected:** new card appears without needing a hard refresh.

---

## G. Comments

### G.1 — Post comment (P0)

1. Open a memory modal → comments tab → type → Enter or "Post"
   **Expected:** comment appears at bottom; PostHog `comment_added` event; tag count on icon updates.

### G.2 — Edit own comment (P1)

1. Hover own comment → pencil → change text → save
   **Expected:** `· edited` label appears next to timestamp.

### G.3 — Delete own comment with confirmation (P1)

1. Hover own comment → trash → inline "Delete this comment?" → Delete
   **Expected:** comment removed; Cancel dismisses without deleting.

### G.4 — Cannot edit/delete others' comments (P0 — privacy)

1. Hover M's comment as O
   **Expected:** no pencil/trash icons visible (DOM should not contain them).

### G.5 — "View N older" pagination (P2)

1. Open memory with 10+ comments
   **Expected:** shows last 5 + "View N older" link; click expands all.

### G.6 — Comment parity in QuickNoteModal (P1)

1. Open a quick note → repeat G.1, G.2, G.3
   **Expected:** same flows work identically.

---

## H. Reactions

### H.1 — Hover/tap reaction picker (P0)

1. Hover (desktop) or tap (mobile) a polaroid → "+" emoji button → pick 😍
   **Expected:** chip appears at bottom of card with count 1; PostHog `reaction_added` with the emoji.

### H.2 — Toggle off own reaction (P0)

1. Tap the chip you just added
   **Expected:** chip disappears OR count decrements (if others reacted same); NO new PostHog event fires on toggle-off.

### H.3 — Multiple users react same emoji (P1)

1. O and M both react ❤️ on the same memory
   **Expected:** single ❤️ chip with count = 2; tooltip lists both names.

### H.4 — Reactions in MemoryModal (P0)

1. Open memory modal → repeat H.1
   **Expected:** chips render in info row; emoji picker opens correctly.

### H.5 — Reactions in QuickNoteModal (P1)

1. Open quick note → react via footer chips
   **Expected:** identical behavior to H.4.

---

## I. Children & Anniversary

### I.1 — Add child profile (P1)

1. As O of `parents` circle → `/circle-settings` → "Add child" → name + DOB
   **Expected:** child appears in list; available in upload chip-picker.

### I.2 — Remove child profile (P1)

1. Settings → trash a child
   **Expected:** child removed; existing memory tags unaffected (test that age pill doesn't appear anymore).

### I.3 — Non-owner cannot manage children (P0)

1. As M → `/circle-settings`
   **Expected:** no children manager section visible.

### I.4 — Age pill rendering (P1)

1. Tag a child on a memory dated 100 days after their DOB
   **Expected:** pill shows `<name> · 3 months, 1 week` exactly.

### I.5 — Set anniversary (couple circle) (P1)

1. As O of `couple` circle → `/circle-settings` → set anniversary date
   **Expected:** timeline header shows "Year N together · Since <date>".

### I.6 — Set trip date (friends/travel) (P2)

1. As O of `travel` or `friends` circle → set anchor date
   **Expected:** label is "Trip date" (not "Anniversary"); timeline shows years/days elapsed.

---

## J. Sharing & Viewer Links

### J.1 — Save photo to device (P1)

1. Open photo memory → tap download icon
   **Expected:** browser download of original file; works for photos AND videos.

### J.2 — Share photo with watermark (P1)

1. Open photo memory → tap share icon
   **Expected:** "Our Story" watermark drawn bottom-right; Web Share sheet on mobile; download fallback on desktop; falls back gracefully if CORS blocks canvas.

### J.3 — Share button hidden for videos (P2)

1. Open video memory
   **Expected:** download present, share button absent.

### J.4 — Create viewer link (full mode) (P0)

1. As O → timeline header → "Share link" → "Full circle" → name it → Create
   **Expected:** new link with copy/revoke/renew actions; 30-day expiry.

### J.5 — Create viewer link (date range) (P1)

1. Same flow → "Date range" → pick start/end
   **Expected:** link issued; opening it shows only memories in range.

### J.6 — Create viewer link (selection) (P1)

1. Same flow → "Specific memories" → pick 5 from MemoryPicker grid → Create
   **Expected:** link shows exactly those 5 memories.

### J.7 — Open viewer link (no auth) (P0)

1. V (logged out) opens link in incognito
   **Expected:** no auth prompt; first-open splash; memories visible per mode; max 50 ordered by memory_date desc.

### J.8 — Guest reaction on viewer page (P1)

1. V taps a reaction → name prompt → confirms
   **Expected:** reaction posts with guest name; rate-limited at 20/min per link.

### J.9 — Revoke viewer link (P0)

1. As O → share-links sheet → trash a link → confirm
   **Expected:** link instantly dies (verify by reloading V's tab — expired UX shown).

### J.10 — Member cannot create viewer links (P0)

1. As M → check for "Share link" button
   **Expected:** button hidden/disabled (owner-only feature).

### J.11 — Viewer-page referral CTA (P2)

1. V scrolls past 3 memories on view page
   **Expected:** "Start your own circle" CTA appears.

---

## K. Notifications (Push)

### K.1 — Push prompt banner shows on timeline (P1) [Chrome/Android]

1. New user on timeline → if push permission `default`
   **Expected:** "Stay in the loop" banner appears.

### K.2 — Enable push subscription (P1)

1. Tap "Enable" → grant browser permission
   **Expected:** subscription saved in DB; banner disappears.

### K.3 — Receive push on upload (P1)

1. M enabled push; O uploads a memory
   **Expected:** M's device shows notification "<O> added a memory"; tap opens timeline with that memory.

### K.4 — Receive push on comment (P1)

1. M enabled; O comments on a memory
   **Expected:** notification "<O> commented" with comment preview.

### K.5 — Receive push on reaction (P2)

1. M enabled; O reacts with emoji
   **Expected:** notification "<O> reacted ❤️".

### K.6 — Batch coalescing (P1)

1. O uploads 3 memories in quick succession
   **Expected:** M's device shows ONE notification that silently updates to "<O> added 3 memories"; buzzes once.

### K.7 — Mute circle suppresses push (P1)

1. M opens `/notification-settings` → toggle "Mute" for that circle → O uploads
   **Expected:** no push to M.

### K.8 — Snooze banner persistence (P2)

1. Push banner shows → "Later" → refresh
   **Expected:** banner stays hidden for 14 days.

### K.9 — Quiet hours (P2)

1. Set quiet hours via API (no UI yet) → trigger push during those hours
   **Expected:** push not delivered; logged as skipped.

### K.10 — iOS push (currently NOT supported in Phase 1 web) (P1)

1. Test on iOS Safari
   **Expected:** push prompt does NOT appear (no Web Push on iOS web); document this clearly.

---

## L. Email Notifications

### L.1 — Weekly digest (P1) [requires pg_cron set up + Resend live key]

1. Set M's `email_digest_frequency = 'weekly'`; circle has uploads in last 7d → wait for/trigger cron
   **Expected:** email arrives; subject mentions child name + age (parents) or circle name; thumbnail signed URLs work for 7 days; "Open Our Story to react ❤️" deep-links correctly.

### L.2 — Monthly digest (P1)

1. Set `email_digest_frequency = 'monthly'`; trigger monthly cron
   **Expected:** monthly email same structure; idempotent (won't send twice in same period).

### L.3 — Digest skipped for muted user (P0 — privacy)

1. Set `circle_muted = true` → run digest cron
   **Expected:** no email to that user.

### L.4 — Digest skipped for `frequency = 'off'` (P1)

**Expected:** no email even when others receive.

### L.5 — Empty-period skip (P2)

1. Run weekly cron when circle had zero uploads in 7d
   **Expected:** entire circle skipped; nothing sent.

### L.6 — Milestone nudge T-3 (P1)

1. Add child with DOB 3 days before a milestone (e.g., 6mo - 3d)
2. Run `send-milestone-nudges` cron
   **Expected:** push (if subscribed) or email "Heads up — Emma turns 6 months in 3 days"; in-app banner on `/timeline`.

### L.7 — Milestone nudge T+3 skip rule (P1)

1. Set up T+3 nudge eligibility AND upload a memory with `milestone_label` set in the ±3-day window → run cron
   **Expected:** nudge skipped (user already commemorated).

### L.8 — In-app milestone banner click (P1)

1. With nudge active → click banner
   **Expected:** opens upload sheet with milestone label pre-filled.

### L.9 — First-month recap (P1)

1. Circle's `first_memory_at` = 30 days ago → run cron
   **Expected:** all members get the recap email (memory count, milestone count, top reaction, original first memory).

### L.10 — Quiet-circle nudge tier 1 (P1)

1. Circle inactive 14+ days → run cron
   **Expected:** owner-only email, gentle tone; `quiet_nudge_count` goes 0→1.

### L.11 — Quiet-circle nudge tier 3 + cap (P2)

1. Trigger nudges 3 times over 6 weeks → trigger a 4th
   **Expected:** 4th is suppressed; reset on next memory upload.

### L.12 — On This Day push (above threshold) (P1)

1. Circle has 30+ memories AND `first_memory_at` ≥ 90 days ago AND there's a memory with MM-DD matching today from a past year → run cron
   **Expected:** push "On this day, N years ago"; deep-links to that memory.

### L.13 — On This Day below-threshold weekly email (P2)

1. Small circle (<30 memories or <90 days old) → run cron
   **Expected:** "A memory from your first month" push or email; capped to once per 7 days.

---

## M. Settings & Account

### M.1 — Edit profile name (P1)

1. `/settings/account` → change first/last name → save
   **Expected:** name updated everywhere it appears (timeline header, comments, reactions).

### M.2 — Avatar upload (P2)

1. Upload an avatar
   **Expected:** appears on comments, reactions, member chips, header.

### M.3 — Language toggle (P0)

1. Open language picker (header or avatar dropdown)
2. Switch en → zh-CN → fr
   **Expected:** UI strings change immediately; persisted to `User.locale`; persists across refresh and login.

### M.4 — Dates respect locale (P1)

1. Set zh-CN → look at a memory's date
   **Expected:** `Intl.DateTimeFormat` formatting (e.g., `2026年5月11日`), not `MM/DD/YYYY`.

### M.5 — Edit circle name (P1)

1. As O → `/circle-settings` → change name → save
   **Expected:** new name shows in switcher, header, emails.

### M.6 — Change circle type (P1)

1. As O → `/circle-settings` → tap a different type in grid → save (button enables only when changed)
   **Expected:** copy and chips update accordingly; existing memories untouched.

### M.7 — Notification preferences (P1)

1. `/notification-settings` → for each circle: toggle push, mute, milestone reminders, digest frequency
   **Expected:** each persists; muting kills both push and email digest for that circle.

### M.8 — Notification preferences load without flicker (P2)

1. Open `/notification-settings` from a cold load
   **Expected:** controls render only AFTER data loads; no "monthly" → user's value flicker.

### M.9 — Data export request (P1)

1. `/settings/account` → pick circle → "Export"
   **Expected:** "Export queued" toast; email arrives with 24h-expiry download link containing ZIP of all media + JSON manifest.

### M.10 — Data export rate limit (P2)

1. Trigger 2 exports for the same circle back-to-back
   **Expected:** second one rejected ("already in progress") until first completes.

### M.11 — Member deletes own account, keep content (P0)

1. As M → `/settings/account` → delete → "Keep as Former member"
   **Expected:** comments/reactions deleted; memories remain showing "Former member"; 30-day soft delete; M cannot log in.

### M.12 — Member deletes own account, remove content (P0)

1. As M → delete → "Remove from circles"
   **Expected:** memories deleted; reactions deleted; soft delete; hard purge after 30 days.

### M.13 — Owner deletion: must resolve circles first (P0)

1. As O of a circle with multiple admins → delete account
   **Expected:** flow forces choice: auto-promote, transfer, or delete circle.

### M.14 — Owner deletion: only owner, no admins (P0)

1. As sole owner with no admins → delete account
   **Expected:** flow forces circle delete or admin promotion.

### M.15 — Circle deletion (owner) (P0)

1. As O → `/circle-settings` → "Delete circle" → type circle name → confirm
   **Expected:** warning shown; soft delete; all members emailed; member sessions land on `/no-circle`; hard purge after 30 days.

### M.16 — Cancel deletion during 30-day grace (P1)

1. Log in within 30 days of deletion request
   **Expected:** "Welcome back, your deletion was canceled" or similar.

---

## N. Landing & Pricing

### N.1 — Landing page renders (P1)

1. Open `/` in incognito (no auth)
   **Expected:** hero, 3-step "How it works", 7 per-type cards, privacy proof, pricing line, footer.

### N.2 — Authenticated user redirects (P1)

1. Open `/` while logged in
   **Expected:** redirects to `/timeline`.

### N.3 — Pricing page (P1)

1. Visit `/pricing` (or click pricing link)
   **Expected:** Free/Plus/Pro table; FAQ; CTAs per tier; SEO meta tags present.

### N.4 — Per-type CTA (P2)

1. Click "Start a parents circle →"
   **Expected:** routes to `/login` (or signup) → onboarding pre-selects `parents` type.

### N.5 — SEO meta tags (P2)

1. View source on `/` and `/pricing`
   **Expected:** `<title>`, meta description, OG tags present; prerendered HTML (no JS hydration needed for content).

---

## O. PWA

### O.1 — Add to Home Screen banner: Android (P1)

1. Visit 3+ times on Android Chrome → on visit 3 banner shows
   **Expected:** banner with "Install" button; tap → native install prompt.

### O.2 — Add to Home Screen banner: iOS (P1)

1. Visit 3+ times on iOS Safari
   **Expected:** manual instructions banner ("Tap Share → Add to Home Screen"); no native prompt.

### O.3 — Launches in standalone (P2)

1. After install, open app from home screen
   **Expected:** runs standalone (no browser UI); banner hidden.

### O.4 — Offline asset caching (P2)

1. Visit `/timeline` → put device offline → reload
   **Expected:** HTML shell loads from cache; API calls fail with friendly error; static assets load.

### O.5 — Service worker activation (P2)

1. Deploy new build → reload twice
   **Expected:** new SW activates via `skipWaiting()` + `clients.claim()`; no stale UI.

---

## P. Localization (en / zh-CN / fr)

### P.1 — Switch locale mid-session (P0)

1. Logged in → switch en → zh-CN
   **Expected:** every visible string updates; no `t('foo.bar')` fallbacks; persisted to DB.

### P.2 — Locale survives logout/login (P1)

1. Set zh-CN → log out → log back in
   **Expected:** UI loads in zh-CN immediately.

### P.3 — All email templates translated (P1)

1. Trigger invite, digest, milestone, recap, quiet-nudge, on-this-day in each of en/zh-CN/fr
   **Expected:** subject + body in correct locale per recipient's `User.locale`.

### P.4 — Push payload locales (P2)

1. Set recipient locale=fr → trigger a push
   **Expected:** title + body in French.

### P.5 — Date formatting per locale (P1)

**Expected:** en `May 11, 2026`, zh-CN `2026年5月11日`, fr `11 mai 2026`.

---

## Q. Security & Privacy

### Q.1 — Cross-circle data isolation (P0)

1. O1 in Circle A, O2 in Circle B (different circles, different users)
2. As O2, manually craft a fetch to `/api/timeline?circle=<A_id>`
   **Expected:** 403; O2 cannot see Circle A's memories.

### Q.2 — Service-role key absent from client bundle (P0)

1. Open browser devtools → search built JS bundle for `service_role`
   **Expected:** zero matches; the key only lives in server env.

### Q.3 — No `storage_path` in API responses (P0)

1. Inspect `/api/timeline` response
   **Expected:** only `url` and `thumbnailUrl` (signed); never `storage_path`.

### Q.4 — Raw error messages not leaked (P1)

1. Trigger a 500 (kill DB or send malformed body)
   **Expected:** generic human-readable error to client; details logged server-side.

### Q.5 — Rate limiting on guest reactions (P1)

1. As V on viewer link → react 21+ times in 60s
   **Expected:** 21st attempt returns 429 "Too many reactions".

### Q.6 — Member cannot delete others' content (P0)

1. As M → try to DELETE another member's comment via API
   **Expected:** 403/RLS denial.

### Q.7 — Member cannot transfer ownership / change type (P0)

1. As M → POST to `/api/circles/<id>` with `circleType` change
   **Expected:** 403; only owner can.

### Q.8 — DNT browser sends no PostHog events (P2)

1. Enable DNT in Firefox → walk through signup/upload
   **Expected:** zero requests to `i.posthog.com` in network tab.

### Q.9 — No PII in PostHog payloads (P1)

1. PostHog Live Events → inspect a `memory_uploaded` and `milestone_created` payload
   **Expected:** only IDs and enums; no emails, names, notes, file names, or raw milestone text (must be `"suggested"` or `"custom"`).

### Q.10 — HTTPS-only cookies (P1)

1. Inspect cookie attributes on production
   **Expected:** session/auth cookies are `Secure`, `HttpOnly`, `SameSite=Lax` (or stricter).

---

## R. Errors & Edge Cases

### R.1 — Network drop mid-upload (P1)

1. Start upload → kill Wi-Fi mid-progress
   **Expected:** clean error toast; no half-uploaded memory row; retry works on reconnect.

### R.2 — Direct URL to deleted memory (P2)

1. Note a memory's URL → owner deletes it → visit URL
   **Expected:** "Memory not found" or redirect; no 500.

### R.3 — Direct URL to unauthorized memory (P0 — privacy)

1. Note a memory URL from Circle A → log in as user not in Circle A → visit URL
   **Expected:** 403/404; no leakage.

### R.4 — Browser back/forward through timeline pages (P2)

1. Open timeline → open modal → click back
   **Expected:** modal closes; URL state consistent.

### R.5 — Multi-device session (P1)

1. Log in on Device 1 → log in same email on Device 2 via magic link
   **Expected:** Device 1 session NOT invalidated (validates that Phase 1 magic-link doesn't break multi-device — this is the M13 Auth pre-launch check).

### R.6 — Long names / unicode (P2)

1. Upload note with emoji + RTL characters + 1000-char body
   **Expected:** renders correctly; doesn't break layout.

---

## S. Cross-functional smoke tests

### S.1 — Full happy-path session (P0)

1. Sign up → create circle → invite → upload photo → add comment → react → milestone → share viewer link → log out
   **Expected:** every step succeeds; PostHog event timeline shows all 8+ events under one distinct_id.

### S.2 — Two-account interaction (P0)

1. O and M act on same circle simultaneously: O uploads, M comments, O reacts, M tags O in another upload
   **Expected:** real-time UI updates (after refresh, at minimum); both see consistent state.

### S.3 — Lighthouse on `/` and `/timeline` (P1)

1. Run Lighthouse mobile (Fast 4G, 4x CPU throttle)
   **Expected:** performance ≥ 70, accessibility ≥ 90, best-practices ≥ 80; LCP < 2.5s; CLS < 0.1.

### S.4 — `pnpm audit --audit-level high` (P1)

**Expected:** zero high/critical vulnerabilities.

### S.5 — Security headers (P1)

1. Submit production URL to `securityheaders.com`
   **Expected:** A or A+ rating; CSP, HSTS, X-Frame-Options, Referrer-Policy all set.

---

## T. Known gaps / explicit non-tests

Mark these as **not expected to work in UAT**; document so testers don't file them as bugs:

- iOS Web Push (no support; install as PWA + Capacitor is Phase 2)
- 3.5 Linked logins (Google OAuth fallback) — deferred
- 9.5.x Guest contributor / event QR codes — Phase 3
- 4.10.2 Location tag — not yet built
- 4.10.3 Health event types — cut from Phase 1
- Stripe billing / paid tier gating — Phase 2
- Reaction-based "best photo" ranking in digests — deferred to Phase 2
- Cron-scheduled features (digest, milestone-nudge, on-this-day, quiet-nudge, first-month-recap, export-job) require **manual pg_cron setup in Supabase Studio** — set these up BEFORE UAT or trigger via cURL during testing

---

## How to track results

Recommend running each section in a separate session, recording **pass / fail / blocked** + browser + date. For failures, capture:

- exact reproduction steps
- screenshot or screen recording
- console errors (devtools open)
- network tab for failed requests (status + response body if visible)
- Sentry event link if one was generated
