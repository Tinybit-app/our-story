# Our Story — Design Spec Summary

**"A private space where your circle builds a shared story."**

---

## Core Principles (non-negotiable, evaluated in this order)

1. **Security first** — RLS on every table, signed URLs only, zod validation on every API route, no raw errors to client, secrets never in code/logs
2. **User-friendliness is a product requirement** — magic link, human-readable errors, 200ms feedback, 44×44px tap targets, WCAG 2.1 AA baseline
3. **User service is a competitive advantage** — 4h acknowledge / 24h resolve SLA, proactive incident comms, 7-day data deletion
4. **Enterprise-grade reliability** — 99.9% uptime target, RTO < 4h, RPO < 24h, all background jobs idempotent

---

## What It Is

A circle-first photo & video memory app. Not storage — storytelling.
The wedge: Google Photos is built for one person. This is built for any meaningful group — families, friend groups, couples, adult siblings, travel groups.

---

## Terminology

| UI (users see)  | Code / DB (internal) |
| --------------- | -------------------- |
| Circle          | Circle               |
| Create a Circle | Create a Circle      |
| Circle members  | CircleMember         |

Both UI and code/DB now use "Circle" — this is not just a UX rename.

---

## Core Loop

Upload → Add note → Share to circle timeline → Circle reacts

---

## Competitive Advantage

| Advantage                          | Why it matters                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Circle-first, not individual-first | Google Photos, iCloud, Amazon Photos are all individual-first. This is the only app built around a shared group narrative.      |
| Storytelling over storage          | Notes, milestones, reactions turn photos into memories with context.                                                            |
| Works for any meaningful group     | Families, friend groups, couples, adult siblings, travel groups — no code changes needed.                                       |
| Privacy as a feature               | No ads, no AI training, invite-only. Real selling point for any group sharing personal moments.                                 |
| Inclusive UX                       | Magic link login, view-only mode — designed for non-technical members.                                                          |
| Emotional lock-in                  | 2 years of milestones, notes, reactions, time capsules = enormous switching cost. The strongest moat.                           |
| Better than FamilyAlbum (free)     | FamilyAlbum stores photos. Our Story stores meaning — notes, milestones, reactions, and time capsules FamilyAlbum doesn't have. |

---

## Key Features

### Phase 1 (ship these)

- Shared family timeline (photos + short videos)
- **Quick note** — text-only memory, no photo required ("First word today: 'dada'")
- **Batch upload** with per-item EXIF date detection and review UI before uploading
- Milestones (preset templates per circle type + fully custom milestones)
- Notes, comments, emoji reactions on memories
- Personal vs circle visibility per memory
- Invite-only circle with magic link + view-only mode (no account needed)
- On This Day daily push notification (free for all in Phase 1 — no tier check until Stripe billing ships in Phase 2; then Plus-gated)
- Early retention hooks (months 1–6): weekly digest, milestone suggestions, first-memory anniversary, quiet-circle nudge
- Mobile-responsive PWA (no app download required for Phase 1)
- Invite email (Resend + React Email — emotionally crafted, not transactional)

### Phase 2

- Albums & collections, search, memory date override
- **Year in Review shareable card** — free for all tiers, generated client-side (canvas API); 9:16 format for Instagram Stories; public share URL with "Create your family's story →" CTA. This is the Spotify Wrapped acquisition mechanic — ships in Phase 2 because it's lightweight and drives organic growth from day one.
- Voice memo (audio memory, max 60 seconds, server-side Whisper transcription)
- Stripe billing + storage quotas
- Notification preferences, weekly email digest
- Native app (Capacitor — iOS + Android, App Store submission)
- Background upload, offline queue
- Media deduplication (pHash)
- Phone/SMS OTP auth (Supabase + Twilio — for users without email)
- Passkeys (Face ID / Touch ID via Supabase experimental support)
- Audit logging (Supabase audit logs + AWS CloudTrail)

