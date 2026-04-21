# Our Story — Design Spec

---

## Vision

> *Your story may not feel like much right now — but looking back 20 years from now, you will cherish every memory you saved here.*

Our Story exists to capture the small, ordinary moments that become irreplaceable with time: a toddler's first messy birthday cake, a quiet Sunday morning, a handwritten note from someone who is no longer here. We build every feature with that 20-year perspective in mind. Nothing we ship should make it harder to preserve those moments — and everything we ship should make it easier.

---

## Core Principles

These are non-negotiable. Every feature, every decision, every line of code is evaluated against them — in this order.

### 1. Security first
User data — photos, videos, notes, family information — is deeply personal and irreplaceable. A single security breach destroys trust permanently. There is no "we'll fix it later" for a privacy violation.

**What this means in practice:**
- Every API route validates authentication and authorisation before touching data
- RLS policies are the last line of defence — they must be correct and tested on every migration
- No raw storage paths ever reach the client — signed URLs only
- No user input is trusted — validate type, length, and format at every boundary
- Dependencies are scanned for vulnerabilities on every PR (Dependabot)
- Security headers are set on every response (CSP, HSTS, X-Frame-Options)
- Secrets never appear in code, logs, or error messages
- Every significant data access is logged and auditable

### 2. User-friendliness is a product requirement, not a nice-to-have
Your circle includes grandparents, non-technical family members, and people who are not comfortable with technology. If they can't use the app, the app has failed — regardless of what features it has.

**What this means in practice:**
- Magic link login — no passwords to forget
- Every error message is human-readable ("Your invite link has expired — ask the circle owner for a new one"), never a raw error code
- Every async action has visible feedback within 200ms (progress bar, spinner, skeleton)
- Minimum tap target size: 44×44px on all interactive elements
- Font size minimum 16px on all inputs (prevents iOS auto-zoom)
- WCAG 2.1 AA compliance is a baseline — test with VoiceOver and TalkBack before every release
- New users must reach their "aha moment" (first shared memory) in one session — onboarding is never optional to fix

### 3. User service is a competitive advantage
Most consumer apps have no support. Responding to a frustrated user within hours — not days — turns churners into loyal advocates. For a private family app, trust is the product.

**What this means in practice:**
- Support response SLA: acknowledge within 4 hours, resolve within 24 hours (Phase 1–2)
- Every error that reaches a user is also logged in Sentry — you see it before they report it
- Proactive incident communication: if the app is down, post a status update before users ask
- Data deletion requests are processed within 30 days (GDPR requirement, but do it in 7)
- Never lose a user's data — ever. Photos are irreplaceable.

### 4. Enterprise-grade reliability
"It just works" is the bar. The app must behave predictably under load, recover gracefully from failures, and never silently corrupt or lose data.

**What this means in practice:**
- 99.9% uptime target (< 8.7 hours downtime/year)
- RTO (recovery time objective): < 4 hours
- RPO (recovery point objective): < 24 hours
- All background jobs are idempotent — safe to retry without side effects
- No operation silently fails — every failure is logged, alerted, and handled with a user-visible error
- Database migrations are never destructive without a rollback plan
- Load tested before any public launch

---

## Overview

**App Name:** Our Story
**Tagline:** "A private space where your circle builds a shared story."
**Positioning:** Not photo storage — your story.

### Terminology note
| UI (what users see) | Code / DB (internal) |
|---|---|
| Circle | Circle |
| Create a Circle | Create a Circle |
| Circle members | CircleMember |
| Your circles | Circles |

"Circle" works for any meaningful group — nuclear families, friend groups, couples, adult siblings, caregiving families, travel groups. Both UI and code/DB now use "Circle" — this rename was applied throughout the schema.

---

## Core Concept

| Google Photos | Our Story |
|---|---|
| Personal storage + AI search | Shared group experience + storytelling |
| Individual-first | Circle-first |
| Search-based | Timeline-based |
| Stores images | Stores meaning |

---

## Competitive Advantage

| Advantage | Why it matters |
|---|---|
| Circle-first, not individual-first | Google Photos, iCloud, Amazon Photos are all built around one person's camera roll. This is the only app built around a shared group narrative — families, friend groups, couples, anyone. |
| Storytelling over storage | Notes, milestones, comment threads turn photos into memories with context. "First steps at grandma's house" or "10 years of friendship" is worth more than a file in a folder. |
| Works for any meaningful group | Nuclear families, friend groups, couples, adult siblings, caregiving families, travel groups — the core product serves all of them without changing a line of code. |
| Privacy as a feature | No ads, no AI training, invite-only. A real selling point for any group sharing personal moments. |
| Inclusive UX | Magic link login, view-only mode, simple UI — designed for non-technical members. Most apps ignore them. |
| Emotional lock-in | Once a circle has 2 years of milestones, notes, reactions, and time capsules, switching costs are enormous. This is the strongest moat. |
| Better than FamilyAlbum (free) | FamilyAlbum stores photos. Our Story stores meaning — notes, milestones, reactions, and time capsules that FamilyAlbum doesn't have. Free storage with no story layer is just backup. |

---

## Key Features

### 1. Shared Circle Timeline
- Everyone uploads into one shared timeline
- Auto-organized chronologically
- "This day last year" (shared across circle)
- Scroll = life story

### 2. Milestones
- Structured life events with preset templates per circle type + fully custom milestones
- Timeline highlights and auto-generated "chapters"
- Preset templates by circle type (see below) — user can also create any custom milestone

#### Milestone templates
| Circle type | Example presets |
|---|---|
| New parents | First steps, first word, first birthday, first day of school |
| Couples | First date anniversary, moved in together, engagement, wedding |
| Family | Family reunion, new home, holiday tradition, family trip |
| Friend group | Trip together, X years of friendship, reunion |
| Caregiving family | Moved to new home, health milestone, birthday celebration |
| Travel group | Trip started, first destination, trip completed, X countries visited |
| Solo | Personal goal reached, new chapter, anniversary of an important date |
| Custom | User defines their own label — any text |

#### Data model
```sql
-- milestone_label supports both i18n preset keys AND free-form custom text
Memory
  - milestone_label (nullable)
  - milestone_is_custom (bool, default false)

-- If milestone_is_custom = false: milestone_label is an i18n key ("first_steps")
-- If milestone_is_custom = true:  milestone_label is free-form user text ("10 years of friendship!")
```

### 3. Context & Memory
- Add notes to moments ("first steps today")
- Comment threads (family reactions)
- Relationship-based tagging (not just face detection)

#### Lower-friction memory types
Every memory does not need a photo. Requiring a photo raises the documentation bar too high for daily habit formation.

**Quick note — MVP**

Text-only memory. No photo required.
- "First word today: 'dada'" — captures the moment in 5 seconds
- Appears on the timeline as a text card (distinct visual treatment from photo memories)
- `MemoryMedia` row is omitted — just a `Memory` row with `note` and no media
- Upload flow: `+` button → bottom sheet with "Photo/Video" and "Quick Note" options. Photo is default, unchanged.

**Voice memo — Phase 2**

A 30-second audio recording attached to a memory. Emotionally irreplaceable for certain moments — a grandparent's birthday message, a baby's first laugh, a family singing Happy Birthday. Nothing on the market does this well.

Deferred to Phase 2 because:
- Web Speech API transcription is unreliable across browsers and locales
- Audio playback UI (waveform, scrubber) is non-trivial
- Server-side transcription (Whisper API) adds cost and latency
- The core loop (photo + note) handles 95% of use cases without it

Do not conflate with **voice reactions** (Pro tier — a family member records a 10-second voice response *to* someone else's memory). That is a separate, distinct feature.

Phase 2 implementation notes when ready:
- Store as audio file in `memories-private` bucket, `media_type: "audio"`
- Transcribe server-side via OpenAI Whisper on upload (store transcript in `Memory.note` as fallback)
- Playback: waveform visualisation + transcript overlay
- Max 60 seconds (not 30 — the original limit was too restrictive for a birthday message)

### 4. Privacy by Design
- No ads
- No public sharing by default
- Explicit invite-only system
- Clear ownership: "this is OUR space"

### 5. Inclusive UX
- Simple UI by default — benefits everyone, not just older users
- Magic link login — no passwords needed
- View-only mode (no account required) — for anyone who won't create an account, regardless of age
- Tech-savvy family members of any age can be invited as full members and get the complete experience
- Email digest — primary touchpoint for viewers who never open the app directly

### 6. Albums & Collections *(Phase 2 — Free tier)*
- User-created albums for grouping by event: "Hawaii Trip 2026", "Christmas 2025"
- Albums are circle-scoped — any member can create, any member can add to
- Albums sit alongside the main timeline, not separate from it
- DB schema:
```
Album
  - id, circle_id, name, cover_media_id, created_by
AlbumMemory
  - album_id, memory_id
```

### 7. Media Download & Share
- "Save to device" button on each memory (Capacitor Filesystem API)
- "Share" button generates a shareable image with optional "Our Story" watermark
- Watermark = free growth: recipients see the branding and can tap to download
- Share targets: WhatsApp, iMessage, Instagram, copy link

### 7.5. "Your First Month" Recap Email

Sent 30 days after a circle's first memory upload. One email that combines nostalgia (the original first memory) with a look-back at the month. Gated by `Circle.first_month_email_sent` — sent once, never repeated.

**Email content (top to bottom):**
1. **Nostalgia hook** — show the original first memory as a full-width card: photo, note, date. Copy: "One month ago, [uploader name] added your first memory to [Circle name]."
2. **Month in numbers** — memories uploaded, any milestones marked, most-reacted memory (if reactions exist)
3. **Forward CTA** — "Add another memory →" + "Invite someone who hasn't joined yet →"

This is also the implementation of the "first-memory anniversary" retention hook (see Early Retention section Hook 3). They are the same email — not two separate sends. `first_month_email_sent` is the single guard flag for both.

**Why Phase 1:** Creates a felt delight moment before Year in Review exists. Users who receive this email are significantly more likely to still be active at 90 days. It also gives new parents a sharable moment early — "look what our first month looks like" — without waiting a full year.

**Implementation:** Scheduled Edge Function checks for circles where `first_memory_at` is between 29–31 days ago AND `first_month_email_sent = false` → compile stats + fetch oldest memory → send via Resend → set `first_month_email_sent = true`. Reuses the same email design system as the weekly digest.

---

### 8. Annual Recap / Year in Review

**Phase split:**
- **Phase 2 — Shareable card (free for all tiers):** The Spotify Wrapped growth mechanic. Generated client-side via canvas API. Gating it kills virality — every user gets a beautiful branded 9:16 card to share to Instagram/WhatsApp with "Made with Our Story."
- **Phase 3 — Full in-app slideshow/video (Pro only):** Immersive experience generated via Remotion. Free/Plus users see a blurred preview with "Unlock your year →"

**Phase 2 implementation:** Scheduled Edge Function in December → compile top memories → share card generated client-side (canvas API) → public share URL created.
**Phase 3 implementation:** Same Edge Function extended → slideshow generated via Remotion (server-side) → Pro only.

Summary:
- Highlights: top memories, milestone highlights, most-reacted moments
- Shareable card format: 9:16 (Instagram Stories), "2026: The Year in Our Story"

#### Shareable card (Spotify Wrapped equivalent)
The Year in Review must produce a shareable card designed specifically for Instagram Stories and WhatsApp — not just an in-app experience. The card IS the acquisition channel.

**Card format:**
```
[9:16 ratio — designed for Instagram Stories]

Top third:   Best photo of the year (full bleed)
Middle:      "The [Johnson] Family · 2026"
             "47 memories · 6 milestones · 3 cities"
Bottom:      "Our Story" wordmark (subtle, not a logo blast)
             "ourstory.tinybit.app"
```

**Sharing mechanic:**
- "Share your year" CTA is prominent in the app each December and first week of January — not buried in settings
- Generates a public web URL (no login required): `our-story.tinybit.app/year/2026/{share-token}`
  - Shows a read-only highlight reel — not the full family timeline
  - Bottom CTA: "Create your family's story →" — the viewer becomes a new user
- Share to: Instagram Stories, WhatsApp, iMessage, copy link
- Card is generated client-side (canvas API) to avoid server load — Remotion upgrade in Phase 3 for video

**Why this drives acquisition:**
A new parent sharing their Year in Review to Instagram Stories is seen by 200–500 people, many of whom are also new parents. When someone asks "what app made that?", the answer is Our Story. This is the Spotify Wrapped mechanism: the content is so personal and shareable that the app's name spreads as a side effect.

---

## Memory Model

### Two layers
| Layer | Description |
|---|---|
| Personal Memory | Default for every upload. Private, owned by uploader. |
| Circle Memory | Intentionally shared. Visible to invited circle members. |

### Key UX action: "Share to Circle"
- Upload → default to personal
- One tap: "Add to circle story"
- Language matters: not "move to shared folder" — "add to circle story"

### Tab structure
1. **Circle** (main timeline) — default landing
2. **My Memories** (private)
3. **Albums / Milestones**

---

## Circle & Group System

### Circles (top-level groups)
- A user can belong to multiple circles (e.g. "Dao Family", "Extended Family")
- Recommended internal cap: ~10 circles per account (not user-visible)

### Visibility within a circle
- Two levels: `private` (only you) | `circle` (everyone in the circle)
- Access control within a circle is intentionally not supported in Phase 1–2 — it creates hidden content in a shared space, which breeds confusion and suspicion in family contexts
- If you need a different audience, create a separate circle — that's a clean boundary with no awkwardness
- **`group` visibility is Phase 3 only** — the `Group` and `GroupMember` tables are in the schema for future use, but `Memory.visibility` must only accept `"private"` and `"circle"` in Phase 1–2. Do not implement group-scoped memories until Phase 3. The DB enum should reflect this: add `"group"` only in the Phase 3 migration.

### Invitation System
- **Magic link** (recommended): generate invite token → `yourapp.com/invite?token=abc123`
- Email-based auto-join if user signs up with same email
- Shareable link with optional approval

### Roles
- **Owner** — circle creator, manages billing, can transfer ownership, can delete circle
- **Admin** — can invite/remove members, delete any memory
- **Member** — can upload, comment, react, delete own memories
- **Caregiver** — limited role for nannies, babysitters, daycare workers; can upload (circle-visible only) and emoji react; cannot comment, view private memories, invite members, or access settings. See Role-based authorization table for the full permission matrix.

### Ownership rules
- Each circle has exactly one owner
- Owner is the billing identity for that circle's subscription
- Transfer ownership: owner explicitly promotes another member
- If owner deletes their account: auto-promote oldest admin, or block deletion until ownership is transferred

---

## Data Model

```
User
  - id (UUID, from Supabase Auth)
  - email
  - first_name
  - last_name
  - avatar_url (nullable)
  - locale: "en" | "zh-Hans" | "fr" (nullable — falls back to browser language, then "en")
    -- "en" = English (default); "zh-Hans" = Simplified Chinese; "fr" = French (Canadian bilingual)
    -- Expand this set as Phase 2+ languages ship — each new language requires a DB migration to add the value
  - platform_role: "user" | "platform_admin"
  - stripe_customer_id (nullable)       -- Stripe credentials on User (one subscription per user account)
  - stripe_subscription_id (nullable)
  - subscription_status: "free" | "plus" | "pro"  -- source of truth; "grace" lives on Circle only
  - subscription_period_end (nullable)
  - referral_code (unique)
  - referred_by_user_id (nullable)
  - deletion_requested_at (nullable)    -- set when user initiates deletion; 30-day window starts here
  - deleted_at (nullable)               -- set at hard-purge time (deletion_requested_at + 30 days)
  - created_at

Circle
  - id, name, created_by (user_id)
  - circle_type: "parents" | "couple" | "family" | "friends" | "caregiving" | "travel" | "solo" | "custom"
    -- set during onboarding circle type picker; drives milestone templates, empty state copy, push notification language
  - subscription_status: "free" | "plus" | "pro" | "grace"
    -- denormalised from owner's User.subscription_status for fast RLS checks without joining to User
    -- Stripe credentials (stripe_customer_id, stripe_subscription_id) live on User, NOT on Circle
  - grace_period_until (nullable)
  - challenge_streak (int)
  - last_challenge_completed_at (nullable timestamp)  -- updated on each completed challenge; used for streak logic
  - quiet_nudge_count INT (default 0)               -- how many quiet-circle nudges sent; hard stop at 3
  - quiet_nudge_last_sent_at (nullable timestamp)   -- prevents nudges more than once per 14 days
  - first_memory_at (nullable timestamp)  -- set once on first Memory insert; drives trial + "Your First Month" email
  - last_memory_at (nullable timestamp)   -- updated on every Memory insert via trigger; used by quiet-circle nudge and digest features
  - memory_count INT NOT NULL DEFAULT 0   -- incremented on every Memory insert via trigger; used by On This Day activation threshold (avoids COUNT() queries in cron)
  - trial_ends_at (nullable timestamp)    -- Pro trial expiry; extended by referral rewards
  - trial_used (bool, default false)
  - first_month_email_sent (bool, default false)
  - e2ee_enabled (bool, default false)              -- Phase 3: opt-in per-circle client-side encryption toggle
  - e2ee_enabled_at (nullable timestamp)            -- Phase 3: when e2ee was enabled for this circle
  - deleted_at (nullable)               -- set when owner initiates circle deletion; 30-day soft-delete window
  - deletion_initiated_by (nullable FK → User)  -- records which owner triggered deletion

CircleMember
  - user_id, circle_id
  - role: "owner" | "admin" | "member" | "caregiver"
    -- owner:    billing, delete circle, transfer ownership
    -- admin:    invite/remove members, delete any memory, manage groups
    -- member:   upload, comment, react, view private memories, delete own
    -- caregiver: upload to circle timeline, view circle timeline, react (emoji only)
    --            cannot: comment, view private memories, invite members, delete any memory,
    --            see member list details beyond first name, access settings
    --            use case: nanny, babysitter, daycare worker — they document the child's day
    --            but should not have social access to the full circle feed or member data
    --            uploads by caregiver: always visibility="circle", cannot set private
    --            displayed in member list as "[Name] · Caregiver"
    --            on removal: same flow as member deletion (keep or remove their uploads)
  - memorial_status: "active" | "memorial"
  - memorial_date (nullable)
  - memorial_message (nullable)

Memory
  - id, owner_user_id, circle_id
  - visibility: "private" | "circle"  -- Phase 3 adds "group"; do not add earlier
  - note TEXT (nullable)  -- text content; required for Quick Notes (no media), optional for photo/video memories
  - alt_text TEXT (nullable)  -- accessibility description; user-provided or auto-suggested; never auto-generated silently
  - memory_date (user-set or EXIF — drives timeline order)
  - created_at (upload timestamp — never changes)
  - is_collaborative (bool)
  - contributions_open (bool)
  - milestone_label (i18n key, e.g. "first_steps" — nullable)
  - milestone_is_custom (bool, default false)  -- true when milestone_label is free-form text, false when it's an i18n key

MemoryMedia
  - id, memory_id, contribution_id (nullable)
  - storage_path
  - file_size, media_type: "photo" | "video" | "live_photo" | "audio"  -- "audio" reserved for Phase 2 voice memos; add to CHECK constraint now so the migration is additive when voice memos ship
  - still_path, live_path (nullable — for live photos)
  - phash
  - lat, lng, location_name (nullable — from EXIF GPS)
  - event_token_id (nullable — for guest uploads)
  - guest_name (nullable)

MemoryContribution        -- for collaborative memories
  - id, memory_id, contributor_user_id
  - note
  - created_at

MemoryComment
  - id, memory_id, user_id, body, created_at

MemoryReaction
  - id, memory_id
  - user_id (nullable — NULL for guest reactions from the email digest one-tap link; set in Phase 1 Milestone 12.1 migration)
  - guest_name (nullable — display name for guest reactors; added in Phase 1 Milestone 12.1 migration alongside the nullable user_id change)
  - type: "emoji" | "voice" | "video"
  - emoji (nullable)
  - media_path (nullable — Supabase Storage path for voice/video reactions; never return raw to client — generate signed URL server-side, same rule as MemoryMedia.storage_path)
  - duration_seconds (nullable)
  - created_at

MemoryChildren            -- per-memory child tagging (§4.10.1)
  - memory_id, child_id (PK composite)
  -- Uploader tags which children appear in this memory; age stamp derived from tagged children + memory_date.
  -- RLS: circle members can read; uploader (owner_user_id) can insert/delete.

MemoryMembers             -- per-memory member tagging (§4.10.6)
  - memory_id, user_id (PK composite)
  -- Any uploader can tag which circle members appear in a memory. Replace-all semantics.
  -- Tagged members receive an email notification (fire-and-forget).
  -- Displayed as overlapping avatar bubbles on PolaroidCard (max 4 visible, "+N" overflow).
  -- RLS: circle members can read; uploader (owner_user_id) can insert/delete.

AccountStorage
  - user_id
  - total_quota_bytes
  - total_used_bytes
  - bonus_bytes  -- reserved for future storage promotions; NOT used by the referral program (referral reward is a Pro trial, not storage)

Album
  - id, circle_id, name, cover_media_id, created_by
AlbumMemory
  - album_id, memory_id

NotificationPreference
  - user_id, circle_id
  - push_enabled (bool)
  - email_digest_frequency: "daily" | "weekly" | "off"
  - quiet_hours_start, quiet_hours_end
  - circle_muted (bool)

Referral
  - id, referrer_user_id, referee_user_id
  - status: "pending" | "completed"
  - pro_trial_granted (bool, default false)
  - pro_trial_ends_at (nullable timestamp)  -- set when reward is granted; used to update Circle.trial_ends_at
  - created_at

EventUploadToken          -- guest uploads (no account needed)
  - id, circle_id, album_id (nullable FK → Album)  -- nullable: guests may upload without being scoped to an album
  - token (UUID)
  - expires_at, max_uploads, upload_count
  - created_by, revoked (bool)
  - requires_approval (bool, default true)  -- when true, guest photos are held in pending state visible to admins only until approved; default true prevents inappropriate content from appearing on the circle timeline before review

TimeCapsule
  - id, circle_id, created_by
  - title, unlock_date
  - content_type: "memory" | "letter" | "video"
  - memory_id (nullable), letter_text (nullable, encrypted), media_path (nullable)
  - status: "locked" | "unlocked"
  - notified (bool)

ChildProfile              -- data record only, NOT a user account, cannot login
  - id, circle_id         -- represents a child for milestone/development tracking
  - name, date_of_birth, avatar_media_id (nullable)
  -- Phase 1: table ships in the initial schema migration (Step 2.1) so Step 12.2
  --   milestone nudges can query date_of_birth. No UI to create ChildProfiles is
  --   required in Phase 1 — the cron skips circles with no ChildProfile rows.
  -- Phase 3: full development tracking UI ships alongside DevelopmentEntry below.
  -- Note: when a child grows up and joins the app, they create their own
  --   User account and are invited as a Member. No link between ChildProfile → User.

DevelopmentEntry          -- logged milestone/growth for a child (Phase 3)
  - id, child_profile_id, circle_id
  - category: "growth" | "milestone" | "health"
  - label (i18n key, e.g. "first_steps", "weight")
  - value (nullable — e.g. "7.2 kg" for growth entries)
  - memory_id (nullable — linked photo)
  - recorded_at

PregnancyJourney
  - id, circle_id, created_by
  - due_date, baby_name (nullable)
  - status: "active" | "completed"
  - child_profile_id (nullable — linked after birth)

PregnancyEntry
  - id, journey_id, week_number (1–40)
  - memory_id (nullable), note, recorded_at

CircleStreak              -- circle-level upload streak (Phase 2)
  - circle_id (unique)
  - current_streak_weeks INT (default 0)   -- consecutive ISO weeks with ≥1 upload
  - longest_streak_weeks INT (default 0)
  - last_upload_week DATE                  -- ISO Monday of the most recent upload week

CircleChallenge           -- weekly prompt for all circle members to upload
  - id, circle_id
  - prompt ("Share a photo of your favourite family meal")
  - created_by (null = system-generated)
  - starts_at, ends_at
  - status: "active" | "completed"
  - result_album_id (nullable)

ChallengeEntry            -- a member's submission to a challenge
  - id, challenge_id, memory_id, contributor_user_id

NewsletterRecipient
  - id, circle_id, added_by
  - email, name (nullable)
  - frequency: "weekly" | "monthly"
  - unsubscribe_token (UUID)
  - subscribed (bool)
  - open_count, click_count, last_clicked_at
  - join_prompt_count INT NOT NULL DEFAULT 0  -- frequency cap on join CTA shown to this recipient

ExportJob
  - id, user_id
  - status: "pending" | "processing" | "complete" | "failed"
  - download_url (nullable), expires_at (nullable)
  - created_at

FeatureFlag
  - id, key (unique)
  - enabled_globally (bool)
  - enabled_user_ids (uuid[])
  - enabled_pct (int 0–100)

BackupLog
  - id, media_id
  - backup_tier: "s3" | "glacier"
  - archived_at, storage_path

CircleInvite
  - id, circle_id, email, token (UUID)
  - role: "admin" | "member" | "caregiver"
    -- "admin": owner can directly invite a co-parent or trusted adult as admin
    -- "member": default for all regular invites
    -- "caregiver": caregiver invite flow (limited permissions, separate UI path)
  - status: "pending" | "accepted" | "expired"
  - expires_at, created_at

Feedback                    -- in-app feedback submissions (distinct from Crisp support chat)
  - id, user_id (nullable — not required; viewer-role users can submit too)
  - message TEXT NOT NULL
  - page TEXT              -- which page/route the user was on
  - app_version TEXT
  - created_at
```

---

## Storage Model

**Rule: Storage quota is per account (billing identity), not per circle.**

Circles are organizational containers, not storage buckets.

```
if (account.total_used + file_size > account.quota) {
  reject upload
}
```

### Platform admin role (unlimited storage)

A platform-level role on `User` — separate from circle roles — that bypasses quota enforcement entirely. Used for the app owner/developer account.

```sql
User
  - platform_role: "user" | "platform_admin"  -- default "user"
```

Quota check updated:
```ts
// Skip quota enforcement for platform admins
if (user.platform_role === "platform_admin") {
  // proceed with upload, no quota check
} else {
  const usage_pct = (account.total_used + file_size) / account.total_quota
  if (usage_pct > 1.0) return { error: "storage_full" }
  if (usage_pct > 0.8) return { warning: "storage_near_limit" }
}
```

- Set directly in Supabase DB — no UI needed (you're the only one)
- Never expose `platform_role` to client-side code
- RLS: `platform_role` column readable only by the user themselves, not by other circle members

- All photos (private or shared) count toward the account quota
- Circles organize memories but do not own storage
- Optional: track per-user usage for analytics ("Dad uploaded 80% this year")

### Tiers
| Plan | Price | Storage | Notes |
|---|---|---|---|
| Free | $0 | 5 GB | ~3–6 months of active use |
| Plus | $4.99/mo | 50 GB | ~2 years of active use |
| Pro | $9.99/mo | 500 GB | ~15+ years, removes storage anxiety entirely |

---

## Auth

- **Provider:** Supabase Auth (no custom SSO for now)
- **Primary:** Magic link (email login, no password) — lowest friction for any user; no password to forget
- **No email?** The view-only JWT link requires no account at all. For users without email who want full membership, phone/SMS OTP is the Phase 2 solution (see below).
- **Secondary:** Google OAuth — one-tap login, used as fallback if magic link email is ever lost
- No username/password — adds credential stuffing risk, password reset still requires email, solves nothing magic link + Google don't already cover
- No MFA at launch (adds friction for the wrong audience)
- Row-level security (RLS) via Supabase enforces all access rules at DB level

### Session strategy

Magic link is only cumbersome if sessions are short. With long-lived sessions, users authenticate once and stay logged in for months.

| Setting | Value | Why |
|---|---|---|
| `persistSession` | `true` (default) | Session survives page reloads and app restarts |
| `autoRefreshToken` | `true` (default) | Access token silently refreshes every hour — user never notices |
| Session inactivity timeout | 30 days | Users on a daily-use app shouldn't be asked to re-login |
| Refresh token rotation | enabled (default) | Rotated on every use — stolen token is invalidated on next legitimate use |

```ts
// Confirm these are not overridden anywhere in the codebase
const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
```

**When users actually need to re-authenticate:**
- First login on a new device or browser (deliberate — acceptable)
- Session idle for > 30 days (rare for an engaged user)
- Explicit logout
- Admin-forced sign-out (e.g. account compromise)

**Magic link clicked while already logged in on another device:**
A user already logged in on their phone may click a magic link from a weekly digest email on their laptop. Supabase's default with `detectSessionInUrl: true` issues a new session for the new device without revoking the existing one. This is the correct behaviour — explicitly verify it does not log out the phone session.

Test this before launch: open the app on two devices simultaneously, click a magic link on the second device, confirm the first device session remains active. If Supabase revokes the first session, set `flowType: "pkce"` in the auth config and handle the PKCE flow on the magic link callback.

### Linked login methods

Users can connect a Google account to their existing magic link account from account settings. This is the recovery path if email access is ever lost — not passwords.

- `supabase.auth.linkIdentity({ provider: "google" })` — links Google to existing account
- `supabase.auth.unlinkIdentity(identity)` — only allowed if at least one other identity remains
- Blocked: removing the last login method (UI prevents it, API enforces it)

Email change is also available in account settings while the user still has access to their current email. Supabase sends a verification link to the new address before switching.

### Phase 2: Phone/SMS auth

Some users — particularly older family members — do not have an email address or a Google account. For them, the current auth options (magic link, Google OAuth) are a dead end.

The view-only JWT link already handles the pure viewer case: no account, no email needed. But a family member without email who wants to *upload or react as a named user* (not a guest) has no path in Phase 1.

**Phase 2 solution: Supabase phone/SMS OTP**
- Supabase supports phone number + SMS OTP natively (Twilio or Vonage as provider)
- Flow: enter phone number → receive SMS code → enter code → authenticated
- No password, no email — identical friction model to magic link
- Add phone as a third login option on the login page alongside magic link and Google

**When to build:**
Only if real users hit this wall. The view-only link covers most grandparent use cases. If the T+3 milestone follow-up or weekly digest prompts a grandparent to want to upload, and they have no email, that's the trigger to add phone auth. Don't build it speculatively.

### Phase 2: Passkeys

Passkeys (Face ID / Touch ID / Windows Hello) are the long-term answer for frictionless daily login. Supabase has experimental passkey support. Worth implementing in Phase 2 when the Capacitor native app ships — one biometric tap replaces the magic link entirely for returning users on their own device. No passwords, no email, no friction.

### Role-based authorization

| Action | Owner | Admin | Member | Caregiver |
|---|---|---|---|---|
| View circle timeline | Yes | Yes | Yes | Yes |
| Upload to circle timeline | Yes | Yes | Yes | Yes (circle-visible only — cannot set private) |
| Comment | Yes | Yes | Yes | No |
| React (emoji) | Yes | Yes | Yes | Yes |
| React (voice/video) | Yes | Yes | Yes | No |
| Delete own memory | Yes | Yes | Yes | No |
| View private memories | Yes | Yes | Yes | No |
| View member list | Yes | Yes | Yes | First name only |
| Invite members | Yes | Yes | No | No |
| Remove members | Yes | Yes | No | No |
| Create albums | Yes | Yes | Yes | No |
| Edit circle name/settings | Yes | Yes | No | No |
| Delete any memory | Yes | Yes | No | No |
| Manage billing | Yes | No | No | No |
| Transfer ownership | Yes | No | No | No |
| Delete circle | Yes | No | No | No |

### RLS enforcement (Supabase)

```sql
-- Members can only read memories in circles they belong to
CREATE POLICY "read circle memories"
ON Memory FOR SELECT
USING (
  circle_id IN (
    SELECT circle_id FROM CircleMember WHERE user_id = auth.uid()
  )
);

-- Private memories only readable by their owner
-- (this is RESTRICTIVE — AND'd with permissive policies above)
CREATE POLICY "private memories owner only"
ON Memory FOR SELECT
AS RESTRICTIVE
USING (
  visibility != 'private' OR owner_user_id = auth.uid()
);

-- Caregivers cannot read private memories
-- (also RESTRICTIVE — must be AND'd, not OR'd, to actually restrict)
CREATE POLICY "caregiver cannot read private memories"
ON Memory FOR SELECT
AS RESTRICTIVE
USING (
  NOT (
    visibility = 'private'
    AND EXISTS (
      SELECT 1 FROM CircleMember
      WHERE user_id = auth.uid() AND role = 'caregiver'
        AND circle_id = Memory.circle_id
    )
  )
);

-- Only memory owner can delete their own memory
CREATE POLICY "delete own memory"
ON Memory FOR DELETE
USING (owner_user_id = auth.uid());

-- Only admins can delete any memory in their circle
CREATE POLICY "admin delete any memory"
ON Memory FOR DELETE
USING (
  circle_id IN (
    SELECT circle_id FROM CircleMember
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);
```

### Notes
- Every DB query is scoped by `auth.uid()` — no client-side trust
- Private memories only readable by `owner_user_id` — enforced via RESTRICTIVE policy
- Caregivers blocked from private memories via RESTRICTIVE policy — never use a permissive policy to restrict; it will be OR'd and ineffective
- Group-scoped memories only readable by `GroupMember` records (Phase 3)
- `platform_role` column readable only by the user themselves (not other circle members)

---

## Security Hardening

Security is the #1 priority (see Core Principles). This section defines the full security posture of the app — not just auth and RLS, but every layer from HTTP headers to dependency management.

### HTTP Security Headers

Every response from the Nuxt server must include these headers. Configure in `server/middleware/security-headers.ts`:

```ts
export default defineEventHandler((event) => {
  setHeaders(event, {
    // Prevent clickjacking
    "X-Frame-Options": "DENY",
    // Prevent MIME sniffing
    "X-Content-Type-Options": "nosniff",
    // Force HTTPS
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    // Control referrer info
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Permissions policy — disable features you don't use
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    // Content Security Policy — restrict resource origins
    "Content-Security-Policy": [
      "default-src 'self'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "media-src 'self' blob: https://*.supabase.co",
      "script-src 'self' 'unsafe-inline' https://client.crisp.chat",  // tighten post-launch
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com",
      "frame-ancestors 'none'",
    ].join("; "),
  })
})
```

### Input Validation on Every API Route

Never trust client input. Validate at every boundary using `zod`:

```bash
pnpm install zod
```

```ts
// server/api/memories/upload.post.ts
import { z } from "zod"

const uploadSchema = z.object({
  circleId: z.string().uuid(),
  note: z.string().max(500).optional(),
  memoryDate: z.string().datetime().optional(),
  milestoneLabel: z.string().max(40).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = uploadSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 400, message: "Invalid request" })
    // Never expose result.error.message to client — it can leak schema details
  }
  // proceed with result.data (typed and validated)
})
```

Apply `zod` validation to every POST/PATCH/DELETE route. No exceptions.

### CORS Configuration

Only allow requests from your own domain:

```ts
// nuxt.config.ts
routeRules: {
  "/api/**": {
    cors: false,  // handled manually
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL ?? "https://our-story.tinybit.app",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  },
},
```

### Dependency Vulnerability Scanning

Add Dependabot to auto-open PRs when dependencies have known vulnerabilities:

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    ignore:
      - dependency-name: "*"
        update-types: ["version-update:semver-patch"]  # auto-merge patches in CI
```

Also run `npm audit` in CI — fail the build on high/critical vulnerabilities. Use `npm audit` (not `pnpm audit`) — pnpm still targets the retired npm audit endpoints as of v10:
```yaml
- name: Security audit
  run: npm audit --audit-level=high
```

### Session Security

- JWT tokens are short-lived (Supabase default: 1 hour access token, 7-day refresh token)
- Refresh tokens are rotated on every use (`supabase.auth.onAuthStateChange` handles this)
- "Log out all devices" invalidates all refresh tokens for the user:
  ```ts
  await supabase.auth.admin.signOut(userId, "global")
  ```
- Service role key is never sent to the client — only used in server routes
- `httpOnly` cookies for invite tokens (already spec'd) — not accessible via JS

### File Upload Security

Beyond size/type limits, validate file content server-side:

```ts
// In upload Edge Function — verify MIME type from file bytes, not just the Content-Type header
// A malicious user could rename a .exe as photo.jpg
const fileBytes = new Uint8Array(await file.arrayBuffer())
const mimeType = detectMimeType(fileBytes)  // check magic bytes

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "video/mp4", "video/quicktime", "video/webm"
]

if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
  return Response.json({ error: "unsupported_file_type" }, { status: 415 })
}
```

### Error Messages — Never Leak Internals

Every error response to the client must be human-readable and must not expose:
- Stack traces
- Database error messages
- Internal field names or schema details
- Storage paths or internal URLs

```ts
// Bad — leaks DB internals
throw createError({ statusCode: 500, message: error.message })