### Phase 3 (growth features)

- Guest contributor / event QR code
- Time capsule ("open on Mia's 18th birthday")
- Collaborative memory (one event, many contributors)
- Pregnancy journey tracker
- Baby / child development tracking (WHO milestones)
- Circle map (EXIF GPS, shareable)
- Circle challenges (weekly prompts)
- Private family newsletter (outward to non-members)
- Referral program (30-day Pro trial for referrer when referee uploads first memory)
- Year in Review full slideshow/video (Pro only — Remotion-generated, immersive in-app experience)
- Caregiver mode, memorial / legacy mode
- Video / voice reactions
- Full Live Photos support (LivePhotosKit JS)
- Optional per-circle E2EE (client-side AES-256-GCM, opt-in)
- Physical products (photo books, printed timelines — $20–60 one-time)
- Extra storage add-on (+100 GB for $2/mo)
- Meilisearch upgrade (typo tolerance, ranking)

---

## Tech Stack

| Layer             | Choice                                                           |
| ----------------- | ---------------------------------------------------------------- |
| Frontend          | Nuxt                                                             |
| UI library        | shadcn-vue (Radix Vue + Tailwind — accessible, you own the code) |
| Backend           | Supabase (Auth, DB, Storage, Realtime)                           |
| Mobile            | Capacitor (iOS + Android)                                        |
| Email             | Resend + React Email                                             |
| Payments          | Stripe + Customer Portal                                         |
| Analytics         | PostHog (self-hosted, privacy-first)                             |
| Error tracking    | Sentry                                                           |
| Uptime            | Better Uptime (1-min checks on `/api/health`)                    |
| Rate limiting     | Upstash Redis                                                    |
| CI/CD             | GitHub Actions + Vercel                                          |
| Hosting           | our-story.tinybit.app                                            |
| Storage (Phase 3) | S3 + CloudFront + MediaConvert                                   |

---

## Data Model (core tables)

```
User (platform_role: "user"|"platform_admin", stripe_customer_id, stripe_subscription_id,
      subscription_status: "free"|"plus"|"pro", subscription_period_end,
      referral_code, referred_by_user_id, deletion_requested_at, deleted_at)
      -- Stripe credentials on User only — NOT on Circle

Circle (circle_type, subscription_status: "free"|"plus"|"pro"|"grace", grace_period_until,
        challenge_streak, last_challenge_completed_at,
        quiet_nudge_count, quiet_nudge_last_sent_at,
        first_memory_at, last_memory_at, memory_count,
        trial_ends_at, trial_used, first_month_email_sent,
        e2ee_enabled, e2ee_enabled_at,
        deleted_at, deletion_initiated_by)

CircleMember (role: owner | admin | member | caregiver,
              memorial_status: "active"|"memorial", memorial_date, memorial_message)

Group, GroupMember
Memory (visibility: private | circle, note, alt_text, memory_date, is_collaborative,
        contributions_open, milestone_label, milestone_is_custom)
MemoryMedia (phash, lat, lng, location_name, is_live_photo, still_path, live_path,
             event_token_id, guest_name)
MemoryContribution (for collaborative memories)
MemoryComment, MemoryReaction (type: emoji | voice | video)
AccountStorage (total_quota_bytes, total_used_bytes, bonus_bytes — reserved for future promotions, not referrals)
CircleInvite, EventUploadToken (guest uploads; requires_approval bool default true)
Album, AlbumMemory
NotificationPreference (push, email digest, quiet hours, family mute)
TimeCapsule, PregnancyJourney, PregnancyEntry
ChildProfile (data record only — NOT a user account, cannot login)
DevelopmentEntry
CircleChallenge, ChallengeEntry
CircleStreak (Phase 2 — circle-level upload streak: current_streak_weeks, longest_streak_weeks, last_upload_week)
NewsletterRecipient (open_count, click_count, last_clicked_at, join_prompt_count)
Referral (pro_trial_granted, pro_trial_ends_at — no separate ReferralReward table), ExportJob, FeatureFlag, BackupLog
Feedback (user_id nullable, message, page, app_version — in-app submissions; distinct from Crisp support chat)
```