// Good — safe, human-readable
throw createError({ statusCode: 500, message: "Something went wrong. Please try again." })

// Log the real error server-side only
console.error("[upload-media]", error)
```

### Security Review Checklist (every PR that touches auth, API routes, or DB)

- [ ] New API route validates auth (`serverSupabaseUser`)
- [ ] Input validated with `zod` before use
- [ ] No raw `error.message` exposed to client
- [ ] No `storage_path` in any response body
- [ ] New DB table has RLS enabled
- [ ] New RLS policy has a corresponding pgTAP test
- [ ] No secrets hardcoded or logged

### Penetration Testing (before Phase 2 launch)

Before opening billing to real users, run a basic penetration test:
- Use OWASP ZAP (free, automated) against staging environment
- Manually test: can user A access user B's memories by guessing UUIDs?
- Test rate limiting: can the invite endpoint be spammed?
- Test file upload: can non-image files be uploaded by spoofing Content-Type?
- Fix all critical and high findings before launch

---

## Monetization

### Pricing philosophy
You are not selling storage — you are selling a shared story. Storage is infrastructure. Feature gates drive upgrades because users *want* something, not because they hit a byte limit. Never lead with GB in marketing copy.

### Subscription model: per account, paid by the circle owner

One subscription per user account. The subscription tier determines what features and storage that user gets across all circles they own or belong to. There is no separate charge per circle.

**"Owner pays" rule:** The owner of a circle is responsible for that circle's feature tier. If an owner is on Free, their circle is Free regardless of whether members are on Plus. Members inherit the circle's tier for that circle only — their own private storage quota is determined by their own subscription.

**Plus member in a Free circle — billing clarity:**
A member's Plus subscription benefits their own circles and private storage. It does not upgrade circles they've been invited into. This distinction must be surfaced clearly in the UI — never show a generic "Upgrade to Plus" button to a member who is already a Plus subscriber.

Feature gate prompt for a Plus member hitting a limit in a Free owner's circle:
> *"[Circle name] is on Free. Search and On This Day are available when the circle owner upgrades to Plus. [Ask owner to upgrade →]"*

The "Ask owner to upgrade" CTA opens a pre-filled share sheet with a message the member can send directly to the owner. Never redirect a paying member to the upgrade/pricing page — they've already paid.

**Stripe model:**
```
User → Stripe Customer (1:1)
User → Stripe Subscription (one active subscription at a time)
Circle.subscription_status mirrors the owner's subscription
```

When a user upgrades to Plus:
- All circles they own are upgraded to Plus features
- Their personal storage quota increases to 50 GB
- Members of their circles get access to Plus features within those circles (search, On This Day, etc.) — but their own private storage stays at their own tier

This means: a Free user who is a member of a Plus circle can use search and On This Day in that circle, but their own private memories are still capped at 5 GB.

| Plan | Price | Storage | Features |
|---|---|---|---|
| **Free** | $0 | 5 GB | 1 circle owned, up to 10 members, basic timeline, milestones, albums, comments, reactions |
| **Plus** | $4.99/mo | 50 GB | Unlimited circles owned, up to 20 members per circle, search, On This Day, notification preferences, offline upload |
| **Pro** | $9.99/mo | 500 GB | Unlimited circles + members, time capsule, collaborative memory, pregnancy tracker, Year in Review full slideshow/video, priority support, voice/video reactions |

### Stripe schema
```sql
User
  - stripe_customer_id (nullable)
  - stripe_subscription_id (nullable)
  - subscription_status: "free" | "plus" | "pro"
  - subscription_period_end (nullable)

-- Circle.subscription_status is derived from the owner's User.subscription_status
-- Denormalised onto Circle for fast RLS checks without joining to User every time
Circle
  - subscription_status: "free" | "plus" | "pro" | "grace"
  - grace_period_until (nullable)
```

On upgrade/downgrade: Stripe webhook → update `User.subscription_status` → update all `Circle.subscription_status` rows where `created_by = user_id`.

**Grace state:** When a payment fails, `Circle.subscription_status` → `"grace"` and `grace_period_until` is set. `User.subscription_status` stays at the paid tier value (`"plus"` or `"pro"`) during the grace window — it only moves to `"free"` if the user does not resolve payment before `grace_period_until`. Feature enforcement is driven by `Circle.subscription_status`, not `User.subscription_status`, so webhook handlers should update `Circle` first.

### Why these storage numbers
- Free (5 GB): ~3–6 months of active use for a new parent. Enough to get hooked, not enough to stay free forever.
- Plus (50 GB): ~2 years of active use. Users upgrade to Pro before hitting the limit because they *want* Pro features — the storage limit is a backstop, not the primary driver.
- Pro (500 GB): ~15+ years of active use for most circles. Feels genuinely generous at $9.99 — removes storage anxiety entirely for Pro users. At $9.99/mo, 200 GB felt weak against Google One's 2 TB at the same price, even if we're not competing on storage.

### Feature gate logic (what drives upgrades)
| Trigger | Who sees it | Prompt |
|---|---|---|
| Owner tries to send 11th invite on Free | Owner only | "You've reached the 10-member limit. Upgrade to Plus to invite more. [Start free trial →]" — blocked at invite-send time, not accept time |
| Plus member hits feature gate in a Free circle | Member (already paying) | "[Circle name] is on Free. Search and On This Day are available when the circle owner upgrades to Plus. [Ask owner to upgrade →]" — never show upgrade CTA to a paying member |
| Free member hits feature gate in any circle | Member | "This feature needs Plus. [Upgrade →]" |
| User tries to create a time capsule on Free/Plus | Owner | "Time capsules are a Pro feature →" |
| Storage at 80% on Free | Owner | "Your story space is almost full — upgrade to keep going →" |
| Collaborative memory on Free/Plus | Owner | "Upgrade to Pro to let everyone contribute →" |

### Free trial

> **Phase split:** `first_memory_at` (the timestamp that triggers the trial) is a **Phase 1** column — it's also needed for the "Your First Month" early retention email. Add it to the schema in Phase 1. The trial **activation logic** (check `trial_used`, set `trial_ends_at`, send trial-start email) is **Phase 2**, wired in alongside Stripe billing.

New circles get a **14-day Pro trial** automatically when the owner's first upload happens. No credit card required. The goal is to get every new user to experience the features that drive Pro conversion (time capsule, collaborative memory, Year in Review card) before they decide whether to stay on Free.

**Trial mechanics:**
- Trial starts on first memory upload in the circle — not on signup (users who don't upload never see a trial end message)
- Duration: 14 days
- Scope: full Pro features for that circle — including the unlimited member limit; a Pro trial that caps members at the Free tier is not a Pro experience
- No credit card at trial start — reduces friction, allows re-engagement if they skip billing
- At trial end: downgrade to Free automatically. No surprise charges. One email warning 3 days before expiry.

**Trial prompts:**
| Moment | Copy |
|--------|------|
| Trial starts | "Your circle is on a 14-day Pro trial — explore everything, no card needed." |
| Day 11 (3 days left) | "3 days left on your Pro trial. Like what you see? Keep it for $9.99/mo →" |
| Day 14 (trial ends) | "Your trial has ended. Your memories are safe. Upgrade anytime to get Pro features back →" |

Never show trial prompts more than once per day. Never show them during upload — the moment of upload is sacred, never interrupt it with a commercial message.

> `first_memory_at`, `trial_ends_at`, `trial_used`, and `first_month_email_sent` are in the canonical `Circle` model — see the Data Model section. No migration addition needed here.

`first_memory_at` is the shared trigger for both the auto-trial and the "Your First Month" recap email. Set it once (on the first Memory insert for this circle) and never update it. All scheduled jobs that need "first memory date" read from this column rather than querying `MIN(Memory.created_at)` every time.

**Stripe:** No Stripe subscription created at trial start. Only create a subscription when the user actively upgrades. Trials are tracked in the DB, not Stripe.

**Why not a free trial on signup?** A circle with no content has nothing to trial. The trial starts when there's something to protect — when the first memory exists. This also means users who abandon before uploading never receive trial-end emails, reducing noise.

**Trial stacking rules (auto-trial + referral trial):**
A user can have both the auto-trial (14 days, triggered by their own first upload) and a referral trial (30 days, triggered when their referee uploads). The rules:

| Scenario | Outcome |
|---|---|
| Auto-trial active, referral reward arrives | `trial_ends_at = max(current trial_ends_at, now() + 30 days)` — referral extends to 30 days from today, not 30 days added on top |
| Auto-trial expired, referral reward arrives | `trial_ends_at = now() + 30 days` — fresh 30-day window |
| Multiple referrals | Each referral extends to `max(current trial_ends_at, now() + 30 days)` — stacking is capped, not additive |
| User already on Plus/Pro | No trial applied — they're already paying; referral reward is noted but dormant until they downgrade |

**Why not additive stacking?** Additive stacking (14 + 30 = 44 days) is exploitable: a user could coordinate with a friend to get a long free trial without genuine referral intent. The `max()` rule is generous for legitimate referrers (who get 30 days regardless) and removes the exploit incentive.

### Secondary revenue streams (Phase 3)
- **Physical products** — auto-generated photo books, printed timelines ($20–60 one-time)
- **Year in Review video** — included in Pro; one-time purchase ($5–10) for Free/Plus
- **Extra storage add-on** — +100 GB for $2/mo (rather than forcing full tier upgrade)

### Anti-patterns to avoid
- No ads (kills trust immediately)
- No data selling (breaks privacy positioning)
- No freemium-forever without upgrade path
- Never compete on $/GB — you will always lose to Google

### Realistic targets
| Milestone | MRR |
|---|---|
| 500 Plus circles × $4.99 | $2,495/mo |
| 1,000 Plus + 200 Pro circles | $6,980/mo |
| 3,000 Plus + 500 Pro circles | $19,970/mo |

---

## MVP Core Loop

1. Upload photo
2. Add note ("first time crawling")
3. Auto-add to circle timeline
4. Circle reacts / comments

**Simple → emotional → sticky**

---

## Media

- **Photos:** supported (HEIC, JPEG, PNG, WebP)
- **Videos:** short clips only — max 90 seconds, max 500 MB
- **Live Photos:** supported (see below)
- **Original quality always preserved** — originals are stored untouched in the private bucket. Never compress before storing. A grandchild's first birthday deserves to exist at full resolution twenty years from now.
- Compressed/resized versions are generated on-the-fly at serve time using Supabase Image Transformations (800px thumbnail, WebP, 85% quality). The original is never touched.
- Videos stored as-is; transcode to HLS for playback (use Supabase Storage + a transcoding step, or a service like Mux for v2)
- Video counts significantly more toward storage quota — factor into tier sizing

### File size limits

| Type | Max size | Max duration | Notes |
|---|---|---|---|
| Photo | 50 MB | — | Covers RAW/HEIC from modern iPhones |
| Video | 500 MB | 90 seconds | ~90s at 1080p 30fps H.264 |
| Live Photo (Phase 3) | 30 MB | 3 seconds | .heic still + .mov clip combined |

Enforced client-side before upload starts (fast UX feedback) and server-side in Edge Function (security).

```ts
// Client-side pre-check (before upload begins)
const MAX_PHOTO_BYTES = 50 * 1024 * 1024   // 50 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024  // 500 MB
const MAX_VIDEO_SECONDS = 90

if (file.type.startsWith("video/") && file.size > MAX_VIDEO_BYTES) {
  return { error: "file_too_large", limit: "500 MB" }
}
if (file.type.startsWith("image/") && file.size > MAX_PHOTO_BYTES) {
  return { error: "file_too_large", limit: "50 MB" }
}
// Video duration checked after metadata loads (HTMLVideoElement.duration)
```

**Supabase Storage file size limit:** The free plan caps uploads at 50 MB per file — this blocks all videos. You must be on **Supabase Pro** (or higher) and set `fileSizeLimit` in Storage settings to at least 500 MB before launch. Do this before writing any upload code.

### Live Photos

iOS Live Photos = `.heic` still + paired `.mov` (1.5s clip). Android Motion Photos = JPEG with embedded video. Both are 3–5x larger than regular photos.

| Phase | Behaviour |
|---|---|
| MVP | Strip to static JPEG on upload — extract best frame via `sharp` in Edge Function. Simple, low storage. |
| Phase 3 | Full support — store both components, play on long-press using Apple's `LivePhotosKit` JS library. |

Live Photos are a strong differentiator for a memory app — a baby's first laugh as a Live Photo is more emotional than a still. Worth the storage cost in Phase 3.

**MVP implementation (strip to JPEG):**
```ts
// Edge Function: extract still from Live Photo
import sharp from "sharp"

const jpeg = await sharp(heicBuffer)
  .jpeg({ quality: 90 })
  .toBuffer()

// Store jpeg only, discard .mov
```

**Phase 3 implementation (full Live Photo):**
```
Upload: store .heic + .mov as paired objects in Storage
  MemoryMedia
    - still_path  (.heic)
    - live_path   (.mov, nullable)
    - is_live_photo (bool)

Playback: Apple LivePhotosKit JS
  <div data-live-photo
    data-photo-src="{signed_still_url}"
    data-video-src="{signed_live_url}" />
```

### Storage migration path
| Stage | Storage |
|---|---|
| MVP → Phase 2 | Supabase Storage — less setup, RLS just works |
| Phase 3+ | Migrate to S3 + CloudFront + MediaConvert for video transcoding at scale |

Supabase Storage is S3-compatible, so migration is straightforward. Auth/RLS stays in Supabase regardless.

### Batch Upload with Automatic Date Detection

Users should be able to select multiple photos/videos at once and have the correct `memory_date` filled in automatically from each file's metadata — rather than defaulting everything to today.

#### UX flow

1. File input has `multiple` attribute — user selects 1–N files
2. For each file, the client extracts the capture date (see below) before showing the review UI
3. A batch review sheet opens showing:
   - Scrollable list of thumbnails with filename and detected date per item
   - A small "from photo" label next to EXIF-sourced dates so the user knows it was auto-detected
   - Editable date picker per item (user can correct any wrong date before uploading)
   - Optional shared note that applies to all memories in the batch
   - Remove button (×) to drop individual items from the batch
4. "Upload N" button uploads sequentially — one at a time — with per-item progress and an overall progress bar
5. Each completed item shows a check overlay; failed items show an error badge with a short reason
6. When all items finish (success or failure), the button becomes "Done"
7. Each successful upload emits an `uploaded` event with the new `memoryId` (same contract as single upload)

#### Date detection priority

| Source | When used | UI label |
|---|---|---|
| EXIF `DateTimeOriginal` | Preferred for photos — the actual shutter moment | "from photo" |
| EXIF `DateTimeDigitized` | Fallback if `DateTimeOriginal` is absent | "from photo" |
| `file.lastModified` | Videos, or if EXIF parsing fails/returns no date | (no label — silent fallback) |

EXIF parsing is client-side only using the `exifr` library (browser-compatible, ~60 KB gzipped, handles JPEG/HEIC/WebP/TIFF). For videos there is no reliable client-side EXIF access, so `file.lastModified` is used — this is accurate enough for most cases (iOS/Mac preserve original capture time in the filesystem timestamp when exporting from Photos).

```ts
// Date extraction logic (runs before review sheet opens)
async function extractDate(file: File): Promise<{ date: string; source: 'exif' | 'file_modified' }> {
  const fallback = {
    date: new Date(file.lastModified).toISOString().split('T')[0],
    source: 'file_modified' as const,
  }
  if (file.type.startsWith('video/')) return fallback
  try {
    const exifr = await import('exifr')
    const exif = await exifr.parse(file, { DateTimeOriginal: true, DateTimeDigitized: true })
    const raw: Date | undefined = exif?.DateTimeOriginal ?? exif?.DateTimeDigitized
    if (raw && !isNaN(raw.getTime())) {
      return { date: raw.toISOString().split('T')[0], source: 'exif' }
    }
  } catch { /* fall through */ }
  return fallback
}
```

#### Edge Function: no changes needed

The existing `upload-media` Edge Function already accepts a `memoryDate` field and persists it as `memory_date`. Batch upload is purely a client-side UX change — each file is sent as a separate `POST /functions/v1/upload-media` request (same as single upload), just queued sequentially. No new API surface required.

#### Sequential vs parallel uploads

Files are uploaded one at a time (not all in parallel) to:
- Avoid saturating the user's uplink on large batches
- Keep per-item progress meaningful
- Simplify quota error handling (fail fast on the first `storage_full` error and skip remaining items)

#### Error handling

| Error | Per-item behaviour |
|---|---|
| `storage_full` | Mark item as failed with "Storage full" label, skip all remaining pending items |
| `file_too_large` | Mark item as failed with "File too large" label, continue to next |
| Network error | Mark item as failed with "Upload failed" label, continue to next |
| Session expired | Mark all pending items as failed with "Session expired" label, stop |

---

## Notifications

### In-app (real-time)
- Supabase Realtime (websockets) — listens to DB changes, pushes to connected clients instantly
- Triggers: new upload, comment, reaction, milestone

### Push notifications (mobile, backgrounded)
- FCM (Android) + APNs (iOS) via Capacitor
- Triggered by Supabase Edge Function on DB insert

### Email notifications
- **Provider:** Resend
- **Templates:** React Email
- Triggered via Supabase Edge Function on DB events (new upload, comment, milestone)
- Digest emails ("5 new memories this week") via scheduled Edge Function (cron)

```
DB insert (Memory/Comment)
  → Supabase Edge Function
  → Resend API
  → circle members notified
```

### Notification preferences
Per user, per circle — circle apps get noisy fast.

```
NotificationPreference
  - user_id, circle_id
  - push_enabled (bool)
  - email_digest_frequency: "daily" | "weekly" | "off"
  - quiet_hours_start, quiet_hours_end (e.g. 22:00–08:00)
  - circle_muted (bool) — mute a specific circle entirely
```

**Default state on join:** `push_enabled = true`, `email_digest_frequency = "weekly"`, `circle_muted = false`. Push is opt-out, not opt-in — members who never touch settings still receive activity. A member who accepts an invite and never opens Settings should not silently miss everything.

On the first push notification received, show an in-app prompt: *"Stay in the loop — configure your notification preferences"* with a link to settings. Never show a configuration screen upfront before they've experienced a notification.

All notification send paths check preferences before firing:
```ts
const prefs = await getPrefs(userId, circleId)
if (prefs.circle_muted) return
if (!isWithinQuietHours(prefs)) sendPush(...)
if (prefs.email_digest_frequency !== "off") queueDigest(...)
```

---

## Tech Stack

- **Frontend:** Nuxt
- **UI library:** shadcn-vue (Radix Vue + Tailwind — accessible, unstyled, you own the code)
- **Backend:** Supabase (Auth, DB, Storage, Realtime)
- **Mobile:** Capacitor (wraps Nuxt for iOS + Android, native push via FCM/APNs)
- **Email:** Resend + React Email
- **Hosting:** our-story.tinybit.app (Go Daddy → tinybit.app)

### Why shadcn-vue
- Components are copied into your project — you edit them directly, no fighting library opinions
- Tailwind-native — zero friction with existing setup
- Accessible by default (Radix Vue primitives) — keyboard nav, screen reader, WCAG 2.1 AA mostly handled
- Clean neutral aesthetic out of the box — suits a memory app
- Key components used: Dialog (upload modal), Sheet (memory detail), Drawer (mobile), Toast (upload success/error), Avatar, Tabs (timeline / my memories)

---

## Billing

- **Provider:** Stripe
- Subscriptions per account (owner pays) — one active subscription per user; the owner's tier determines their circles' features. See the Monetization section for the full billing model.
- Stripe webhook → Supabase DB sync on subscription changes (upgrade, downgrade, cancel)
- On voluntary cancellation (`customer.subscription.deleted`): start 30-day grace period — `Circle.subscription_status = "grace"`, `grace_period_until = now() + 30 days`. Immediate free downgrade only when `grace_period_until` expires without renewal. Retain all data. See canonical grace period rules in the Error States section.
- On failed payment (`invoice.payment_failed`): start 7-day grace period — `Circle.subscription_status = "grace"`, `grace_period_until = now() + 7 days`. Restrict new uploads only after the 7 days expire without payment resolution.

### Stripe events to handle
| Event | Action |
|---|---|
| `checkout.session.completed` | Activate paid plan |
| `invoice.payment_succeeded` | Renew subscription |
| `invoice.payment_failed` | Start grace period |
| `customer.subscription.deleted` | Start 30-day grace period (voluntary cancellation) — see canonical grace period rules in the Error States section. Immediate free downgrade only happens when `grace_period_until` expires without renewal. |

---

## Account Deletion & Data Retention

Three distinct deletion scenarios. Each is documented below with exact state changes and notification emails.

---

### Scenario 1 — Member removed from a circle (by owner or admin)

This is not account deletion. The member keeps their account; they are only removed from one circle.

**Content choice shown to the owner/admin at time of removal:**
> *"What should happen to their photos in this circle?"*
> - **Keep their memories** (default) — photos stay on the timeline. Their reactions are removed.
> - **Remove their memories** — their photos and videos are permanently deleted from this circle.

**What happens immediately (server-side):**

| Action | Keep memories | Remove memories |
|--------|--------------|-----------------|
| `memory.owner_user_id` set to `NULL` | ✓ (detaches from account) | — |
| Storage files deleted | — | ✓ |
| Memory rows deleted | — | ✓ (cascade) |
| Reactions deleted | ✓ | ✓ (always) |
| `CircleMember` row deleted | ✓ | ✓ |

**Detaching explained:** Setting `owner_user_id = NULL` means the memory is no longer tied to any user account. It stays on the timeline indefinitely, visible to all circle members. Circle owners and admins can still delete these memories later. If the removed member later deletes their own account, these detached memories are **not** affected — they survive the account purge.

**Notification email — sent to the removed member immediately:**
> Subject: *"You've been removed from [circle name]"*
> Body: *"[Owner name] has removed you from [circle name]. Your [photos/memories] [have been kept on the timeline / have been deleted]. If you think this was a mistake, reach out to the circle owner."*

---

### Scenario 2 — Member deletes their own account

**Pre-flight check (before accepting the request):**
- If the user is a circle owner → run ownership resolution first (see Scenario 3)

**What happens at the moment they confirm deletion:**
1. `User.deleted_at = now()`, `User.deletion_requested_at = now()`
2. All active sessions revoked (`auth.admin.signOut(userId, "global")`)
3. User is signed out everywhere immediately

**Notification email — sent to the user immediately:**
> Subject: *"Your account is scheduled for deletion"*
> Body: *"Your Our Story account will be permanently deleted on [date 30 days from now]. All your photos, videos, and memories will be removed. You can cancel this at any time before then from account settings. [Cancel deletion →]"*

**What the 30-day grace period looks like:**
- Account is deactivated — user cannot sign in
- Their memories are still on circle timelines (other members can still see them)
- User can cancel deletion by clicking the link in the confirmation email — this restores full access

**What the daily purge cron does at day 30:**
1. Fetches memories where `owner_user_id = user.id` → collects storage paths from `memorymedia` → deletes storage files
2. Hard-deletes the `User` row (cascades to owned `Memory` rows, `CircleMember`, `AccountStorage`)
3. Deletes the `auth.users` entry
4. Memories with `owner_user_id = NULL` (detached from a prior circle removal) are **not touched** — they remain on the timeline

**Notification email — sent 3 days before purge (day 27):**
> Subject: *"Your account will be permanently deleted in 3 days"*
> Body: *"This is your last chance to cancel your account deletion. After [date], all your data will be permanently deleted and cannot be recovered. [Cancel deletion →]"*

---

### Scenario 3 — Owner deletes their own account (ownership resolution)

Run this check before Scenario 2. For each circle the user owns:

| Circle state | Resolution |
|-------------|-----------|
| Has at least one admin | Auto-promote the oldest admin (by `created_at`) to owner. Email the new owner (see below). |
| Has members but no admins | **Block deletion.** Show list of circle names. Hint: "Go to each circle's members page and promote a member to admin." |
| Sole member (no other members) | Allow. Circle becomes empty. Purged with the account at day 30. |

Once all circles are resolved, proceed with Scenario 2.

**Notification email — sent to newly auto-promoted owner immediately:**
> Subject: *"You're now the owner of [circle name]"*
> Body: *"[Previous owner] has deleted their account and you've been made the owner of [circle name] as the most senior admin. You now have full ownership including the ability to manage billing and delete the circle."*

---

### Circle settings page (`/circle-settings`)

Owner-only page (`app/pages/circle-settings.vue`) accessible via:
- Gear icon next to the circle name in the home header (`index.vue`)
- Gear icon in the members page header (`members.vue`)

Contains:
- Circle name + type display (read-only info)
- **Danger zone** — 2-step delete circle flow (moved here from `/members`)

The delete circle flow was moved from the members page to a dedicated settings page to avoid accidental deletion and to keep the members page focused on member management.

After successful deletion the page calls `useUserState().clear()` before redirecting to `/` so the middleware re-checks membership state and redirects to `/no-circle`.

---

### Scenario 4 — Circle deleted (by owner)

Make it hard to do accidentally.

**Step 1 — Warning screen:**
> *"This will permanently delete [N] memories and remove all [N] members. Members will be notified and have 30 days to export their own photos before they're gone forever."*
> [Cancel] [Delete circle →]

**Step 2 — Type-to-confirm:**
> Type *"[circle name]"* to confirm

**Step 3 — Immediate actions:**
- `Circle.deleted_at = now()`, `Circle.deletion_initiated_by = owner.id`
- Circle hidden from all members immediately (RLS excludes it)

**Notification email — sent to all members on day 1:**
> Subject: *"[Owner name] has deleted [circle name]"*
> Body: *"[Owner name] has deleted [circle name]. You have 30 days to export your photos before they're gone forever. After [date], all memories will be permanently deleted. [Export my photos →] [Learn more →]"*

- Owner can recover the circle within 30 days from account settings (sets `Circle.deleted_at = NULL`)
- **Day 30 hard purge:** delete all storage files → delete all `Memory` rows (cascade) → delete all `CircleMember` rows → delete `Circle` row

---

### Notification email summary

| Event | Recipient(s) | When | Sent by |
|-------|-------------|------|---------|
| Member removed from circle | Removed member | Immediately | `DELETE /api/circles/[id]/members/[userId]` |
| Account deletion initiated | User | Immediately | `POST /api/account/delete` |
| Owner auto-promoted to new owner | Promoted admin | Immediately | `POST /api/account/delete` |
| Account purge warning | User | Day 27 — detected by daily purge cron via `deletion_requested_at BETWEEN (now-28d) AND (now-27d)` | `purge-deleted-users` Edge Function |
| Circle deleted | All members | Day 1 of soft-delete window | `purge-deleted-users` Edge Function (not yet implemented — step 3.7) |

Email copy for member removal varies by `keepContent`:
- `keepContent: true` → *"Your photos are still part of [circle]'s story."*
- `keepContent: false` → *"Your photos have been permanently deleted from [circle]."*

All emails sent via Resend from `hello@our-story.tinybit.app`. In dev (no `RESEND_API_KEY`), emails are logged to console instead.

---

### Grace periods

| What | Grace period | How to cancel |
|------|-------------|--------------|
| Account deletion | 30 days | Link in confirmation email, or account settings |
| Circle deletion | 30 days | Account settings (owner only) |
| After day 30 | — | Irreversible — no recovery |

---

### Soft-delete DB columns

```
User
  - deleted_at (nullable)               -- set when user initiates deletion
  - deletion_requested_at (nullable)    -- same timestamp; kept separate for audit

Circle
  - deleted_at (nullable)               -- set when owner initiates circle deletion
  - deletion_initiated_by (nullable FK → User)
```

---

## Data Export

### Why async
Export can be gigabytes — synchronous generation would timeout. Use a job queue pattern.

### Flow
```
User selects a circle and requests export (account settings)
  → POST /api/account/export { circleId }
  → API validates membership, checks for active job for this (user, circle)
  → INSERT into ExportJob { user_id, circle_id, status: "pending" }
  → Supabase Edge Function triggered (via pg_net or scheduled poll every 5 min)
  → Resolve user's role in the circle (owner/admin vs member)
  → Stream files from Supabase Storage in chunks (avoid loading all into memory)
  → Build zip using JSZip, write to temp storage bucket
  → Generate signed URL (expiry: 24 hours)
  → Send download link via Resend email (subject includes circle name)
  → UPDATE ExportJob { status: "complete", download_url, expires_at }
```

### DB schema
```
ExportJob
  - id
  - user_id
  - circle_id         ← scopes export to a single circle
  - status: "pending" | "processing" | "complete" | "failed"
  - download_url (nullable)
  - expires_at (nullable)
  - created_at
```

### Export scope
- **Members** export only their own uploads from the selected circle (GDPR portability covers data you provided)
- **Owners and admins** export the full circle — all members' uploads, with `uploaded_by` in metadata

### Export UI
- Export button lives in account settings (`/settings/account`)
- If the user belongs to one circle: auto-selected, no selector shown
- If the user belongs to multiple circles: circle selector dropdown shown above the button

### Export contents
- Original media files (photos + videos)
- `metadata.json` per memory: `{ date, note, milestone_label, visibility, circle_name, uploaded_by }`
- Folder structure: `/YYYY-MM/memory-id/photo.jpg + metadata.json`

### Limits
- One active export job per user per circle (parallel exports of different circles allowed)
- Temp zip deleted from storage after 24 hours (scheduled cleanup)
- Required for GDPR Article 20 (data portability)

---

## Content Moderation

- Invite-only reduces risk but does not eliminate it
- Any member can report a memory (flag button on each memory)
- Reported memories are hidden from circle timeline pending review
- Owner / admin notified of report and can remove the memory
- Repeated violations: account flagged (manual review for MVP, automated later)

---

## Onboarding Flow

Three entry paths depending on intent. All land on the same core product.

### Value proposition screens (shown once, on first open after signup)
Before any setup, new users see 2–3 swipeable screens that reflect their pain back at them and resolve it. Skippable after the first — never shown again. These are the bridge between "downloaded the app" and "understand why I'm here."

These screens exist because the competitive advantage is real but invisible until you name it. Most users arrive with a vague idea ("private photo sharing") — these screens sharpen it into a felt need.

**Screen 1 — The pain (relatable, not preachy):**
```
Visual: a WhatsApp conversation — 200 messages, one photo buried halfway up

"Photos get buried.
Group chats are noisy.
That moment deserved better."
```

**Screen 2 — The solution:**
```
Visual: a clean timeline — a note, a milestone label, a grandparent's reaction

"Your circle's story, beautifully kept.
Notes, milestones, and reactions —
not just another folder of files."
```

**Screen 3 — The promise (addresses cross-platform and grandparent objections):**
```
Visual: iPhone and Android side by side, view-only email on a laptop

"Works for everyone.
iPhone, Android, or just an email.
No one gets left out."
```

**Copy rules:**
- Never use the word "features" — describe feelings and outcomes
- "Group chat" and "Google Photos" are named implicitly (via the visual) but not explicitly — no competitor-bashing
- CTA at the end: "Start your story →" — not "Sign up" or "Create account"

**Empty state copy (adapts to circle_type):**
| circle_type | Headline | Body |
|---|---|---|
| parents | "Every milestone deserves a memory" | "Add your first photo or video to start documenting your little one's story." |
| couple | "Your shared story starts here" | "Add your first memory together to start building your timeline." |
| family | "Family moments last forever" | "Add your first photo or video to start building your family story." |
| friends | "Capture every adventure together" | "Add your first photo or video to start building your shared memories." |
| caregiving | "Every moment matters" | "Add your first photo or video to start documenting your journey." |
| travel | "The adventure starts here" | "Add your first photo or video from the trip to start your travel story." |
| solo | "Your story, your way" | "Add your first photo or video to start building your personal timeline." |
| custom | "Your story starts here" | "Add your first photo or video to start building your shared timeline." |

Implemented via `useCircleTypeConfig` composable (`app/composables/useCircleTypeConfig.ts`) — single source of truth for all per-type copy and chip data.

---

### Path A — Circle creator

```
Sign up (magic link or Google)
  → Value proposition screens (3 swipeable, skippable)
  → "Who is this story for?" (see circle type picker below)
  → Name your circle ("The Dao Family", "Barcelona Trip Crew", etc.)
  → Invite first member (email) — or skip
  → Upload first memory
  → Add a note
  → "Your story has begun"
```

### Path B — Solo start (invite later, or never)
For users who want to start privately before inviting anyone — or who simply want a personal timeline.

```
Sign up (magic link or Google)
  → "Who is this story for?"
  → Select: "Just me for now"
  → Name your story ("My Story", "My 2026", etc.)
  → Upload first memory
  → "Your story has begun — invite others whenever you're ready"
```

Solo start UX rules:
- Invite UI is always present — owner's discretion whether they use it
- On This Day works exactly the same — daily nostalgia is just as valuable for solo users
- Timeline looks identical — just no other contributors until someone is invited

**Privacy rule: private memories never auto-share.** When a new member joins, no existing memories change visibility. Every memory the owner created stays at its current `visibility` value until they explicitly change it. The sharing prompt is an invitation — not a default.

This is a trust-critical rule. A user who stored personal memories must never discover that a new member can see them because they forgot to check a setting. Implementation must enforce this at the DB level: `Memory.visibility` is never mutated by the invite/join flow. Only an explicit user action can change visibility to `"circle"`.

**PATCH /api/circles/[id]** — owner-only endpoint for updating `circle_type`. Accepts `{ circleType: z.enum(CIRCLE_TYPES) }`. Used by the type picker in `/circle-settings`. Implemented at `server/api/circles/[id]/index.patch.ts`.

### Path C — Invited member
Already covered above in invite-before-signup flow.

---

### Circle type picker (shown during onboarding)

**`circle_type` is a purely a UX and marketing signal.** It sets copy, empty state, and milestone chip defaults. It does not gate any features — all features are available to all circles regardless of type. The owner can change their circle type at any time from `/circle-settings`.

```
"Who is this story for?"
  → 👶 New parents       → preloads baby milestone chips, parents copy
  → 👫 Couples           → preloads relationship milestone chips, couple copy
  → 👨‍👩‍👧‍👦 Family            → preloads family milestone chips, family copy
  → 👯 Friend group      → preloads friendship milestone chips, friends copy
  → 🧓 Caregiving family → preloads health/life event chips, caregiving copy
  → 🌍 Travel group      → preloads trip/destination chips, travel copy
  → 📔 Just me           → preloads personal milestone chips, solo copy
  → ✏️  Other            → blank chips, generic copy
```

Stored as:
```sql
Circle
  - circle_type: "parents" | "couple" | "family" | "friends"
               | "caregiving" | "travel" | "solo" | "custom"
```

Used to:
- Pre-populate milestone quick-pick chips in the upload modal
- Personalise empty state copy (headline + body — see table above)
- Inform push notification copy ("Your circle" vs "Your family" vs "Your crew")
- Drive landing page per-type card copy and SEO targeting

Not used to:
- Gate any features — all features available to all circles
- Restrict invite functionality — invite UI always present regardless of type

Empty state always shows "Upload your first memory" CTA — copy adapts to `circle_type`.

**Implemented differentiation (shipped):**

All per-type copy is centralised in `app/composables/useCircleTypeConfig.ts`:

| circle_type | Milestone chips |
|---|---|
| parents | First smile · First steps · First word · First birthday · First tooth |
| couple | First date · Anniversary · Engaged · Moved in together · Wedding day |
| family | Family trip · Birthday · Holiday · Graduation · Reunion |
| friends | Trip · Party · Concert · Road trip · Reunion |
| caregiving | Good day · Doctor visit · Treatment · Recovery · Milestone |
| travel | Arrived · Best meal · Hidden gem · Adventure · Last day |
| solo | Achievement · New chapter · Goal reached · Reflection · Memory |

**Feature roadmap (available to all circles — type sets which are surfaced by default):**

Features are progressively disclosed: they appear in the UI when first used, not all at once. Type influences which features are proactively suggested in empty states and onboarding prompts, but any feature can be used by any circle regardless of type.

#### Parents
*Default features for this type: time is relative to the baby*

| Feature | Description |
|---|---|
| **Baby age stamp** | Memory cards show each tagged child's age at time of photo ("Emma · 3 months, 2 weeks"). Children stored in `ChildProfile` table (id, circle_id, name, date_of_birth) — supports multiple children (twins, siblings). Owner manages children in `/circle-settings`. At upload, uploader tags which children appear in the memory via a chip-picker; `memory_children` junction table records the tagging. `POST /api/memories/:id/children` saves tags (replace-all). `GET /api/timeline` embeds `memory_children` on each memory; age stamp only appears on tagged memories — untagged memories show no stamp. `computeBabyAge(dob, memoryDate)` formats: 1–13 days → "N days old"; 14d–1mo → "N weeks old"; 1–11mo → "N months[, W weeks]"; 1y+ → "N years[, M months]". One stamp row per tagged child (accent colour). Edit mode in `MemoryModal` lets owner update tags after upload. |
| **Developmental milestone tracks** | Predefined milestone categories (Motor, Language, Social, First foods) with completion checkboxes. |
| **Growth chart** | Weight/height log entries alongside photos, visualized as a simple chart. |
| **Vaccination tracker** | Date-stamped health events separate from memories. |
| **Weekly digest** | "Your baby is 6 months old this week" summary email with recent memories. |

#### Couple
*Default features for this type: shared relationship timeline with anniversary anchoring*

| Feature | Description |
|---|---|
| **Relationship start date** | Set once at circle creation; used to compute "Year 3 together", "1,200 days", anniversary reminders. |
| **Anniversary reminder** | Email/push nudge one week before the anniversary date. |
| **"How we met" pinned memory** | One memory pinned at the top of the timeline as the origin story. |
| **Couple stats** | Memories together, countries visited, months documented. |

#### Family
*Default features for this type: multi-generational, person-tagged memories*

| Feature | Description |
|---|---|
| **Person tags** | Tag which circle members appear in a memory. Any uploader can tag members via a chip-picker at upload time; tags are saved to `memory_members(memory_id, user_id)` junction table via `POST /api/memories/:id/members` (replace-all semantics). Tagged members receive an email notification (fire-and-forget). `GET /api/timeline` embeds `memory_members` on each memory; `PolaroidCard` renders overlapping avatar bubbles (max 4 visible, "+N" overflow). Edit mode in `MemoryModal` lets the uploader update tags after upload. Implemented in build plan §4.10.6. |
| **"This day last year"** | Surface a memory from exactly 1 year ago in a weekly digest. |
| **Event grouping** | Cluster memories by event (Christmas 2024, Summer holiday) rather than just month. |
| **Family tree light** | Simple list of circle members with their relationship labels (Grandma, Uncle, etc.). |

#### Friends
*Default features for this type: event-centric and trip-focused*

| Feature | Description |
|---|---|
| **Trip/event containers** | Group memories inside a named event (Barcelona Trip, NYE 2025). |
| **"Who was there" tag** | Tag which members attended an event. Implemented as member tagging via `memory_members` junction table — same mechanism as Family person tags (§4.10.6). |
| **Reaction leaderboard** | Fun stat: most-reacted photo, most-active member. |
| **Memory count milestones** | Celebrate 50th, 100th memory with a banner. |

#### Caregiving
*Default features for this type: structured health log alongside emotional memories*

| Feature | Description |
|---|---|
| **Daily log entry** | Simple structured note: mood (1–5), energy, free text — separate from photo memories. |
| **Medication/appointment reminders** | Upcoming event alerts. |
| **Health event types** | Tag memories as: Doctor visit · Good day · Hard day · Milestone · Treatment. |
| **Care team notes** | Private notes visible only to admins (not the care recipient if they're a member). |
| **PDF export** | Structured health timeline export for medical appointments. |

#### Travel
*Default features for this type: geography and itinerary awareness*

| Feature | Description |
|---|---|
| **Location tag** | City/country on each memory; auto-suggested from EXIF GPS data. |
| **Trip itinerary** | Ordered list of destinations with dates; memories attached to each stop. |
| **Map view** | Pins on a world map showing where memories were taken. |
| **Trip stats** | Countries visited, days travelled, km covered. |
| **"Before you leave" prompt** | Nudge to add a final memory on the last day of the trip. |

#### Solo
*Default features for this type: personal journal with reflection prompts*

| Feature | Description |
|---|---|
| **Reflection prompts** | Optional writing prompt on upload: "What made today memorable?" |
| **Mood/emotion tag** | Tag each memory with a feeling. |
| **Year-in-review** | Auto-generated annual summary of memories. |
| **Streak tracker** | "You've documented 7 days in a row." |

> **Note:** `circle_type` is a purely UX/marketing signal — it controls empty-state copy, milestone chips, and which features are proactively suggested, but it does not gate any feature. All features listed under any type are available to all circles regardless of type. If a feature has existing data it remains accessible even after the owner changes the circle type.

**Highest-value, lowest-effort features to build next** (available to all circles; type influences which are proactively suggested):

| Priority | Feature | Suggested first for | Why |
|---|---|---|---|
| 1 | Baby age stamp | parents | Birth date field + computed display — highest emotional value, clear differentiator |
| 2 | Location tag | travel | Single text field + EXIF GPS auto-fill, shown below the date |
| 3 | Health event types | caregiving | Type selector in upload modal |
| 4 | Anniversary anchoring | couple | Relationship start date field, shown in the header |

### Path D — Existing user with no active circle (`/no-circle`)

An authenticated user with a complete profile but no circle membership (e.g. removed by an owner, or their only circle was deleted) is **not** sent through the new-user onboarding flow. Onboarding asks "who is this story for?" — a disorienting question for someone who was just removed from a circle they knew.

Instead they land on `/no-circle`:

```
Removed member refreshes or signs in again
  → auth.global.ts middleware: hasMembership=false, needsProfile=false
  → router.replace('/no-circle')