---

## Key Architecture Decisions

| Decision              | Choice                                                                                                                             | Why                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Storage quota         | Per account                                                                                                                        | Prevents circle-spam exploit                                                       |
| Media access          | Signed URLs (1h expiry)                                                                                                            | RLS protects DB, not files                                                         |
| Timeline ordering     | `memory_date` (not `created_at`)                                                                                                   | Old photos insert at correct position                                              |
| Timeline loading      | Cursor-based pagination + virtual scroll                                                                                           | Stable + performant at scale                                                       |
| Auth primary          | Magic link (no password)                                                                                                           | Zero-friction for any user                                                         |
| Auth secondary        | Google OAuth                                                                                                                       | One-tap recovery if email lost                                                     |
| View-only access      | Stateless signed JWT                                                                                                               | No account needed, revocable — a role, not an age assumption                       |
| Guest uploads         | `EventUploadToken` (UUID)                                                                                                          | Auth without an account                                                            |
| Input validation      | zod on every POST/PATCH/DELETE route                                                                                               | No raw client input trusted                                                        |
| Mobile Phase 1        | PWA (mobile-responsive web)                                                                                                        | Invite-based growth — App Store not needed for first 200 users                     |
| Mobile Phase 2        | Capacitor                                                                                                                          | Reuses Nuxt, native push + camera + background upload                              |
| Live Photos (MVP)     | Strip to JPEG                                                                                                                      | Simple, low storage                                                                |
| Live Photos (Phase 2) | LivePhotosKit JS                                                                                                                   | Full motion support                                                                |
| Storage (MVP→2)       | Supabase Storage                                                                                                                   | RLS just works                                                                     |
| Storage (Phase 3)     | S3 + CloudFront + MediaConvert                                                                                                     | Video at scale                                                                     |
| Search                | PostgreSQL tsvector + GIN                                                                                                          | Zero extra infra                                                                   |
| Notifications         | Supabase Realtime + FCM/APNs + Resend                                                                                              | In-app + push + email                                                              |
| Deduplication         | pHash + Hamming distance                                                                                                           | Robust to compression/re-saves                                                     |
| Backup                | Supabase → S3 → Glacier                                                                                                            | 3-location, 50-year guarantee                                                      |
| E2EE                  | Opt-in per circle, Phase 3                                                                                                         | Breaks thumbnails/dedup/search if default — honest privacy policy covers Phase 1–2 |
| Subscription model    | Per account (owner pays)                                                                                                           | One Stripe subscription per user; owner's tier determines their circles' features  |
| Year in Review        | Phase 2: shareable card (free for all tiers, canvas API). Phase 3: full slideshow/video (Pro only — blurred preview for Free/Plus) | Free card is the Spotify Wrapped acquisition mechanic; Pro video is the upsell     |

---

## Roles

| Role           | Key permissions                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner          | Billing, delete circle, transfer ownership                                                                                                                  |
| Admin          | Invite/remove members, delete any memory                                                                                                                    |
| Member         | Upload, comment, react, delete own memories                                                                                                                 |
| Caregiver      | Upload to family timeline (always family-visible), view family timeline, react (emoji only) — no comments, no private memories, no member list, no settings |
| Platform admin | Unlimited storage (developer account, DB `platform_role` only — never client-exposed)                                                                       |

---

## Pricing Tiers

| Plan | Price    | Storage | Key unlock                                                                                                                                  |
| ---- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Free | $0       | 5 GB    | 1 circle owned, 10 members, basic timeline, milestones, albums, comments, reactions                                                         |
| Plus | $4.99/mo | 50 GB   | Unlimited circles owned, 20 members, search, On This Day, notification preferences, offline upload                                          |
| Pro  | $9.99/mo | 500 GB  | Unlimited circles + members, time capsule, collaborative memory, pregnancy tracker, Year in Review, priority support, voice/video reactions |