```

**Page content:**
- Title: "You're not in any circle"
- Subtitle: "You may have been removed, or your invite hasn't arrived yet."
- Primary CTA: "Create a new circle" → `/onboarding` (circle type picker — they already have a profile so the profile step is skipped)
- Secondary info block: "Waiting for an invite? Ask the circle owner to send you an invite link."

**Routing rules:**

| State | Destination |
|---|---|
| `hasMembership: true` | `/` — should not be on this page |
| `needsProfile: true` | `/onboarding/profile` — brand-new user, complete profile first |
| `hasMembership: false, needsProfile: false` | Stay on `/no-circle` |

All membership-based routing is handled by `auth.global.ts` middleware — there is no page-level `onMounted` guard on `/no-circle`. The middleware runs on every navigation, so if a user gains a membership (e.g. accepts an invite in another tab) and then navigates, they are redirected to `/` automatically.

**Onboarding from `/no-circle`:**
When the user clicks "Create a new circle", they go to `/onboarding` (circle type picker). The onboarding middleware allows this for users without a membership. Since `needsProfile` is false, the profile step is skipped. They complete the flow and gain a new membership — at which point the onboarding redirect sends them to `/`.

---

### Onboarding for invited members
The creator's onboarding is covered above. Invited members land on a timeline they didn't build — they need a different first experience.

```
Invited member accepts invite → joins circle
  → Welcome screen: "Welcome to the [Dao] family story!"
  → Show 3 most recent memories as a preview carousel
  → Highlight any milestones ("Mia took her first steps last week!")
  → CTA: "Add your first memory to the story →"
  → If they skip: show gentle nudge on next open ("The circle would love to hear from you")
```

Goal: get the invited member to upload within their first session — this is the activation event that determines long-term retention.

### Invite-before-signup flow
Problem: invited user may not have an account yet.

```
Owner sends invite
  → INSERT CircleInvite { circle_id, email, token (UUID), expires_at: +7 days, status: "pending" }
  → Resend email with link: our-story.tinybit.app/invite?token=abc123

User clicks link (no account)
  → Store token in cookie (httpOnly, 7-day expiry)
  → Redirect to sign up / magic link flow
  → On auth.signUp success → check cookie for pending invite token
  → Fetch invite: SELECT role FROM CircleInvite WHERE token = $token
  → Auto-join: INSERT CircleMember { user_id, circle_id, role: invite.role }
    -- CRITICAL: use invite.role, not a hardcoded "member" — caregiver and admin invites must preserve their role
  → UPDATE CircleInvite { status: "accepted" }
  → Redirect to circle timeline
```

### DB schema
```
CircleInvite
  - id
  - circle_id
  - email
  - token (UUID, unique)
  - role: "admin" | "member" | "caregiver"  -- default "member"; must be read on auto-join
  - status: "pending" | "accepted" | "expired"
  - expires_at
  - created_at
```

### View-only access (no account required)
For anyone who wants to view without creating an account. This is a **role**, not an age group. A tech-savvy grandparent who wants to upload should be invited as a full **member** instead — they get the same app as everyone else. The view-only path is for people who will never make an account, regardless of age.

```
Owner generates view-only link
  → Create signed JWT: { circle_id, role: "viewer", exp: 30 days }
  → Link: our-story.tinybit.app/view?token=<jwt>

Viewer opens link
  → Server verifies JWT signature (no Supabase account needed)
  → Read-only API routes: fetch circle timeline (circle-visible only, newest 50, ordered by memory_date)
  → Supports photos and videos; mediaType detected server-side from file extension
  → Cannot upload or comment
  → Can react (one-tap heart — see email reactions below)
  → Bottom CTA: "Join to add your own memories →"
```

- No DB record needed for viewer — stateless JWT
- Rotate viewer link on demand (owner can revoke and regenerate)
- Timeline scope: all circle-visible memories, newest first, max 50. No month filter.
- **Curated links (owner selects specific memories):** deferred to Milestone 9.1. When the link-generation UI is built, offer two modes — "full timeline" (default) and "share a selection" (owner picks memories). Not worth implementing before 9.1 since there is no UI to drive selection.

**Expired link UX:**
A grandparent who bookmarks the view-only link and opens it 31 days later must not see a generic error. On JWT expiry, show:
> *"This link has expired. Ask [owner first name] for a new one."*
> [Send a reminder →]

"Send a reminder" opens a pre-written share sheet message the viewer can send directly to the owner (SMS, WhatsApp, etc.) — one tap, no friction. The viewer has no self-service path to regenerate a link, but they shouldn't need one.

#### Viewer-optimised UI
The view-only page is not just a "timeline with controls removed." It is a separately designed experience for a viewer-role user who may be opening a link on an old Android or iPad with no prior context. The simplified UI is driven by the **viewer role**, not by assumed age or tech ability — a 70-year-old who's comfortable with technology gets the full member experience if they're invited as a member.

**First-open experience (before they see the timeline):**
```
Full-screen splash — the most recent memory photo (full bleed)
Overlay text: "[Parent's name] created this so you'd never miss a moment."
Sub-text: "No account needed — just scroll."
CTA: "See the memories →"
```
This is the grandparent equivalent of the onboarding value proposition screens. They need emotional context before they see an interface.

**Navigation model:**
- Default view: swipe left/right between individual memories (not an infinite scroll list)
- Scroll-down for timeline list view (opt-in)
- Each memory shows: photo, date, note, child's name + age at time of memory, reactions from circle members
- Large, obvious heart button — tapping it registers a reaction without requiring an account
- Text is 1–2 sizes larger than the standard app

**Reaction without an account:**
```
Viewer taps ❤ on a memory
  → POST /api/reactions/guest { viewerToken, memoryId, emoji: "❤️" }
  → Server verifies JWT, inserts MemoryReaction with guest_name = "Viewer" (or prompted name)
  → Parent gets push: "Someone reacted to your memory ❤"
```
On first reaction, prompt for name: "What's your name? So the family knows it's you." Store in a short-lived cookie — not a full account.

**Grandparent referral CTA:**
After a viewer has scrolled through 3+ memories (engaged), show a soft prompt:
```
"Know another grandparent who'd love to see their grandkids like this?
Share this app with them →"
```
This surfaces the grandparent-to-grandparent word-of-mouth channel, which is entirely organic and entirely absent from most competitors. Grandparents trust recommendations from other grandparents more than any other source.

---

## Error States & Storage Full UX

### Storage warning (80% threshold)
Checked on every upload in the Edge Function — no separate polling needed:

```
on upload request:
  usage_pct = (account.total_used + file_size) / account.total_quota

  if usage_pct > 1.0 → reject, return { error: "storage_full" }
  if usage_pct > 0.8 → allow, return { warning: "storage_near_limit" }
```

Frontend subscribes to `AccountStorage` via Supabase Realtime — banner appears automatically when `total_used / total_quota > 0.8`.

### Grace period (post-cancellation)
Tracked as a column on `Circle`, set by Stripe webhook:

```sql
Circle
  - subscription_status: "free" | "plus" | "pro" | "grace"
  - grace_period_until (nullable timestamp)
```

Two distinct grace periods:

**Payment failed (7 days):**
```
invoice.payment_failed webhook
  → UPDATE Circle SET subscription_status = "grace",
      grace_period_until = now() + INTERVAL '7 days'

Middleware check on upload:
  if status = "grace" AND grace_period_until < now()
    → downgrade to free, block if over free quota
```

**Voluntary cancellation (30 days):**
```
customer.subscription.deleted webhook
  → UPDATE Circle SET subscription_status = "grace",
      grace_period_until = now() + INTERVAL '30 days'
  → Email all members: "[Circle name]'s Plus plan ends in 30 days.
     Your photos are safe. New uploads may be restricted after that date.
     [Export your memories →]"
```

**Content rules after downgrade — existing content is never hidden or deleted due to a plan change:**

| Content | During grace period | After downgrade to Free |
|---------|--------------------|-----------------------|
| Photos/videos already uploaded | Full access | Full access — viewable forever |
| Voice memos already recorded | Full access | Still playable — grandfathered in |
| Reactions already made | Full access | Full access |
| New uploads (if over 5 GB quota) | Allowed | Blocked until under quota |
| New voice memos | Allowed | Blocked (Pro feature) |
| Members over 10 | All keep access | All keep access — no forced removal, just can't invite more |

Downgrade restricts future actions, never past content. Hiding existing memories because of a billing change = immediate trust destruction for a family app.

### Error state summary
| State | Trigger | UX |
|---|---|---|
| Storage warning | usage > 80% | Soft banner + upgrade CTA |
| Storage full | usage = 100% | Block upload, hard prompt to upgrade |
| Grace period | payment failed | Read-only banner, re-subscribe CTA |
| Expired invite | token past `expires_at` | "This invite has expired — ask the circle owner for a new one" |
| Invalid invite | token not found | "This invite link is invalid" |
| File too large | photo > 50 MB or video > 500 MB | Inline error: "Photos must be under 50 MB / Videos must be under 500 MB" |
| Video too long | video > 90 seconds | Inline error before upload starts: "Videos must be 90 seconds or less" |

---

## API Rate Limiting & Abuse Prevention

### Why it matters
Without rate limiting, a bad actor can spam invite tokens, hammer upload endpoints, or create thousands of circles — running up your Supabase and storage bill.

### Solution: Upstash Redis (serverless rate limiter)
Upstash is a serverless Redis that works natively with Supabase Edge Functions. No server to manage.

```
npm install @upstash/ratelimit @upstash/redis
```

### Rate limit rules
| Endpoint | Limit | Window | Key |
|---|---|---|---|
| Upload | 20 requests | 1 min | `user_id` |
| Invite send | 10 requests | 1 hour | `user_id` |
| Invite token lookup | 5 requests | 1 min | `IP` |
| Export job create | 1 request | 1 hour | `user_id` |
| Auth (magic link) | 5 requests | 10 min | `IP` |

### Implementation in Edge Function
```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "1 m"),
})

const { success } = await ratelimit.limit(user_id)
if (!success) return new Response("Too many requests", { status: 429 })
```

### Invite token security
- Tokens are UUIDs (unguessable)
- Expire after 7 days
- Single-use: mark `status: "accepted"` on first use
- Max 20 pending invites per circle at a time (matches Plus member limit; Free tier cap is enforced at send-time by the tier member limit, not the pending invite cap)

---

## Performance Targets

The timeline is the core experience. If it loads slowly, the app feels broken regardless of features. These are hard targets, not aspirations.

| Metric | Target | Why |
|---|---|---|
| Timeline first image visible | < 1.0s on 4G | First impression — users judge instantly |
| Timeline LCP (Largest Contentful Paint) | < 2.5s on 4G | Google's "good" threshold; also affects PWA feel |
| Upload feedback (progress bar visible) | < 200ms after tap | User must know something is happening immediately |
| Memory open (lightbox) | < 300ms | Should feel instant — image is already thumbnailed |
| Push notification → app open → memory | < 2s | Deep link must resolve fast or the moment is lost |
| Offline queue drain on reconnect | Start within 5s | Background upload must be reliable, not mysterious |

### How to hit these

**Timeline load:**
- Cursor-based pagination — load 20 items, not all
- Serve thumbnails (300px WebP) on timeline, full-res only on open
- `vue-virtual-scroller` — only render DOM nodes in viewport
- Supabase Storage + Cloudflare CDN — images served from edge globally
- Skeleton screens while loading — perceived performance > actual performance

**Upload feedback:**
- Show progress bar immediately on file select, before upload starts
- No client-side compression — originals are uploaded and stored at full quality. Thumbnails are generated server-side on first request via Supabase Image Transformations.
- Optimistic UI: show memory in timeline at correct position immediately, mark as "uploading" — replace with real data on success

**Deep links (push → memory):**
- Universal Links (iOS) / App Links (Android) must be configured correctly
- Link format: `our-story.tinybit.app/memory/{id}` — resolves to native app if installed, browser fallback if not
- Memory page must be renderable without full timeline load — fetch single memory by ID, not the full timeline

### Testing
- Measure with Lighthouse (PWA mode) in CI — fail builds that regress below targets
- Test on a mid-range Android device (e.g. Samsung A-series) — not just iPhone 15 Pro
- Throttle to "Fast 4G" in DevTools for all timeline performance testing

---

## Image & Video CDN / Delivery

### Problem
Serving original full-res images directly on the timeline = slow loads, high bandwidth cost. A timeline with 50 photos would be unusable without thumbnails.

### Solution: Supabase Image Transformations + Cloudflare CDN

Supabase Storage is backed by Cloudflare CDN globally. Supabase also has built-in image transformation via URL params — no extra service needed for MVP.

```
// Original
https://[project].supabase.co/storage/v1/object/public/memories/photo.jpg

// Thumbnail (300x300, webp)
https://[project].supabase.co/storage/v1/render/image/public/memories/photo.jpg
  ?width=300&height=300&format=webp&quality=80

// Medium (for timeline)
?width=800&format=webp&quality=85

// Full-res (on open)
original URL
```

### Image sizes to generate per upload
| Size | Usage | Dimensions |
|---|---|---|
| Thumbnail | Timeline grid, notifications | 300×300 |
| Medium | Timeline feed | 800px wide |
| Full | Lightbox / download | Original |

Supabase handles resizing on-the-fly and caches via Cloudflare — no pre-generation needed for MVP.

### Video delivery
- Store original in Supabase Storage
- Generate poster (first frame thumbnail) via Edge Function using `ffmpeg` (Deno supports this)
- Stream via Supabase signed URL with `Content-Type: video/mp4`
- Phase 3: migrate to HLS via AWS MediaConvert for adaptive bitrate streaming

### Phase 3 upgrade path
```
Upload video
  → S3 bucket (raw)
  → Lambda trigger → AWS MediaConvert job
  → Output: HLS (.m3u8 + .ts segments) → S3
  → CloudFront CDN serves HLS
  → Client uses hls.js for playback
```

---

## Accessibility (a11y)

### Target: WCAG 2.1 AA
Especially important — your users include grandparents and non-tech family members.

### Key requirements

**Visual**
- Minimum contrast ratio: 4.5:1 for text, 3:1 for UI components
- Never rely on colour alone to convey meaning (e.g. status indicators need icons too)
- Support system font size scaling (use `rem` not `px`)
- Support dark mode (Nuxt + CSS variables)

**Images & media**
- Every uploaded memory stores an optional `alt_text` field
- If blank: fallback to `"Photo uploaded by {first_name} {last_name} on {date}"`
- Videos require captions (optional for MVP, prompted on upload)

> `alt_text (nullable)` is in the canonical `Memory` model — see the Data Model section. No migration addition needed here.

**Keyboard & screen reader**
- All interactive elements reachable via keyboard (`Tab`, `Enter`, `Space`)
- Use semantic HTML: `<button>`, `<nav>`, `<main>`, `<article>` — not `<div>` for everything
- Nuxt: use `@nuxtjs/a11y` or manual audits with `axe-core`

**Upload UX**
- Show upload progress (not just a spinner)
- Announce success/failure via `aria-live` region

### Testing
- Use `axe-core` in dev (browser extension or Vitest integration)
- Manual test with VoiceOver (iOS) and TalkBack (Android) before launch

---

## Media Privacy Model

### What "private" means in Our Story

Current model (Phase 1–2): **invite-only privacy, not zero-knowledge.**

- Photos are stored in a private Supabase Storage bucket — no public access
- Signed URLs (1h expiry) — no persistent direct links
- RLS — every DB query is scoped to authenticated circle members only
- No ads, no AI training, no data selling

What this does NOT guarantee: the developer (you) with Supabase dashboard or AWS credentials can browse the storage bucket and view photos. So can Supabase as a company. This is also true of Google Photos, iCloud (without Advanced Data Protection), and Dropbox.

### Privacy Dashboard (in-app)

A dedicated screen in Settings that makes the privacy commitment *felt*, not just stated. Shows:

```
Your photos are stored privately.
0 third parties can access them.
No ads. No AI training. No data selling.

Storage: Supabase (EU region) — invite-only, encrypted at rest
Last accessed: Never (only you and your circle)
```

Users who trust the product share it. A privacy dashboard is something a parent screenshots and sends to a skeptical grandparent. It turns "we say we're private" into "here's the proof." Competitors don't have this — they bury privacy claims in a ToS.

**Implementation:** Static settings page. No backend required — just honest copy and the Supabase region info from `runtimeConfig`.

---

**Privacy policy must be honest about this:** "Your photos are stored in a private, invite-only space. We do not sell your data, use it for advertising, or train AI on it. As with all cloud storage, your data resides on infrastructure we manage. We do not access your content except as required to operate the service (e.g. generating thumbnails, sending notifications)."

This is defensible, honest, and consistent with your positioning. Do not claim zero-knowledge unless you implement it.

---

### Why true E2EE is not built in Phase 1–2

End-to-end encryption (client encrypts before upload, server never sees plaintext) would break:

| Feature | Why it breaks |
|---|---|
| Server-side thumbnails | Can't resize encrypted image bytes |
| pHash deduplication | Can't read pixel data to compute hash |
| Video transcoding | Can't process encrypted video |
| Full-text search | Can't index encrypted notes |
| On This Day cron | Can't read encrypted memory metadata server-side |
| Invite email thumbnails | Can't generate signed preview of encrypted image |

The engineering cost is high, key management with magic-link auth (no password to derive from) is a hard unsolved problem, and it would block core features. Not worth it in Phase 1–2.

---

### Phase 3: Per-circle client-side encryption (optional, if privacy becomes a core differentiator)

If privacy becomes a hard requirement or marketing wedge, implement client-side encryption for media only (not metadata/notes — those remain readable server-side for notifications and search).

**Architecture:**

```
Circle creation:
  → Generate AES-256-GCM key (crypto.subtle.generateKey) in browser
  → Store key in IndexedDB on creator's device
  → Key never leaves the device in plaintext

Upload:
  → Read file → encrypt with circle key (AES-256-GCM) client-side
  → Upload encrypted blob to Supabase Storage
  → Server stores ciphertext only — unreadable without the key

Download:
  → Fetch encrypted blob via signed URL
  → Decrypt client-side with circle key from IndexedDB
  → Display in browser/app — plaintext never sent to server

New member joins:
  → Key exchange on invite acceptance:
      - Existing member generates a one-time encrypted key package
      - Encrypted with new member's public key (generated on signup, stored server-side)
      - New member decrypts with their private key (stored in IndexedDB)
      - Circle key now in new member's IndexedDB
```

**Key storage:**
```
IndexedDB (non-extractable CryptoKey):
  circle_keys: { [circle_id]: CryptoKey }

→ Non-extractable: key cannot be read by JS code, only used for encrypt/decrypt ops
→ Persists across sessions on the same device
→ Lost if user clears browser data or switches devices → requires re-key from another member
```

**What still works with E2EE:**
- Timeline ordering (memory_date is unencrypted metadata)
- Comments, reactions (text stored unencrypted)
- Notifications (note text stored unencrypted — encrypt only if user opts in)
- Member count, milestone labels (metadata only)

**What breaks / requires workarounds:**
- Server-side thumbnails → must generate and re-encrypt thumbnails client-side before upload (adds upload time)
- pHash dedup → run pHash client-side before encryption, send hash only (hash doesn't reveal image content)
- Invite email thumbnails → not possible — omit photo preview from invite email in E2EE mode

**Key loss / recovery:**
The hardest problem. If a user loses their only device, circle key is gone and all encrypted media is unrecoverable. Options:
- Require at least 2 active members before enabling E2EE (second member holds a copy of the key)
- Optional: encrypted key backup to a recovery passphrase (user sets a separate backup password)
- No server-side recovery — make this explicit in UX: "Enable private mode? If all members lose access, media cannot be recovered."

**Decision:** Implement as an opt-in per-circle toggle ("Enable private mode"), not the default. Default stays with current signed-URL model. Users who want stronger guarantees can opt in and accept the trade-offs.

> `e2ee_enabled` and `e2ee_enabled_at` are in the canonical `Circle` model — see the Data Model section. No migration addition needed here.

---

### Audit logging (practical middle ground, Phase 2)

Even without E2EE, add access audit logging so any internal access to user data is traceable.

- Enable Supabase audit logs (available on Pro plan)
- For S3/Phase 3: AWS CloudTrail on the media bucket — every GetObject logged with timestamp and IAM identity
- Internal policy: no developer accesses user media without a logged support ticket reason

This doesn't prevent access but makes every access accountable. Sufficient for GDPR Article 32 compliance and publishable as a transparency commitment.

---

## Privacy Policy & Terms of Service

### Why you can't skip this
- Required before any public launch
- GDPR (EU users): requires explicit consent, right to erasure, data portability
- COPPA (US): if any user under 13 — strict rules on data collection
- Your "private by design" positioning makes trust a core feature — a missing policy destroys it

### Recommendation: Termly or Iubenda
Both auto-generate compliant policies based on your answers. Iubenda is better for GDPR detail, Termly is faster.

- **Privacy Policy** must cover: what data you collect, how it's stored, third parties (Supabase, Stripe, Resend), user rights (export, deletion)
- **Terms of Service** must cover: acceptable use, content ownership, subscription terms, account termination

### Content ownership (critical for a photo app)
Spec this explicitly in ToS:
- Users own their content
- You have a limited licence to store and display it to authorised family members only
- You do not use content for training AI or advertising

### Cookie consent
- Magic link + Supabase Auth uses cookies — requires consent banner in EU
- Use Iubenda Cookie Solution or a simple consent banner
- No third-party tracking cookies (aligns with privacy positioning)

### Children's data
- Do not allow users under 13 to sign up (add age gate on signup)
- Photos of children uploaded by parents are covered under parent's consent
- Add to ToS: "You confirm you have the right to upload content involving minors"

---

## Analytics & Retention Tracking

### Why NOT Google Analytics
Contradicts your "private by design" positioning. Never use GA on this app.

### Recommendation: PostHog (self-hostable, privacy-first)
- Open source, can self-host on your own infra
- No data sold, no third-party tracking
- Works with Nuxt via `posthog-js`
- Session recording, funnels, retention charts built-in

### Key events to track
```
user_signed_up
circle_created
member_invited
member_joined
memory_uploaded          { type: photo|video, visibility: private|circle }
memory_shared_to_circle
comment_added
reaction_added
milestone_created
export_requested
subscription_upgraded
subscription_cancelled
```

### Key metrics
| Metric | Why it matters |
|---|---|
| Time to first shared memory | Core activation metric — did onboarding work? |
| D7 / D30 retention | Are circles coming back? |
| Uploads per circle per week | Engagement health |
| Invite conversion rate | % of invites → joined |
| Free → paid conversion | Monetisation funnel |
| Storage usage distribution | Informs tier sizing |

### Implementation
```ts
// Nuxt plugin: plugins/posthog.client.ts
import posthog from "posthog-js"

posthog.init(process.env.POSTHOG_KEY, {
  api_host: "https://analytics.our-story.tinybit.app", // self-hosted
  capture_pageview: true,
  autocapture: false, // manual events only — avoid capturing PII
  persistence: "localStorage",
})
```

- Never log PII in events (no names, emails, photo content)
- PostHog self-hosted keeps all data on your infra

---

## Offline Support

### Problem
### Phase 1 web: upload failure handling

For Phase 1 (web-only, no Capacitor), the upload failure UX is intentionally simple:

- On failure: show a toast — *"Upload failed. Tap to retry."* — and mark the item visually as failed in the upload list
- Never silently drop a failed upload — always surface it to the user
- No automatic retry queue in Phase 1 (added in Phase 2 with Capacitor)
- If the entire batch fails, show a single failure message rather than one per item

---

### Phase 2+: Offline upload queue

Mobile photo apps are used in low-connectivity situations — hospital, travel, remote areas. Without offline support, uploads fail silently and users lose trust.

### Solution: Upload queue in IndexedDB (Capacitor)

```
User selects photo/video to upload
  → File stored in IndexedDB queue { id, file, metadata, status: "pending" }
  → UI shows "Queued" state

App detects connectivity (Capacitor Network plugin)
  → On reconnect: process queue in order
  → Upload each item → on success: remove from queue, update UI
  → On failure: retry with exponential backoff (3 attempts), then mark "failed"
```

### Queue schema (IndexedDB)
```ts
UploadQueue {
  id: string           // local UUID
  file: Blob
  metadata: {
    circle_id, note, visibility, milestone_label
  }
  status: "pending" | "uploading" | "failed"
  retries: number
  created_at: Date
}
```

### Capacitor plugins needed
- `@capacitor/network` — detect online/offline
- `@capacitor/filesystem` — persist large files to device storage (IndexedDB has size limits)

### UX
- Show queue status in upload button: "3 photos waiting to upload"
- On reconnect: auto-process silently, notify on completion
- Failed items: "Tap to retry" — never silently drop

---

## Background Upload

### Problem
iOS and Android kill app processes when backgrounded. A 30-second video upload will fail if the user locks their phone mid-upload.

### Solution: Capacitor Background Runner

```
npm install @capacitor/background-runner
```

### How it works
- Background Runner executes a JS context separate from the main app
- iOS: uses Background Tasks framework (BGProcessingTask)
- Android: uses WorkManager

### Flow
```
User triggers upload
  → Register background task: BackgroundRunner.dispatchEvent("uploadMemory", { fileId })
  → App can be backgrounded — BackgroundRunner continues
  → On complete: post local notification "Your memory was uploaded"
  → On failure: queue for retry via UploadQueue
```

### iOS configuration (Info.plist)
```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>app.tinybit.our-story.upload</string>
</array>
```

### Limits to be aware of
- iOS Background Tasks: ~30 seconds guaranteed, up to a few minutes depending on system
- For very large videos: warn user to keep app open, or chunk upload (multipart)
- Use Supabase Storage multipart upload for files > 50MB — resumable if interrupted

### Multipart upload for large videos
```
Supabase Storage supports TUS protocol (resumable uploads)
  → If upload interrupted → resume from last chunk on reconnect
  → No need to re-upload entire file
```

---

## Signed URLs for Private Media

### Problem
Supabase Storage URLs are path-based. Without signed URLs, anyone who obtains a storage path can access a private photo directly — RLS only protects the DB, not the files.

### Solution: Two storage buckets + server-side signed URLs

```
memories-public    → circle-shared photos/videos (CDN-cached, but scoped)
memories-private   → personal (private visibility) photos/videos
```

Both buckets are set to **private** in Supabase. All media is served via signed URLs generated server-side — never expose raw storage paths to the client.

### Signed URL flow
```
Client requests timeline
  → Nuxt server route fetches Memory rows (RLS ensures correct scope)
  → For each media item: call Supabase Storage createSignedUrl()
      { expiresIn: 3600 } // 1 hour
  → Return memories with signed URLs to client
  → Client caches signed URLs in memory for duration
  → On expiry: re-fetch signed URLs (not full timeline)
```

### Implementation
```ts
// server/api/timeline.get.ts
const { data: memories } = await supabase
  .from("Memory")
  .select("*, MemoryMedia(*)")
  .eq("circle_id", circleId)

// Generate signed URLs for each media item
const memoriesWithUrls = await Promise.all(
  memories.map(async (memory) => {
    const signedUrls = await Promise.all(
      memory.MemoryMedia.map(({ storage_path }) =>
        supabase.storage
          .from("memories-private")
          .createSignedUrl(storage_path, 3600)
      )
    )
    return { ...memory, signedUrls }
  })
)
```

### Rules
- Never return any column that holds a Supabase Storage path to the client — only signed URLs. This applies to every such column regardless of its name: `storage_path` on `MemoryMedia`, `media_path` on `MemoryReaction` and `TimeCapsule`. The field name doesn't change the rule.
- Signed URLs for thumbnails: longer expiry (24h) since they're cached by CDN
- Signed URLs for originals: shorter expiry (1h) since they're only fetched on open
- Video signed URLs: include `Content-Disposition: inline` for browser playback

---

## Timeline Pagination & Performance

### Problem
A circle with 3 years of daily uploads could have 1,000+ memories. Loading all at once = slow initial load, high DB cost, bad UX.

### Solution: Cursor-based pagination + virtual scroll

**Why cursor-based, not offset:**
Offset pagination (`LIMIT 20 OFFSET 100`) breaks when new items are inserted — items shift, causing duplicates or skipped rows. Cursor pagination is stable.

### DB query
```sql
-- Fetch next page after cursor
-- NOTE: order by memory_date (not created_at) — memory_date drives timeline position
-- so old photos uploaded today appear at their correct historical position
SELECT * FROM Memory
WHERE circle_id = $1
  AND (memory_date, id) < ($cursor_memory_date, $cursor_id)
ORDER BY memory_date DESC, id DESC
LIMIT 20;
```

### API response
```ts
{
  memories: Memory[],
  next_cursor: {
    memory_date: "2024-03-15T10:00:00Z",  // matches the sort key — NOT created_at
    id: "uuid-of-last-item"
  } | null  // null = no more pages
}
```

> **Note:** The cursor key is `memory_date`, not `created_at`. The DB query binds `$cursor_memory_date` from this field. Using `created_at` here would silently produce wrong results — the query sorts by `memory_date` and the cursor must encode that same value.

### Frontend: virtual scroll
Use `vue-virtual-scroller` to render only visible items — prevents DOM bloat with large timelines.

```ts
// Only ~10 items rendered in DOM at a time regardless of list size
import { RecycleScroller } from "vue-virtual-scroller"
```

### Prefetching
```
User scrolls to 80% of current page
  → Fetch next page in background
  → Append to list seamlessly
  → No loading spinner needed
```

### Index required
```sql
-- Order by memory_date (not created_at) — this drives timeline position
-- An index on created_at would NOT be used by the timeline query
CREATE INDEX idx_memory_timeline
ON Memory (circle_id, memory_date DESC, id DESC);
```

---

## Search

### PostgreSQL full-text search (zero extra infra)
> **Product phase: Phase 2** — search ships as a Plus feature alongside Stripe billing. "Phase 1" is the name of this implementation approach (before the Phase 3 Meilisearch upgrade), not the product ship phase.

Supabase supports `tsvector` natively — fast enough for thousands of memories.

```sql
-- Add search vector column
ALTER TABLE Memory ADD COLUMN search_vector tsvector;

-- Populate on insert/update via trigger
CREATE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.note, '') || ' ' ||
    coalesce(NEW.milestone_label, '') || ' ' ||
    coalesce(NEW.alt_text, '')  -- include alt_text so memories are findable by their accessibility description
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_search_vector_update
BEFORE INSERT OR UPDATE ON Memory
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Index
CREATE INDEX idx_memory_search ON Memory USING GIN(search_vector);
```

### Search query
```ts
// Supabase client
const { data } = await supabase
  .from("Memory")
  .select("*")
  .eq("circle_id", circleId)
  .textSearch("search_vector", query, { type: "websearch" })
```

### Filter options
| Filter | Implementation |
|---|---|
| Date range | `.gte("memory_date", from).lte("memory_date", to)` — filter by when the memory happened, not when it was uploaded |
| Milestone only | `.not("milestone_label", "is", null)` |
| By uploader | `.eq("owner_user_id", userId)` |
| Media type | `.select("*, MemoryMedia!inner(*)").eq("MemoryMedia.media_type", "video")` — `media_type` is on `MemoryMedia`, not `Memory`; use an inner join so only memories with matching media are returned |

### Phase 3 upgrade: Meilisearch
When full-text search feels limiting (typo tolerance, ranking), self-host Meilisearch and sync Memory rows via Edge Function on insert/update. API is identical to swap in.

---

## Error Monitoring & Uptime

### Error tracking: Sentry
```
npm install @sentry/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@sentry/nuxt/module"],
  sentry: {
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.2,      // 20% of requests
    environment: process.env.NODE_ENV,
  }
})
```

### What to capture
- All unhandled errors (automatic)
- Upload failures with context: `{ circle_id, file_size, media_type }`
- Payment webhook failures
- Edge Function errors (Supabase logs → pipe to Sentry via webhook)

### What NOT to capture
- PII: never log user emails, names, or memory content in Sentry

### Uptime monitoring: Better Uptime
- Monitor: `https://our-story.tinybit.app/api/health`
- Check every 1 minute
- Alert via email + SMS on downtime

### Health endpoint
```ts
// server/api/health.get.ts
export default defineEventHandler(async () => {
  // Ping Supabase DB
  const { error } = await supabase.from("User").select("id").limit(1)
  if (error) throw createError({ statusCode: 503, message: "DB unreachable" })
  return { status: "ok", timestamp: new Date().toISOString() }
})
```

### Alerting thresholds
| Event | Alert |
|---|---|
| Uptime check fails | Immediate email + SMS |
| Error rate > 1% in 5 min | Sentry alert |
| Edge Function > 10 errors/min | Sentry alert |
| Stripe webhook failures | Sentry alert |

---

## Testing Strategy

You don't need 100% coverage. You need tests around the paths where a bug means data loss, billing failure, or a privacy breach. Everything else is secondary.

### Stack
| Layer | Tool |
|---|---|
| Unit + integration | Vitest |
| End-to-end | Playwright |
| Edge Function tests | Vitest + Supabase local (`supabase start`) |
| RLS policy tests | pgTAP (PostgreSQL unit testing) |

---

### What to test (priority order)

**1. RLS policies — highest priority**
A broken RLS policy means user A can read user B's private photos. This is a privacy breach. Test every policy before shipping.

```sql
-- pgTAP: verify a member cannot read another circle's memories
SELECT plan(2);

-- Set session to user_a (not in circle_b)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-a-uuid"}';

SELECT is(
  (SELECT count(*) FROM Memory WHERE circle_id = 'circle-b-uuid'),
  0::bigint,
  'user_a cannot read circle_b memories'
);

SELECT is(
  (SELECT count(*) FROM Memory WHERE owner_user_id = 'user-a-uuid' AND visibility = 'private'),
  -- only user_a's own private memories visible
  (SELECT count(*) FROM Memory WHERE owner_user_id = 'user-a-uuid'),
  'private memories only visible to owner'
);

SELECT * FROM finish();
```

Run pgTAP tests via `supabase db test` in CI on every migration.

**2. Upload quota enforcement**
The quota check runs in an Edge Function on every upload. A bug here means users can exceed their tier limit silently.

```ts
// vitest: quota enforcement
describe("upload quota", () => {
  it("rejects upload when account is at limit", async () => {
    const res = await uploadHandler({
      userId: "user-1",
      fileSize: 1_000_000,
      accountUsed: 5_368_709_120, // 5 GB (at Free limit)
      accountQuota: 5_368_709_120,
    })
    expect(res.status).toBe(413)
    expect(res.body.error).toBe("storage_full")
  })

  it("allows upload for platform_admin regardless of quota", async () => {
    const res = await uploadHandler({
      userId: "admin-1",
      platformRole: "platform_admin",
      fileSize: 1_000_000,
      accountUsed: 5_368_709_120,
      accountQuota: 5_368_709_120,
    })
    expect(res.status).toBe(200)
  })
})
```

**3. Stripe webhook handlers**
A missed webhook means a user who paid stays on Free, or a cancelled user keeps Pro access.

```ts
describe("stripe webhooks", () => {
  it("upgrades circle to plus on checkout.session.completed", async () => {
    await handleStripeEvent(checkoutCompletedEvent({ userId: "user-1", plan: "plus" }))
    const user = await db.from("User").select().eq("id", "user-1").single()
    expect(user.subscription_status).toBe("plus")
  })

  it("starts grace period on invoice.payment_failed", async () => {
    await handleStripeEvent(paymentFailedEvent({ userId: "user-1" }))
    const circle = await db.from("Circle").select().eq("created_by", "user-1").single()
    expect(circle.subscription_status).toBe("grace")
    expect(circle.grace_period_until).not.toBeNull()
  })

  // customer.subscription.deleted = voluntary cancellation → 30-day grace on Circle.
  // User.subscription_status stays at the paid tier until grace_period_until expires.
  // An immediate free downgrade here would strip features from users who just cancelled —
  // violating the contractual 30-day wind-down. See canonical grace period rules in Error States.
  it("starts 30-day grace period on customer.subscription.deleted (voluntary cancellation)", async () => {
    await handleStripeEvent(subscriptionDeletedEvent({ userId: "user-1" }))
    const circle = await db.from("Circle").select().eq("created_by", "user-1").single()
    expect(circle.subscription_status).toBe("grace")
    expect(circle.grace_period_until).not.toBeNull()
    // User.subscription_status must NOT change to "free" yet — stays at paid tier during grace
    const user = await db.from("User").select().eq("id", "user-1").single()
    expect(user.subscription_status).not.toBe("free")
  })
})
```

**4. Invite token flow**
Broken invite = new users can't join. Test the full token lifecycle.

```ts
describe("invite flow", () => {
  it("auto-joins circle after signup with pending invite token", async () => {
    const { token } = await createInvite({ circleId: "circle-1", email: "new@user.com" })
    await signUp({ email: "new@user.com", inviteToken: token })
    const member = await db.from("CircleMember").select()
      .eq("circle_id", "circle-1").eq("user_id", newUserId).single()
    expect(member.role).toBe("member")
  })

  // CRITICAL: this test is the only one that catches a hardcoded "member" bug.
  // If the auto-join flow uses a hardcoded "member" instead of invite.role,
  // the test above passes but caregivers and admins silently join as members.
  it("preserves caregiver role from invite — does NOT default to member", async () => {
    const { token } = await createInvite({ circleId: "circle-1", email: "nanny@example.com", role: "caregiver" })
    await signUp({ email: "nanny@example.com", inviteToken: token })
    const member = await db.from("CircleMember").select()
      .eq("circle_id", "circle-1").eq("user_id", newUserId).single()
    expect(member.role).toBe("caregiver")  // must be "caregiver", not "member"
  })

  it("rejects expired invite token", async () => {
    const { token } = await createInvite({ circleId: "circle-1", expiresAt: pastDate() })
    const res = await acceptInvite(token)
    expect(res.status).toBe(410)
    expect(res.body.error).toBe("invite_expired")
  })
})
```

**5. End-to-end: critical user paths (Playwright)**

Two paths that must work before any release:

```ts
// Path 1: sign up → create circle → upload → share
test("creator onboarding", async ({ page }) => {
  await page.goto("/signup")
  await completeMagicLinkSignup(page)
  await page.getByText("New parents").click()
  await page.getByLabel("Circle name").fill("The Dao Family")
  await page.getByText("Continue").click()
  await uploadPhoto(page, "test-photo.jpg")
  await page.getByLabel("Add a note").fill("First photo")
  await page.getByText("Share to circle").click()
  await expect(page.getByText("First photo")).toBeVisible()
})

// Path 2: receive invite → join → upload
test("invited member activation", async ({ page }) => {
  const inviteUrl = await createTestInvite()
  await page.goto(inviteUrl)
  await completeMagicLinkSignup(page)
  await expect(page.getByText("Welcome to")).toBeVisible()
  await uploadPhoto(page, "test-photo.jpg")
  await expect(page.getByText("added a memory")).toBeVisible()
})
```

---

### What NOT to test

- Supabase internals (Auth, Realtime, Storage) — trust the platform
- UI pixel perfection — not your job at this stage
- Every edge case in third-party libraries (Stripe SDK, Resend) — mock these at the boundary

---

### Running tests

```bash
# Unit + integration
npx vitest run

# E2E (requires local Supabase running)
supabase start
npx playwright test

# RLS policy tests
supabase db test

# In CI (GitHub Actions): all three run on every PR
```

Add to CI pipeline: fail the build if any test fails. Never merge broken RLS tests.

---

### Email deliverability (pre-launch checklist)

Invite emails landing in spam = your #1 acquisition channel failing silently. Do this before sending any real invites:

- [ ] Add SPF record to `tinybit.app` DNS (Resend provides the value)
- [ ] Add DKIM record to `tinybit.app` DNS (Resend provides the value)
- [ ] Add DMARC record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@tinybit.app`
- [ ] Send test invite to Gmail + Hotmail — confirm inbox delivery, not spam
- [ ] Verify domain in Resend dashboard shows "Verified"

Takes 30 minutes. Do it before Phase 1 launch.

---

## CI/CD Pipeline

### Stack: GitHub Actions + Vercel + Supabase CLI

```
Push to feature branch
  → GitHub Actions: lint + typecheck + unit tests
  → Vercel: preview deployment (unique URL per PR)
  → Supabase: no migration (preview uses dev project)

Merge to main
  → GitHub Actions: lint + tests pass
  → Supabase CLI: apply migrations to production
  → Vercel: production deployment
```

### GitHub Actions workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}

  deploy:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile && pnpm build
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: "--prod"
```