**Philosophy:** Sell the story, not the storage. Feature gates drive upgrades — users pay for what they _want_, not because they hit a byte limit.

**Subscription model:** One subscription per user account. Owner's tier determines their circles' features. Members inherit circle-level features but their private storage is governed by their own tier.

### Free trial

New circles get a **14-day Pro trial** starting on first memory upload. No credit card. DB-tracked (`Circle.trial_ends_at`). 3-day warning email before expiry. No Stripe subscription created until the user actively upgrades.

### Upgrade triggers

- 11th member joins → "Upgrade to Plus"
- Time capsule attempted → "Upgrade to Pro"
- Collaborative memory on Free/Plus → "Upgrade to Pro"
- Storage at 80% → "Your story space is almost full"
- Year in Review → blurred preview on Free/Plus → "Unlock your year"

### Secondary revenue (Phase 3)

- Physical photo books / printed timelines ($20–60 one-time)
- Year in Review video one-time purchase ($5–10) for Free/Plus
- Extra storage add-on (+100 GB for $2/mo)

### Realistic MRR targets

- 500 Plus + 0 Pro = $2,495/mo
- 1,000 Plus + 200 Pro = $6,980/mo
- 3,000 Plus + 500 Pro = $19,970/mo

---

## Privacy Model

**Phase 1–2:** Invite-only privacy, not zero-knowledge. Private bucket + signed URLs + RLS. Developer has infrastructure access — honest privacy policy covers this.

**Phase 3 (opt-in):** Per-circle AES-256-GCM client-side encryption. Keys in IndexedDB, never leave device in plaintext. Breaks server-side thumbnails and dedup — implemented as opt-in toggle only.

**Audit logging (Phase 2):** Supabase audit logs + AWS CloudTrail on media bucket. Every internal access traceable.

---

## Security Hardening

- HTTP security headers on every response (CSP, HSTS, X-Frame-Options, etc.) via `server/middleware/security-headers.ts`
- `zod` validation on every POST/PATCH/DELETE route — no raw client input trusted
- CORS locked to own domain only
- File upload: MIME type verified from magic bytes, not just `Content-Type` header
- Never expose `storage_path`, stack traces, or DB errors to client
- Dependabot for dependency vulnerability scanning; `npm audit --audit-level=high` in CI (use `npm audit`, not `pnpm audit` — pnpm targets retired audit endpoints as of v10)
- `platform_role` column readable only by the user themselves (not other family members)

---

## Performance Targets

| Metric                       | Target            |
| ---------------------------- | ----------------- |
| Timeline first image visible | < 1.0s on 4G      |
| Timeline LCP                 | < 2.5s on 4G      |
| Upload feedback visible      | < 200ms after tap |
| Memory open (lightbox)       | < 300ms           |
| Push → app → memory          | < 2s              |

---

## Testing Strategy

| Layer                         | Tool       | Priority                       |
| ----------------------------- | ---------- | ------------------------------ |
| RLS policies                  | pgTAP      | Highest — privacy breach risk  |
| Upload quota + Edge Functions | Vitest     | Billing correctness            |
| Stripe webhook handlers       | Vitest     | Subscription state             |
| Invite token flow             | Vitest     | Acquisition path               |
| Critical E2E paths            | Playwright | Onboarding + invite activation |

All tests run in CI on every PR. Broken RLS tests block merge.

---

## Growth Strategy (priority order)

| #   | Mechanic                                                   | Type        |
| --- | ---------------------------------------------------------- | ----------- |
| 1   | On This Day notifications                                  | Retention   |
| 2   | Beautiful invite email                                     | Acquisition |
| 3   | Invited member activation (upload in first session)        | Retention   |
| 4   | Shareable memory cards (branded)                           | Viral       |
| 5   | Year in Review (shareable 9:16 card for Instagram Stories) | Viral       |
| 6   | Referral program (30-day Pro trial for referrer)           | Acquisition |