### Environments
| Environment | Branch | Supabase project | Purpose |
|---|---|---|---|
| Local | — | local Docker | Development |
| Preview | feature/* | dev project | PR review |
| Production | main | prod project | Live |

### Secrets management
- Never commit `.env` files
- GitHub Secrets for CI: `SUPABASE_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`
- Vercel environment variables for runtime secrets
- Rotate secrets on any team member offboarding

---

## Database Migrations

### Rule: never edit schema in the Supabase dashboard
Dashboard edits are untracked, unrepeatable, and will conflict with migration files. All schema changes go through migration files.

### Supabase CLI workflow
```bash
# Create new migration
supabase migration new add_alt_text_to_memory

# Edit the generated file
# supabase/migrations/20240315_add_alt_text_to_memory.sql
ALTER TABLE Memory ADD COLUMN alt_text TEXT;

# Apply locally
supabase db reset   # resets local DB and replays all migrations

# Apply to production (runs in CI)
supabase db push
```

### Migration file structure
```
supabase/
  migrations/
    20240101_initial_schema.sql
    20240215_add_groups.sql
    20240310_add_export_jobs.sql
    20240315_add_alt_text_to_memory.sql
  seed.sql   ← local dev seed data only, never runs in prod
```

### Rules for safe migrations
| Rule | Why |
|---|---|
| Always additive first (add columns, new tables) | Backwards compatible — old code still works during deploy |
| Never drop columns in same PR as feature | Deploy feature first, drop in a follow-up PR |
| Always provide default for new NOT NULL columns | Prevents locking large tables |
| Test migration on dev Supabase before merging | Catch syntax errors before prod |

### Example: safe column add
```sql
-- Safe: nullable first, backfill, then constrain
ALTER TABLE Memory ADD COLUMN alt_text TEXT;          -- step 1: add nullable
UPDATE Memory SET alt_text = '' WHERE alt_text IS NULL; -- step 2: backfill
-- step 3: add NOT NULL constraint in a future migration after backfill confirmed
```

---

## Backup & Disaster Recovery

### Risk
Circle photos are irreplaceable. Data loss = permanent trust destruction. Supabase paid plan includes daily DB backups (7–30 day retention), but you have no control over them and Supabase Storage has no built-in backup.

### Strategy: independent backups to a separate S3 bucket (different region)

```
Supabase (primary)          →    S3 backup bucket (secondary)
  DB (PostgreSQL)           →    daily pg_dump → S3
  Storage (photos/videos)   →    nightly sync → separate S3 bucket
```

### DB backup: scheduled GitHub Actions cron
```yaml
# .github/workflows/backup.yml
name: DB Backup
on:
  schedule:
    - cron: "0 2 * * *"  # 2am UTC daily

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Dump DB
        run: |
          pg_dump ${{ secrets.DATABASE_URL }} \
            --format=custom \
            --file=backup-$(date +%Y%m%d).dump

      - name: Upload to S3
        run: |
          aws s3 cp backup-$(date +%Y%m%d).dump \
            s3://our-story-backups/db/backup-$(date +%Y%m%d).dump
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.BACKUP_AWS_KEY }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.BACKUP_AWS_SECRET }}
```

### Storage backup: Supabase Edge Function (nightly)
```ts
// Sync new/modified storage objects to S3 backup bucket
// Use AWS SDK S3 client in Deno Edge Function
// Only sync objects modified in last 24h (incremental)
const objects = await supabase.storage
  .from("memories-private")
  .list("", { limit: 1000 })

for (const obj of objects) {
  const { data } = await supabase.storage
    .from("memories-private")
    .download(obj.name)
  await s3.putObject({ Bucket: "our-story-backups", Key: obj.name, Body: data })
}
```

### Recovery targets
| Metric | Target |
|---|---|
| RPO (max data loss) | 24 hours |
| RTO (time to restore) | < 4 hours |

### Backup retention
- Daily backups retained for 30 days
- Monthly snapshot retained for 1 year
- S3 lifecycle rule: auto-delete after retention period

### Test restores
- Restore to a staging Supabase project monthly
- Verify row counts + spot-check media files
- Document restore steps — you don't want to figure it out during an incident

---

## Deep Linking

### Why it matters
Push notifications without deep links are useless. "Mom uploaded a photo" → tap → opens home screen = bad UX. Tap → opens the specific memory = good UX. Deep links are the bridge between notifications and in-app content.

### Solution: Universal Links (iOS) + App Links (Android)
Prefer Universal Links over custom URL schemes (`ourstory://`) — they work in email clients, SMS, and are harder to hijack.

### URL structure
```
https://our-story.tinybit.app/memory/{id}       → open specific memory
https://our-story.tinybit.app/circle/{id}        → open circle timeline
https://our-story.tinybit.app/invite?token=abc  → join circle
```

### iOS: apple-app-site-association
Host at `https://our-story.tinybit.app/.well-known/apple-app-site-association`:
```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAMID.app.tinybit.our-story",
      "paths": ["/memory/*", "/circle/*", "/invite"]
    }]
  }
}
```

### Android: assetlinks.json
Host at `https://our-story.tinybit.app/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.tinybit.ourstory",
    "sha256_cert_fingerprints": ["YOUR_CERT_FINGERPRINT"]
  }
}]
```

### Capacitor: handle incoming deep links
```ts
// app.vue
import { App } from "@capacitor/app"

App.addListener("appUrlOpen", ({ url }) => {
  const path = new URL(url).pathname
  router.push(path)  // Nuxt router handles the rest
})
```

### Push notification payload
```json
{
  "title": "Mom added a memory",
  "body": "First steps at the park",
  "data": {
    "deep_link": "https://our-story.tinybit.app/memory/abc123"
  }
}
```

FCM/APNs delivers the payload → Capacitor intercepts on tap → `appUrlOpen` fires → router navigates to `/memory/abc123`.

---

## App Store Submission Requirements

### iOS (App Store Connect)

**Permissions — Info.plist**
```xml
<key>NSCameraUsageDescription</key>
<string>To capture new memories for your family timeline</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>To upload photos and videos to your family story</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>To save memories to your photo library</string>

<key>NSUserNotificationsUsageDescription</key>
<string>To notify you when family members share new memories</string>
```

**Privacy Nutrition Labels (App Store Connect → App Privacy)**
| Data type | Collected | Linked to user | Used for tracking |
|---|---|---|---|
| Photos & Videos | Yes | Yes | No |
| Name | Yes | Yes | No |
| Email address | Yes | Yes | No |
| User ID | Yes | Yes | No |
| Purchase history | Yes | Yes | No |
| Crash data | Yes | No | No |

**Age rating:** 4+ (no public UGC, invite-only)

**Required before submission:**
- Privacy policy URL live at `our-story.tinybit.app/privacy`
- Terms of service URL live at `our-story.tinybit.app/terms`
- Support URL (can be same domain)

### Android (Play Console)

**Permissions — AndroidManifest.xml**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
```

**Data Safety form (Play Console):**
- Declare: photos/videos collected, linked to identity, encrypted in transit
- No data shared with third parties for advertising
- Users can request deletion (link to account deletion flow)

### Permission request UX (both platforms)
Never request permissions on first launch. Request contextually:
```
User taps "Upload memory"
  → Check camera/photo permission
  → If not granted: show rationale first ("To upload photos...")
  → Then trigger system permission dialog
  → If denied: show settings deep link ("Enable in Settings →")
```

---

## Stripe Customer Portal

### Problem
Without self-service billing, every "how do I cancel?" or "update my card" question is a support ticket to you. At even 200 users this becomes unsustainable.

### Solution: Stripe hosted Customer Portal
Stripe provides a fully hosted portal that handles upgrade, downgrade, cancellation, payment method updates, and invoice history — zero UI to build.

### Flow
```
User taps "Manage Subscription" in app settings
  → POST /api/billing/portal (Nuxt server route)
  → Look up stripe_customer_id from User (not Circle — Stripe credentials live on User)
  → Create Stripe portal session:
      stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: "https://our-story.tinybit.app/settings"
      })
  → Redirect user to Stripe-hosted portal URL
  → User manages subscription
  → Redirected back to /settings on done
```

### Server route
```ts
// server/api/billing/portal.post.ts
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401 })

  // Stripe credentials live on User — not on Circle
  // (one subscription per user account; owner's tier determines their circles' features)
  const { data: userRecord } = await supabase
    .from("User")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!userRecord?.stripe_customer_id) {
    throw createError({ statusCode: 400, message: "No active subscription found." })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: userRecord.stripe_customer_id,
    return_url: `${process.env.APP_URL}/settings`,
  })

  return { url: session.url }
})
```

> **Note:** `stripe_customer_id` and `stripe_subscription_id` are on `User`, not `Circle`. The subscription model is per user account — one Stripe customer per user. `Circle.subscription_status` is a denormalised copy for fast RLS and is not the source of truth for billing. See the Stripe schema in the Monetization section.

### Webhooks to handle subscription changes from portal
```
customer.subscription.updated
  → UPDATE User SET subscription_status based on new price_id
  → UPDATE Circle SET subscription_status for all circles created_by = user_id

customer.subscription.deleted  (voluntary cancellation from portal)
  → UPDATE Circle SET subscription_status = "grace",
      grace_period_until = now() + INTERVAL '30 days'
  → UPDATE User SET subscription_status = (unchanged until grace expires)
  → Email all members: "[Circle name]'s plan ends in 30 days. Your photos are safe."
  -- NOTE: voluntary cancellation → 30-day grace. Payment failure → 7-day grace.
  -- These are two distinct scenarios handled by two distinct webhooks.
  -- See the canonical grace period rules in the Error States section.

payment_method.updated
  → no action needed (Stripe handles billing)
```

### Configure portal in Stripe Dashboard
- Enable: upgrade/downgrade between plans
- Enable: cancel subscription (immediate or end of period)
- Disable: pause subscription (keep it simple)
- Set cancellation flow: "cancel at period end" (not immediate) so users keep access until paid period expires

---

## Support Channel

User service is a core competitive advantage (see Core Principles). Most consumer apps ignore their users. Responding fast and resolving problems completely is how you build trust that no feature can buy.

### Service Level Agreement (SLA)

| Phase | First response | Resolution | After hours |
|---|---|---|---|
| Phase 1 (0–50 users) | Within 4 hours | Within 24 hours | Next morning |
| Phase 2 (50–200 users) | Within 2 hours | Within 12 hours | Within 4 hours |
| Phase 3 (200+ users) | Within 1 hour | Within 8 hours | Dedicated on-call |

**What "response" means:** a real reply acknowledging the issue, not an auto-responder.
**What "resolution" means:** the user's problem is solved or a clear timeline is given.

### Incident Communication

When the app is down or significantly degraded:
1. Post on status page (Better Uptime) within 15 minutes of detection
2. In-app banner if Supabase Realtime is still reachable
3. Email to all active users if outage > 1 hour
4. Post-incident report within 48 hours: what happened, what was fixed, what prevents recurrence

Template:
```
Subject: Our Story — Service Update

We experienced [issue] from [time] to [time] affecting [what].

Your data was not affected / [if data was at risk: explain what happened].

We've [fixed X] and [added Y to prevent recurrence].

We're sorry for the disruption. If you have any questions, reply to this email.

— [Your name], Our Story
```

### Solution: Crisp (free tier, in-app chat + email)
Crisp is lightweight, has a free tier, and works in both web and Capacitor mobile.

```ts
// plugins/crisp.client.ts
window.$crisp = []
window.CRISP_WEBSITE_ID = process.env.CRISP_WEBSITE_ID

const script = document.createElement("script")
script.src = "https://client.crisp.chat/l.js"
document.head.appendChild(script)

// Pre-fill user identity so you know who's messaging
$crisp.push(["set", "user:email", [user.email]])
$crisp.push(["set", "user:nickname", [`${user.first_name} ${user.last_name}`]])
```

### Support touchpoints
| Channel | Purpose | Phase |
|---|---|---|
| In-app chat (Crisp) | Real-time help, bug reports | 1 |
| `support@our-story.tinybit.app` | Email fallback, App Store requirement | 1 |
| Status page (Better Uptime) | Transparent incident communication | 1 |
| In-app feedback form | Passive feedback ("How are we doing?") | 1 |
| Feedback board (Canny/Featurebase) | Public suggestions + voting + roadmap | 2 |

### In-app feedback form (lightweight alternative to Crisp)
```ts
// POST /api/feedback
{
  user_id, message, page, app_version
}
// → inserts to Feedback table → sends email to you via Resend
```

> See the canonical `Feedback` table in the Data Model section — `user_id` is nullable to support viewer-role submissions (grandparents using the view-only link can still submit feedback without an account).

---

## Feedback Board (Phase 2)

### Why not Phase 1
At 0–50 users, talk to them directly — email, iMessage, Crisp chat. A public board with 3 posts looks abandoned. Use the in-app feedback form (above) to collect input privately and identify patterns before going public.

### Phase 2: Canny or Featurebase

Purpose-built tools for public feedback boards. Users submit feature requests, others vote, you update status (under review / planned / in progress / shipped). No need to build this yourself.

| Tool | Free tier | Notes |
|---|---|---|
| **Canny** | 100 tracked users | Clean UI, widely used, embeddable widget |
| **Featurebase** | Unlimited posts/votes | Newer, more generous free tier, simpler setup |

**Recommendation:** Featurebase for Phase 2 — unlimited free tier is sufficient until Phase 3.

### Implementation

Embed the feedback widget behind a "Send feedback" button in the app settings page. Pre-fill the user's name and email from their session so they don't need to create a separate account.

```ts
// Featurebase: identify user so submissions are linked to their account
// Add to app settings page (authenticated users only)

// For Canny:
Canny("identify", {
  appID: process.env.CANNY_APP_ID,
  user: {
    id: user.id,
    email: user.email,
    name: `${user.first_name} ${user.last_name}`,
    avatarURL: user.avatar_url,
    created: user.created_at,
  },
})

// Open the board in a modal or new tab
Canny("openChangelog")
```

**Don't make the board fully public** (no auth required to submit). Your users include grandparents who won't use it, and open boards attract spam. Require login — only your actual users can submit and vote.

### What to show on the board
- Feature requests only — not bug reports (those go to Crisp)
- Your public roadmap: what's planned, what's in progress, what shipped
- Use "shipped" notifications to close the loop with users who voted — this builds trust

### When to add it (Phase 2 trigger)
Add the feedback board when you have 20+ paying circles and are making regular product decisions. Before that, direct conversations are more valuable than a voting board.

---

## Feature Flags

### Why it matters
Feature flags let you ship code to production but control who sees it — beta users, specific families, or a percentage rollout. Prevents risky big-bang releases and lets you test with real users safely.

### Solution: FeatureFlag table in Supabase (no extra service needed)

```sql
FeatureFlag
  - id
  - key (unique)          -- e.g. "milestone_chapters"
  - enabled_globally      -- boolean, default false
  - enabled_user_ids      -- uuid[] (specific users)
  - enabled_pct           -- integer 0-100 (percentage rollout)
  - created_at
```

### Evaluation logic (Nuxt server route)
```ts
async function isEnabled(flag: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("FeatureFlag")
    .select("*")
    .eq("key", flag)
    .single()

  if (!data) return false
  if (data.enabled_globally) return true
  if (data.enabled_user_ids?.includes(userId)) return true
  if (data.enabled_pct > 0) {
    // Stable hash: same user always gets same result
    const hash = hashUserId(userId) % 100
    return hash < data.enabled_pct
  }
  return false
}
```

### Usage in components
```ts
// composables/useFeatureFlag.ts
const { data: flags } = await useFetch("/api/flags")

const hasMilestoneChapters = computed(() =>
  flags.value?.includes("milestone_chapters")
)
```

### Rollout workflow
```
1. Ship feature behind flag (disabled globally)
2. Enable for your own user_id → test in prod
3. Enable for beta family group (enabled_user_ids)
4. Ramp enabled_pct: 10% → 50% → 100%
5. Set enabled_globally = true → remove flag from code
```

---

## Localization / i18n

### Why it matters
Family apps are used across generations and cultures. Building without i18n from the start means a painful retrofit later — especially for date formats, RTL languages, and pluralization. All three priority languages ship in Phase 1 (see below).

### Solution: @nuxtjs/i18n

```
npm install @nuxtjs/i18n
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@nuxtjs/i18n"],
  i18n: {
    locales: [
      { code: "en", file: "en.json", name: "English" },
      { code: "fr", file: "fr.json", name: "Français" },
      { code: "zh-Hans", file: "zh-Hans.json", name: "中文（简体）" },
    ],
    defaultLocale: "en",
    strategy: "prefix_except_default",
    lazy: true,
    langDir: "locales/",
  }
})
```

### Usage
```ts
// locales/en.json
{
  "timeline.empty": "Upload your first memory",
  "memory.share": "Add to circle story",
  "storage.full": "Your circle memory space is full",
  "milestone.first_steps": "First steps"
}

// In component
const { t } = useI18n()
t("timeline.empty")
```

### Priority languages for Phase 1
| Language | Reason |
|---|---|
| English | Default |
| Chinese (Simplified) | **Must-have** — primary motivation is enabling the developer's own parents to use the app; non-negotiable before personal launch |
| French | Canadian bilingual requirement |

### Key i18n considerations
- **Date formats**: always use `Intl.DateTimeFormat` — never hardcode `MM/DD/YYYY`
- **Pluralization**: "1 memory" vs "3 memories" — i18n handles this via plural rules
- **RTL**: Arabic/Hebrew would require CSS `dir="rtl"` — defer to Phase 3
- **Milestone labels**: store as i18n keys in DB, not raw strings

```sql
-- Store as key, translate at display time
Memory
  - milestone_label: "first_steps" | "first_birthday" | null
-- NOT: milestone_label: "First Steps"
```

---

## Media Deduplication

### Problem
Mobile photo apps frequently produce duplicates — same photo uploaded twice, once from camera roll and once from a screenshot. Duplicates waste storage (your cost) and clutter the timeline (user experience).

### Solution: perceptual hash (pHash) on upload

A perceptual hash captures the visual fingerprint of an image — similar images produce similar hashes. Unlike MD5/SHA (which change if a single pixel differs), pHash is robust to minor edits, compression, and re-saves.

### Flow
```
User selects photo for upload
  → Client generates pHash (using `sharp` in Edge Function or `blurhash` client-side)
  → POST /api/upload with { pHash, circle_id }
  → Server checks:
      SELECT id FROM MemoryMedia
      WHERE circle_id = $circle_id
        AND phash_distance(pHash, $pHash) < 10  -- threshold
  → If match found: warn user "This looks like a photo you've already uploaded"
      → User confirms or cancels
  → If no match: proceed with upload, store pHash
```

> `phash` is in the canonical `MemoryMedia` model — see the Data Model section. No migration addition needed here.

### pHash distance function (PostgreSQL)
```sql
-- Hamming distance between two pHash strings
CREATE FUNCTION phash_distance(a TEXT, b TEXT) RETURNS INT AS $$
  SELECT bit_count((('x' || a)::bit(64)) # (('x' || b)::bit(64)))::INT
$$ LANGUAGE SQL IMMUTABLE;

-- Index for fast similarity search
CREATE INDEX idx_memorymedia_phash ON MemoryMedia (circle_id, phash);
```

### Threshold guide
| Distance | Meaning |
|---|---|
| 0 | Exact duplicate |
| 1–5 | Near-identical (compression artefacts) |
| 6–10 | Very similar (minor crop/edit) |
| > 10 | Different image |

### Videos
- pHash on first frame only (sufficient for duplicate detection)
- Also check file size + duration as a fast pre-filter before hashing

### UX
- **Warn, don't block** — user may intentionally upload a similar photo
- "This looks like a photo you've already added — upload anyway?"
- Show the existing matching photo as a thumbnail in the warning

---

## Early Retention (Months 1–6)

On This Day is the #1 long-term retention driver — but it requires 1+ year of memories to trigger. New circles in their first 6 months get nothing from it. This is the highest-churn window. These hooks cover the gap.

### Hook 1: Weekly activity digest (week 1 onward)
Even with 3 photos, a weekly email showing "3 memories added this week" with thumbnails creates a habit loop. Does not require historical data.

```
Scheduled Edge Function (every Monday 9am local time)
  → SELECT memories uploaded in last 7 days for each circle
  → If count > 0: send digest via Resend
      Subject: "[Circle name] added [N] memories this week"
      Body: thumbnail grid + most-reacted memory + CTA to open app
  → If count = 0: send re-engagement nudge
      Subject: "Your story is waiting — add a memory this week"
```

### Hook 2: Milestone suggestions (proactive, date-driven)
Push/email sent when an upcoming milestone is near. Drives uploads between events.

This is the most powerful retention hook in the entire app — and the most underdeveloped in most competitors. The key insight: send three notifications per milestone, not one.

**Triple-nudge pattern (3 days before → day of → 3 days after):**
```
Scheduled Edge Function (daily)
  → For each ChildProfile: calculate upcoming milestones from date_of_birth

  Monthly age milestones: [1mo, 2mo, 3mo, 6mo, 9mo, 12mo, 18mo, 24mo,
                           then yearly: 3yr, 4yr, 5yr, ...]

  T-3 days:  "Mia turns 6 months on Thursday — ready to capture the moment?"
  T+0 days:  "Today is Mia's 6-month birthday 🎉 Add a memory?"
  T+3 days:  "Did you capture Mia's 6-month milestone? Add it before the moment fades →"
             (only if NO memory was uploaded with milestone_label matching this event in ±3 day window)
```

The T+3 follow-up is the most important and the most missing from competitors. The moment already happened — the user definitely has photos on their camera roll. The guilt of not having documented it yet converts better than the advance notice.

**Auto-detected milestones (no user setup required):**
```sql
-- Auto-calculate from ChildProfile.date_of_birth
-- Run daily cron, check if any child hits a milestone age in next 3 days
SELECT cp.id, cp.name, cp.date_of_birth, c.id as circle_id
FROM ChildProfile cp
JOIN Circle c ON cp.circle_id = c.id
WHERE age_in_months(cp.date_of_birth, today + 3) IN (1,2,3,6,9,12,18,24,36,48,60)
  AND age_in_months(cp.date_of_birth, today + 2) NOT IN (1,2,3,6,9,12,18,24,36,48,60)
  -- i.e., the milestone is exactly 3 days away
```

**Other circle types:**
```
Couples:
  T-3: "Your [N]-year anniversary is in 3 days — add a memory?"
  T+0: "Happy [N] years together 🥂 — capture today"
  T+3: "Did you celebrate your anniversary? Add it to your story →"

Friend groups:
  Annual trip anniversary: same triple-nudge
  > 14 days since last upload: "Your crew hasn't added anything in 2 weeks — what's new?"
```

### Hook 3: First-memory anniversary (month 1)
Sent exactly 1 month after a circle's first upload. Implemented as part of the **"Your First Month" recap email** (see Key Features §7.5) — not a separate send.

The nostalgia element ("One month ago, [uploader] added your first memory") is the opening section of that email. `Circle.first_month_email_sent` is the guard flag. There is one email, one flag, one Edge Function invocation.

### Hook 4: "Quiet circle" nudge (14-day inactivity)
If no uploads in 14 days, send a soft nudge to the owner only (not all members — don't spam).

```
if circle.last_memory_at < now() - INTERVAL '14 days'
  AND circle.quiet_nudge_count < 3
  → push to owner only: "Your story has been quiet — add something this week?"
  → UPDATE Circle SET quiet_nudge_count = quiet_nudge_count + 1,
                      quiet_nudge_last_sent_at = now()
```

> `last_memory_at` is updated on every Memory insert via trigger (see Data Model `Circle` table). Do not query `MAX(Memory.created_at)` per-circle in the cron — it will not scale.

**Hard rules to prevent guilt-tripping:**
- Max 3 nudges total before permanently stopping for that circle — families that go quiet don't want to be badgered
- Minimum 14 days between nudges (never more than monthly)
- Hard stop after 3 consecutive non-engaged nudges — if they've ignored 3, they've made their decision
- Reset nudge count if a new memory is uploaded (circle is active again) — implemented in the `handle_memory_insert()` trigger: `quiet_nudge_count = 0` on every Memory insert. This gives the circle a fresh 3-nudge window the next time it goes quiet. Do not reset in the cron — the trigger is the right place because it fires immediately on any upload.
- Never send to members — owner only

> `quiet_nudge_count` and `quiet_nudge_last_sent_at` are in the canonical `Circle` model — see the Data Model section. No migration addition needed here.

### Hook 5: Circle streak
A streak that belongs to the circle, not the individual. Any member uploading counts — this distributes the pressure and makes it social rather than personal.

```
CircleStreak
  - circle_id
  - current_streak_weeks INT  -- consecutive weeks with ≥1 upload
  - longest_streak_weeks INT
  - last_upload_week DATE     -- ISO week of most recent upload
```

**Streak rules:**
- Increments when a memory is uploaded in a new ISO week (Mon–Sun)
- Breaks if an entire week passes with no upload from any member
- Displayed on the timeline header: "🔥 7-week streak"
- Breaking a streak sends a soft push to the owner (not all members) on Sunday evening if no upload yet that week: "Your 7-week streak ends tonight — add a quick memory?"

**Why circle-level, not individual:**
Duolingo's individual streak works because the obligation is personal. For a family app, individual streaks create guilt and pressure that breaks relationships. A circle streak distributes responsibility — Dad didn't upload this week but Mum did, and the streak is safe. The nudge goes to the owner who can either upload or remind the group.

**Shareable streak achievement:**
At 4 weeks, 12 weeks, and 52 weeks — show an in-app celebration card:
```
"🎉 The Johnson family has shared memories for 52 weeks in a row!"
[Share to WhatsApp] [Share to Instagram Stories]
```
The 52-week card is a word-of-mouth moment. It's inherently brag-worthy.

**Build order:** Weekly digest first (works from day 1, highest impact). Milestone suggestions second (requires ChildProfile data). First-memory anniversary and quiet nudge are low-effort additions. Circle streak is Phase 2 — requires a week of usage data to be meaningful.

---

## On This Day (Nostalgia Engine)

The #1 retention driver. Brings users back unprompted, every day.

### Features
- Daily push notification: "2 years ago today — Mia's first birthday 🎂" *(Phase 1)*
- In-app "On This Day" carousel at the top of the timeline *(Phase 3 — push notification is Phase 1; see carousel subsection below)*
- Weekly email digest: "Your family added 7 memories this week" + thumbnails of highlights *(Phase 1)*

### Activation threshold

On This Day only activates for circles with **30+ memories and 90+ days since first upload**. Below this threshold, most days yield nothing — a Plus subscriber paying $4.99/mo who sees silence for months concludes the feature is broken.

**Below-threshold fallback:** substitute a *"A memory from your first month"* notification — surface the oldest memory in the circle as a mini-nostalgia moment. This gives new circles a retention hook while On This Day ramps up.

```
if circle.memory_count < 30 OR circle.first_memory_at > now() - INTERVAL '90 days':
  → Send "A memory from your first month" (oldest memory) instead
  → Max once per week — do not send daily if below threshold
```

> `memory_count` is in the canonical `Circle` model — incremented by the `handle_memory_insert()` trigger on every Memory insert. Do not query `COUNT(*) FROM Memory WHERE circle_id = $id` in the cron — it does not scale.

### Implementation: scheduled Edge Function (daily cron)
```
Every day at 8am (user's local timezone):
  SELECT * FROM Memory
  WHERE circle_id = $circle_id
    AND EXTRACT(month FROM memory_date) = EXTRACT(month FROM today)
    AND EXTRACT(day FROM memory_date) = EXTRACT(day FROM today)
    AND memory_date < today - INTERVAL '1 year'

  → For each result: send push via FCM/APNs
      title: "On This Day, {N} years ago"
      body: memory note or "{uploader} added a memory"
      deep_link: /memory/{id}
```

### Weekly digest (every Monday 9am)

> See the **Early Retention** section (Hook 1) for the canonical weekly digest implementation — including the zero-upload re-engagement variant, subject line personalisation, and build priority. The digest is built in Phase 1 alongside the On This Day cron; both share the same Edge Function invocation pattern.

#### Grandparent-first digest design
The weekly digest is the primary product for grandparents — many will never open the app. Design the email for them, not for the circle creator.

**Subject line:**
- For viewers/followers: `"3 new memories of Mia this week 📸"` — not "Your weekly digest"
- For active members: `"The Johnson family added 5 memories this week"`
- Personalise with the child's name when `ChildProfile` exists and the recipient is a viewer-role user

**Email structure:**
```
[Hero image — best photo of the week, full width, large]

Mia · 8 months old

[Memory 1 thumbnail] [Memory 2 thumbnail] [Memory 3 thumbnail]

        ❤  React with a heart →         ← single tracked link

    → See all this week's memories

---
You're receiving this because [parent name] shares
Mia's story with you. Unsubscribe at any time.
```

**One-tap email reaction:**
The `❤ React with a heart →` link is a tracked GET endpoint — no login required:
```
GET /api/reactions/email?token=<viewer-jwt>&memoryId=<id>&emoji=❤️
  → Verify JWT (viewer role OK)
  → INSERT MemoryReaction { memory_id, emoji: "❤️", guest_name from JWT }
  → Notify parents: "Grandma reacted to your memory ❤"
  → 302 redirect to /view/<circle-token> — grandparent lands on the timeline
```
This is the single most important interaction for grandparent engagement. FamilyAlbum built their retention around this pattern. Requiring the grandparent to open the app to react loses ~80% of them.

### "On This Day" carousel (in-app)

> **Phase 3 only.** The push notification and below-threshold fallback email are Phase 1. The in-timeline carousel surface ships in Phase 3 — do not build it in Phase 1.

- Shown at top of timeline when matching memories exist
- Dismissible per session
- Tapping opens the memory in full

---

## Referral & Sharing Mechanics

### Why referral matters
Every family invite is a new user acquisition. The app is inherently viral — but only if the mechanics make it effortless.

### Referral program
```
User invites a friend to start their own family story
  → Share referral link: our-story.tinybit.app/join?ref={referral_code}
  → Referee signs up + creates a family + uploads first memory
  → Referrer receives a 30-day Pro trial (credited immediately on referee's first upload)
```

The referee gets no separate reward — the invite itself is valuable (they gain access to a product they want). The referrer gets something aspirational and immediately felt: Pro features for 30 days.

### DB schema
```sql
User
  - referral_code (unique, auto-generated on signup)
  - referred_by_user_id (nullable)

Referral
  - id, referrer_user_id, referee_user_id
  - status: "pending" | "completed"
  - pro_trial_granted (bool, default false)
  - pro_trial_ends_at (nullable timestamp)  -- set when reward is granted; propagated to Circle.trial_ends_at
  - created_at
```

### Referral completion trigger
```
Referee signs up with referral code
  → INSERT Referral { referrer, referee, status: "pending" }

Referee uploads first memory
  → UPDATE Referral { status: "completed", pro_trial_granted: true,
      pro_trial_ends_at: GREATEST(COALESCE(referrer_circle.trial_ends_at, now()), now() + INTERVAL '30 days') }
  → UPDATE Circle SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now() + INTERVAL '30 days')
      for all circles where created_by = referrer_user_id
      (if referrer already has a running trial, this extends it to 30 days from today if that's further out)
  → Notify referrer: "Your friend joined — enjoy 30 days of Pro free!"
```

### Multi-circle support and circle switcher

A user can belong to multiple circles (e.g. "Dao Family" and "Barcelona Trip Crew"). The active circle is tracked via the `?circle=<id>` URL query param; when absent the first circle in the list is used.

**Circle switcher** — the circle name in the main nav header is always clickable and opens a bottom sheet showing:
- All circles the user belongs to, with their role badge
- A checkmark on the currently active circle
- "Create a new circle" CTA at the bottom (navigates to `/onboarding`)

Switching circles updates the URL param (`/?circle=<id>`) and reloads the timeline.

**Creating a second circle** — any authenticated user (including existing members) can access `/onboarding` to create a new circle. The onboarding middleware no longer blocks on `hasMembership`. The profile step is skipped when `needsProfile=false`. After creation the user is redirected to `/?circle=<newId>` so the new circle is immediately active.

**Post-creation redirect** — both `onboarding/name.vue` (solo path) and `onboarding/invite.vue` (invite path) redirect to `/?circle=<newId>` after completing the flow, not to bare `/`.

### "Invite another circle" flow
A user who loves the app in Circle A should easily seed Circle B:
- "Create a new circle" CTA in circle switcher
- Pre-filled invite email: "I've been using Our Story with my family — want to start one for ours?"
- Every new circle created = new subscription opportunity

### Shareable memory card
- "Share" button on each memory generates a branded preview card
- Card: photo + note + "Our Story" wordmark + "ourstory.tinybit.app"
- Share to WhatsApp, iMessage, Instagram Stories, copy link
- Viewer lands on a public preview page → CTA: "Start your family's story →"

### Milestone sharing cards
Every time a milestone is marked on a memory, offer a beautifully designed card for external sharing. This is the single most important acquisition mechanism for new parents — they share milestones constantly, to Instagram, WhatsApp, family group chats.

**Card design:**
```
[Photo, full bleed, soft vignette]

"Mia took her first steps 👶"
April 2026 · 10 months old

          Our Story
    ourstory.tinybit.app
```

**Rules:**
- Card is generated client-side (canvas API) — no server round-trip
- Offered automatically after saving a milestone memory: "Share this milestone?"
- Share targets: Instagram Stories (9:16), WhatsApp (1:1 square), copy image
- The Our Story wordmark is small but present — when another new parent asks "what app is that?", the answer is visible
- No login required to view the landing page the link opens

**Why this drives acquisition:**
New parents share milestone moments constantly. They're already going to share the photo somewhere. Offering a beautifully formatted card makes Our Story the *format* for that share — the app's name spreads as a side effect, exactly as Nike Run Club's post-run card made NRC synonymous with running photos.

### Grandparent referral loop
The grandparent-to-grandparent channel is the most underrated acquisition path in this space and is completely absent from competitors.

Grandparents who have a good viewing experience tell other grandparents. "My daughter set this up — I get photos every week, it's lovely." This happens organically, but you can design for it:

**Trigger:** After a viewer (grandparent) has reacted to 3+ memories (high engagement signal):
```
Push or in-app prompt on next open:
"Know another grandparent who'd love this?
Share the app with them →"

[Share link: ourstory.tinybit.app/for-grandparents]
```

**The `/for-grandparents` landing page:**
- Shows the view-only experience demo (no real family data)
- Copy: "See your grandkids' story, every week, in your inbox. No app needed."
- CTA: "Ask your family to set this up for you →" — sends a pre-written message to the grandparent's own family

The last CTA is the key insight: the grandparent *becomes the acquisition channel into a new family*. They don't refer another viewer — they trigger their own family (a new creator) to sign up.

### Referral incentive: 30-day Pro trial

When a referred user uploads their first memory, the referrer receives a **30-day Pro trial** (not +5 GB storage).

**Why Pro trial beats +5 GB storage:**
- Storage is invisible — users don't notice 5 GB until they're nearly full, which could be months away. The reward has zero emotional impact at the moment of referral.
- A Pro trial is immediate and tangible — the referrer gets time capsules, Year in Review preview, and voice reactions *today*. They feel the upgrade.
- It creates aspirational intent — most referrers will want to stay on Pro after 30 days, driving upgrade conversion at zero extra acquisition cost.
- The referral program "sell" becomes: *"Invite a friend, get a month of Pro free"* — far more compelling than *"get 5 GB"*

**Trigger:** Credited when the referee uploads their first memory (not just signs up) — rewards genuine activation, not drive-by signups.

**DB:** No separate reward table needed. The trial end date is stored directly on `Referral.pro_trial_ends_at` (for audit trail) and propagated to `Circle.trial_ends_at` (for enforcement). See the core Data Model `Referral` table.

---

## Memory Date Override

### Problem
Families upload old photos from years ago — scanned prints, photos from a grandparent's phone, throwbacks. Using `created_at` (upload time) for timeline ordering makes these appear at the wrong point in the story.

### Solution: `memory_date` field (separate from `created_at`)

```sql
Memory
  - memory_date TIMESTAMPTZ   -- used for timeline ordering
  - created_at TIMESTAMPTZ    -- upload time, never changes
```

### Population priority
```
1. User manually sets a date → use that
2. EXIF metadata present in file → extract and use
3. Fallback → created_at (upload time)
```

### EXIF extraction (Edge Function on upload)
```ts
import * as exifr from "exifr"  // Deno-compatible
const exif = await exifr.parse(file)
const memoryDate = exif?.DateTimeOriginal ?? new Date()
```

### UX
- Date shown on memory card — user can tap to edit
- Timeline ordered by `memory_date DESC` (not `created_at`)
- When uploading: "When was this taken?" — pre-filled from EXIF, editable
- Uploading a 10-year-old photo inserts it correctly into the 10-years-ago position in the timeline

---

## Launch GTM (First 50 Users)

The product can be perfect and still die at zero if no one hears about it. This is the only marketing plan needed for Phase 1 — five specific channels, no budget required.

### Channel 1: New parent communities (primary beachhead)
New parents are the highest-motivation audience. They have a clear pain point, they talk to each other constantly, and they share app recommendations freely.

- **r/beyondthebump** (2M members), **r/NewParents**, **r/daddit**, **r/mommit**
- **Facebook Groups** — "New Moms [City]", birth month groups ("March 2025 Babies") — extremely active, high peer-recommendation trust
- **What to post:** A real memory from your own circle. Never a feature list. Show the emotional output, not the product.

**How to engage without getting banned:**
Reddit and Facebook parent communities have strict no-promotion rules. Violating them gets you banned and poisons the channel for future posts. The only approach that works:

1. **Be a genuine member first.** Spend 2–4 weeks contributing to threads unrelated to your product — answer questions, share experiences, be helpful. Build post history. New accounts with zero activity that immediately post about their product are flagged instantly.
2. **Post your own story, not a product pitch.** "I built something to solve this problem I had" is allowed and respected. "Check out my new app" is spam. The difference is authenticity — you must actually be a parent using this for your own family, not a founder looking for beta users.
3. **Let the product spread from value, not promotion.** Post a real memory from your own circle. Show what the app *does* emotionally, not what it *is* technically. If it's good, people ask what app made that. That question is the only CTA you need.
4. **Reply to every DM personally.** Early adopters who DM are your most valuable signal. They'll become advocates if you treat them like people, not metrics.
5. **Never post the same thing twice.** Subreddit mods track this. Unique, genuine contributions only.

Concrete post formats that work:
- "We've been using [app] for 6 months. Here's what our family's story looks like." (screenshot of timeline — no UI chrome, just the memories)
- Responding to "how do you remember your baby's milestones?" threads: share your workflow, mention the app only if directly asked or as a natural part of the answer
- "Soft launch post": "I built this for our family because nothing else did X. Would love feedback from other new parents." — works once, in the right subreddit, with real post history behind it

### Channel 2: Your own network (fastest path to first 10)
- Personally invite 5–10 friends/family who have kids or a meaningful group
- These are not real users yet — they're beta testers who give you feedback and don't churn because they know you
- Goal: one external circle (people who don't know you) using it within the first month

### Channel 3: Couples and friend groups (secondary)
- **r/relationships**, **r/LongDistance** — for couples wanting a private shared space
- **Travel communities** — post-trip "how we stayed connected and remembered this trip" angle
- **Discord servers** for friend groups (gaming, hobby communities) — private photo sharing for groups is a universal problem

### Channel 4: Maker communities (for early feedback, not users)
- Product Hunt launch (Phase 2, after retention is proven)
- Indie Hackers — document the build in public. Attracts early adopters who love trying new apps.
- Twitter/X build-in-public thread — not for users, for accountability and SEO

### Channel 5: The invite email as acquisition
Every circle creator who invites a member is doing marketing for you. The invite email (see spec above) lands in inboxes of people who've never heard of Our Story. Make it beautiful. This is free distribution.

### What NOT to do in Phase 1
- No paid ads (CAC before you know LTV = burning money)
- No App Store optimisation (no app yet)
- No press outreach (nothing to show yet)
- No ProductHunt (before retention is proven, early negative reviews stick)

### Exit criteria
First 50 users acquired, at least 10 from channels you don't personally control (community posts, invite chain).

---

## Cold Discovery Strategy

Everything else in the growth section assumes someone gets invited. This section addresses how the very first person in any family network finds the app.

### The problem
The invite model is efficient but it has no cold start. If no one in a family has heard of Our Story, no invite gets sent. Word-of-mouth only compounds — it doesn't start the chain.

### The landing page as the cold discovery path

The app root (`our-story.tinybit.app/`) serves as the landing page for unauthenticated visitors. It is the single coldest entry point and must do one job: convert a curious stranger into someone who creates their first circle.

**Primary search moment to target:** "private photo sharing for family" — high intent, low competition, no dominant brand owns it.

**Page structure:**
```
Headline:   A private space where your circle builds a shared story.
Subhead:    No ads. No AI training. Invite-only.
CTA:        Start your circle — free  →

Below fold:
  1. What it looks like
       — Screenshot of timeline with a milestone card visible

  2. How it works
       — 3 steps: invite → upload → remember

  3. "Who uses it" — per-type feature cards
       — One card per circle type (7 types)
       — Each card: emoji icon, type name, core differentiation tagline,
         3–4 bullet feature highlights specific to that type
       — CTA on each card: "Start a [type] circle →"
       — See §Circle-type landing page sections for full copy per type

  4. Privacy proof
       — "Your photos never leave your circle."
       — "No ads. No algorithm. No AI training on your memories."

  5. Pricing summary
       — Free to start. One line. Link to /pricing.
```

**SEO targets (Phase 1):**
- "private photo sharing for family"
- "family memory app"
- "private baby photo sharing grandparents"
- "photo sharing app no ads"
- "baby milestone tracker app"
- "couple photo timeline app"
- "group travel photo sharing"
- "caregiving journal app"

**What this is NOT:** a marketing site with multiple pages, blog, or complex content. It's a single focused page. Build it inside the Nuxt app as the `/` route — unauthenticated visitors land here, authenticated users are redirected to `/timeline`.

**Per-type card copy** — see §Circle-type landing page sections below for the feature bullets, taglines, and SEO angles to use in each card. The cards are the primary way the landing page communicates the product's depth without requiring a sign-up.

---

### Circle-type landing page sections

The "Who uses it" section of the landing page should expand into per-type feature highlights. Each type has a distinct core differentiation that resonates with a different audience. Use these in landing page copy, SEO targeting, and any future type-specific landing sub-pages (`/for-parents`, `/for-couples`, etc.).

---

#### 👶 Parents
**Default features: time is relative to the baby**

- **Baby age stamp** — tag children on individual memories at upload time; the memory card shows each tagged child's age ("Emma · 3 months, 2 weeks"). Untagged memories show no stamp. Supports multiple children (twins, siblings). Child profiles (name + date of birth) are managed in circle settings.
- **Developmental milestone categories** — predefined milestone tracks (Motor, Language, Social, First foods) with completion checkboxes
- **Growth chart** — weight/height log entries alongside photos, visualized as a simple chart
- **Vaccination tracker** — date-stamped health events separate from memories
- **Weekly digest** — "Your baby is 6 months old this week" summary email with recent memories

SEO angles: "private baby photo sharing", "baby milestone tracker", "share baby photos with grandparents"

---

#### 💑 Couple
**Default features: shared relationship timeline with anniversary anchoring**

- **Relationship start date** — set once, used to calculate "Year 3 together", "1,200 days"
- **Anniversary reminder** — email/push nudge a week before the anniversary
- **"How we met" pinned memory** — one memory pinned at the top of the timeline as the origin story
- **Couple stats** — memories together, countries visited, months documented

SEO angles: "couple memory app", "relationship photo timeline", "private photo album for couples"

---

#### 👨‍👩‍👧‍👦 Family
**Default features for this type: multi-generational, person-tagged memories**

- **Person tags** — tag which circle members appear in a memory; avatar bubbles on cards, email notification to tagged members, editable after upload (implemented — §4.10.6)
- **"This day last year"** — surface a memory from exactly 1 year ago in a weekly digest
- **Event grouping** — cluster memories by event (Christmas 2024, Summer holiday) rather than just month
- **Family tree light** — simple list of circle members with their relationship labels (Grandma, Uncle, etc.)

SEO angles: "family memory app", "private family photo sharing", "family photo album app"

---

#### 👯 Friends
**Default features for this type: event-centric and trip-focused**

- **Trip/event containers** — group memories inside a named event (Barcelona Trip, NYE 2025)
- **"Who was there" tag** — tag which members attended an event (implemented as member tagging — §4.10.6)
- **Reaction leaderboard** — fun stat: most-reacted photo, most-active member
- **Memory count milestones** — celebrate 50th, 100th memory with a banner

SEO angles: "shared photo album for friends", "group trip photo sharing app", "friend group memory app"

---

#### 🤍 Caregiving
**Default features for this type: structured health log alongside emotional memories**

- **Daily log entry** — simple structured note: mood (1–5), energy, notes — separate from photo memories
- **Medication/appointment reminders** — upcoming event alerts
- **Health event types** — tag memories as: Doctor visit · Good day · Hard day · Treatment · Milestone
- **Care team notes** — private notes visible only to admins (not the care recipient if they're a member)
- **Export as PDF** — structured health timeline export for medical appointments

SEO angles: "caregiving journal app", "dementia care memory app", "family caregiver photo log"

---

#### ✈️ Travel
**Default features for this type: geography and itinerary awareness**

- **Location tag** — city/country on each memory, auto-suggested from EXIF GPS data
- **Trip itinerary** — ordered list of destinations with dates, memories attached to each stop
- **Map view** — pins on a world map showing where memories were taken
- **Trip stats** — countries visited, days travelled, km covered
- **"Before you leave" prompt** — nudge to add a final memory on the last day of the trip

SEO angles: "group travel photo sharing", "trip memory app", "private shared travel album"

---

#### 📔 Solo
**Default features for this type: personal journal with reflection prompts**

- **Reflection prompts** — optional writing prompt on upload ("What made today memorable?")
- **Mood/emotion tag** — tag each memory with a feeling
- **Year-in-review** — auto-generated annual summary of memories
- **Streak tracker** — "You've documented 7 days in a row"

SEO angles: "private photo journal app", "personal memory timeline", "visual diary app"

---

### Per-type build priority

All features below are available to every circle regardless of `circle_type`. The "suggested first for" column only indicates which circle type has it proactively surfaced (empty-state chip, placeholder copy). Highest-value, lowest-effort features to implement first (see build plan §4.10):

| Priority | Feature | Suggested first for | Why |
|---|---|---|---|
| 1 | **Baby age stamp** | parents | Per-memory child tagging (`memory_children` junction table) + computed age on tagged memory cards. Child profiles managed in circle settings. For `parents` circles the upload picker is visually prominent; available on all circle types. **Implemented (§4.10.1).** |
| 2 | **Member tagging** | family, friends | Per-memory member tagging (`memory_members` junction table). Uploader tags circle members via chip-picker at upload. Tagged members get email notification. Avatar bubbles on PolaroidCard (max 4, "+N" overflow). Edit mode in MemoryModal. **Implemented (§4.10.6).** |
| 3 | **Location tag** | travel | Single text field + EXIF GPS auto-fill, shown below the memory date. Low effort, high landing page impact. |
| 4 | **Health event types** | caregiving | Type selector in upload modal. |
| 5 | **Anniversary anchoring** | couple | Relationship start date at circle creation + display in header + anniversary email trigger. |

**`tinybit.app`** is the company page (separate site) listing both products. The Our Story landing page lives inside the Our Story app.

---

## Pricing Page

Lives at `our-story.tinybit.app/pricing` — inside the Nuxt app, not a separate site. Linked from the landing page, all upgrade prompts, and any shareable card that includes a "Made with Our Story" CTA. The answer to "what does this cost?" must be one tap away from any public-facing link.

### Page structure

```
Headline:   Simple, honest pricing.
Subhead:    Start free. Upgrade when your story grows.

[Free]          [Plus — $4.99/mo]       [Pro — Coming soon]
0 / 5 GB        50 GB                   500 GB
1 circle        Unlimited circles       Unlimited + Pro features
Up to 10 members Up to 20 members       Unlimited members
Basic timeline  Search                  Time capsule
Albums †        On This Day             Year in Review
Milestones      Notification prefs      Voice reactions
Comments        Offline upload          Collaborative memory
Reactions

† Coming in Phase 2 — already included in your Free plan, no upgrade needed.

[Start free →]  [Upgrade to Plus →]    [Join waitlist →]
```

### FAQ (must answer these prominently)
| Question | Answer |
|---|---|
| Can I cancel anytime? | Yes. No commitment, cancel in one tap from settings. |
| What happens to my photos if I cancel? | They stay. Forever. Downgrading to Free restricts new uploads if you're over 5 GB, but never hides or deletes existing memories. |
| Is my data private? | Yes. Invite-only. No ads. No AI training. No data selling. Your photos are stored privately and never leave our servers. |
| Do grandparents need to pay? | No. Joining a circle is always free. Only circle owners pay. |
| What counts toward the 5 GB limit? | Photos and videos you upload. Memories shared by other members don't count against your quota. |
| Can I try Pro before paying? | Yes — every new circle gets a free 14-day Pro trial when you upload your first memory. No credit card needed. Refer a friend and extend it to 30 days when they upload their first memory. |

### Phase 1 note
Mark Pro as *"Coming soon"* — show the tier with greyed-out features and a waitlist CTA. Mark Albums with the `†` footnote above — it is a Free feature arriving in Phase 2, not gated behind a paid plan. Honest, and plants the value of upcoming features without overpromising what's available today.

---

## Growth Strategy

### Priority order (build in this sequence)
| Priority | Mechanic | Why |
|---|---|---|
| 1 | **On This Day notifications** | Turns the app into a daily habit. Without this, families go quiet after 3 months. |
| 2 | **Invite quality** | Every family invite is an acquisition. Make the email beautiful and emotional — not transactional. |
| 3 | **Invited member activation** | Get invited members to upload in their first session. This single metric predicts long-term retention better than anything else. |
| 4 | **Shareable memory cards** | Branded share to WhatsApp/iMessage → recipient sees "Our Story" → organic discovery. |
| 5 | **Year in Review** | Free, shareable, emotional. Your Spotify Wrapped moment. One viral share = dozens of signups. |
| 6 | **Referral program** | 30-day Pro trial for the referrer when referee uploads first memory. Turns your happiest users into your sales team — and drives upgrade conversion. |

**Rule: nail retention (#1–3) before viral (#4–6). You can't grow what you can't retain.**

---

### The Invite Email (most important single asset)

Every circle creator sends invites. Each invite email is an acquisition moment — it either converts or it doesn't. This is your highest-leverage piece of copy.

**Goals:**
- Convey what Our Story *is* in 2 seconds (not a storage app — a story app)
- Create emotional pull, not obligation ("you should join")
- Make clicking feel low-friction ("no account needed to look")

**Structure:**
```
Subject: [Name] started your story on Our Story

Preview text: See your first shared memory →

---

[Sender name] is building a private space for [circle name].

[If the circle already has memories: show 1 thumbnail of the most recent memory]

"[Optional personal message from sender]"

→  See your story   ← (primary CTA, large button)

No account needed to look. Join to add your own memories.

---
Sent by Our Story · Private, invite-only · No ads
```

**Subject line variants to A/B test:**
- `[Name] started your story on Our Story`
- `[Name] added you to [Circle name]`
- `Your first memory is waiting`
- `[Name] wants to share something with you`

**Key rules:**
- Never say "sign up" or "create account" in the primary CTA — it implies friction
- Always show a memory thumbnail if one exists — emotional proof before the click
- The view-only path (stateless JWT) means the recipient can see the timeline *before* deciding to join — this is the hook
- Mobile-optimised by default (most invites opened on phone)

**Implementation:** Resend + React Email. Template lives in `emails/invite.tsx`. Personalised with sender name, circle name, optional message, and first memory thumbnail (signed URL, 24h expiry for email use).

---

### Organic / viral mechanics
| Mechanism | How it works |
|---|---|
| Built-in virality | Every family invite is a new user acquisition — make the invite email beautiful and emotional, not transactional |
| Shareable memory cards | "Share to WhatsApp" with branded preview → viewer sees photo + "Made with Our Story" + download CTA |
| Referral program | Referrer gets 30-day Pro trial when referee uploads first memory. "Invite a friend, get a month of Pro free." |
| Year in Review | Auto-generated annual recap users share on social — free Spotify Wrapped-style impressions |
| View-only grandparent CTA | After grandparent views timeline: "Start your own family story →" — turns viewers into creators |

### Retention mechanics
| Mechanism | Why it matters |
|---|---|
| "On This Day" push notification | #1 reason users open the app unprompted — build this for Phase 1 |
| Weekly email digest | "Your family added 7 memories this week" — pulls inactive members back |
| Milestone suggestions | "Mia turns 1 next week — ready to capture the moment?" — proactive engagement |
| Year in Review | Annual emotional anchor — gives families a reason to keep uploading all year |
| Invited member activation | Get invited members to upload in first session — this is the retention inflection point |

### Expansion mechanics
| Mechanism | How it grows the user base |
|---|---|
| Multi-circle support | One user in 3 circles = 3x network effect. Make circle switching dead simple. |
| "Invite another circle" | User who loves Circle A easily seeds Circle B with in-laws |
| Print products (Phase 3) | Photo books sit on coffee tables = passive word of mouth |
| Referral program | Turns your happiest users into your sales team |

### The one thing that matters most
**Nail "On This Day" + the weekly digest first.**
Every other growth mechanic depends on users staying active. A daily nostalgia notification is what turns a utility into a habit. Build this in Phase 1, not Phase 2.

---

## Competitive Advantage Features

### Priority order
| Priority | Feature | Growth impact |
|---|---|---|
| 1 | **Guest contributor / event QR code** | Every event = acquisition. Turns social rituals into growth channels. |
| 2 | **Time capsule** | Deepest emotional lock-in possible. Zero churn once a parent writes to their newborn. |
| 3 | **Baby / child development tracking** | Absorbs a $5–10/mo competing app category. Massive word of mouth in parent communities. |
| 4 | **Caregiver mode** | Opens nanny/daycare segment. High daily upload frequency = strong retention signal. |
| 5 | **Collaborative memory** | Turns passive members into active contributors. One event, many perspectives. |
| 6 | **Video / voice reactions** | Emotional depth no competitor matches. Grandparent's reaction video stored forever. |

---

### 1. Guest Contributor / Event QR Code

**How it works:**
Circle admin generates an event upload link. Guests scan QR code, enter their name, upload photos — no account needed. Token is the authorization.

**DB schema**
```sql
EventUploadToken
  - id, circle_id, album_id (nullable)  -- nullable: token may be scoped to a specific album or the entire circle timeline
  - token (UUID, unique)
  - expires_at
  - max_uploads (default 100)
  - upload_count
  - created_by (user_id)
  - revoked (bool)
  - requires_approval (bool, default true) — guest photos queue in pending state, visible only to admins until approved

MemoryMedia
  - event_token_id (nullable)  -- identifies the guest upload token; join to EventUploadToken for event context
  - guest_name (nullable)      -- display name entered by guest on upload
  -- Note: no owner_user_id on MemoryMedia — owner is derived via Memory.owner_user_id (regular) or
  --       event_token_id + guest_name (guest). Do not add a redundant owner_user_id column here.
```

**Flow**
```
Admin creates event → INSERT EventUploadToken { expires_at: +48h, max_uploads: 100 }
  → QR code: our-story.tinybit.app/event?token=abc123

Guest scans QR
  → Landing page: "Upload to the [Dao Family] Birthday Party album"
  → "What's your name?" (no account needed)
  → Selects photos → uploads
  → Photos attributed to guest_name, queued for admin review

If requires_approval = true (default):
  → Guest photos are pending — visible to admins only, NOT on the family timeline
  → Admin receives push: "15 guest photos pending your approval"
  → Reviews in bulk → approve all / approve individually / reject
  → Approved photos appear in album
If requires_approval = false (owner opted out):
  → Photos appear immediately on the timeline

**Why approval is the default:** A single inappropriate photo uploaded by an unknown guest before the owner reviews it is visible to all members including children. Events like weddings or birthdays are high-trust socially, but the guest list includes people outside the family's normal circle. Default to safe — let owners opt out for events where they trust everyone.

Post-upload CTA: "Want to start your own family story? →"
```

**Server-side token validation**
```ts
// server/api/event/upload.post.ts
const token = await supabase
  .from("EventUploadToken")
  .select("*")
  .eq("token", tokenParam)
  .single()

if (!token || token.expires_at < now()) return 401
if (token.revoked) return 401
if (token.upload_count >= token.max_uploads) return 429

// Upload to Storage, INSERT MemoryMedia with event_token_id + guest_name
// INCREMENT upload_count
```

**Abuse prevention**
- Token is UUID (unguessable), time-limited, revocable
- Rate limit by IP: max 20 uploads/hour (Upstash)
- Guest uploads capped at 10 MB/photo (no storage quota = fixed cap)
- Admin moderation before photos appear on timeline

---

### 2. Time Capsule

**How it works:**
A memory, letter, photo, or video locked until a future date. "Open on Mia's 18th birthday." The most powerful emotional lock-in feature possible — a parent who has written to their newborn will never leave.

**DB schema**
```sql
TimeCapsule
  - id, circle_id, created_by
  - title ("For Mia — open on your 18th birthday")
  - unlock_date (TIMESTAMPTZ)
  - content_type: "memory" | "letter" | "video"
  - memory_id (nullable — link to existing memory)
  - letter_text (nullable — encrypted at rest)
  - media_path (nullable — Supabase Storage path; never return raw to client; signed URL generated server-side only after unlock_date — same rule as MemoryMedia.storage_path)
  - status: "locked" | "unlocked"
  - notified (bool)
```

**Unlock flow**
```
Scheduled Edge Function runs daily
  → SELECT * FROM TimeCapsule
      WHERE unlock_date <= now() AND status = "locked"
  → For each: UPDATE status = "unlocked"
  → Send push + email to all circle members:
      "A time capsule has opened — a message from [name], [N] years ago"
  → Deep link: /capsule/{id}
```

**Encryption**
- Letter text encrypted at rest using Supabase Vault (pgcrypto)
- Media signed URL only generated server-side after `unlock_date` — storage path never exposed before unlock

**UX**
- Creator writes letter / records video → sealed with a date
- Locked capsules show as "sealed" on timeline with a countdown: "Opens in 17 years"
- On unlock: full-screen reveal moment with animation — treat it as a ceremony

---

### 3. Baby / Child Development Tracking

**How it works:**
Extend milestones with WHO developmental milestones — height, weight, first word, first tooth. Absorbs what baby tracking apps (Huckleberry, Baby Tracker) charge $5–10/month for. New parents in Reddit/Facebook communities are extremely word-of-mouth driven.

**DB schema**
```sql
ChildProfile
  - id, circle_id, name, date_of_birth, avatar_media_id

DevelopmentEntry
  - id, child_profile_id, circle_id
  - category: "growth" | "milestone" | "health"
  - label (e.g. "first_word", "weight", "first_tooth")
  - value (nullable — e.g. "7.2 kg" for growth)
  - memory_id (nullable — link to a photo memory)
  - recorded_at
```

**Milestone suggestions (proactive engagement)**
```
Scheduled Edge Function (weekly)
  → For each ChildProfile: calculate age in months
  → Compare against WHO milestone schedule
  → If upcoming milestone in next 2 weeks:
      push notification: "Mia is 11 months — most babies take their first steps around now!"
      → CTA: "Ready to capture the moment? →"
```

**WHO milestone schedule (stored as config)**
```ts
const WHO_MILESTONES = [
  { months: 2, label: "first_smile" },
  { months: 6, label: "sits_without_support" },
  { months: 9, label: "crawls" },
  { months: 12, label: "first_steps" },
  { months: 18, label: "first_words" },
  // ...
]
```

**Growth chart**
- Plot height/weight entries over time (client-side chart, e.g. Chart.js)
- Overlay WHO percentile curves
- Export as PDF for pediatrician visits

---

### 4. Caregiver Mode

> **Phase split:**
> - **Phase 1** — Schema and RLS only. The `"caregiver"` value is included in the `CircleMember.role` CHECK constraint from the initial migration. The RESTRICTIVE RLS policy (defined in the Auth section) ships in Phase 1 — defensive, costs nothing, correct from day one.
> - **Phase 3** — Everything visible to the user: the caregiver invite UI (separate invite path, distinct from regular member invite), the simplified caregiver view (upload + circle timeline only, no settings/private tab), and the acquisition funnel. Do not build the invite UI or simplified view in Phase 1 — there are no caregivers to invite yet and the complexity is not worth it.

**How it works:**
Nanny, babysitter, or daycare gets limited access to a specific family. High daily upload frequency from caregivers = strong retention signal for the family.

**Full permission matrix**

| Action | Caregiver |
|--------|-----------|
| Upload to circle timeline | Yes — always `visibility: "circle"`, cannot set private |
| View circle timeline | Yes |
| React (emoji) | Yes |
| React (voice/video) | No |
| Comment | No |
| View private memories | No |
| See member list | First name only — caregiver needs to know who the parents are, but cannot enumerate full member details |
| Invite members | No |
| Delete own uploads | No (owner/admin only) |
| Access settings / billing | No |
| Create albums | No |

Displayed in the member list (visible to owner/admin only) as "[Name] · Caregiver".

On removal: same content-choice flow as member deletion — owner is prompted to keep or remove the caregiver's uploads.

> **DB schema:** `CircleMember.role` includes `"caregiver"` in the canonical Data Model — see the Data Model section. No separate migration needed; it is part of the initial schema.

**RLS policy for caregivers**

> **Critical:** Postgres/Supabase permissive policies are OR'd together. A separate permissive policy for caregivers would add permission, not restrict it — a caregiver who satisfies the general "read family memories" policy would still read private memories. The fix is a **RESTRICTIVE** policy, which is AND'd with all permissive policies.

```sql
-- RESTRICTIVE: blocks caregivers from private memories regardless of other policies
-- AS RESTRICTIVE means this is AND'd with permissive policies, not OR'd
CREATE POLICY "caregiver cannot read private memories"
ON Memory FOR SELECT
AS RESTRICTIVE
USING (
  NOT (
    visibility = 'private'
    AND EXISTS (
      SELECT 1 FROM CircleMember
      WHERE user_id = auth.uid() AND role = 'caregiver'
        AND circle_id = Memory.circle_id
    )
  )
);
```

This must have a corresponding pgTAP test before any caregiver feature ships:
```sql
-- pgTAP: caregiver cannot read private memories
SELECT plan(2);

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "caregiver-uuid"}';

SELECT is(
  (SELECT count(*) FROM Memory
   WHERE circle_id = 'circle-1-uuid' AND visibility = 'private'),
  0::bigint,
  'caregiver cannot read private memories'
);

SELECT is(
  (SELECT count(*) FROM Memory
   WHERE circle_id = 'circle-1-uuid' AND visibility = 'circle'),
  (SELECT count(*) FROM Memory WHERE circle_id = 'circle-1-uuid' AND visibility = 'circle'),
  'caregiver can read circle-visibility memories'
);

SELECT * FROM finish();
```

**Caregiver invite flow**
```
Admin sends caregiver invite (separate from regular invite)
  → CircleInvite { role: "caregiver", email, expires_at: +7 days }
  → Email: "The Dao family has invited you to share updates"
  → Caregiver signs up → joins with role = "caregiver"
  → Sees simplified UI: upload button + circle timeline only
  → No access to: settings, billing, private tab, member management
```

**Acquisition angle**
- Caregiver uploads photos of the child during the day → parents see updates in real time
- Caregiver eventually wants this for their own family → natural referral path

---

### 5. Collaborative Memory

**How it works:**
One event container (e.g. "Christmas 2026") that any family member contributes photos + their own caption to. Unified timeline entry showing all perspectives. Turns passive members into active contributors.

**DB schema**
```sql
Memory
  - is_collaborative (bool, default false)
  - contributions_open (bool) -- admin can close when done

MemoryContribution
  - id, memory_id, contributor_user_id
  - note (contributor's personal caption)
  - created_at

MemoryMedia
  - contribution_id (nullable — links media to a specific contribution)
```

**Flow**
```
Admin creates collaborative memory: "Christmas 2026"
  → is_collaborative = true, contributions_open = true
  → Push to all members: "Dad started a Christmas 2026 memory — add your photos!"

Member taps → contribution screen
  → Selects photos from their phone
  → Adds personal note: "The kids finally let us sleep in!"
  → INSERT MemoryContribution + MemoryMedia

Timeline display
  → One unified entry: "Christmas 2026 — 4 contributors, 47 photos"
  → Tap to expand: grouped by contributor
  → Each contributor's photos + caption shown together

Admin closes: contributions_open = false
  → Memory sealed, no more additions
  → Push: "The Christmas 2026 memory is complete — 4 family members, 47 photos"
```

**Conflict resolution**
- No conflicts — each contributor owns their own `MemoryContribution`
- Admin can remove any contribution (same as deleting any memory)
- Contributors can edit/delete their own contribution only

---

### 6. Video / Voice Reactions

**How it works:**
Instead of just emoji reactions, family members can record a short video or voice reaction to a memory. A grandparent's 10-second reaction video to seeing their grandchild's first steps is irreplaceable. Stored permanently alongside the memory.

**DB schema**
```sql
MemoryReaction
  - id, memory_id, user_id
  - type: "emoji" | "voice" | "video"
  - emoji (nullable)
  - media_path (nullable — Supabase Storage path for voice/video reactions; never return raw to client — generate signed URL server-side, same rule as MemoryMedia.storage_path)
  - duration_seconds (nullable)
  - created_at
```

**Constraints**
- Voice reactions: max 30 seconds
- Video reactions: max 15 seconds, front camera only
- Stored in Supabase Storage under `reactions/` bucket
- Signed URL (same pattern as memories) — 1h expiry

**Flow**
```
User long-presses reaction button on a memory
  → Options: emoji | voice | video
  → Voice: tap to record (max 30s) → preview → send
  → Video: front camera, 15s max → preview → send
  → Stored as MemoryReaction with media_path
  → Push to memory owner: "Grandma reacted to Mia's first steps"
  → Reaction shown as avatar ring on memory thumbnail
```

**UX**
- Emoji reactions: shown as overlapping avatars (like Instagram)
- Voice reactions: waveform player inline on memory
- Video reactions: small circular thumbnail, tap to play fullscreen
- Memory owner gets notified of each reaction (respects quiet hours)

---

## Growth Features (Phase 2+)

### Priority order
| Priority | Feature | Growth impact |
|---|---|---|
| 1 | **Pregnancy journey tracker** | Captures users at the start of the family lifecycle — highest LTV |
| 2 | **Circle map** | EXIF GPS already exists — low effort, highly shareable, organic growth |
| 3 | **Circle challenges** | Weekly uploads between events — prevents the "went quiet after 3 months" churn |
| 4 | **Memorial / legacy mode** | Zero churn. Word of mouth in grief communities is powerful and underrated |
| 5 | **Private family newsletter** | Converts non-users to users — extends reach beyond immediate family |
| 6 | **Memory backup guarantee** | Trust + conversion lever against free alternatives |

---

### 1. Pregnancy Journey Tracker

**Why:** Captures users before the baby is born. Parents who start during pregnancy have the highest LTV — already invested before the baby arrives.

**DB schema**
```sql
PregnancyJourney
  - id, circle_id, created_by
  - due_date
  - baby_name (nullable — may not be known yet)
  - status: "active" | "completed"
  - child_profile_id (nullable — linked after birth)

PregnancyEntry
  - id, journey_id, week_number (1–40)
  - memory_id (nullable — bump photo, ultrasound)
  - note
  - recorded_at
```

**Weekly milestone suggestions (cron)**
```ts
// Weekly Edge Function
const PREGNANCY_MILESTONES = [
  { week: 8,  label: "First ultrasound 🩺" },
  { week: 12, label: "End of first trimester" },
  { week: 20, label: "Anatomy scan week" },
  { week: 28, label: "Third trimester begins" },
  { week: 36, label: "Almost there — baby is full term soon" },
  { week: 40, label: "Due date week! 🎉" },
]

// Calculate current week from due_date
// If upcoming milestone in next 7 days → push notification
// "Week 20 is coming up — time for the anatomy scan photo!"
```

**Birth transition**
```
Journey status → "completed"
  → Prompt: "Welcome to the world! Add your baby's details →"
  → Create ChildProfile linked to journey
  → All pregnancy entries appear at the start of the baby's development timeline
  → Seamless continuity: pregnancy → birth → development in one timeline
```

**UX**
- Pregnancy tab in timeline: week-by-week strip with photo thumbnails
- Countdown banner: "17 days until your due date"
- Shareable pregnancy summary: "40 weeks of our story" — shareable at birth announcement

---

### 2. Circle Map

**Why:** EXIF GPS data is already extracted on upload. Minimal extra work — massive shareability. A beautiful visual of your family's story across the world.

> `lat`, `lng`, and `location_name` are already in the canonical `MemoryMedia` model — see the Data Model section. No migration addition needed here.

**EXIF GPS extraction (on upload, Edge Function)**
```ts
import * as exifr from "exifr"
const exif = await exifr.parse(file)

if (exif?.latitude && exif?.longitude) {
  // Reverse geocode via free API (Nominatim / OpenCage)
  const location = await reverseGeocode(exif.latitude, exif.longitude)
  // Store: lat, lng, location_name ("Calgary, Canada")
}
```

**Privacy**
- GPS extraction is opt-in per upload (toggle: "Include location")
- Default: off — privacy-first positioning demands this
- Circle map only visible to circle members, never public

**Map rendering (client-side)**
```ts
// Use Mapbox GL JS or Leaflet (free, open source)
// Cluster pins by location — tap cluster to see memories from that place
// "The Dao family has memories in 8 countries, 23 cities"
```

**Shareable map card**
```
User taps "Share our map"
  → Generate static map image (Mapbox Static API)
  → Overlay: "The Dao Family — 8 countries, 47 memories"
  → Share to Instagram/WhatsApp as image
  → "Made with Our Story" watermark + download CTA
```

**Stats to show**
- Countries visited
- Cities with memories
- Most-photographed location
- Furthest memory from home

---

### 3. Circle Challenges

**Why:** Drives weekly uploads between events. Circles that only upload at birthdays and holidays go quiet and churn. Challenges create a habit loop.

**DB schema**
```sql
CircleChallenge
  - id, circle_id
  - prompt ("Share a photo of your favourite family meal")
  - created_by (null = system-generated)
  - starts_at, ends_at (7-day window)
  - status: "active" | "completed"
  - result_album_id (nullable — compiled after close)

ChallengeEntry
  - id, challenge_id, memory_id, contributor_user_id
```

**System-generated challenge prompts (weekly cron)**
```ts
const CHALLENGE_PROMPTS = [
  "Share a memory from this time last year",
  "A photo of your favourite family meal",
  "Something that made you laugh this week",
  "A throwback — the older the better",
  "Your favourite corner of home",
  "A photo with no people — just a place you love",
  // seasonal: "First snow of the year", "Summer tradition", etc.
]

// Every Monday: pick prompt (or use admin-created if exists)
// INSERT CircleChallenge { starts_at: Monday, ends_at: Sunday }
// Push to all circle members: "This week's challenge: [prompt]"
```

**Challenge lifecycle**
```
Monday: Challenge opens → push to all members
  → Members upload a memory tagged to the challenge
  → In-app: challenge banner at top of timeline

Sunday: Challenge closes
  → Compile entries into a special album
  → Push: "Your circle completed this week's challenge — 4 members, 7 photos"
  → Show completion streak: "4 weeks in a row! 🔥"
```

**Admin can create custom challenges**
- "Family vacation challenge: everyone share their best photo from Hawaii"
- Same schema, created_by = user_id instead of null

> `challenge_streak` and `last_challenge_completed_at` are in the canonical `Circle` model — see the Data Model section. No migration addition needed here.

---

### 4. Memorial / Legacy Mode

**Why:** Zero churn. A family that uses the app to preserve a grandparent's memory will never leave. Word of mouth in grief communities is powerful and underrated.

> `memorial_status`, `memorial_date`, and `memorial_message` are in the canonical `CircleMember` model — see the Data Model section. No migration addition needed here.

**What changes when memorial_status = "memorial"**
- Profile shows memorial badge + name + dates ("1942–2026")
- All their memories and contributions preserved permanently
- Circle members can still comment and react on their memories
- "In Memory of" section on circle timeline
- Account managed by family admin (cannot be deleted by the memorial user)
- Memorial user's login disabled

**Anniversary notifications (cron)**
```ts
// Runs daily
SELECT * FROM CircleMember
WHERE memorial_status = "memorial"
  AND EXTRACT(month FROM memorial_date) = EXTRACT(month FROM today)
  AND EXTRACT(day FROM memorial_date) = EXTRACT(day FROM today)

// Push to circle: "Today marks X years since Grandma passed.
//   Here are some of her favourite memories →"
// Deep link to their memorial section
```

**Birthday notifications for memorial members**
```ts
// Same pattern — notify on what would have been their birthday
// "Today would have been Grandma's 82nd birthday.
//   Share a memory of her →"
```

**UX**
- Circle admin activates memorial mode (not automated — requires deliberate action)
- Memorial profile page: timeline of their contributions + tribute message
- Soft visual treatment: muted tones, not a jarring UI change
- Option: family can contribute new memories tagged "In Memory of [name]"

---

### 5. Private Circle Newsletter

**Why:** Converts non-app-users into users. Unlike the weekly digest (sent to existing members), this goes *outward* to extended family who haven't joined yet.

**DB schema**
```sql
NewsletterRecipient
  - id, circle_id, added_by
  - email
  - name (optional)
  - frequency: "weekly" | "monthly"
  - unsubscribe_token (UUID)
  - subscribed (bool)
  - join_prompt_count (int) -- how many times we've shown the join CTA
```

**Newsletter generation (scheduled Edge Function)**
```
Weekly/monthly cron:
  → Fetch recent memories for circle (last 7 or 30 days)
  → Select top 4–6 by reaction count (most engaging)
  → Generate signed URLs for thumbnails (24h expiry)
  → Render React Email template
  → Send via Resend to all NewsletterRecipient for that circle
```

**Email structure**
```
Subject: "The Dao family had a big week 📸"

Header: family name + date range
Body:
  - 4–6 memory thumbnails with notes
  - Milestone callout if any: "Mia took her first steps! 👶"
  - "See all X memories →" CTA (deep link / web preview)

Footer:
  - "Join the family story →" (acquisition CTA)
  - Unsubscribe link (CAN-SPAM / GDPR required)
```

**Conversion tracking**

> `open_count`, `click_count`, `last_clicked_at`, and `join_prompt_count` are in the canonical `NewsletterRecipient` model — see the Data Model section. No migration addition needed here.

```ts
// If click_count >= 3 AND not yet a member:
//   Send targeted email: "You've been following the Dao family story —
//     why not add your own memories? Join free →"
```

**Privacy**
- Recipients only see circle-scoped memories (never private)
- Admin controls who receives the newsletter
- One-click unsubscribe (token-based, no login required)

---

### 6. Memory Backup Guarantee

**Why:** A written promise of data permanence is a direct conversion lever against free alternatives (Google Photos, iCloud). For parents with irreplaceable photos of their children, trust is worth paying for.

**Technical implementation: 3-location backup**
```
Primary:   Supabase Storage (Cloudflare CDN)
Secondary: S3 backup bucket (different region, nightly sync)
Tertiary:  S3 Glacier (monthly cold storage snapshot, 10-year retention)
```

**S3 Glacier archival (monthly cron)**
```ts
// GitHub Actions monthly workflow
// Copy all new MemoryMedia storage paths to Glacier
// Log archived objects to BackupLog table

BackupLog
  - id, media_id, backup_tier: "s3" | "glacier"
  - archived_at, storage_path
```

**Backup health dashboard (in-app settings)**
```
"Your memories are safe"
  ✅ Primary storage: healthy
  ✅ Secondary backup: last synced 6 hours ago
  ✅ Long-term archive: last snapshot April 1, 2026
  Total memories backed up: 1,247
```

**The written guarantee (ToS + marketing)**
- "We guarantee your memories will be preserved for a minimum of 50 years"
- "If Our Story ever shuts down, we will give 12 months notice and provide a full data export"
- "Your memories are never deleted without your explicit instruction"

**Annual reassurance email**
```
Subject: "Your 1,247 memories are safe — here's our annual backup report"

Body:
  - Backup health summary
  - Total memories, storage used
  - "Your family story is in good hands"
  - Link to trigger manual export
```

This email doubles as a retention touch — reminding users of the value they'd lose by leaving.

---

## Rollout Phases

### Mobile Strategy: PWA first, native second

**Phase 1: Mobile-responsive web (PWA)**

You do not need native apps for Phase 1. Your acquisition model is invite-based — your first 200 users come from direct invites, not App Store search. An invite link opens in a browser. That experience must be excellent.

What works on mobile web today:
- Photo/video upload via `<input type="file" accept="image/*,video/*" capture>`
- Timeline viewing, comments, reactions
- Web Push notifications on Android Chrome and iOS Safari 16.4+ (March 2023)
- "Add to Home Screen" install prompt (Android auto-prompt; iOS: manual via share sheet)

What requires native (Capacitor) — deferred to Phase 2:
- Background upload (continues when app is backgrounded)
- Camera roll bulk import
- Reliable push on iOS below 16.4
- App Store presence (credibility + discovery at scale)

**Phase 1 PWA requirements:**
- Fully mobile-responsive — designed mobile-first, desktop secondary
- `manifest.json` with app name, icons, `display: standalone` — enables "Add to Home Screen"
- Service worker for offline asset caching (not offline upload — that's Phase 2)
- All invite links, view-only links, and deep links open cleanly in mobile Safari/Chrome
- No feature should require an app download to access

**Why this is fine for Phase 1:**
Capacitor wraps Nuxt with ~zero code changes. The jump from PWA to native app in Phase 2 is a shell addition, not a rewrite. Don't spend Phase 1 time on App Store submission — spend it proving retention.

---

### Phase 1 — Validate (0 → 50 users)
**Target segment:** New parents
**Goal:** Get a family using it daily. Prove retention before adding anything else.

**Build this:**
- [ ] Auth — magic link + Google login (Supabase Auth)
- [ ] Create circle + invite members (email invite, token-based)
- [ ] Upload photo/video to timeline
- [ ] Batch upload with per-item EXIF date detection (multi-select, date review before submit)
- [ ] Quick note (text-only memory, no photo required)
- [ ] Add note to memory
- [ ] Share to circle / keep private
- [ ] Comments + emoji reactions
- [ ] Milestones (first steps, first birthday, first day of school)
- [ ] Magic link view-only for grandparents (stateless JWT)
- [ ] On This Day push notification (daily cron — #1 retention driver; built in Phase 1 for all users; Plus-gated in Phase 2 once billing ships — do not add the tier check until Stripe is wired)
- [ ] Basic push notifications (new upload, comment, reaction)
- [ ] Early retention hooks (weeks 1–6): weekly activity digest, milestone suggestions (triple-nudge), first-memory anniversary email, quiet-circle nudge — all reuse the React Email system already needed for invite emails
- [ ] Cursor-based timeline pagination
- [ ] Signed URLs for all media (never expose raw storage paths)
- [ ] Supabase Storage for media
- [ ] RLS policies (all access scoped to circle membership)
- [ ] Sentry error tracking
- [ ] CI/CD pipeline (GitHub Actions + Vercel)
- [ ] Supabase migrations workflow
- [ ] Mobile-responsive UI + PWA manifest (no app download required)
- [ ] Invite email (Resend + React Email — see invite email spec above)
- [ ] Data export (async zip job — GDPR Article 20 data portability, required before any public launch)
- [ ] Privacy policy + Terms of Service live (required before any public launch)

**Do NOT build in Phase 1:**
Everything else in this spec. No billing, no albums, no search, no Upstash Redis rate limiting (basic server-side validation — invite count cap, file size — still applies), no S3 migration, no referral program, no year in review, no native apps. Ship fast, learn fast.

**Exit criteria:** At least one family (not yours) uses it weekly for 4 consecutive weeks.

---

### Phase 2 — Monetise (50 → 200 users)
**Target segment:** All families — including couples, adult siblings, caregiving families
**Goal:** Get first paying users. Validate willingness to pay before building growth features.

> **Scope note:** This checklist is the monetization critical path — the minimum required to ship billing and prove willingness to pay. The following features are also labeled Phase 2 in their spec sections but are secondary to the billing goal and not on the critical path: voice memo (§Key Features §3), phone/SMS OTP auth (§Auth), passkeys (§Auth), audit logging (§Media Privacy Model). Build them in Phase 2 after the core billing items are stable.

**Build this:**
- [ ] Stripe billing (circle subscription, free + paid tiers)
- [ ] Storage quota enforcement (per account, not per circle)
- [ ] Stripe Customer Portal (self-service billing)
- [ ] Albums & collections
- [ ] Search (PostgreSQL full-text, tsvector)
- [ ] Memory date override (EXIF extraction + user-editable date)
- [ ] Notification preferences (push on/off, quiet hours, email digest frequency)
- [ ] Invited member onboarding flow
- [ ] Media deduplication (pHash)
- [ ] Rate limiting (Upstash Redis)
- [ ] Image/video CDN optimisation (Supabase image transforms, thumbnails)
- [ ] Offline upload queue (Capacitor + IndexedDB)
- [ ] Background upload (Capacitor Background Runner)
- [ ] Year in Review shareable card (free for all tiers — the Spotify Wrapped growth mechanic; canvas API, 9:16 format, public share URL with "Create your circle's story →" CTA)
- [ ] Native app (Capacitor wrapper around existing Nuxt app — minimal code delta)
- [ ] App Store submission (iOS + Android)
- [ ] Universal Links / App Links (invite links open app if installed, browser if not)
- [ ] Circle streak (circle-level weekly upload streak; Sunday streak-saver nudge to owner; shareable achievement cards at 4/12/52 weeks — requires a week of usage data to be meaningful, so Phase 2 not Phase 1)

**Exit criteria:** 20+ paying families. Churn rate under 5%/month.

---

### Phase 3 — Grow (200+ users)
**Target segment:** Friend groups, travel groups, sports teams, any meaningful group
**Goal:** Turn retention into growth. Add viral mechanics and power features.

**Build this:**
- [ ] On This Day in-app carousel (new in Phase 3 — the push notification is Phase 1; this is the in-timeline visual surface for matching memories)
- [ ] Referral program (30-day Pro trial for referrer on referee's first upload)
- [ ] Guest contributor / event QR code
- [ ] Shareable memory cards (branded, WhatsApp/iMessage)
- [ ] Collaborative memory (one event, many contributors)
- [ ] Circle challenges (weekly prompts)
- [ ] Pregnancy journey tracker
- [ ] Baby / child development tracking (WHO milestones)
- [ ] Caregiver mode — invite UI + simplified caregiver view (schema and RLS already shipped in Phase 1)
- [ ] Circle map (EXIF GPS, Mapbox)
- [ ] Private circle newsletter (outward to non-members)
- [ ] Time capsule
- [ ] Video / voice reactions
- [ ] Live Photos (full support, LivePhotosKit)
- [ ] Year in Review full slideshow/video (Remotion, Pro only — Phase 2 built the free shareable card; this is the immersive in-app video with blurred preview for Free/Plus)
- [ ] S3 + CloudFront + MediaConvert (video at scale)
- [ ] PostHog analytics (self-hosted)
- [ ] Feature flags (FeatureFlag table)
- [ ] Memorial / legacy mode
- [ ] Memory backup guarantee (S3 Glacier)
- [ ] Print products (photo books)

**Exit criteria:** Organic signups exceed invited signups. Net revenue positive.