**Rule: nail retention (#1–3) before viral (#4–6).**

---

## Onboarding (3 entry paths)

**Path A — Circle creator:** Sign up → Value proposition screens (3 swipeable) → Pick circle type → Name circle → Invite member → Upload memory → Add note → Share → "Your story has begun"

**Path B — Solo mode:** Sign up → "Just me for now" → Upload private memory → Add note → Persistent CTA to invite later → Solo-to-circle upgrade when first member joins (existing memories preserved)

**Path C — Invited member:** Accept invite → Welcome screen with recent memories → "Add your first memory →"

**Grandparent (view-only):** Click view-only link → No account needed → Swipe through memories (not infinite scroll) → Large heart button to react without account → "Join to participate →"

### Circle type picker (onboarding step)

- 👶 New parents → baby milestone templates
- 👫 Couples → relationship milestone templates
- 👨‍👩‍👧‍👦 Family → general family templates
- 👯 Friend group → friendship milestone templates
- 🧓 Caregiving family → health/life event templates
- 🌍 Travel group → trip/destination templates
- 📔 Just me → solo, personal templates
- ✏️ Other → blank, fully custom

Stored as `Circle.circle_type` — drives milestone suggestions, empty state copy, push notification language.

---

## Launch GTM (First 50 Users)

1. **New parent communities** — r/beyondthebump, r/NewParents, birth month Facebook groups
2. **Personal network** — 5–10 friends/family as beta testers
3. **Couples + friend groups** — r/relationships, r/LongDistance, Discord servers
4. **Maker communities** — Indie Hackers build-in-public (feedback, not users)
5. **Invite email as distribution** — every invite is free acquisition

No paid ads, no Product Hunt, no press until retention is proven.

---

## Rollout Phases

| Phase | Users    | Target segment                          | Exit criteria                                                |
| ----- | -------- | --------------------------------------- | ------------------------------------------------------------ |
| 1     | 0 → 50   | New parents                             | One external circle uses it weekly for 4 consecutive weeks   |
| 2     | 50 → 200 | All families, couples, adult siblings   | 20+ paying circles, churn < 5%/mo                            |
| 3     | 200+     | Friend groups, travel groups, any group | Organic signups exceed invited signups, net revenue positive |

---

## Pre-Launch Checklist (before Phase 1 goes live)

- [ ] SPF, DKIM, DMARC records on tinybit.app DNS (Resend)
- [ ] Test invite email in Gmail + Hotmail — confirm inbox delivery
- [ ] RLS policy tests passing (`supabase db test`)
- [ ] Privacy policy + Terms of Service live
- [ ] Sentry error tracking active
- [ ] Supabase Storage `fileSizeLimit` set to 500 MB (Pro plan required for video uploads)
- [ ] At least one non-developer family using it in staging

## Pre-Launch Checklist (before Phase 2 / billing goes live)

- [ ] Stripe webhook handlers tested (upgrade, downgrade, cancel, payment failure)
- [ ] OWASP ZAP scan on staging — all critical/high resolved
- [ ] App Store / Play Console metadata + privacy policy URL live
- [ ] Storage quota enforcement tested end-to-end

---

## What NOT to Build (ever / yet)

- Custom SSO (use Supabase Auth)
- AI tagging / face recognition (compete on story, not AI)
- Unlimited storage (compete on meaning, not bytes)
- Per-user storage limits (breaks collaboration)
- Complex RBAC beyond 4 roles
- RTL language support (Phase 3+ at earliest)
- Google Analytics (contradicts privacy positioning — use PostHog)

---

## Files

- [Full design spec](design-spec.md)
- [Description & research](description.md)
