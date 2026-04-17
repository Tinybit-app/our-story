# Our Story — Phase 1 Build Plan

A step-by-step build order for Phase 1 (0 → 50 users). Each milestone has hard dependencies on the one before it. Do not skip ahead.

**Exit criteria for Phase 1:** One external family (people who don't know you) uses the app weekly for 4 consecutive weeks.

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
- [ ] 3.4 Profile setup page (first_name + last_name collection for magic link users)
- [ ] 3.5 Linked login methods (connect Google OAuth as fallback for magic link users)
- [ ] 3.6 Account deletion flow:
  - Member deletion: content choice ("keep as Former member" vs "remove from circles"), reactions always removed
  - Owner deletion: resolve ownership first (auto-promote admin, force transfer, or delete circle)
  - 30-day soft delete + daily hard purge cron
- [ ] 3.7 Circle deletion (owner-only): warning screen → type-to-confirm → 30-day soft delete → email all members → hard purge at day 30
- [ ] 3.8 Data export (ExportJob): members export own uploads only; owners export full circle

### Milestone 3.9: Landing Page + Pricing Page (Cold Discovery)
- [ ] 3.9.1 `/` route — landing page for unauthenticated visitors; authenticated users redirect to `/timeline`
- [ ] 3.9.2 Hero: headline, subhead, single CTA ("Start your circle — free")
- [ ] 3.9.3 Below fold: product screenshot, 3-step explainer, privacy proof, pricing summary
- [ ] 3.9.4 SEO: `<title>`, meta description, OG tags targeting "private photo sharing for family"
- [ ] 3.9.5 `/pricing` route — tier comparison table (Free / Plus / Pro "coming soon"), FAQ (cancel, photos on cancel, privacy, grandparents), CTA per tier
- Note: single focused pages — not a multi-page marketing site; lives inside the Nuxt app
- Note: see design spec §Cold Discovery Strategy and §Pricing Page for full structure

### Milestone 4: Onboarding & Circle Creation
- [x] 4.1 Onboarding flow (circle type picker → name → invite)
- [x] 4.2 Invite API + email (Resend)
- [x] 4.3 Invite acceptance flow (token → auto-join)
- [ ] 4.4 Value proposition screens (3 swipeable screens shown once on first open)
- [ ] 4.5 Viewer-role UX (first-open splash, swipe nav, guest reactions — applies to viewer role, not grandparents specifically)

### Milestone 5: Media Upload
- [x] 5.1 Upload Edge Function (quota check, size check, storage)
- [x] 5.2 Upload UI component (file picker, preview, progress bar)
- [ ] 5.3 Batch upload with automatic mem_date detection (multi-select, EXIF extraction, per-item progress)


### Milestone 6: Timeline
- [x] 6.1 Signed URL API (cursor-based, memory_date ordering)
- [x] 6.2 Timeline UI — Polaroid Wall (monthly sections, year badge, jump modal, month overflow page)

### Milestone 7: Memory Features
- [ ] 7.1 Share to circle (visibility toggle)
- [ ] 7.2 Milestones (picker + custom milestone)
- [ ] 7.2.1 Milestone share card — after saving a milestone, offer a branded canvas card (Instagram Stories / WhatsApp format) with "Made with Our Story" CTA — primary acquisition channel for new parents
- [ ] 7.3 Quick note (text-only memory, no photo required)
- [ ] 7.4 Image quality: verify originals stored untouched, thumbnails served via Supabase Image Transformations
- [ ] 7.5 Media download & share (save to device, shareable card with watermark)

### Milestone 8: Comments & Reactions
- [ ] 8.1 Comments (post, read, delete own)
- [ ] 8.2 Emoji reactions (toggle on/off)

### Milestone 8.5: Localization (i18n — English + Chinese + French)
- [ ] 8.5.1 Install `@nuxtjs/i18n`, configure `en` + `zh-Hans` + `fr` locales (lazy-loaded JSON files)
- [ ] 8.5.2 Extract all UI strings to `locales/en.json` — replace every hardcoded string with `t('key')`
- [ ] 8.5.3 Translate `locales/zh-Hans.json` (Simplified Chinese — must-have: developer's own parents)
- [ ] 8.5.4 Translate `locales/fr.json` (French — Canadian bilingual requirement)
- [ ] 8.5.5 Language toggle in settings (persisted to `User.locale`)
- Note: use `Intl.DateTimeFormat` for all dates from day one — never hardcode `MM/DD/YYYY`
- Note: see design spec §Localization for full setup code and priority language rationale

### Milestone 9: Viewer-Role Access
- [ ] 9.1 Generate view-only JWT link
- [ ] 9.2 View-only page (no auth required)
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
- [ ] 10.1 Basic push (new upload, comment, reaction) — default push_enabled = true on join; prompt to configure on first notification received
- [ ] 10.2 On This Day daily cron — activates at 30+ memories and 90+ days since first upload; below threshold substitutes weekly "A memory from your first month" notification — build for all users in Phase 1 (no tier check); add Plus gate in Phase 2 alongside Stripe billing

### Milestone 11: PWA & Mobile Polish
- [ ] 11.1 PWA manifest + service worker
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

## Milestone 1: Project Foundation

Everything else depends on this. Get the repo, deployment, and local dev working before writing a single line of product code.

### Step 1.1 — Create the Nuxt project

```bash
mkdir -p ~/dev/tinybit
cd ~/dev/tinybit
pnpm dlx nuxi@latest init our-story --package-manager pnpm
cd our-story
```

Install core dependencies:
```bash
pnpm install @nuxtjs/supabase @nuxtjs/tailwindcss @vueuse/nuxt
pnpm install @upstash/ratelimit @upstash/redis  # Phase 2 dependency — installed now so env vars are wired from day one, but no Upstash calls in Phase 1 code. Phase 1 rate limiting uses server-side DB count checks only. You do NOT need to provision an Upstash instance until Phase 2.
pnpm install resend
pnpm install -D vitest @vitest/ui playwright @playwright/test

# Initialise shadcn-vue (run after Tailwind is set up)
pnpm dlx shadcn-vue@latest init

# Add components you'll need for Phase 1
pnpm dlx shadcn-vue@latest add button dialog sheet drawer toast avatar tabs input textarea
```

`nuxt.config.ts`:
```ts
export default defineNuxtConfig({
  modules: ["@nuxtjs/supabase", "@nuxtjs/tailwindcss", "@vueuse/nuxt"],
  supabase: {
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      exclude: ["/invite/*", "/view/*"],
    },
  },
  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    jwtSecret: process.env.JWT_SECRET,
    appUrl: process.env.APP_URL,  // Used in invite + view-only links
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  },
})
```

**Definition of done:** `pnpm dev` shows the default Nuxt page at `localhost:3000`.

---

### Step 1.2 — Create the Supabase project

1. Go to supabase.com → New project → name it `our-story`
2. Choose a region close to your target users (US East if US-focused)
3. **Start on the free plan during development** — fine for local dev and schema work
4. **Upgrade to Pro ($25/mo) before sharing with any real user** — free plan caps file uploads at 50 MB (blocks all video uploads) and pauses the project after 1 week of inactivity
5. After upgrading: In Storage settings set `fileSizeLimit` to `524288000` (500 MB)
6. Copy project URL and anon key

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialise local Supabase project
supabase init

# Link to remote project
supabase link --project-ref <your-project-ref>

# Start local Supabase (runs Postgres + Auth + Storage locally)
supabase start
```

`.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Never expose to client
JWT_SECRET=<random 32-char string>  # For view-only grandparent JWT
RESEND_API_KEY=re_...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=...               # For Sentry source map uploads
APP_URL=http://localhost:3000       # Change to https://our-story.tinybit.app in Vercel env vars
```

`.env.example` (commit this, not `.env`):
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
RESEND_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
APP_URL=
```

**Definition of done:** `supabase start` runs without errors. `supabase status` shows local URLs.

---

### Step 1.3 — GitHub repo + Vercel deployment

1. Create GitHub repo `our-story` (private)
2. Push initial commit
3. Connect repo to Vercel → New Project → Import from GitHub
4. Set all env vars in Vercel dashboard (same as `.env`)
5. Set `SUPABASE_SERVICE_ROLE_KEY` as a sensitive env var (not exposed to preview deploys)

Verify auto-deploy works: push a commit → Vercel builds and deploys automatically.

**Definition of done:** Every push to `main` auto-deploys to `our-story.tinybit.app`.

---

### Step 1.4 — CI/CD pipeline (GitHub Actions)

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  test:
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

      - name: Install dependencies
        run: pnpm install

      - name: Security audit
        run: pnpm audit --audit-level high
        # pnpm audit reads pnpm-lock.yaml natively — no package-lock.json needed.
        # The "retired endpoints" issue was a pnpm v8 regression; fixed in v9+ (CI uses latest).

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start local Supabase
        run: supabase start

      - name: Export Supabase env vars
        run: |
          STATUS_ENV=$(supabase status --output env 2>&1)
          # Supabase CLI v2 renamed: ANON_KEY→PUBLISHABLE_KEY, SERVICE_ROLE_KEY→SECRET_KEY
          ANON_KEY=$(echo "$STATUS_ENV" | grep 'PUBLISHABLE_KEY=' | cut -d= -f2-)
          SERVICE_KEY=$(echo "$STATUS_ENV" | grep 'SECRET_KEY=' | cut -d= -f2-)
          echo "NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321" >> $GITHUB_ENV
          echo "NUXT_PUBLIC_SUPABASE_KEY=$ANON_KEY" >> $GITHUB_ENV
          echo "NUXT_SUPABASE_SECRET_KEY=$SERVICE_KEY" >> $GITHUB_ENV
          echo "JWT_SECRET=ci-placeholder-secret-not-used-in-tests" >> $GITHUB_ENV

      - name: Run DB tests (RLS policies)
        run: |
          if find supabase/tests -name "*.sql" 2>/dev/null | grep -q .; then
            pnpm db:test
          else
            echo "No DB tests found, skipping."
          fi

      - name: Run unit tests
        run: pnpm test

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload Playwright results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results
          path: test-results/
          retention-days: 7

      - name: Stop Supabase
        run: supabase stop
```

`package.json` scripts:
```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:test": "supabase db test"
  }
}
```

**Definition of done:** Opening a PR triggers CI. A failing test blocks merge.

---

### Step 1.5 — Sentry error tracking

```bash
pnpm install @sentry/nuxt
```

`nuxt.config.ts` addition:
```ts
modules: ["@sentry/nuxt/module"],
sentry: {
  sourceMapsUploadOptions: {
    project: "our-story",
    authToken: process.env.SENTRY_AUTH_TOKEN,
  },
},
```

`sentry.client.config.ts`:
```ts
import * as Sentry from "@sentry/nuxt"

Sentry.init({
  dsn: useRuntimeConfig().public.sentryDsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

**Definition of done:** Throw a test error in dev → it appears in Sentry dashboard.

---

### Step 1.6 — Security hardening baseline

Security is the #1 priority. Set this up before writing any product code so it's never an afterthought.

**HTTP security headers** — `server/middleware/security-headers.ts`:
```ts
export default defineEventHandler((event) => {
  setHeaders(event, {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "media-src 'self' blob: https://*.supabase.co",
      "script-src 'self' 'unsafe-inline' https://client.crisp.chat",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join("; "),
  })
})
```

**Input validation** — install `zod` and use it on every API route:
```bash
pnpm install zod
```

```ts
// Pattern to use on every POST/PATCH route
import { z } from "zod"

const schema = z.object({ ... })
const result = schema.safeParse(await readBody(event))
if (!result.success) throw createError({ statusCode: 400, message: "Invalid request" })
// Use result.data — never the raw body
```

**CORS configuration** — only allow requests from your own domain (`nuxt.config.ts`):
```ts
routeRules: {
  "/api/**": {
    cors: false,  // handled manually below
    headers: {
      "Access-Control-Allow-Origin": process.env.APP_URL ?? "https://our-story.tinybit.app",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  },
},
```

**Dependabot** — `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
```

**Security audit in CI** — add to `.github/workflows/ci.yml`:
```yaml
- name: Security audit
  run: pnpm audit --audit-level high
```
> Use `pnpm audit` — it reads `pnpm-lock.yaml` natively, no `package-lock.json` needed. The "retired endpoints" issue was a pnpm v8 regression; fixed in v9+ (CI pins `version: latest`).

**Error messages** — never expose internals to client. Always log server-side:
```ts
// Every API route error handler
try {
  // ...
} catch (error) {
  console.error("[route-name]", error)  // full error in logs / Sentry
  throw createError({ statusCode: 500, message: "Something went wrong. Please try again." })
}
```

**Definition of done:** Security headers visible in browser DevTools Network tab. CORS `Access-Control-Allow-Origin` set to your domain. `pnpm audit --audit-level high` runs in CI. Dependabot PRs enabled on GitHub.

---

### Step 1.7 — PostHog analytics

Privacy-first analytics that doesn't contradict your "no ads, no AI training" positioning. Self-hosted so all data stays on your infra.

```bash
pnpm add posthog-js
```

`plugins/posthog.client.ts`:
```ts
import posthog from "posthog-js"

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  posthog.init(config.public.posthogKey, {
    api_host: config.public.posthogHost,  // self-hosted or posthog.com
    capture_pageview: true,
    autocapture: false,  // manual events only — avoids capturing PII accidentally
    persistence: "localStorage",
  })

  return {
    provide: { posthog },
  }
})
```

`nuxt.config.ts` addition:
```ts
runtimeConfig: {
  public: {
    posthogKey: process.env.POSTHOG_KEY,
    posthogHost: process.env.POSTHOG_HOST ?? "https://app.posthog.com",
  },
},
```

`.env` addition:
```
POSTHOG_KEY=phc_...
POSTHOG_HOST=https://analytics.our-story.tinybit.app  # or https://app.posthog.com for cloud
```

**Key events to track** — call `$posthog.capture(event, properties)` at each action:

| Event | Where to fire | Properties |
|---|---|---|
| `user_signed_up` | `confirm.vue` on first redirect | `{ method: "magic_link" \| "google" }` |
| `circle_created` | after Circle insert | `{ circle_type }` |
| `member_invited` | invite API success | `{ circle_id }` |
| `member_joined` | invite acceptance | `{ circle_id }` |
| `memory_uploaded` | upload Edge Function response | `{ type: "photo" \| "video" \| "quick_note", visibility }` |
| `memory_shared_to_circle` | share API success | — |
| `reaction_added` | reaction API success | `{ emoji }` |
| `milestone_created` | memory insert with milestone | `{ is_custom }` |
| `subscription_upgraded` | Stripe webhook | `{ plan: "plus" \| "pro" }` |

**Rules:**
- Never log PII in event properties (no names, emails, photo content, or UUIDs that link to identifiable data)
- Identify users with PostHog: `$posthog.identify(user.id)` on login — use opaque ID only

**Definition of done:** Sign up → `user_signed_up` event appears in PostHog. Upload a memory → `memory_uploaded` event appears. No PII visible in PostHog event properties.

---

## Milestone 2: Database Schema & RLS

The schema and RLS policies are the foundation of all security. Get these right before building any product features. A bug here is a privacy breach.

### Step 2.1 — Initial schema migration

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.User (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  locale TEXT CHECK (locale IN ('en', 'zh-Hans', 'fr')),  -- nullable; falls back to browser language then 'en'; expand CHECK as Phase 2+ languages ship
  platform_role TEXT NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user', 'platform_admin')),
  -- Subscription (one per user — owner's tier determines their circles' features)
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status TEXT NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free', 'plus', 'pro')),
  subscription_period_end TIMESTAMPTZ,
  referral_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  referred_by_user_id UUID REFERENCES public.User(id),
  deleted_at TIMESTAMPTZ,
  deletion_requested_at TIMESTAMPTZ,  -- set when user requests deletion; hard purge at deleted_at + 30 days
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create User row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.User (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CIRCLES
-- ============================================================
CREATE TABLE public.Circle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  circle_type TEXT NOT NULL DEFAULT 'custom' CHECK (circle_type IN (
    'parents', 'couple', 'family', 'friends', 'caregiving', 'travel', 'solo', 'custom'
  )),
  created_by UUID NOT NULL REFERENCES public.User(id),
  subscription_status TEXT NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free', 'plus', 'pro', 'grace')),
  grace_period_until TIMESTAMPTZ,
  challenge_streak INT NOT NULL DEFAULT 0,
  last_challenge_completed_at TIMESTAMPTZ,             -- updated on each completed challenge; used for streak logic
  quiet_nudge_count INT NOT NULL DEFAULT 0,            -- quiet-circle nudge count; hard stop at 3
  quiet_nudge_last_sent_at TIMESTAMPTZ,                -- prevents nudges < 14 days apart
  e2ee_enabled BOOL NOT NULL DEFAULT false,
  e2ee_enabled_at TIMESTAMPTZ,
  first_memory_at TIMESTAMPTZ,                       -- set once on first Memory insert
  last_memory_at TIMESTAMPTZ,                        -- updated on every Memory insert via trigger; used by quiet-circle nudge cron and weekly digest
  memory_count INT NOT NULL DEFAULT 0,               -- incremented on every Memory insert via trigger; used by On This Day activation threshold
  trial_ends_at TIMESTAMPTZ,                         -- Pro trial expiry
  trial_used BOOL NOT NULL DEFAULT false,
  first_month_email_sent BOOL NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,                              -- set when owner initiates circle deletion; 30-day soft-delete window
  deletion_initiated_by UUID REFERENCES public.User(id),  -- records which owner triggered deletion
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CIRCLE MEMBERS
-- ============================================================
CREATE TABLE public.CircleMember (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.Circle(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'caregiver')),
  memorial_status TEXT NOT NULL DEFAULT 'active' CHECK (memorial_status IN ('active', 'memorial')),
  memorial_date TIMESTAMPTZ,
  memorial_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, circle_id)
);

-- ============================================================
-- CIRCLE INVITES
-- ============================================================
CREATE TABLE public.CircleInvite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.Circle(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'caregiver')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ACCOUNT STORAGE
-- ============================================================
CREATE TABLE public.AccountStorage (
  user_id UUID PRIMARY KEY REFERENCES public.User(id) ON DELETE CASCADE,
  total_quota_bytes BIGINT NOT NULL DEFAULT 5368709120,  -- 5 GB free tier
  total_used_bytes BIGINT NOT NULL DEFAULT 0,
  bonus_bytes BIGINT NOT NULL DEFAULT 0  -- reserved for future storage promotions; referral reward is a Pro trial, not storage
);

-- Auto-create AccountStorage row on User insert
CREATE OR REPLACE FUNCTION public.handle_new_account_storage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.AccountStorage (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_storage
  AFTER INSERT ON public.User
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_account_storage();

-- ============================================================
-- MEMORIES
-- ============================================================
CREATE TABLE public.Memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.User(id),
  circle_id UUID NOT NULL REFERENCES public.Circle(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'circle')),
  -- NOTE: 'group' is intentionally absent from the CHECK constraint. The spec requires
  -- that 'group' is added only in the Phase 3 migration when Group/GroupMember tables ship.
  -- Adding it here would allow group-scoped memories to be inserted before any RLS policy exists.
  -- group_id column also ships in Phase 3 only — do NOT add it here.
  note TEXT,
  alt_text TEXT,
  memory_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_collaborative BOOL NOT NULL DEFAULT false,
  contributions_open BOOL NOT NULL DEFAULT false,
  milestone_label TEXT,
  milestone_is_custom BOOL NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_circle_date ON public.Memory (circle_id, memory_date DESC, id DESC);
CREATE INDEX idx_memory_owner ON public.Memory (owner_user_id);

-- ============================================================
-- MEMORY MEDIA
-- ============================================================
CREATE TABLE public.MemoryMedia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.Memory(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,   -- NEVER expose to client — serve signed URLs only
  file_size BIGINT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'live_photo', 'audio')),  -- 'audio' reserved for Phase 2 voice memos; in constraint now so Phase 2 migration is additive
  still_path TEXT,              -- live photos only
  live_path TEXT,               -- live photos only
  phash TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_name TEXT,
  guest_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMMENTS + REACTIONS
-- ============================================================
CREATE TABLE public.MemoryComment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.Memory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.User(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.MemoryReaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES public.Memory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.User(id),
  type TEXT NOT NULL DEFAULT 'emoji' CHECK (type IN ('emoji', 'voice', 'video')),
  emoji TEXT,
  media_path TEXT,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (memory_id, user_id, emoji)
);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE public.NotificationPreference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.Circle(id) ON DELETE CASCADE,
  push_enabled BOOL NOT NULL DEFAULT true,
  email_digest_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (email_digest_frequency IN ('daily', 'weekly', 'off')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  circle_muted BOOL NOT NULL DEFAULT false,
  UNIQUE (user_id, circle_id)
);

-- ============================================================
-- EXPORT JOBS (async GDPR data export)
-- ============================================================
CREATE TABLE public.ExportJob (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  download_url TEXT,        -- signed URL, valid 24h
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FEATURE FLAGS
-- ============================================================
CREATE TABLE public.FeatureFlag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  enabled_globally BOOL NOT NULL DEFAULT false,
  enabled_user_ids UUID[] NOT NULL DEFAULT '{}',
  enabled_pct INT NOT NULL DEFAULT 0 CHECK (enabled_pct BETWEEN 0 AND 100)
);

-- ============================================================
-- CHILD PROFILES (data record only — not a User account)
-- Phase 1: lightweight record (name + DOB) required for Step 12.2 milestone nudges.
-- Phase 3: full development tracking UI (DevelopmentEntry, growth charts, WHO milestones)
--          ships in Phase 3 — do NOT add DevelopmentEntry here.
-- ============================================================
CREATE TABLE public.ChildProfile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.Circle(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  avatar_media_id UUID REFERENCES public.MemoryMedia(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- NEWSLETTER RECIPIENTS (viewer-role digest recipients with no User account)
-- ============================================================
CREATE TABLE public.NewsletterRecipient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.Circle(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES public.User(id),
  email TEXT NOT NULL,
  name TEXT,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'monthly')),
  unsubscribe_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  subscribed BOOL NOT NULL DEFAULT true,
  open_count INT NOT NULL DEFAULT 0,
  click_count INT NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  join_prompt_count INT NOT NULL DEFAULT 0,  -- frequency cap on join CTA shown to this recipient
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (circle_id, email)
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update Circle timestamps, memory_count, and quiet_nudge_count on Memory insert
-- Used by: free trial activation, "Your First Month" email, quiet-circle nudge cron, weekly digest, On This Day threshold
CREATE OR REPLACE FUNCTION public.handle_memory_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.Circle
  SET
    first_memory_at   = COALESCE(first_memory_at, now()),  -- set once, never updated
    last_memory_at    = now(),                              -- updated on every insert
    memory_count      = memory_count + 1,                  -- incremented on every insert; avoids COUNT() in crons
    quiet_nudge_count = 0                                  -- reset on every upload — the circle is active again
                                                           -- allows a fresh 3-nudge window next time the circle goes quiet
  WHERE id = NEW.circle_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_memory_created
  AFTER INSERT ON public.Memory
  FOR EACH ROW EXECUTE FUNCTION public.handle_memory_insert();
```

Apply migration:
```bash
supabase db push
```

**Definition of done:** `supabase db push` runs clean. All tables visible in Supabase dashboard.

---

### Step 2.2 — RLS policies migration

Create `supabase/migrations/002_rls_policies.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE public.User ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Circle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.CircleMember ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.CircleInvite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.AccountStorage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.Memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryMedia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryComment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.MemoryReaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.NotificationPreference ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER
-- ============================================================
CREATE POLICY "users can read own profile"
  ON public.User FOR SELECT USING (id = auth.uid());

CREATE POLICY "users can read circle members profiles"
  ON public.User FOR SELECT USING (
    id IN (
      SELECT fm.user_id FROM public.CircleMember fm
      WHERE fm.circle_id IN (
        SELECT circle_id FROM public.CircleMember WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "users can update own profile"
  ON public.User FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- CIRCLE
-- ============================================================
CREATE POLICY "members can read their circles"
  ON public.Circle FOR SELECT USING (
    id IN (SELECT circle_id FROM public.CircleMember WHERE user_id = auth.uid())
  );

CREATE POLICY "authenticated users can create circles"
  ON public.Circle FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "owner can update circle"
  ON public.Circle FOR UPDATE USING (
    id IN (
      SELECT circle_id FROM public.CircleMember
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================
-- CIRCLE MEMBER
-- ============================================================
CREATE POLICY "members can read circle membership"
  ON public.CircleMember FOR SELECT USING (
    circle_id IN (SELECT circle_id FROM public.CircleMember WHERE user_id = auth.uid())
  );
-- NOTE: caregivers can read circle membership (needed to show parent names) but must only
-- see first_name. RLS cannot do column-level filtering, so the member-list API route must
-- check the requesting user's role and return first_name only when role = 'caregiver'.
-- Enforce this in server/api/circles/[id]/members.get.ts, not via RLS.

CREATE POLICY "owner and admin can insert members"
  ON public.CircleMember FOR INSERT WITH CHECK (
    circle_id IN (
      SELECT circle_id FROM public.CircleMember
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "owner and admin can remove members"
  ON public.CircleMember FOR DELETE USING (
    circle_id IN (
      SELECT circle_id FROM public.CircleMember
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- ACCOUNT STORAGE
-- ============================================================
CREATE POLICY "users can read own storage"
  ON public.AccountStorage FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- MEMORY
-- ============================================================
CREATE POLICY "members can read circle memories"
  ON public.Memory FOR SELECT USING (
    -- circle memories: must be a member
    (visibility = 'circle' AND circle_id IN (
      SELECT circle_id FROM public.CircleMember WHERE user_id = auth.uid()
    ))
    OR
    -- private memories: only the owner
    (visibility = 'private' AND owner_user_id = auth.uid())
  );

CREATE POLICY "members can insert memories"
  ON public.Memory FOR INSERT WITH CHECK (
    owner_user_id = auth.uid() AND
    circle_id IN (SELECT circle_id FROM public.CircleMember WHERE user_id = auth.uid())
  );

CREATE POLICY "owner can update own memory"
  ON public.Memory FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "owner can delete own memory"
  ON public.Memory FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY "admin can delete any memory in their circle"
  ON public.Memory FOR DELETE USING (
    circle_id IN (
      SELECT circle_id FROM public.CircleMember
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RESTRICTIVE: blocks ANY non-owner from reading private memories regardless of other permissive policies.
-- AS RESTRICTIVE means this is AND'd with all permissive policies, not OR'd — if a future permissive
-- policy accidentally grants broader SELECT access to Memory rows, private memories are still protected.
-- See design spec §RLS enforcement §Notes: "Private memories only readable by owner_user_id — enforced via RESTRICTIVE policy."
CREATE POLICY "private memories owner only"
  ON public.Memory
  AS RESTRICTIVE
  FOR SELECT
  USING (visibility != 'private' OR owner_user_id = auth.uid());

-- RESTRICTIVE: blocks caregivers from private memories regardless of any other permissive policy.
-- AS RESTRICTIVE means this is AND'd with all permissive policies, not OR'd — so future permissive
-- policy additions cannot accidentally expose private memories to caregivers.
-- Phase 1 scope: caregiver role ships in Phase 1; this policy must ship with it.
-- See design spec §Caregiver Mode for full rationale.
CREATE POLICY "caregiver cannot read private memories"
  ON public.Memory
  AS RESTRICTIVE
  FOR SELECT
  USING (
    NOT (
      visibility = 'private'
      AND EXISTS (
        SELECT 1 FROM public.CircleMember
        WHERE user_id = auth.uid() AND role = 'caregiver'
          AND circle_id = Memory.circle_id
      )
    )
  );

-- ============================================================
-- MEMORY MEDIA
-- ============================================================
CREATE POLICY "members can read media for accessible memories"
  ON public.MemoryMedia FOR SELECT USING (
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "uploader can insert media"
  ON public.MemoryMedia FOR INSERT WITH CHECK (
    memory_id IN (
      SELECT id FROM public.Memory WHERE owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE POLICY "members can read comments on accessible memories"
  ON public.MemoryComment FOR SELECT USING (
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "members can post comments"
  ON public.MemoryComment FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "users can delete own comments"
  ON public.MemoryComment FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- REACTIONS
-- ============================================================
CREATE POLICY "members can read reactions"
  ON public.MemoryReaction FOR SELECT USING (
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "members can add reactions"
  ON public.MemoryReaction FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    memory_id IN (SELECT id FROM public.Memory)
  );

CREATE POLICY "users can remove own reactions"
  ON public.MemoryReaction FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHILD PROFILES
-- ============================================================
ALTER TABLE public.ChildProfile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read child profiles in their circles"
  ON public.ChildProfile FOR SELECT USING (
    circle_id IN (SELECT circle_id FROM public.CircleMember WHERE user_id = auth.uid())
  );

CREATE POLICY "members can insert child profiles"
  ON public.ChildProfile FOR INSERT WITH CHECK (
    circle_id IN (SELECT circle_id FROM public.CircleMember WHERE user_id = auth.uid())
  );

CREATE POLICY "members can update child profiles in their circles"
  ON public.ChildProfile FOR UPDATE USING (
    circle_id IN (SELECT circle_id FROM public.CircleMember WHERE user_id = auth.uid())
  );

-- ============================================================
-- NEWSLETTER RECIPIENTS
-- ============================================================
ALTER TABLE public.NewsletterRecipient ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner and admin can manage newsletter recipients"
  ON public.NewsletterRecipient FOR ALL USING (
    circle_id IN (
      SELECT circle_id FROM public.CircleMember
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
```

**Definition of done:** `supabase db test` passes. Manually verify in Supabase dashboard that RLS is enabled on all tables.

---

### Step 2.3 — RLS policy tests

Create `supabase/tests/rls.test.sql`:

```sql
BEGIN;
SELECT plan(9);

-- Test 1: user cannot read another user's private memory
SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE owner_user_id = 'user-b-uuid' AND visibility = 'private'),
  0,
  'user_a cannot read user_b private memories'
);

-- Test 2: user can read circle memory they belong to
-- (set up fixture data in test, verify count > 0)

-- Test 3: user cannot read circle they don't belong to
SELECT is(
  (SELECT count(*)::int FROM public.Circle
   WHERE id = 'other-circle-uuid'),
  0,
  'user cannot read circle they are not a member of'
);

-- Test 4: member cannot invite (only owner/admin can)
-- Test 5: owner can delete any memory in their circle
-- Test 6: platform_role is not readable by other users

-- Test 7: non-owner circle member cannot read another member's private memory (RESTRICTIVE policy)
-- This guards against future permissive policy additions accidentally exposing private memories.
SET LOCAL request.jwt.claims TO '{"sub": "member-uuid"}';
SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE circle_id = 'circle-1-uuid' AND visibility = 'private'
     AND owner_user_id != 'member-uuid'),
  0,
  'circle member cannot read another member private memories (RESTRICTIVE policy)'
);

-- Test 8: caregiver cannot read private memories (RESTRICTIVE policy)
-- Switch session to the caregiver user
SET LOCAL request.jwt.claims TO '{"sub": "caregiver-uuid"}';
SELECT is(
  (SELECT count(*)::int FROM public.Memory
   WHERE circle_id = 'circle-1-uuid' AND visibility = 'private'),
  0,
  'caregiver cannot read private memories'
);

-- Test 9: caregiver CAN read circle-visibility memories
SELECT isnt(
  (SELECT count(*)::int FROM public.Memory
   WHERE circle_id = 'circle-1-uuid' AND visibility = 'circle'),
  0,
  'caregiver can read circle-visibility memories'
);

SELECT * FROM finish();
ROLLBACK;
```

---

### Step 2.4 — Storage bucket setup

Create `supabase/migrations/003_storage.sql`:

```sql
-- Private bucket for all user media (no public access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memories-private',
  'memories-private',
  false,
  524288000,  -- 500 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
);

-- Storage RLS: only authenticated users can upload to their own path
CREATE POLICY "authenticated users can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'memories-private' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: no direct reads — all access via signed URLs from server
CREATE POLICY "no direct reads"
  ON storage.objects FOR SELECT
  USING (false);
```

**Definition of done:** `memories-private` bucket visible in Supabase Storage. Direct URL access returns 403.

---

## Milestone 3: Authentication

### Step 3.1 — Login page

`pages/login.vue`:
```vue
<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="max-w-sm w-full p-8">
      <h1 class="text-2xl font-semibold mb-2">Welcome back</h1>
      <p class="text-gray-500 mb-8">Enter your email to sign in</p>

      <form @submit.prevent="sendMagicLink">
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="w-full border rounded-lg px-4 py-3 mb-4"
          required
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-black text-white rounded-lg py-3"
        >
          {{ loading ? "Sending..." : "Send magic link" }}
        </button>
      </form>

      <div v-if="sent" class="mt-6 text-center text-green-600">
        Check your email for a sign-in link
      </div>

      <div class="mt-6 relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-200" />
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-white text-gray-500">or</span>
        </div>
      </div>

      <button @click="signInWithGoogle" class="mt-4 w-full border rounded-lg py-3 flex items-center justify-center gap-2">
        <img src="/google-icon.svg" class="w-5 h-5" />
        Continue with Google
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const email = ref("")
const loading = ref(false)
const sent = ref(false)

async function sendMagicLink() {
  loading.value = true
  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: { emailRedirectTo: `${window.location.origin}/confirm` },
  })
  if (!error) sent.value = true
  loading.value = false
}

async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/confirm` },
  })
}
</script>
```

### Step 3.2 — Auth callback page

`pages/confirm.vue`:
```vue
<script setup lang="ts">
// @nuxtjs/supabase handles the token exchange automatically
// This page just redirects after the session is established
const user = useSupabaseUser()
const router = useRouter()
const route = useRoute()

watchEffect(() => {
  if (user.value) {
    // Check for pending invite token in cookie
    const inviteToken = useCookie("pending_invite_token")
    if (inviteToken.value) {
      router.push(`/invite/${inviteToken.value}`)
    } else {
      router.push("/")
    }
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-gray-500">Signing you in...</p>
  </div>
</template>
```

### Step 3.3 — Auth middleware

`middleware/auth.ts`:
```ts
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()
  const publicRoutes = ["/login", "/confirm", "/invite", "/view"]

  if (!user.value && !publicRoutes.some((r) => to.path.startsWith(r))) {
    return navigateTo("/login")
  }
})
```

Register globally in `nuxt.config.ts`:
```ts
router: {
  middleware: ["auth"]
}
```

**Definition of done:** Unauthenticated users are redirected to `/login`. Magic link email arrives, clicking it logs the user in and redirects to `/`.

---

### Step 3.4 — Profile setup page

Google OAuth users arrive with `first_name`/`last_name` populated from their Google account (via the `handle_new_user` trigger). Magic link users do not — they only have an email address.

The profile collection page is rendered as the first step of the onboarding flow (see Step 4.1). The `confirm.vue` redirect logic checks whether `first_name` is set and routes magic link users to `/onboarding/profile` before the circle setup steps.

No additional implementation is needed in this step — the page is built as part of Milestone 4. This step is a reminder to ensure the `confirm.vue` redirect logic handles both cases correctly:

```ts
// confirm.vue redirect logic (covered fully in Step 4.1)
if (!profile?.first_name) router.push("/onboarding/profile")
else if (!membership) router.push("/onboarding")
else router.push("/")
```

**Definition of done:** Magic link user who completes sign-in is prompted to enter their name before seeing the circle setup. Google OAuth user skips this step and goes directly to circle setup or timeline.

---

### Step 3.5 — Linked login methods

Magic link users can lose access to their email. Connecting a Google account gives them an independent second login path — no password storage, no credential stuffing risk.

**What this step does:**
- Account settings page shows which login methods are connected (magic link email / Google)
- "Connect Google account" button links Google OAuth to the existing account via Supabase `linkIdentity`
- "Remove" only allowed if at least one other method remains (prevent lockout)
- Email change flow (update email while still logged in — Supabase sends verification to new address)

`pages/settings/account.vue`:
```vue
<template>
  <div class="max-w-lg mx-auto p-8 space-y-8">
    <div>
      <h2 class="text-lg font-semibold mb-1">Login methods</h2>
      <p class="text-sm text-gray-500 mb-4">
        Connect a second login method so you're never locked out if you lose access to your email.
      </p>

      <div class="space-y-3">
        <!-- Magic link / email -->
        <div class="flex items-center justify-between border rounded-xl p-4">
          <div class="flex items-center gap-3">
            <span class="text-xl">✉️</span>
            <div>
              <div class="font-medium text-sm">Email (magic link)</div>
              <div class="text-xs text-gray-500">{{ user?.email }}</div>
            </div>
          </div>
          <span class="text-xs text-green-600 font-medium">Connected</span>
        </div>

        <!-- Google OAuth -->
        <div class="flex items-center justify-between border rounded-xl p-4">
          <div class="flex items-center gap-3">
            <span class="text-xl">🔵</span>
            <div>
              <div class="font-medium text-sm">Google</div>
              <div class="text-xs text-gray-500">
                {{ googleIdentity ? googleIdentity.identity_data?.email : 'Not connected' }}
              </div>
            </div>
          </div>
          <button
            v-if="!googleIdentity"
            @click="connectGoogle"
            :disabled="linking"
            class="text-sm font-medium text-blue-600 hover:underline disabled:opacity-40"
          >
            {{ linking ? 'Connecting...' : 'Connect' }}
          </button>
          <button
            v-else-if="identities.length > 1"
            @click="unlinkGoogle"
            :disabled="linking"
            class="text-sm font-medium text-red-500 hover:underline disabled:opacity-40"
          >
            Remove
          </button>
          <span v-else class="text-xs text-gray-400">Can't remove — only login method</span>
        </div>
      </div>
    </div>

    <!-- Email change -->
    <div>
      <h2 class="text-lg font-semibold mb-1">Change email address</h2>
      <p class="text-sm text-gray-500 mb-4">
        Do this while you still have access to your current email. A verification link will be sent to your new address.
      </p>
      <div class="flex gap-3">
        <input
          v-model="newEmail"
          type="email"
          placeholder="New email address"
          class="flex-1 border rounded-lg px-4 py-2.5 text-sm"
        />
        <button
          @click="changeEmail"
          :disabled="!newEmail || emailLoading"
          class="px-5 py-2.5 bg-black text-white text-sm rounded-lg disabled:opacity-40"
        >
          {{ emailLoading ? 'Sending...' : 'Update' }}
        </button>
      </div>
      <p v-if="emailSuccess" class="text-sm text-green-600 mt-2">
        Check your new inbox for a verification link.
      </p>
      <p v-if="emailError" class="text-sm text-red-500 mt-2">{{ emailError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const identities = ref<any[]>([])
const linking = ref(false)
const newEmail = ref("")
const emailLoading = ref(false)
const emailSuccess = ref(false)
const emailError = ref("")

const googleIdentity = computed(() =>
  identities.value.find((i) => i.provider === "google")
)

onMounted(async () => {
  const { data } = await supabase.auth.getUserIdentities()
  identities.value = data?.identities ?? []
})

async function connectGoogle() {
  linking.value = true
  const { error } = await supabase.auth.linkIdentity({ provider: "google" })
  // Supabase redirects to Google — on return, identity list will include Google
  if (error) {
    useToast().error("Could not connect Google account.")
    linking.value = false
  }
}

async function unlinkGoogle() {
  if (!googleIdentity.value) return
  linking.value = true
  const { error } = await supabase.auth.unlinkIdentity(googleIdentity.value)
  if (error) {
    useToast().error("Could not remove Google account.")
  } else {
    identities.value = identities.value.filter((i) => i.provider !== "google")
  }
  linking.value = false
}

async function changeEmail() {
  emailLoading.value = true
  emailError.value = ""
  emailSuccess.value = false
  const { error } = await supabase.auth.updateUser({ email: newEmail.value })
  if (error) {
    console.error("[change-email]", error)  // full error in logs only — never expose to client
    emailError.value = "Could not update email. Please try again."
  } else {
    emailSuccess.value = true
    newEmail.value = ""
  }
  emailLoading.value = false
}
</script>
```

**Supabase config required:**
- Dashboard → Authentication → Providers → Google: enable, add OAuth client ID + secret
- Dashboard → Authentication → URL Configuration: add `https://your-domain.com/confirm` to redirect allow list
- Enable "Allow linking identities" in Auth settings (off by default)

**Definition of done:** Magic link user can connect their Google account from settings. Attempting `/login` with Google on the same email correctly lands them in their existing account, not a new one. Email change sends verification to new address.

---

### Step 3.6 — Account deletion + data export (GDPR)

Required before Phase 1 launch. GDPR Article 17 (right to erasure) + Article 20 (data portability). Processes deletion within 7 days (legal requires 30).

#### Account deletion

**Soft-delete model:** set `deleted_at` immediately, hard-purge after 30 days. Users have a 30-day grace period to cancel.

`pages/settings/account.vue` addition (danger zone section):
```vue
<div class="border border-destructive/30 rounded-xl p-5 space-y-3">
  <h3 class="font-semibold text-sm text-destructive">Delete account</h3>
  <p class="text-sm text-muted-foreground">
    Your account will be deactivated immediately. After 30 days, all your data — photos, videos, and memories — will be permanently deleted. This cannot be undone.
  </p>
  <p v-if="isOwner" class="text-sm font-medium text-amber-600">
    You own one or more circles. Transfer ownership or delete your circles before deleting your account.
  </p>
  <button
    v-else
    @click="requestDeletion"
    :disabled="deleting"
    class="text-sm font-medium text-destructive hover:underline disabled:opacity-40"
  >
    {{ deleting ? "Processing..." : "Delete my account" }}
  </button>
</div>
```

`server/api/account/delete.post.ts`:
```ts
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401 })

  // Block if user is an owner of any circle
  const { count: ownedCircles } = await supabase
    .from("CircleMember")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "owner")

  if ((ownedCircles ?? 0) > 0) {
    throw createError({
      statusCode: 400,
      message: "Transfer ownership or delete your circles before deleting your account.",
    })
  }

  const now = new Date().toISOString()
  await supabase
    .from("User")
    .update({ deleted_at: now, deletion_requested_at: now })
    .eq("id", user.id)

  // Revoke all sessions
  await supabase.auth.admin.signOut(user.id, "global")

  return { ok: true }
})
```

**Hard purge cron** — daily Edge Function:
```ts
// supabase/functions/purge-deleted-users/index.ts
// Triggered daily at 3am UTC via pg_cron
// SELECT users WHERE deleted_at < now() - INTERVAL '30 days'

for (const user of expiredUsers) {
  // 1. Delete storage objects (all objects with path prefix user.id/)
  const { data: objects } = await supabase.storage.from("memories-private").list(user.id)
  for (const obj of objects ?? []) {
    await supabase.storage.from("memories-private").remove([`${user.id}/${obj.name}`])
  }

  // 2. Update family memories: owner_user_id stays, but display name becomes "Deleted Member"
  //    (no action needed — RLS + soft delete on User handles this)

  // 3. Delete CircleMember records, personal Memory rows, AccountStorage
  //    Cascade handles most of this via ON DELETE CASCADE

  // 4. Hard delete User row (triggers cascade)
  await supabase.from("User").delete().eq("id", user.id)
  await supabase.auth.admin.deleteUser(user.id)
}
```

Register cron:
```sql
SELECT cron.schedule(
  'purge-deleted-users',
  '0 3 * * *',  -- 3am daily UTC
  $$SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/purge-deleted-users',
    headers := '{"Authorization": "Bearer [service_role_key]"}'::jsonb
  )$$
);
```

**Cancellation grace period** — until `deleted_at` is 30 days old, user can cancel:
```ts
// server/api/account/cancel-deletion.post.ts
await supabase
  .from("User")
  .update({ deleted_at: null, deletion_requested_at: null })
  .eq("id", user.id)
// Re-authenticate (user was signed out) — redirect to /login with a note
```

#### Data export

Async job — export can be gigabytes, synchronous generation would timeout.

`server/api/account/export.post.ts`:
```ts
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401 })

  // One active job per user
  const { data: existing } = await supabase
    .from("ExportJob")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .single()

  if (existing) {
    throw createError({ statusCode: 409, message: "An export is already in progress." })
  }

  await supabase.from("ExportJob").insert({ user_id: user.id })

  return { ok: true, message: "Export started — you'll receive a download link by email within a few minutes." }
})
```

`supabase/functions/process-export/index.ts`:
```ts
// Triggered by pg_net webhook on ExportJob INSERT, or polled every 5 minutes

// 1. Mark job as processing
await supabase.from("ExportJob").update({ status: "processing" }).eq("id", job.id)

// 2. Fetch all memories for user — join Circle for circle_name, User for uploaded_by
const { data: memories } = await supabase
  .from("Memory")
  .select("*, MemoryMedia(*), Circle!circle_id(name), User!owner_user_id(first_name, last_name)")
  .eq("owner_user_id", job.user_id)

// 3. Build zip: /YYYY-MM/memory-id/photo.jpg + metadata.json per memory
const JSZip = (await import("jszip")).default
const zip = new JSZip()

for (const memory of memories ?? []) {
  const folder = zip.folder(`${memory.memory_date.slice(0, 7)}/${memory.id}`)!
  const uploadedBy = memory.User
    ? `${memory.User.first_name ?? ""} ${memory.User.last_name ?? ""}`.trim()
    : "Unknown"
  const meta = {
    date: memory.memory_date,
    note: memory.note,
    milestone_label: memory.milestone_label,
    visibility: memory.visibility,
    circle_name: memory.Circle?.name ?? null,  // per design spec export metadata
    uploaded_by: uploadedBy,                   // per design spec export metadata
  }
  folder.file("metadata.json", JSON.stringify(meta, null, 2))

  for (const media of memory.MemoryMedia ?? []) {
    const { data: file } = await supabase.storage
      .from("memories-private")
      .download(media.storage_path)
    if (file) {
      const ext = media.storage_path.split(".").pop()
      folder.file(`media.${ext}`, await file.arrayBuffer())
    }
  }
}

// 4. Write zip to temp storage, generate signed URL (24h expiry)
const zipBuffer = await zip.generateAsync({ type: "arraybuffer" })
const exportPath = `exports/${job.user_id}/${job.id}.zip`
await supabase.storage.from("memories-private").upload(exportPath, zipBuffer, { contentType: "application/zip" })
const { data: signedUrl } = await supabase.storage
  .from("memories-private")
  .createSignedUrl(exportPath, 86400)

// 5. Update job + email link
const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString()
await supabase.from("ExportJob").update({
  status: "complete",
  download_url: signedUrl?.signedUrl,
  expires_at: expiresAt,
}).eq("id", job.id)

// Email lives in auth.users — use admin client to fetch (Edge Function has no user session)
const { data: authUser } = await supabase.auth.admin.getUserById(job.user_id)
const userEmail = authUser?.user?.email

const resend = new Resend(Deno.env.get("RESEND_API_KEY"))
if (userEmail) {
  await resend.emails.send({
    from: "Our Story <hello@our-story.tinybit.app>",
    to: userEmail,
    subject: "Your Our Story export is ready",
    html: `<p>Your data export is ready. <a href="${signedUrl?.signedUrl}">Download your memories</a> — link expires in 24 hours.</p>`,
  })
}
```

**Definition of done:** Request export from account settings → "Export started" message → email arrives within 5 minutes with download link → zip contains original media + metadata.json per memory. Requesting a second export while one is in-progress returns a clear error.

---

### Step 3.7 — Circle deletion (owner-only)

Warning screen → type-to-confirm → 30-day soft delete → email all members → hard purge at day 30. `Circle.deleted_at` and `Circle.deletion_initiated_by` are already in the initial schema — no new migration needed.

**`pages/circle/[id]/settings/delete.vue`** — two-phase confirmation UI:

```vue
<script setup lang="ts">
const route = useRoute()
const { family, members } = await useFamilySettings(route.params.id)
const confirmText = ref("")
const isConfirming = ref(false)

const canConfirm = computed(
  () => confirmText.value === family.value.name
)

async function initiateDelete() {
  await $fetch(`/api/circles/${family.value.id}/delete`, { method: "POST" })
  navigateTo("/")
}
</script>

<template>
  <div v-if="!isConfirming">
    <!-- Step 1: Warning screen -->
    <p>
      This will permanently delete {{ family.memoriesCount }} memories and
      remove all {{ members.length }} members. Members will be notified and
      have 30 days to export their own photos.
    </p>
    <Button variant="ghost" @click="navigateTo(`/circle/${family.id}/settings`)">
      Cancel
    </Button>
    <Button variant="destructive" @click="isConfirming = true">
      Delete circle →
    </Button>
  </div>

  <div v-else>
    <!-- Step 2: Type-to-confirm -->
    <p>Type <strong>{{ family.name }}</strong> to confirm deletion.</p>
    <Input v-model="confirmText" placeholder="Circle name" />
    <Button variant="destructive" :disabled="!canConfirm" @click="initiateDelete">
      Permanently delete
    </Button>
  </div>
</template>
```

**`server/api/circles/[id]/delete.post.ts`**:

```ts
import { serverSupabaseUser, serverSupabaseServiceRole } from "#supabase/server"
import { z } from "zod"

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized" })

  const circleId = z.string().uuid().parse(getRouterParam(event, "id"))
  const supabase = await serverSupabaseServiceRole(event)

  // Verify caller is the circle owner — ownership lives in CircleMember.role, NOT on Circle
  // Circle has no owner_user_id column; the owner is the CircleMember with role = "owner"
  const { data: ownerMembership } = await supabase
    .from("CircleMember")
    .select("role, User!user_id(first_name, last_name)")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .single()

  if (!ownerMembership || ownerMembership.role !== "owner")
    throw createError({ statusCode: 403, message: "Only the circle owner can delete it" })

  const ownerName = ownerMembership.User
    ? `${ownerMembership.User.first_name ?? ""} ${ownerMembership.User.last_name ?? ""}`.trim()
    : "The circle owner"

  const { data: circle } = await supabase
    .from("Circle")
    .select("id, name, deleted_at")
    .eq("id", circleId)
    .single()

  if (!circle) throw createError({ statusCode: 404 })

  if (circle.deleted_at)
    throw createError({ statusCode: 409, message: "Circle is already scheduled for deletion" })

  // Soft-delete: set deleted_at and record initiating owner
  await supabase
    .from("Circle")
    .update({
      deleted_at: new Date().toISOString(),
      deletion_initiated_by: user.id,
    })
    .eq("id", circleId)

  // Email all active members (Day 1 notification)
  const { data: members } = await supabase
    .from("CircleMember")
    .select("user_id, User!user_id(email, first_name, last_name)")
    .eq("circle_id", circleId)
    .eq("memorial_status", "active")

  const resend = new Resend(process.env.RESEND_API_KEY)
  for (const member of members ?? []) {
    await resend.emails.send({
      from: "Our Story <hello@our-story.tinybit.app>",
      to: member.User.email,
      subject: `${circle.name} has been deleted — export your photos within 30 days`,
      html: `<p>${ownerName} has deleted ${circle.name}. You have 30 days to export your own photos before they're gone. <a href="${process.env.NUXT_PUBLIC_SITE_URL}/circle/${circleId}/export">Export my photos →</a></p>`,
    })
  }

  return { ok: true }
})
```

**`supabase/functions/purge-deleted-circles/index.ts`** — daily cron, hard purge at day 30:

```ts
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

Deno.serve(async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: circles } = await supabase
    .from("Circle")
    .select("id")
    .not("deleted_at", "is", null)
    .lte("deleted_at", thirtyDaysAgo)

  for (const circle of circles ?? []) {
    // Delete storage objects for all memories
    const { data: media } = await supabase
      .from("MemoryMedia")
      .select("storage_path, Memory!memory_id(circle_id)")
      .eq("Memory.circle_id", circle.id)

    for (const item of media ?? []) {
      await supabase.storage.from("memories").remove([item.storage_path])
    }

    // Hard delete cascades to Memory, MemoryMedia, CircleMember via ON DELETE CASCADE
    await supabase.from("Circle").delete().eq("id", circle.id)
  }

  return new Response("ok")
})
```

**Recovery (within 30 days):** Owner can cancel deletion from account settings — clears `deleted_at` and `deletion_initiated_by`:

```ts
// server/api/circles/[id]/restore.post.ts
// Verify ownership via CircleMember (Circle has no owner_user_id column)
const { data: ownerCheck } = await supabase
  .from("CircleMember")
  .select("role")
  .eq("circle_id", circleId)
  .eq("user_id", user.id)
  .single()
if (!ownerCheck || ownerCheck.role !== "owner")
  throw createError({ statusCode: 403 })

await supabase
  .from("Circle")
  .update({ deleted_at: null, deletion_initiated_by: null })
  .eq("id", circleId)
```

**RLS:** Add a filter to every `Circle` SELECT policy: `.is("deleted_at", null)` — soft-deleted circles are invisible to all members immediately.

**Definition of done:** Owner taps "Delete circle" → sees memory count and member count → types circle name → circle disappears from all members' dashboards immediately → all members receive deletion email with export link → after 30 days the daily cron deletes all media and DB rows → circle cannot be restored after day 30.

---

### Step 3.8 — Data export: owner full-circle scope

The Step 3.6 export function queries `owner_user_id = job.user_id`, which exports only the requesting user's own uploads. Design spec: *"Owners can export the full circle — all members' memories, with attribution in metadata."* This step upgrades `process-export` to check the user's role and include the full circle when they are an owner.

**No schema change needed** — `ExportJob` already stores `user_id`. The role check is done at processing time.

**Modified `supabase/functions/process-export/index.ts`:**

```ts
// 1. Mark job as processing
await supabase.from("ExportJob").update({ status: "processing" }).eq("id", job.id)

// 2. Determine scope: owned circles → full circle; non-owned circles → own uploads only
const { data: memberships } = await supabase
  .from("CircleMember")
  .select("circle_id, role")
  .eq("user_id", job.user_id)
  .eq("memorial_status", "active")

const ownedCircleIds = (memberships ?? [])
  .filter(m => m.role === "owner")
  .map(m => m.circle_id)

// 3a. Full-circle export for owned circles — all contributors, circle name + attribution in metadata
let circleMemories: any[] = []
if (ownedCircleIds.length > 0) {
  const { data } = await supabase
    .from("Memory")
    .select("*, MemoryMedia(*), User!owner_user_id(first_name, last_name), Circle!circle_id(name)")
    .in("circle_id", ownedCircleIds)
  circleMemories = data ?? []
}

// 3b. Own-uploads-only for circles where the user is not the owner
// Include Circle and User joins so metadata.json has circle_name + uploaded_by (per design spec)
// If ownedCircleIds is empty, this returns all of the user's own memories (no exclusion needed)
let ownMemoriesQuery = supabase
  .from("Memory")
  .select("*, MemoryMedia(*), Circle!circle_id(name), User!owner_user_id(first_name, last_name)")
  .eq("owner_user_id", job.user_id)

if (ownedCircleIds.length > 0) {
  // Exclude memories already captured in the full-circle export above
  ownMemoriesQuery = ownMemoriesQuery.not("circle_id", "in", `(${ownedCircleIds.join(",")})`)
}
const { data: ownMemories } = await ownMemoriesQuery

// 4. Build zip
const JSZip = (await import("jszip")).default
const zip = new JSZip()

// Owner section: organised by circle → date → memory; includes circle_name + uploaded_by
for (const memory of circleMemories) {
  const uploadedBy = memory.User
    ? `${memory.User.first_name ?? ""} ${memory.User.last_name ?? ""}`.trim()
    : "Unknown"
  const folder = zip.folder(
    `circles/${memory.circle_id}/${memory.memory_date.slice(0, 7)}/${memory.id}`
  )!
  folder.file(
    "metadata.json",
    JSON.stringify(
      {
        date: memory.memory_date,
        note: memory.note,
        milestone_label: memory.milestone_label,
        visibility: memory.visibility,
        circle_name: memory.Circle?.name ?? null,  // per design spec export metadata
        uploaded_by: uploadedBy,                    // per design spec export metadata
      },
      null,
      2
    )
  )
  for (const media of memory.MemoryMedia ?? []) {
    const { data: file } = await supabase.storage
      .from("memories-private")
      .download(media.storage_path)
    if (file) {
      const ext = media.storage_path.split(".").pop()
      folder.file(`media.${ext}`, await file.arrayBuffer())
    }
  }
}

// Member section: user's own uploads from circles they don't own
for (const memory of ownMemories ?? []) {
  const uploadedBy = memory.User
    ? `${memory.User.first_name ?? ""} ${memory.User.last_name ?? ""}`.trim()
    : "Unknown"
  const folder = zip.folder(
    `my-memories/${memory.memory_date.slice(0, 7)}/${memory.id}`
  )!
  folder.file(
    "metadata.json",
    JSON.stringify(
      {
        date: memory.memory_date,
        note: memory.note,
        milestone_label: memory.milestone_label,
        visibility: memory.visibility,
        circle_name: memory.Circle?.name ?? null,  // per design spec export metadata
        uploaded_by: uploadedBy,                    // per design spec export metadata
      },
      null,
      2
    )
  )
  for (const media of memory.MemoryMedia ?? []) {
    const { data: file } = await supabase.storage
      .from("memories-private")
      .download(media.storage_path)
    if (file) {
      const ext = media.storage_path.split(".").pop()
      folder.file(`media.${ext}`, await file.arrayBuffer())
    }
  }
}

// 5. Write zip to temp storage, generate signed URL (24h expiry)
const zipBuffer = await zip.generateAsync({ type: "arraybuffer" })
const exportPath = `exports/${job.user_id}/${job.id}.zip`
await supabase.storage
  .from("memories-private")
  .upload(exportPath, zipBuffer, { contentType: "application/zip" })
const { data: signedUrl } = await supabase.storage
  .from("memories-private")
  .createSignedUrl(exportPath, 86400)

// 6. Fetch user email — email lives in auth.users, not public.User; use admin client
const { data: authUser } = await supabase.auth.admin.getUserById(job.user_id)
const userEmail = authUser?.user?.email

// 7. Update job + email link
const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString()
await supabase
  .from("ExportJob")
  .update({
    status: "complete",
    download_url: signedUrl?.signedUrl,
    expires_at: expiresAt,
  })
  .eq("id", job.id)

if (userEmail) {
  await resend.emails.send({
    from: "Our Story <hello@our-story.tinybit.app>",
    to: userEmail,
    subject: "Your Our Story export is ready",
    html: `<p>Your data export is ready. <a href="${signedUrl?.signedUrl}">Download your memories</a> — link expires in 24 hours.</p>`,
  })
}
```

> **Note:** `process-export` in Step 3.6 ends after step 4 (zip write + email). Replace that body with the implementation above — the Step 3.6 export API endpoint (`server/api/account/export.post.ts`) is unchanged; only the Edge Function body changes.

**Definition of done:** Member requests export → zip contains only their own uploads in `my-memories/`. Owner requests export → zip contains `circles/<circle-id>/` folders with every member's memories, each `metadata.json` includes `contributor_name`. Both paths confirmed manually before launch.

---

## Milestone 4: Onboarding & Circle Creation

### Step 4.1 — Onboarding flow pages

After first sign-in, new users should flow through onboarding. Check on the confirm page whether the user has a name set — if not, collect it first, then check for family membership.

`pages/confirm.vue` — update the redirect logic:
```ts
if (user.value) {
  const { data: profile } = await supabase
    .from("User")
    .select("first_name, last_name")
    .eq("id", user.value.id)
    .single()

  // Step 1: collect name if not set (magic link signup skips this)
  if (!profile?.first_name) {
    router.push("/onboarding/profile")
    return
  }

  // Step 2: check for existing circle membership
  const { data: membership } = await supabase
    .from("CircleMember")
    .select("id")
    .eq("user_id", user.value.id)
    .limit(1)
    .single()

  if (!membership) {
    router.push("/onboarding")
  } else {
    router.push("/")
  }
}
```

`pages/onboarding/profile.vue` — collect first + last name (new first step for magic link users):
```vue
<template>
  <div class="max-w-lg mx-auto p-8">
    <h1 class="text-2xl font-semibold mb-2">What's your name?</h1>
    <p class="text-gray-500 mb-8">Your circle will see this on memories you share.</p>

    <div class="flex gap-3 mb-4">
      <input
        v-model="firstName"
        type="text"
        placeholder="First name"
        class="flex-1 border rounded-lg px-4 py-3"
        autofocus
      />
      <input
        v-model="lastName"
        type="text"
        placeholder="Last name"
        class="flex-1 border rounded-lg px-4 py-3"
      />
    </div>

    <button
      @click="save"
      :disabled="!firstName || loading"
      class="w-full bg-black text-white rounded-lg py-3 disabled:opacity-40"
    >
      {{ loading ? "Saving..." : "Continue" }}
    </button>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()
const firstName = ref("")
const lastName = ref("")
const loading = ref(false)

async function save() {
  loading.value = true
  await supabase
    .from("User")
    .update({ first_name: firstName.value, last_name: lastName.value })
    .eq("id", user.value!.id)
  router.push("/onboarding")
  loading.value = false
}
</script>
```

Note: Google OAuth users may already have `first_name`/`last_name` set from `raw_user_meta_data` via the trigger — the profile step is skipped for them.

`pages/onboarding/index.vue` — Circle type picker:
```vue
<template>
  <div class="max-w-lg mx-auto p-8">
    <h1 class="text-2xl font-semibold mb-2">Who is this story for?</h1>
    <p class="text-gray-500 mb-8">We'll personalise your experience based on your group.</p>

    <div class="grid grid-cols-2 gap-3">
      <button
        v-for="type in circleTypes"
        :key="type.value"
        @click="select(type.value)"
        class="border rounded-xl p-4 text-left hover:border-black transition"
        :class="{ 'border-black bg-gray-50': selected === type.value }"
      >
        <div class="text-2xl mb-1">{{ type.emoji }}</div>
        <div class="font-medium text-sm">{{ type.label }}</div>
        <div class="text-xs text-gray-500 mt-0.5">{{ type.description }}</div>
      </button>
    </div>

    <button
      @click="next"
      :disabled="!selected"
      class="mt-8 w-full bg-black text-white rounded-lg py-3 disabled:opacity-40"
    >
      Continue
    </button>
  </div>
</template>

<script setup lang="ts">
const selected = ref("")
const router = useRouter()

const circleTypes = [
  { value: "parents", emoji: "👶", label: "New parents", description: "Baby milestones + growth" },
  { value: "couple", emoji: "👫", label: "Couple", description: "Relationship milestones" },
  { value: "family", emoji: "👨‍👩‍👧‍👦", label: "Family", description: "General family memories" },
  { value: "friends", emoji: "👯", label: "Friend group", description: "Trips, reunions, moments" },
  { value: "caregiving", emoji: "🧓", label: "Caregiving", description: "Health + life events" },
  { value: "travel", emoji: "🌍", label: "Travel group", description: "Adventures together" },
  { value: "solo", emoji: "📔", label: "Just me", description: "Personal timeline" },
  { value: "custom", emoji: "✏️", label: "Other", description: "Fully custom" },
]

function select(value: string) { selected.value = value }

function next() {
  useState("circleType").value = selected.value
  router.push("/onboarding/name")
}
</script>
```

`pages/onboarding/name.vue` — Name the circle:
```vue
<template>
  <div class="max-w-lg mx-auto p-8">
    <h1 class="text-2xl font-semibold mb-2">Name your circle</h1>
    <p class="text-gray-500 mb-8">This is what your members will see.</p>

    <input
      v-model="name"
      type="text"
      :placeholder="placeholder"
      class="w-full border rounded-lg px-4 py-3 mb-4 text-lg"
      autofocus
    />

    <button @click="createCircle" :disabled="!name || loading" class="w-full bg-black text-white rounded-lg py-3">
      {{ loading ? "Creating..." : "Create circle" }}
    </button>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()
const name = ref("")
const loading = ref(false)
const circleType = useState("circleType")

const placeholder = computed(() => {
  const map: Record<string, string> = {
    parents: "The Johnson Family",
    couple: "Sarah & Mike",
    friends: "Barcelona Trip Crew",
    solo: "My Story",
  }
  return map[circleType.value] ?? "Our Circle"
})

async function createCircle() {
  loading.value = true

  // Enforce tier-based circle ownership limit (Free = 1 circle owned)
  const { data: userRecord } = await supabase
    .from("User")
    .select("subscription_status")
    .eq("id", user.value!.id)
    .single()

  if (userRecord?.subscription_status === "free") {
    const { count } = await supabase
      .from("CircleMember")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.value!.id)
      .eq("role", "owner")

    if ((count ?? 0) >= 1) {
      errorMsg.value = "Free plan is limited to 1 circle. Upgrade to Plus for unlimited circles."
      loading.value = false
      return
    }
  }

  const { data: circle, error } = await supabase
    .from("Circle")
    .insert({ name: name.value, circle_type: circleType.value, created_by: user.value!.id })
    .select()
    .single()

  if (error || !circle) { loading.value = false; return }

  // Insert owner membership
  await supabase.from("CircleMember").insert({
    user_id: user.value!.id,
    circle_id: circle.id,
    role: "owner",
  })

  useState("currentCircleId").value = circle.id

  if (circleType.value === "solo") {
    router.push("/")  // Skip invite step for solo mode — persistent CTA shown on timeline instead
  } else {
    router.push("/onboarding/invite")
  }
  loading.value = false
}
</script>
```

**Solo mode UX rules** (applies when `circle_type = "solo"`):
- All memories default to `visibility: "private"` — no circle members to share with yet
- Collaborative features (challenges, guest uploads) are hidden until first member joins
- On This Day works identically — daily nostalgia for solo users is just as valuable
- Timeline shows a persistent soft CTA below the upload button: "Invite someone to your story →"
- Empty state copy: "Your personal story starts here. Just for you, until you're ready to share."

**Solo-to-circle upgrade** — fires when the first member accepts an invite:

`server/api/invites/[token]/accept.post.ts` addition (after CircleMember insert):
```ts
// Check if this was previously a solo circle with only one member (the owner)
const { count: memberCount } = await supabase
  .from("CircleMember")
  .select("*", { count: "exact", head: true })
  .eq("circle_id", invite.circle_id)

if (memberCount === 2) {
  // First member just joined — return upgrade flag so client can show prompt
  return { ok: true, circleId: invite.circle_id, firstMember: true }
}
```

`pages/invite/[token].vue` — handle upgrade:
```ts
const result = await $fetch(`/api/invites/${token}/accept`, { method: "POST" })
inviteCookie.value = null
if (result.circleId) {
  const welcomeQuery = result.firstMember ? "&firstMember=1" : "&welcome=1"
  router.push(`/?circle=${result.circleId}${welcomeQuery}`)
}
```

`pages/index.vue` — show upgrade prompt if `?firstMember=1`:
```vue
<div v-if="route.query.firstMember" class="mx-4 mb-4 p-4 bg-card rounded-[12px] border border-border">
  <p class="font-semibold text-sm text-foreground mb-1">Your story just got bigger 🎉</p>
  <p class="text-sm text-muted-foreground mb-3">
    A new member joined. Want to share any of your memories with them?
  </p>
  <button @click="openMemoryVisibilitySheet" class="text-sm font-semibold text-primary">
    Share memories →
  </button>
</div>
```

**Definition of done (solo mode):** Solo user sees private timeline with no invite prompts during onboarding. Persistent "Invite someone" CTA visible on timeline. After first member joins, "Your story just got bigger" banner appears with option to share existing memories.

`pages/onboarding/invite.vue` — Invite first member (skippable):
```vue
<template>
  <div class="max-w-lg mx-auto p-8">
    <h1 class="text-2xl font-semibold mb-2">Invite your first member</h1>
    <p class="text-gray-500 mb-8">They'll get an email with a link to join your story.</p>

    <input v-model="email" type="email" placeholder="their@email.com" class="w-full border rounded-lg px-4 py-3 mb-4" />

    <button @click="sendInvite" :disabled="!email || loading" class="w-full bg-black text-white rounded-lg py-3 mb-3">
      {{ loading ? "Sending..." : "Send invite" }}
    </button>

    <button @click="skip" class="w-full text-gray-500 py-3">
      Skip for now — invite later
    </button>
  </div>
</template>

<script setup lang="ts">
const email = ref("")
const loading = ref(false)
const router = useRouter()
const circleId = useState("currentCircleId")

async function sendInvite() {
  loading.value = true
  await $fetch("/api/circles/invite", {
    method: "POST",
    body: { circleId: circleId.value, email: email.value },
    // role defaults to "member" — onboarding invite is always a member invite.
    // Caregiver and admin invites are sent from circle settings (post-onboarding),
    // where the invite form includes a role picker: "Member" | "Admin" | "Caregiver".
    // Pass role: "caregiver" or role: "admin" from that settings UI to use the same endpoint.
  })
  router.push("/onboarding/upload")
  loading.value = false
}

function skip() { router.push("/onboarding/upload") }
</script>
```

### Step 4.2 — Invite API + email

`server/api/circles/invite.post.ts`:
```ts
import { Resend } from "resend"
import { serverSupabaseClient, serverSupabaseServiceRole } from "#supabase/server"

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const { circleId, email, role = "member" } = await readBody(event)
  // role: "admin" | "member" | "caregiver" — defaults to "member"
  // Caregiver invites are a separate UI path (circle settings → "Invite caregiver") but use this same endpoint.
  // The acceptance flow (Step 4.3) reads invite.role and sets CircleMember.role — so the role set here IS the role they join with.

  if (!user) throw createError({ statusCode: 401 })

  // Validate role value
  const validRoles = ["admin", "member", "caregiver"] as const
  if (!validRoles.includes(role)) {
    throw createError({ statusCode: 400, message: "Invalid role. Must be admin, member, or caregiver." })
  }

  // Verify sender is owner or admin
  const { data: membership } = await supabase
    .from("CircleMember")
    .select("role")
    .eq("user_id", user.id)
    .eq("circle_id", circleId)
    .single()

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw createError({ statusCode: 403, message: "Only owners and admins can invite" })
  }

  // Only owners can send admin invites
  if (role === "admin" && membership.role !== "owner") {
    throw createError({ statusCode: 403, message: "Only the circle owner can invite admins." })
  }

  // Enforce per-tier member cap (Free = 10, Plus = 20, Pro = unlimited)
  const { data: circle } = await supabase
    .from("Circle")
    .select("subscription_status")
    .eq("id", circleId)
    .single()

  const tierMemberCap: Record<string, number> = { free: 10, plus: 20, pro: Infinity, grace: 20 }
  const maxMembers = tierMemberCap[circle?.subscription_status ?? "free"] ?? 10

  const { count: currentMemberCount } = await supabase
    .from("CircleMember")
    .select("*", { count: "exact", head: true })
    .eq("circle_id", circleId)

  if ((currentMemberCount ?? 0) >= maxMembers) {
    const upgradeMsg = circle?.subscription_status === "plus"
      ? "This circle has reached the 20-member Plus limit. Upgrade to Pro for unlimited members."
      : "This circle has reached the 10-member Free limit. Upgrade to Plus for up to 20 members."
    throw createError({ statusCode: 403, message: upgradeMsg })
  }

  // Check max pending invites (10 per circle)
  const { count } = await supabase
    .from("CircleInvite")
    .select("*", { count: "exact", head: true })
    .eq("circle_id", circleId)
    .eq("status", "pending")

  if ((count ?? 0) >= 10) {
    throw createError({ statusCode: 429, message: "Max 10 pending invites per circle" })
  }

  // Create invite — preserve role so Step 4.3 acceptance inserts the correct CircleMember.role
  const { data: invite } = await supabase
    .from("CircleInvite")
    .insert({ circle_id: circleId, email, role })
    .select()
    .single()

  // Fetch circle name + sender name for email
  // Note: uses a separate variable (circleForEmail) — `circle` is already declared above for subscription_status
  const { data: circleForEmail } = await supabase.from("Circle").select("name").eq("id", circleId).single()
  const { data: sender } = await supabase.from("User").select("first_name, last_name").eq("id", user.id).single()
  const senderName = sender ? `${sender.first_name} ${sender.last_name}`.trim() : "Someone"

  // Send invite email via Resend
  const resend = new Resend(useRuntimeConfig().resendApiKey)
  await resend.emails.send({
    from: "Our Story <hello@our-story.tinybit.app>",
    to: email,
    subject: `${senderName} started your story on Our Story`,
    html: buildInviteEmail({
      senderName,
      circleName: circleForEmail?.name ?? "a circle",
      inviteUrl: `${process.env.APP_URL}/invite/${invite!.token}`,
    }),
  })

  return { ok: true }
})

function buildInviteEmail({ senderName, circleName, inviteUrl }: {
  senderName: string
  circleName: string
  inviteUrl: string
}) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="margin: 0 0 8px;">${senderName} started your story</h2>
      <p style="color: #666; margin: 0 0 32px;">${senderName} has created <strong>${circleName}</strong> on Our Story — a private space to share memories, milestones, and moments.</p>
      <a href="${inviteUrl}" style="display: block; background: #000; color: #fff; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
        See your story →
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 32px; text-align: center;">
        No account needed to look. Join to add your own memories.<br/>
        Private, invite-only · No ads
      </p>
    </div>
  `
}
```

### Step 4.3 — Invite acceptance flow

`pages/invite/[token].vue`:
```vue
<script setup lang="ts">
const route = useRoute()
const user = useSupabaseUser()
const router = useRouter()
const token = route.params.token as string

// Store token in cookie so it survives the auth redirect
const inviteCookie = useCookie("pending_invite_token", { maxAge: 60 * 60 * 24 * 7 })

onMounted(async () => {
  if (!user.value) {
    // Not logged in — store token and redirect to login
    inviteCookie.value = token
    router.push("/login")
    return
  }

  // Logged in — accept invite
  await acceptInvite()
})

async function acceptInvite() {
  const result = await $fetch(`/api/invites/${token}/accept`, { method: "POST" })
  inviteCookie.value = null
  if (result.circleId) {
    router.push(`/?circle=${result.circleId}&welcome=1`)
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-gray-500">Joining your circle...</p>
  </div>
</template>
```

`server/api/invites/[token]/accept.post.ts`:
```ts
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const token = getRouterParam(event, "token")

  if (!user) throw createError({ statusCode: 401 })

  const { data: invite } = await supabase
    .from("CircleInvite")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single()

  if (!invite) throw createError({ statusCode: 410, message: "invite_expired" })
  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from("CircleInvite").update({ status: "expired" }).eq("id", invite.id)
    throw createError({ statusCode: 410, message: "invite_expired" })
  }

  // Add member
  await supabase.from("CircleMember").upsert({
    user_id: user.id,
    circle_id: invite.circle_id,
    role: invite.role,
  })

  await supabase.from("CircleInvite").update({ status: "accepted" }).eq("id", invite.id)

  return { ok: true, circleId: invite.circle_id }
})
```

**Invited member welcome screen** — shown when `?welcome=1` is in the URL after accepting an invite. Goal: get the invited member to upload in their first session — this is the activation event that determines long-term retention.

`components/InvitedMemberWelcome.vue`:
```vue
<template>
  <div v-if="show" class="fixed inset-0 z-50 bg-background flex flex-col">
    <div class="flex-1 overflow-y-auto px-4 pt-8 pb-4">
      <h1 class="font-display text-2xl font-bold text-foreground mb-1">
        Welcome to {{ familyName }}!
      </h1>
      <p class="text-sm text-muted-foreground mb-6">
        Here's what the circle has been sharing.
      </p>

      <!-- 3 most recent circle memories as a preview carousel -->
      <div class="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        <div
          v-for="memory in recentMemories"
          :key="memory.id"
          class="flex-shrink-0 w-48 rounded-[12px] overflow-hidden border border-border bg-card"
        >
          <img
            v-if="memory.MemoryMedia?.[0]"
            :src="memory.MemoryMedia[0].thumbnailUrl"
            class="w-full h-32 object-cover"
          />
          <div class="px-3 py-2">
            <p class="text-xs font-medium text-foreground line-clamp-2">{{ memory.note ?? 'A memory' }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">
              {{ formatDate(memory.memory_date) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Milestone highlight if any recent milestone exists -->
      <div v-if="recentMilestone" class="mt-4 p-3 bg-amber-50 rounded-[12px] border border-amber-100">
        <p class="text-sm font-medium text-amber-900">
          🎉 {{ recentMilestone.milestone_label }} — added recently
        </p>
      </div>
    </div>

    <div class="px-4 pb-8 pt-4 border-t border-border">
      <button
        @click="uploadFirst"
        class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold mb-3"
      >
        Add your first memory to the story →
      </button>
      <button @click="skip" class="w-full text-muted-foreground text-sm py-2">
        Browse the timeline first
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ circleId: string; circleName: string }>()
const emit = defineEmits<{ dismiss: [] }>()

const show = ref(true)
const recentMemories = ref<any[]>([])
const recentMilestone = computed(() =>
  recentMemories.value.find((m) => m.milestone_label)
)

onMounted(async () => {
  const data = await $fetch("/api/timeline", {
    query: { circleId: props.circleId, limit: 3 }
  })
  recentMemories.value = data.memories
})

function uploadFirst() {
  show.value = false
  emit("dismiss")
  // UploadMemory button click triggered from parent
}

function skip() {
  show.value = false
  emit("dismiss")
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
</script>
```

Wire into `pages/index.vue`:
```vue
<InvitedMemberWelcome
  v-if="route.query.welcome === '1' && currentCircle"
  :circle-id="currentCircleId"
  :circle-name="currentCircle.name"
  @dismiss="clearWelcomeQuery"
/>
```

**Definition of done:** Invite email arrives, clicking link on a new device → login → auto-joins circle → sees welcome screen with 3 most recent memories and any milestone highlights → "Add your first memory" CTA → lands on upload flow.

---

### Step 4.4 — Value proposition screens

Shown once on first open after signup. 3 swipeable screens, skippable. Store a `onboarding_vp_seen` flag in `localStorage` — never shown again after first dismiss.

`pages/onboarding/welcome.vue`:
```vue
<template>
  <div class="fixed inset-0 bg-background z-50 flex flex-col">
    <div class="flex-1 relative overflow-hidden">
      <!-- Screen 1 -->
      <div v-if="step === 0" class="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <!-- Visual: mock WhatsApp scroll with photo buried -->
        <div class="w-full max-w-xs rounded-[16px] overflow-hidden bg-card border border-border mb-8 opacity-80">
          <div v-for="i in 6" :key="i" class="px-4 py-2.5 border-b border-border last:border-0 text-xs text-muted-foreground">
            <span v-if="i === 3" class="text-foreground font-medium">📸 Photo</span>
            <span v-else>{{ ["Hey everyone!", "Did you see the game?", "Running late", "Can't make it", "😂😂", "See you Saturday"][i-1] }}</span>
          </div>
        </div>
        <h2 class="font-display text-2xl font-bold text-foreground mb-3">Photos get buried.</h2>
        <p class="text-sm text-muted-foreground leading-relaxed">Group chats are noisy. That moment deserved better.</p>
      </div>

      <!-- Screen 2 -->
      <div v-else-if="step === 1" class="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <!-- Visual: clean timeline card with note + reaction -->
        <div class="w-full max-w-xs rounded-[16px] overflow-hidden bg-card border border-border mb-8">
          <div class="w-full h-36 bg-secondary" />
          <div class="px-4 py-3">
            <p class="text-sm font-medium text-foreground">First steps at grandma's house</p>
            <p class="text-xs text-muted-foreground mt-0.5">10 months · ❤️ 3 reactions</p>
          </div>
        </div>
        <h2 class="font-display text-2xl font-bold text-foreground mb-3">Your story, beautifully kept.</h2>
        <p class="text-sm text-muted-foreground leading-relaxed">Notes, milestones, and reactions — not just another folder of files.</p>
      </div>

      <!-- Screen 3 -->
      <div v-else class="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <div class="text-5xl mb-8">📱💻</div>
        <h2 class="font-display text-2xl font-bold text-foreground mb-3">Works for everyone.</h2>
        <p class="text-sm text-muted-foreground leading-relaxed">iPhone, Android, or just an email link. No one gets left out — even grandparents who don't have the app.</p>
      </div>
    </div>

    <!-- Dots + CTA -->
    <div class="px-6 pb-8 pt-4">
      <div class="flex justify-center gap-1.5 mb-6">
        <div v-for="i in 3" :key="i"
          class="h-1.5 rounded-full transition-all duration-200"
          :class="step === i - 1 ? 'w-6 bg-primary' : 'w-1.5 bg-border'"
        />
      </div>
      <button
        @click="advance"
        class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        {{ step < 2 ? 'Next' : 'Start your story →' }}
      </button>
      <button v-if="step < 2" @click="skip" class="w-full text-muted-foreground text-sm py-3 mt-1">
        Skip
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const step = ref(0)
const router = useRouter()

function advance() {
  if (step.value < 2) { step.value++ } else { complete() }
}

function skip() { complete() }

function complete() {
  localStorage.setItem('onboarding_vp_seen', '1')
  router.push('/onboarding')
}
</script>
```

Show this page from `confirm.vue` when `localStorage.getItem('onboarding_vp_seen')` is null — insert before the circle type picker step.

**Definition of done:** First-time user sees 3 screens before circle setup. Returning user never sees them. Skipping works. Copy matches the design spec exactly.

---

### Step 4.5 — Viewer-role UX

Expand the existing `pages/view/[token].vue` from a plain read-only timeline into an optimised experience for viewer-role users — anyone accessing via a JWT link without an account. This applies to the **role**, not to any assumed age group. A tech-savvy family member should be invited as a full member; this UX is for people who will never create an account.

**First-open splash** (shown once per viewer session):
```vue
<!-- Shown before timeline if no 'view_seen' cookie -->
<div class="fixed inset-0 z-50 flex flex-col">
  <!-- Full-bleed hero: most recent memory photo -->
  <div class="flex-1 relative">
    <img :src="heroMemory.thumbnailUrl" class="w-full h-full object-cover" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
    <div class="absolute bottom-0 left-0 right-0 p-8 text-white">
      <p class="text-lg font-semibold mb-1">{{ senderName }} created this so you'd never miss a moment.</p>
      <p class="text-sm opacity-80">No account needed — just scroll.</p>
    </div>
  </div>
  <div class="bg-background px-6 pb-8 pt-4">
    <button @click="enterTimeline" class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold">
      See the memories →
    </button>
  </div>
</div>
```

**Swipe navigation** — use `@vueuse/core`'s `useSwipe` to enable left/right between individual memories (default view):
```ts
const { direction } = useSwipe(timelineRef)
watch(direction, (dir) => {
  if (dir === 'left') nextMemory()
  if (dir === 'right') prevMemory()
})
```

**Guest reaction endpoint** — see Step 12.1 email reaction endpoint. The same `POST /api/reactions/guest` endpoint is used for both in-app view reactions and email reactions.

**Grandparent referral prompt** — after viewer has reacted to 3+ memories:
```vue
<div v-if="reactionCount >= 3 && !referralDismissed" class="mx-4 mb-4 p-4 bg-card rounded-[12px] border border-border">
  <p class="text-sm text-foreground mb-2">Know another grandparent who'd love this?</p>
  <a href="/for-grandparents" class="text-sm font-semibold text-primary">Share the app with them →</a>
  <button @click="referralDismissed = true" class="ml-3 text-xs text-muted-foreground">Not now</button>
</div>
```

**Definition of done:** Viewer-role user opens view-only link → full-screen splash with most recent photo and sender's name → tap through to swipeable timeline → can heart any memory without an account → after 3 hearts, referral prompt appears. A family member invited as a full member never sees this flow — they use the standard app.

---

## Milestone 5: Media Upload

This is the hardest milestone. Take it step by step.

### Step 5.1 — Upload Edge Function

`supabase/functions/upload-media/index.ts`:
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js"

const MAX_PHOTO_BYTES = 50 * 1024 * 1024   // 50 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024  // 500 MB

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const authHeader = req.headers.get("Authorization")
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace("Bearer ", ""))
  if (!user) return new Response("Unauthorized", { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File
  const circleId = formData.get("circleId") as string
  const note = formData.get("note") as string | null
  const memoryDate = formData.get("memoryDate") as string | null

  // File size check
  const isVideo = file.type.startsWith("video/")
  const maxSize = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES
  if (file.size > maxSize) {
    return Response.json({ error: "file_too_large" }, { status: 413 })
  }

  // Storage quota check
  const { data: storage } = await supabase
    .from("AccountStorage")
    .select("total_used_bytes, total_quota_bytes, bonus_bytes")
    .eq("user_id", user.id)
    .single()

  const { data: userRecord } = await supabase
    .from("User")
    .select("platform_role")
    .eq("id", user.id)
    .single()

  if (userRecord?.platform_role !== "platform_admin") {
    const quota = (storage?.total_quota_bytes ?? 0) + (storage?.bonus_bytes ?? 0)
    const used = storage?.total_used_bytes ?? 0
    if (used + file.size > quota) {
      return Response.json({ error: "storage_full" }, { status: 413 })
    }
  }

  // Verify user is a member of this circle
  const { data: membership } = await supabase
    .from("CircleMember")
    .select("id, role")  // role needed to enforce caregiver visibility rule below
    .eq("user_id", user.id)
    .eq("circle_id", circleId)
    .single()

  if (!membership) return new Response("Forbidden", { status: 403 })

  // Caregivers must always upload as circle-visible — spec: "uploads by caregiver: always
  // visibility='circle', cannot set private." The RESTRICTIVE "caregiver cannot read private
  // memories" RLS policy would also make a private caregiver upload invisible to the caregiver
  // themselves, so this is both a spec requirement and a correctness requirement.
  const effectiveVisibility = membership.role === "caregiver" ? "circle" : "private"

  // Upload file to private storage bucket
  const ext = file.name.split(".").pop()
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`
  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from("memories-private")
    .upload(storagePath, fileBuffer, { contentType: file.type })

  if (uploadError) {
    console.error("[upload-media] storage upload failed", uploadError)
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 })
  }

  // Insert Memory row
  const { data: memory } = await supabase
    .from("Memory")
    .insert({
      owner_user_id: user.id,
      circle_id: circleId,
      visibility: effectiveVisibility,  // "circle" for caregivers; "private" for all others (shared explicitly)
      note: note ?? null,
      memory_date: memoryDate ?? new Date().toISOString(),
    })
    .select()
    .single()

  // Insert MemoryMedia row (never expose storage_path to client)
  await supabase.from("MemoryMedia").insert({
    memory_id: memory!.id,
    storage_path: storagePath,
    file_size: file.size,
    media_type: isVideo ? "video" : "photo",
  })

  // Update storage usage
  await supabase
    .from("AccountStorage")
    .update({ total_used_bytes: (storage?.total_used_bytes ?? 0) + file.size })
    .eq("user_id", user.id)

  return Response.json({ ok: true, memoryId: memory!.id })
})
```

### Step 5.2 — Upload UI component

`components/UploadMemory.vue`:
```vue
<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime"
      class="hidden"
      @change="onFileSelected"
    />

    <button @click="fileInput?.click()" class="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg">
      + Add memory
    </button>

    <!-- Upload modal -->
    <div v-if="file" class="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6">
        <img v-if="previewUrl && !isVideo" :src="previewUrl" class="w-full h-48 object-cover rounded-lg mb-4" />
        <video v-if="previewUrl && isVideo" :src="previewUrl" class="w-full h-48 object-cover rounded-lg mb-4" muted />

        <textarea
          v-model="note"
          placeholder="Add a note... (optional)"
          class="w-full border rounded-lg p-3 mb-3 resize-none"
          rows="2"
        />

        <div class="flex items-center gap-2 mb-4">
          <label class="text-sm text-gray-600">When was this?</label>
          <input v-model="memoryDate" type="date" class="border rounded px-2 py-1 text-sm" />
        </div>

        <!-- Progress bar -->
        <div v-if="uploading" class="w-full bg-gray-100 rounded-full h-2 mb-4">
          <div class="bg-black h-2 rounded-full transition-all" :style="{ width: `${progress}%` }" />
        </div>

        <div class="flex gap-3">
          <button @click="cancel" class="flex-1 border rounded-lg py-3">Cancel</button>
          <button @click="upload" :disabled="uploading" class="flex-1 bg-black text-white rounded-lg py-3">
            {{ uploading ? `Uploading ${progress}%` : "Upload" }}
          </button>
        </div>

        <p v-if="error" class="text-red-500 text-sm mt-2 text-center">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ circleId: string }>()
const emit = defineEmits<{ uploaded: [memoryId: string] }>()

const supabase = useSupabaseClient()
const fileInput = ref<HTMLInputElement>()
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const note = ref("")
const memoryDate = ref(new Date().toISOString().split("T")[0])
const uploading = ref(false)
const progress = ref(0)
const error = ref("")

const isVideo = computed(() => file.value?.type.startsWith("video/") ?? false)

const MAX_PHOTO_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_BYTES = 500 * 1024 * 1024

function onFileSelected(e: Event) {
  const selected = (e.target as HTMLInputElement).files?.[0]
  if (!selected) return

  // Client-side size check (before upload)
  const maxSize = selected.type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES
  if (selected.size > maxSize) {
    error.value = selected.type.startsWith("video/")
      ? "Videos must be under 500 MB"
      : "Photos must be under 50 MB"
    return
  }

  file.value = selected
  previewUrl.value = URL.createObjectURL(selected)
  memoryDate.value = new Date().toISOString().split("T")[0]
}

async function upload() {
  if (!file.value) return
  uploading.value = true
  progress.value = 0
  error.value = ""

  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token

  const formData = new FormData()
  formData.append("file", file.value)
  formData.append("circleId", props.circleId)
  formData.append("note", note.value)
  formData.append("memoryDate", `${memoryDate.value}T00:00:00Z`)

  const xhr = new XMLHttpRequest()
  xhr.open("POST", `${useRuntimeConfig().public.supabaseUrl}/functions/v1/upload-media`)
  xhr.setRequestHeader("Authorization", `Bearer ${token}`)

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 100)
  }

  xhr.onload = () => {
    const result = JSON.parse(xhr.responseText)
    if (xhr.status === 200) {
      emit("uploaded", result.memoryId)
      cancel()
    } else {
      error.value = result.error === "storage_full"
        ? "Your storage is full — upgrade to continue uploading"
        : "Upload failed, please try again"
    }
    uploading.value = false
  }

  xhr.onerror = () => {
    error.value = "Upload failed, please try again"
    uploading.value = false
  }

  xhr.send(formData)
}

function cancel() {
  file.value = null
  previewUrl.value = null
  note.value = ""
  error.value = ""
  uploading.value = false
  progress.value = 0
  if (fileInput.value) fileInput.value.value = ""
}
</script>
```

**Definition of done:** Upload a photo → it appears in the DB → storage usage increments → uploading past quota shows error.

---

### Step 5.3 — Batch upload with automatic mem_date detection

No Edge Function changes — each file is a separate `POST /functions/v1/upload-media` request, queued sequentially. This is entirely a client-side UX upgrade to `UploadMemory.vue`.

Install the EXIF parsing library:
```bash
pnpm add exifr
```

`exifr` is browser-compatible (~60 KB gzipped) and handles JPEG, HEIC, WebP, and TIFF. It returns `DateTimeOriginal` as a parsed `Date` object.

**Date detection priority:**
1. EXIF `DateTimeOriginal` — actual shutter moment, labeled "from photo" in UI
2. EXIF `DateTimeDigitized` — fallback if `DateTimeOriginal` absent, also labeled "from photo"
3. `file.lastModified` — used for videos and when EXIF parsing fails (no label shown)

```ts
// composables/useExifDate.ts
export async function extractMemoryDate(file: File): Promise<{ date: string; source: 'exif' | 'file_modified' }> {
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

**Updated `components/UploadMemory.vue`** — key changes from the single-upload version:

- File input gets `multiple` attribute
- `onFilesSelected` calls `extractMemoryDate` for every file in parallel, then populates `items[]`
- Each item: `{ file, previewUrl, isVideo, memoryDate, dateSource, status, progress, error }`
- Batch review sheet shows a scrollable list: thumbnail + filename + date picker + "from photo" badge
- "Upload N" button uploads sequentially; per-item status overlays (spinner with circular progress, ✓ on done, ! on error)
- Overall progress bar tracks `doneCount / total`
- `storage_full` error skips all remaining pending items; other errors continue to next item
- Emits `uploaded(memoryId)` for each successful file — same contract as single-upload
- "Done" button appears when all items finish (all succeeded or all attempted)

```ts
// Sequential upload loop
async function uploadAll() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    items.value.forEach(i => { if (i.status === 'pending') { i.status = 'error'; i.error = 'Session expired' } })
    return
  }

  for (const item of items.value) {
    if (item.status !== 'pending') continue
    const memoryId = await uploadItem(item, token)
    if (memoryId) {
      emit('uploaded', memoryId)
    } else if (item.error === 'Storage full') {
      // Abort remaining items — no point continuing
      items.value.forEach(i => { if (i.status === 'pending') { i.status = 'error'; i.error = 'Storage full' } })
      break
    }
  }
}
```

**Definition of done:** Select 5 photos → sheet opens with auto-detected dates (EXIF where available, labeled "from photo") → user can edit any date → upload all → per-item progress → all appear in DB with correct `memory_date`. Selecting a video defaults to `file.lastModified` with no label.

---

## Milestone 6: Timeline

### Step 6.1 — Signed URL API

`server/api/timeline.get.ts`:
```ts
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const query = getQuery(event)
  const circleId = query.circleId as string
  const cursor = query.cursor as string | undefined  // "memory_date,id"

  if (!user) throw createError({ statusCode: 401 })

  let dbQuery = supabase
    .from("Memory")
    .select("*, MemoryMedia(*), User!owner_user_id(first_name, last_name, avatar_url), MemoryReaction(*), MemoryComment(count)")
    .eq("circle_id", circleId)
    .in("visibility", ["circle"])  // private memories handled separately
    .order("memory_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(20)

  if (cursor) {
    const [cursorDate, cursorId] = cursor.split(",")
    dbQuery = dbQuery.lt("memory_date", cursorDate)
      .or(`memory_date.lt.${cursorDate},and(memory_date.eq.${cursorDate},id.lt.${cursorId})`)
  }

  const { data: memories, error } = await dbQuery
  if (error) {
    console.error("[timeline] query failed", error)
    throw createError({ statusCode: 500, message: "Failed to load timeline. Please try again." })
  }

  // Generate signed URLs for all media — never return storage_path
  const memoriesWithUrls = await Promise.all(
    (memories ?? []).map(async (memory) => {
      const mediaWithUrls = await Promise.all(
        (memory.MemoryMedia ?? []).map(async (media: any) => {
          const { data } = await supabase.storage
            .from("memories-private")
            .createSignedUrl(media.storage_path, 3600)  // 1h expiry

          const { data: thumb } = await supabase.storage
            .from("memories-private")
            .createSignedUrl(media.storage_path, 86400, {  // 24h for thumbnails
              transform: { width: 800, format: "webp", quality: 85 }
            })

          const { storage_path, ...safeMedia } = media  // strip storage_path from response
          return { ...safeMedia, url: data?.signedUrl, thumbnailUrl: thumb?.signedUrl }
        })
      )
      return { ...memory, MemoryMedia: mediaWithUrls }
    })
  )

  const lastMemory = memoriesWithUrls[memoriesWithUrls.length - 1]
  const nextCursor = lastMemory
    ? `${lastMemory.memory_date},${lastMemory.id}`
    : null

  return { memories: memoriesWithUrls, nextCursor }
})
```

### Step 6.2 — Timeline UI

`pages/index.vue`:
```vue
<template>
  <div class="max-w-2xl mx-auto">
    <header class="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
      <h1 class="font-semibold text-lg">{{ currentCircle?.name ?? "Our Story" }}</h1>
      <UploadMemory :circle-id="currentCircleId" @uploaded="onUploaded" />
    </header>

    <div class="divide-y">
      <MemoryCard
        v-for="memory in memories"
        :key="memory.id"
        :memory="memory"
        @shared="refreshTimeline"
      />
    </div>

    <!-- Load more trigger -->
    <div ref="loadMoreTrigger" class="h-8" />

    <div v-if="loading" class="flex justify-center py-8">
      <div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  </div>
</template>

<script setup lang="ts">
const currentCircleId = useState("currentCircleId")
const memories = ref<any[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadMoreTrigger = ref<HTMLElement>()

async function fetchTimeline(cursor?: string) {
  if (loading.value) return
  loading.value = true

  const data = await $fetch("/api/timeline", {
    query: { circleId: currentCircleId.value, cursor }
  })

  if (cursor) {
    memories.value.push(...data.memories)
  } else {
    memories.value = data.memories
  }
  nextCursor.value = data.nextCursor
  loading.value = false
}

function onUploaded() { fetchTimeline() }
function refreshTimeline() { fetchTimeline() }

// Infinite scroll via IntersectionObserver
const { stop } = useIntersectionObserver(loadMoreTrigger, ([entry]) => {
  if (entry.isIntersecting && nextCursor.value && !loading.value) {
    fetchTimeline(nextCursor.value)
  }
})

onMounted(() => fetchTimeline())
onUnmounted(() => stop())
</script>
```

**Definition of done:** Timeline loads, scrolling to bottom loads more, newest first by `memory_date`. `storage_path` is never present in any API response.

---

## Milestone 7: Memory Features

### Step 7.1 — Share to circle (visibility toggle)

Add to `MemoryCard.vue`:
```vue
<button
  v-if="memory.visibility === 'private' && memory.owner_user_id === currentUser.id && currentUserRole !== 'caregiver'"
  @click="shareToCircle"
  class="text-sm text-blue-600 font-medium"
>
  Share to circle
</button>
```
> **Note:** The `currentUserRole !== 'caregiver'` guard is required because the upload Edge Function (Step 5.1) forces caregiver uploads to `visibility: "circle"` — the button would never appear for caregivers in practice, but the guard makes the invariant explicit and prevents regressions if the check moves.

`server/api/memories/[id]/share.post.ts`:
```ts
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const memoryId = getRouterParam(event, "id")

  const { data: memory } = await supabase
    .from("Memory")
    .select("owner_user_id, circle_id")
    .eq("id", memoryId)
    .single()

  if (memory?.owner_user_id !== user?.id) throw createError({ statusCode: 403 })

  await supabase
    .from("Memory")
    .update({ visibility: "circle" })
    .eq("id", memoryId)

  return { ok: true }
})
```

### Step 7.3 — Quick note (text-only memory)

A `Memory` row with a `note` but no `MemoryMedia` row. No new API endpoint needed — the existing upload Edge Function already accepts `note` and `memoryDate`; just make `file` optional.

**Edge Function change** (`supabase/functions/upload-media/index.ts`):
```ts
const file = formData.get("file") as File | null  // was required, now optional
const isQuickNote = !file

if (!isQuickNote) {
  // existing size check, storage upload, MemoryMedia insert, quota update
}

// Memory insert runs regardless — note + memoryDate always saved
// effectiveVisibility already derived above (caregiver → "circle", others → "private")
const { data: memory } = await supabase.from("Memory").insert({
  owner_user_id: user.id,
  circle_id: circleId,
  visibility: effectiveVisibility,
  note: note || null,
  memory_date: memoryDate ?? new Date().toISOString(),
}).select().single()
```

**UI change** — `UploadMemory.vue`: add a second trigger button "Quick note" alongside the main "Add memory" button. Opens a simpler sheet: just a textarea and date picker, no file preview, no progress bar.

**Timeline card**: text-only memories render as a compact text card with a distinct background (e.g. `bg-secondary` instead of a photo). Show note text prominently, date and author below.

**Definition of done:** Tap "Quick note" → type "First word: dada" → save → appears on timeline at the correct date as a text card with no photo. Storage usage does not change.

---

### Step 7.4 — Image quality verification

No new code. This is a verification step to confirm the existing pipeline stores originals untouched.

**Checklist:**
- [ ] Upload a known full-resolution JPEG (e.g. 12 MP, 6 MB) → download the original from Supabase Storage → confirm file size and dimensions are identical to the source
- [ ] Confirm the timeline thumbnail is served via Supabase Image Transformations (`?width=800&format=webp`) not the original URL
- [ ] Confirm `storage_path` in `MemoryMedia` points to the untransformed file
- [ ] Confirm no resize/compress step exists anywhere in the Edge Function or upload component
- [ ] Remove any lingering "compress before upload" language from code comments

**Definition of done:** Original file in Storage is byte-for-byte identical to what was uploaded. Thumbnails are transformation URLs, not separately stored compressed copies.

---

### Step 7.5 — Media download & share

Two actions on every memory: "Save to device" and "Share" (with optional Our Story watermark).

**Download** — fetch the signed original URL and trigger a browser download:
```ts
// composables/useMemoryActions.ts
export async function downloadMemory(memoryId: string) {
  // Re-fetch signed URL from server (don't rely on cached URL — may be expired)
  const { url, filename } = await $fetch(`/api/memories/${memoryId}/download`)
  const a = document.createElement("a")
  a.href = url
  a.download = filename  // e.g. "memory-2026-04-15.jpg"
  a.click()
}
```

`server/api/memories/[id]/download.get.ts`:
```ts
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const memoryId = getRouterParam(event, "id")

  if (!user) throw createError({ statusCode: 401 })

  // Verify user has access to this memory (RLS handles this via the select below)
  const { data: memory } = await supabase
    .from("Memory")
    .select("id, owner_user_id, circle_id, memory_date, MemoryMedia(storage_path, media_type)")
    .eq("id", memoryId)
    .single()

  if (!memory) throw createError({ statusCode: 404 })

  const media = memory.MemoryMedia?.[0]
  if (!media) throw createError({ statusCode: 404, message: "No media for this memory" })

  // Verify access: owner OR circle member
  const { data: membership } = await supabase
    .from("CircleMember")
    .select("id")
    .eq("user_id", user.id)
    .eq("circle_id", memory.circle_id)
    .single()

  const isOwner = memory.owner_user_id === user.id
  if (!isOwner && !membership) throw createError({ statusCode: 403 })

  const { data } = await supabase.storage
    .from("memories-private")
    .createSignedUrl(media.storage_path, 300)  // 5-min expiry — just for the download

  const ext = media.storage_path.split(".").pop()
  const date = memory.memory_date.split("T")[0]
  const filename = `memory-${date}.${ext}`

  return { url: data?.signedUrl, filename }
})
```

**Share with watermark** — generate a canvas card then use the Web Share API:
```ts
// composables/useMemoryActions.ts
export async function shareMemory(thumbnailUrl: string, note: string | null) {
  // Draw image + watermark on canvas
  const canvas = document.createElement("canvas")
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext("2d")!

  const img = new Image()
  img.crossOrigin = "anonymous"
  await new Promise((resolve) => { img.onload = resolve; img.src = thumbnailUrl })

  // Draw image (cover-fit)
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
  const x = (canvas.width - img.width * scale) / 2
  const y = (canvas.height - img.height * scale) / 2
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale)

  // Subtle watermark in bottom-right
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = "bold 28px system-ui"
  ctx.textAlign = "right"
  ctx.fillText("Our Story", canvas.width - 24, canvas.height - 24)

  // Share via Web Share API (mobile) or copy link (desktop fallback)
  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], "our-story-memory.jpg", { type: "image/jpeg" })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: note ?? "A memory from Our Story",
        text: "Shared from Our Story",
      })
    } else {
      // Desktop fallback: download the card
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "our-story-memory.jpg"
      a.click()
      URL.revokeObjectURL(url)
    }
  }, "image/jpeg", 0.92)
}
```

**UI** — add to `MemoryCard.vue` action row:
```vue
<div class="flex items-center gap-4 px-4 py-2 border-t border-border">
  <!-- ... existing reaction/comment buttons ... -->
  <button @click="downloadMemory(memory.id)" class="ml-auto text-muted-foreground" title="Save to device">
    ↓
  </button>
  <button @click="shareMemory(memory.MemoryMedia[0]?.thumbnailUrl, memory.note)" class="text-muted-foreground" title="Share">
    ↑
  </button>
</div>
```

**Definition of done:** Tap download → original-quality file saved to device downloads folder. Tap share → canvas card generated with watermark → Web Share sheet opens (WhatsApp, iMessage, Instagram, copy). On desktop → card downloads as JPEG. Memory owner and circle members can both download/share circle-visible memories.

---

### Step 7.2 — Milestones

Add milestone picker to the upload modal in `UploadMemory.vue`:
```vue
<div class="mb-3">
  <label class="text-sm text-gray-600 block mb-1">Milestone (optional)</label>
  <select v-model="milestoneLabel" class="w-full border rounded-lg px-3 py-2 text-sm">
    <option value="">No milestone</option>
    <optgroup v-for="group in milestoneGroups" :label="group.label">
      <option v-for="m in group.items" :value="m.value">{{ m.label }}</option>
    </optgroup>
    <option value="__custom__">+ Custom milestone</option>
  </select>
  <input
    v-if="milestoneLabel === '__custom__'"
    v-model="customMilestone"
    placeholder="Describe this milestone"
    class="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
  />
</div>
```

Milestone groups are derived from `circleType` — see design spec for full template list.

---

### Step 7.2.1 — Milestone share card

After a milestone memory is saved, offer a branded canvas card for external sharing (Instagram Stories / WhatsApp). This is the primary organic acquisition channel for new parents — they share milestones constantly.

See design spec §Referral & Sharing Mechanics → "Milestone sharing cards" for full card design and copy rules. Implementation reuses the canvas API approach from Step 7.5.

**Trigger:** Show the share prompt after the upload completes (when `milestoneLabel` is set), not during upload. The moment of upload is never interrupted by a commercial message.

`composables/useMilestoneShareCard.ts`:
```ts
export async function shareMilestoneCard({
  thumbnailUrl,
  milestoneLabel,
  childName,       // from ChildProfile (optional — omit if no ChildProfile exists)
  memoryDate,
}: {
  thumbnailUrl: string
  milestoneLabel: string
  childName?: string
  memoryDate: string
}) {
  // Canvas: 9:16 for Instagram Stories (1080×1920)
  const canvas = document.createElement("canvas")
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext("2d")!

  // Draw photo — top two-thirds, soft vignette
  const img = new Image()
  img.crossOrigin = "anonymous"
  await new Promise((resolve) => { img.onload = resolve; img.src = thumbnailUrl })
  ctx.drawImage(img, 0, 0, 1080, 1280)

  // Vignette overlay
  const vignette = ctx.createLinearGradient(0, 900, 0, 1280)
  vignette.addColorStop(0, "rgba(0,0,0,0)")
  vignette.addColorStop(1, "rgba(0,0,0,0.6)")
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, 1080, 1280)

  // Bottom content area
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 1280, 1080, 640)

  // Milestone label
  const date = new Date(memoryDate)
  const monthYear = date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  ctx.fillStyle = "#111"
  ctx.font = "bold 64px system-ui"
  ctx.textAlign = "left"
  ctx.fillText(childName ? `${childName} · ${milestoneLabel}` : milestoneLabel, 72, 1380)

  ctx.fillStyle = "#888"
  ctx.font = "40px system-ui"
  ctx.fillText(monthYear, 72, 1460)

  // Our Story wordmark (bottom-right, small)
  ctx.fillStyle = "#aaa"
  ctx.font = "32px system-ui"
  ctx.textAlign = "right"
  ctx.fillText("Our Story", 1008, 1870)
  ctx.fillText("ourstory.tinybit.app", 1008, 1910)

  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], "our-story-milestone.jpg", { type: "image/jpeg" })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: milestoneLabel })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "our-story-milestone.jpg"
      a.click()
      URL.revokeObjectURL(url)
    }
  }, "image/jpeg", 0.92)
}
```

Wire into `UploadMemory.vue` — after successful upload with a milestone:
```ts
if (milestoneLabel && result.memoryId) {
  emit("uploaded", result.memoryId)
  cancel()
  // Show share prompt after a short delay — upload complete animation plays first
  setTimeout(() => showMilestoneSharePrompt.value = true, 500)
}
```

Show a bottom sheet prompt:
```vue
<div v-if="showMilestoneSharePrompt" class="fixed inset-0 bg-black/50 flex items-end z-50">
  <div class="bg-white rounded-t-2xl w-full p-6">
    <p class="font-semibold text-lg mb-1">Share this milestone?</p>
    <p class="text-sm text-gray-500 mb-6">Create a beautiful card to share with your wider circle.</p>
    <button @click="doShare" class="w-full bg-black text-white rounded-lg py-3 mb-3">Share milestone card →</button>
    <button @click="showMilestoneSharePrompt = false" class="w-full text-gray-500 py-2">Not now</button>
  </div>
</div>
```

**Definition of done:** After saving a milestone memory, share prompt appears. Tapping "Share milestone card" generates a 9:16 card with the photo, milestone label, date, and "Our Story" wordmark. Web Share sheet opens on mobile; JPEG downloads on desktop. Prompt does not appear for non-milestone memories.

---

## Milestone 8: Comments & Reactions

### Step 8.1 — Comments

`server/api/memories/[id]/comments.get.ts` and `comments.post.ts` — standard CRUD, scoped by RLS.

> **Caregiver restriction:** The RLS `"members can post comments"` policy allows any circle member with Memory access to insert a comment — including caregivers. The spec prohibits caregivers from commenting (see design spec §Role-based authorization). Enforce this in `comments.post.ts` at the API level:
> ```ts
> const { data: membership } = await supabase
>   .from("CircleMember")
>   .select("role")
>   .eq("user_id", user.id)
>   .eq("circle_id", memory.circle_id)  // fetch circle_id from Memory first
>   .single()
>
> if (membership?.role === "caregiver") {
>   throw createError({ statusCode: 403, message: "Caregivers cannot post comments." })
> }
> ```
> Same enforcement pattern used for member-list first-name filtering (noted in Step 2.2).

`components/MemoryComments.vue`:
```vue
<template>
  <div>
    <div v-for="comment in comments" :key="comment.id" class="flex gap-2 py-2">
      <img :src="comment.User.avatar_url" class="w-7 h-7 rounded-full" />
      <div>
        <span class="font-medium text-sm">{{ comment.User.first_name }} {{ comment.User.last_name }}</span>
        <p class="text-sm text-gray-700">{{ comment.body }}</p>
      </div>
    </div>

    <form @submit.prevent="postComment" class="flex gap-2 mt-2">
      <input v-model="body" placeholder="Add a comment..." class="flex-1 border rounded-full px-3 py-1.5 text-sm" />
      <button type="submit" class="text-blue-600 text-sm font-medium">Post</button>
    </form>
  </div>
</template>
```

### Step 8.2 — Emoji reactions

`server/api/memories/[id]/reactions.post.ts`:
```ts
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)
  const { emoji } = await readBody(event)
  const memoryId = getRouterParam(event, "id")

  // Toggle: insert if not exists, delete if already reacted with same emoji
  const { data: existing } = await supabase
    .from("MemoryReaction")
    .select("id")
    .eq("memory_id", memoryId)
    .eq("user_id", user!.id)
    .eq("emoji", emoji)
    .single()

  if (existing) {
    await supabase.from("MemoryReaction").delete().eq("id", existing.id)
  } else {
    await supabase.from("MemoryReaction").insert({
      memory_id: memoryId,
      user_id: user!.id,
      type: "emoji",
      emoji,
    })
  }

  return { ok: true }
})
```

**Definition of done:** Can comment on a memory, comment appears in real-time via Supabase Realtime. Can react with emoji, reaction toggles on/off.

---

## Milestone 8.5: Localization (i18n)

### Step 8.5.1 — Install and configure @nuxtjs/i18n

```bash
pnpm add @nuxtjs/i18n
```

`nuxt.config.ts` addition:
```ts
modules: ["@nuxtjs/i18n"],
i18n: {
  locales: [
    { code: "en", file: "en.json", name: "English" },
    { code: "zh-Hans", file: "zh-Hans.json", name: "中文（简体）" },
    { code: "fr", file: "fr.json", name: "Français" },
  ],
  defaultLocale: "en",
  strategy: "prefix_except_default",
  lazy: true,
  langDir: "locales/",
},
```

Create empty locale files: `locales/en.json`, `locales/zh-Hans.json`, `locales/fr.json` (each starting as `{}`).

**Definition of done:** `pnpm dev` runs without errors. `useI18n()` is available in all components.

---

### Step 8.5.2 — Extract all UI strings to `locales/en.json`

Replace every hardcoded UI string with `t('key')`. Work component by component — do not batch all at once (one broken key breaks the whole UI).

```ts
// In any component:
const { t } = useI18n()
// Then in template: {{ t('timeline.empty') }} instead of "Upload your first memory"
```

Key entries to include (non-exhaustive — add every string you encounter):
```json
{
  "timeline.empty": "Upload your first memory",
  "timeline.empty.parents": "Your baby's story starts here. Upload your first memory — grandparents are waiting.",
  "memory.share": "Add to circle story",
  "memory.milestone.label": "Milestone (optional)",
  "upload.note.placeholder": "Add a note... (optional)",
  "upload.date.label": "When was this?",
  "storage.full": "Your storage is full — upgrade to continue uploading",
  "storage.near_limit": "Your story space is almost full",
  "invite.expired": "This invite link has expired — ask the circle owner for a new one",
  "milestone.first_steps": "First steps",
  "milestone.first_word": "First word",
  "milestone.first_birthday": "First birthday",
  "milestone.first_day_of_school": "First day of school"
}
```

Note: always use `Intl.DateTimeFormat` for dates — never hardcode `MM/DD/YYYY`. Example:
```ts
new Intl.DateTimeFormat(locale.value, { month: "long", day: "numeric", year: "numeric" }).format(new Date(memory.memory_date))
```

**Definition of done:** No hardcoded English strings remain in any `.vue` file. All strings route through `t()`.

---

### Step 8.5.3 — Translate `locales/zh-Hans.json`

Copy every key from `en.json` and provide Simplified Chinese translations. This is a must-have — developer's own parents need to use the app.

```json
{
  "timeline.empty": "上传您的第一段记忆",
  "memory.share": "添加到圈子故事",
  "upload.note.placeholder": "添加备注...（可选）",
  "storage.full": "存储空间已满 — 升级以继续上传"
}
```

**Definition of done:** Switching to `zh-Hans` locale shows all UI strings in Simplified Chinese. No English strings visible.

---

### Step 8.5.4 — Translate `locales/fr.json`

Copy every key from `en.json` and provide French translations. Required for Canadian bilingual compliance.

```json
{
  "timeline.empty": "Téléchargez votre premier souvenir",
  "memory.share": "Ajouter à l'histoire du cercle",
  "upload.note.placeholder": "Ajouter une note... (facultatif)",
  "storage.full": "Votre espace est plein — passez à la version supérieure pour continuer"
}
```

**Definition of done:** Switching to `fr` locale shows all UI strings in French. No English strings visible.

---

### Step 8.5.5 — Language toggle in settings (persisted to `User.locale`)

Add to `pages/settings/account.vue`:

```vue
<template>
  <!-- Add inside the existing settings page, e.g. after login methods section -->
  <div>
    <h2 class="text-lg font-semibold mb-1">Language</h2>
    <select
      :value="locale"
      @change="changeLocale(($event.target as HTMLSelectElement).value)"
      class="border rounded-lg px-3 py-2 text-sm w-full max-w-xs"
    >
      <option value="en">English</option>
      <option value="zh-Hans">中文（简体）</option>
      <option value="fr">Français</option>
    </select>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { locale, setLocale } = useI18n()

async function changeLocale(code: string) {
  await setLocale(code)
  await supabase
    .from("User")
    .update({ locale: code })
    .eq("id", user.value!.id)
}
</script>
```

On app load, read `User.locale` and apply it. Add to `app.vue` (runs once after auth):

```ts
// app.vue <script setup>
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { setLocale } = useI18n()

watch(user, async (u) => {
  if (!u) return
  const { data } = await supabase
    .from("User")
    .select("locale")
    .eq("id", u.id)
    .single()
  if (data?.locale) await setLocale(data.locale)
}, { immediate: true })
```

**Definition of done:** User selects French in settings → UI switches to French immediately → on next login the French locale is restored automatically. `User.locale` column holds the persisted value. The three locale codes in the select (`en`, `zh-Hans`, `fr`) must match the DB CHECK constraint exactly.

---

## Milestone 9: Grandparent View-Only Access

### Step 9.1 — Generate view-only JWT

`server/api/circles/[id]/view-link.post.ts`:
```ts
import { SignJWT } from "jose"

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  const circleId = getRouterParam(event, "id")

  // Only owner/admin can generate view-only links
  // ... (verify membership role)

  const secret = new TextEncoder().encode(useRuntimeConfig().jwtSecret)
  const token = await new SignJWT({ circle_id: circleId, role: "viewer" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret)

  return { url: `${process.env.APP_URL}/view/${token}` }
})
```

### Step 9.2 — View-only page

`pages/view/[token].vue`:
```vue
<script setup lang="ts">
// Middleware: skip auth check for this route (defined in nuxt.config redirect exclusions)
definePageMeta({ auth: false })

const route = useRoute()
const { data, error } = await useFetch(`/api/view/${route.params.token}`)
</script>

<template>
  <div>
    <div class="sticky top-0 bg-amber-50 border-b border-amber-200 px-4 py-3 text-center">
      <p class="text-sm text-amber-800">
        You're viewing as a guest.
        <NuxtLink to="/login" class="font-semibold underline">Join to participate →</NuxtLink>
      </p>
    </div>
    <!-- Read-only timeline -->
    <TimelineFeed :memories="data.memories" :read-only="true" />
  </div>
</template>
```

`server/api/view/[token].get.ts` — verify JWT, return timeline without requiring Supabase auth.

**Definition of done:** Sharing the view-only link opens the timeline without login. No upload, comment, or reaction controls are visible.

---

## Milestone 10: Push Notifications & On This Day

### Step 10.1 — Basic push (new upload, comment, reaction)

Use Supabase Edge Functions triggered by DB webhooks (via `pg_net` or Supabase Database Webhooks):

```sql
-- In Supabase Dashboard: Database → Webhooks → New webhook
-- Trigger: INSERT on MemoryComment
-- URL: https://[project].supabase.co/functions/v1/send-push-notification
```

`supabase/functions/send-push-notification/index.ts`:
```ts
Deno.serve(async (req) => {
  const payload = await req.json()
  const { table, record } = payload

  // Fetch notification preferences for all circle members
  // Check push_enabled, circle_muted, quiet_hours before sending
  // Send via FCM (Android) or APNs (iOS) using Capacitor push tokens
  // For Phase 1 web: use Web Push API
})
```

### Step 10.2 — On This Day cron

`supabase/functions/on-this-day/index.ts`:
```ts
// Triggered daily at 9am via Supabase cron (pg_cron)
// SELECT memories WHERE memory_date is same month+day, at least 1 year ago
// For each: check NotificationPreference, send push + queue email
```

Register cron in a migration:
```sql
SELECT cron.schedule(
  'on-this-day-daily',
  '0 9 * * *',  -- 9am daily UTC
  $$SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/on-this-day',
    headers := '{"Authorization": "Bearer [service_role_key]"}'::jsonb
  )$$
);
```

**Definition of done:** Upload a photo dated exactly 1 year ago → next morning a push notification fires referencing that memory.

---

## Milestone 11: PWA & Mobile Polish

### Step 11.1 — PWA manifest

`public/manifest.json`:
```json
{
  "name": "Our Story",
  "short_name": "Our Story",
  "description": "A private space where your circle builds a shared story.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`nuxt.config.ts`:
```ts
app: {
  head: {
    link: [{ rel: "manifest", href: "/manifest.json" }],
    meta: [
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
  },
},
```

### Step 11.2 — Mobile-first CSS rules

- All tap targets minimum 44×44px
- No hover-only interactions
- `font-size` minimum 16px on inputs (prevents iOS zoom on focus)
- Bottom navigation bar for mobile (Timeline | My Memories | Albums)
- Safe area insets for notch phones: `padding-bottom: env(safe-area-inset-bottom)`

### Step 11.3 — Performance targets (Lighthouse CI)

Add Lighthouse CI to GitHub Actions to catch performance regressions before they ship.

```bash
pnpm install -D @lhci/cli
```

`.lighthouserc.json`:
```json
{
  "ci": {
    "collect": { "url": ["http://localhost:3000/login", "http://localhost:3000"] },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.8 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 300 }]
      }
    }
  }
}
```

Add to CI pipeline after E2E tests:
```yaml
- name: Run Lighthouse CI
  run: pnpm dlx lhci autorun
```

**Manual checks before launch:**
- Open timeline on a real Android mid-range device (Samsung A-series) on 4G
- First image must be visible in < 1s
- Scrolling must not stutter (no jank)
- Test with Chrome DevTools throttled to "Fast 4G"

### Step 11.4 — Add to Home Screen prompt

```ts
// composables/useInstallPrompt.ts
export const useInstallPrompt = () => {
  const deferredPrompt = ref<any>(null)
  const canInstall = ref(false)

  if (process.client) {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault()
      deferredPrompt.value = e
      canInstall.value = true
    })
  }

  async function promptInstall() {
    if (!deferredPrompt.value) return
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    deferredPrompt.value = null
    canInstall.value = false
    return outcome
  }

  return { canInstall, promptInstall }
}
```

Show the prompt after a user has uploaded their second memory ("Add to your home screen to never miss a moment").

**Definition of done:** Opening the app on mobile shows a standalone-style experience. On Android, "Add to Home Screen" prompt appears. No horizontal scroll, no tiny tap targets.

---

## Milestone 12: Early Retention Hooks

### Step 12.1 — Weekly digest email (grandparent-first design)

> **Schema prerequisite:** The viewer-role digest path requires the `NewsletterRecipient` table (created in Step 2.1) to store email addresses for recipients who have no User account (e.g. grandparents on the view-only link). The member-facing digest uses `NotificationPreference` and works without this table. Implement the `NewsletterRecipient` enrollment UI (in circle settings — "Add email recipient") alongside this step.

```sql
-- pg_cron: every Monday 9am UTC
SELECT cron.schedule(
  'weekly-digest',
  '0 9 * * 1',
  $$SELECT net.http_post(
    url := '.../functions/v1/weekly-digest',
    headers := '...'::jsonb
  )$$
);
```

`supabase/functions/weekly-digest/index.ts`:
- Query memories uploaded in last 7 days per circle
- If count > 0: send digest email with thumbnail grid
- If count = 0 and circle is < 90 days old: send re-engagement nudge
- Check `NotificationPreference.email_digest_frequency` before sending
- Personalise subject line for viewer-role recipients: `"3 new memories of Mia this week 📸"` (use ChildProfile name if available)
- **When generating viewer JWTs to embed in email reaction links, include `viewer_name` from `NewsletterRecipient.name`** — this is how the email reaction endpoint attributes the reaction. Without it, `payload.viewer_name` is undefined and every reaction shows as "A circle member":
  ```ts
  // For each NewsletterRecipient when building email links:
  const token = await new SignJWT({
    circle_id: circleId,
    role: "viewer",
    viewer_name: recipient.name ?? null,  // from NewsletterRecipient.name
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret)
  // Use in: /api/reactions/email?token=<token>&memoryId=<id>&emoji=❤️
  ```
  > Note: the view-only link JWT (Step 9.1) does NOT include `viewer_name` — the owner doesn't know who will open the link. Only digest-generated JWTs carry this field.

**One-tap email reaction endpoint** — add alongside the digest:

`server/api/reactions/email.get.ts`:
```ts
// GET /api/reactions/email?token=<viewer-jwt>&memoryId=<id>&emoji=❤️
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseServiceRole(event)
  const { token, memoryId, emoji } = getQuery(event)

  // Verify viewer JWT (same secret as view-only link)
  const secret = new TextEncoder().encode(useRuntimeConfig().jwtSecret)
  const { payload } = await jwtVerify(token as string, secret)
  if (!payload.circle_id) throw createError({ statusCode: 401 })

  // Insert reaction (guest — no user_id, use guest_name from JWT)
  // viewer_name is populated by the weekly digest Edge Function from NewsletterRecipient.name
  // when it generates the JWT embedded in email links — see the digest Edge Function note below.
  await supabase.from("MemoryReaction").upsert({
    memory_id: memoryId,
    user_id: null,          // guest reaction — extend schema to allow null user_id for guests
    type: "emoji",
    emoji,
    guest_name: payload.viewer_name ?? "A circle member",
  })

  // Notify memory owner
  // ... (reuse existing push notification logic)

  // Redirect to view-only timeline
  return sendRedirect(event, `/view/${token}#memory-${memoryId}`, 302)
})
```

**Schema extension needed** — `MemoryReaction.user_id` must allow NULL for guest reactions. Create `supabase/migrations/004_guest_reactions.sql`:
```sql
-- Allow NULL user_id for guest reactions (email digest one-tap ❤)
ALTER TABLE public.MemoryReaction ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.MemoryReaction ADD COLUMN guest_name TEXT;
-- Replace UNIQUE constraint — original assumes non-null user_id
ALTER TABLE public.MemoryReaction DROP CONSTRAINT memoryreaction_memory_id_user_id_emoji_key;
CREATE UNIQUE INDEX memoryreaction_unique
  ON public.MemoryReaction (memory_id, emoji, COALESCE(user_id::text, guest_name))
  WHERE emoji IS NOT NULL;
```

**Definition of done:** Weekly digest arrives Monday 9am. Grandparent-role recipients get personalised subject with child's name. Tapping ❤ in the email registers a reaction without opening the app, and the memory owner gets a push notification.

### Step 12.2 — Milestone suggestions (triple-nudge engine)

Daily cron that auto-calculates upcoming milestones from `ChildProfile.date_of_birth` and sends three notifications per milestone: 3 days before, day-of, and 3 days after (only if no matching memory was uploaded).

`supabase/functions/milestone-suggestions/index.ts`:
```ts
// Runs daily at 8am UTC
// Age milestones to track (in months): 1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60
const MILESTONE_AGES_MONTHS = [1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60]

// For each ChildProfile:
// 1. Calculate age in days from date_of_birth
// 2. Determine if any MILESTONE_AGES_MONTHS hits in exactly 3 days (T-3 nudge)
// 3. Determine if any MILESTONE_AGES_MONTHS hits today (T+0 nudge)
// 4. Determine if any MILESTONE_AGES_MONTHS hit exactly 3 days ago AND
//    no Memory with matching milestone_label uploaded in ±3 day window (T+3 follow-up)

// Nudge copy:
// T-3: "Mia turns 6 months on Thursday — ready to capture the moment?"
// T+0: "Today is Mia's 6-month birthday 🎉 Add a memory?"
// T+3: "Did you capture Mia's 6-month milestone? Add it before the moment fades →"
//       (only sent if no memory found with milestone_label LIKE '%6%month%' in last 6 days)
```

The T+3 follow-up is the highest-converting nudge. The moment already happened — the user has photos on their camera roll and the memory is fresh. Check `NotificationPreference` before sending all three.

### Step 12.3 — "Your First Month" recap email

> **Note:** This step and "Step 12.3.1" are the same email. `first_month_email_sent` is the single guard flag for both. There is no separate anniversary push — this is email only.

Daily cron (`supabase/functions/first-month-recap/index.ts`) that checks all circles where `first_memory_at` is between 29–31 days ago **AND** `first_month_email_sent = false`. The 3-day window (not "exactly 30 days") prevents misses caused by cron skew or deploy gaps.

```ts
// Find eligible circles
const { data: circles } = await supabase
  .from("Circle")
  .select("id, name, first_memory_at")
  .eq("first_month_email_sent", false)
  .gte("first_memory_at", thirtyOneDaysAgo)
  .lte("first_memory_at", twentyNineDaysAgo)

for (const circle of circles) {
  // 1. Fetch oldest memory (hero card)
  const { data: firstMemory } = await supabase
    .from("Memory")
    .select("id, memory_date, note, MemoryMedia(storage_path)")
    .eq("circle_id", circle.id)
    .order("memory_date", { ascending: true })
    .limit(1)
    .single()

  // 2. Compile month-in-numbers stats
  const { count: totalMemories } = await supabase
    .from("Memory")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circle.id)

  const { count: totalContributors } = await supabase
    .from("Memory")
    .select("owner_user_id", { count: "exact", head: true })
    .eq("circle_id", circle.id)

  // 3. Fetch all active members
  const { data: members } = await supabase
    .from("CircleMember")
    .select("user_id, User!user_id(email, first_name, last_name)")
    .eq("circle_id", circle.id)
    .eq("memorial_status", "active")

  // 4. Generate signed URL for hero card (never expose storage_path)
  const heroSignedUrl = firstMemory?.MemoryMedia?.[0]
    ? await getSignedUrl(firstMemory.MemoryMedia[0].storage_path)
    : null

  // 5. Send recap email to every member
  for (const member of members) {
    const recipientName = `${member.User.first_name ?? ''} ${member.User.last_name ?? ''}`.trim()
    await resend.emails.send({
      from: "Our Story <hello@our-story.tinybit.app>",
      to: member.User.email,
      subject: `${circle.name}'s first month — look how far you've come`,
      react: FirstMonthRecapEmail({
        recipientName,
        circleName: circle.name,
        heroImageUrl: heroSignedUrl,
        heroDate: firstMemory?.memory_date,
        totalMemories,
        totalContributors,
        ctaUrl: `${SITE_URL}/circle/${circle.id}/timeline`,
      }),
    })
  }

  // 6. Mark sent — prevents re-send on future cron runs
  await supabase
    .from("Circle")
    .update({ first_month_email_sent: true })
    .eq("id", circle.id)
}
```

**Email content structure** (`emails/FirstMonthRecapEmail.tsx`):
1. **Nostalgia hook** — hero card: signed-URL photo (or placeholder if Quick Note) + date of first memory
2. **Month in numbers** — `X memories saved`, `Y contributors`
3. **Forward CTA** — "Keep the story going →" links to timeline

**Definition of done:** Circle hits 30 days since first memory → exactly one recap email per member → `first_month_email_sent` flips to `true` → no second email sent on day 31.

### Step 12.5 — Circle streak *(Phase 2 — do not build in Phase 1)*

> **Phase 2 only.** The streak requires a week of usage data to be meaningful and depends on notification infrastructure (Capacitor push) that ships in Phase 2. Implementation details are preserved here for reference but this step is excluded from the Phase 1 exit criteria. Add it to the Phase 2 build queue after notification preferences and native app are stable.

`supabase/migrations/XXX_circle_streak.sql`:
```sql
CREATE TABLE public.CircleStreak (
  circle_id UUID PRIMARY KEY REFERENCES public.Circle(id) ON DELETE CASCADE,
  current_streak_weeks INT NOT NULL DEFAULT 0,
  longest_streak_weeks INT NOT NULL DEFAULT 0,
  last_upload_week DATE  -- ISO week start (Monday) of most recent upload
);
```

**Streak update trigger** — fires on every `Memory` INSERT:
```sql
CREATE OR REPLACE FUNCTION public.update_circle_streak()
RETURNS TRIGGER AS $$
DECLARE
  current_week DATE := date_trunc('week', NOW())::DATE;
  streak_row public.CircleStreak%ROWTYPE;
BEGIN
  SELECT * INTO streak_row FROM public.CircleStreak WHERE circle_id = NEW.circle_id;

  IF streak_row IS NULL THEN
    INSERT INTO public.CircleStreak (circle_id, current_streak_weeks, longest_streak_weeks, last_upload_week)
    VALUES (NEW.circle_id, 1, 1, current_week);
  ELSIF streak_row.last_upload_week = current_week THEN
    NULL; -- already uploaded this week, no change
  ELSIF streak_row.last_upload_week = current_week - INTERVAL '7 days' THEN
    -- consecutive week — increment streak
    UPDATE public.CircleStreak SET
      current_streak_weeks = current_streak_weeks + 1,
      longest_streak_weeks = GREATEST(longest_streak_weeks, current_streak_weeks + 1),
      last_upload_week = current_week
    WHERE circle_id = NEW.circle_id;
  ELSE
    -- streak broken — reset
    UPDATE public.CircleStreak SET
      current_streak_weeks = 1,
      last_upload_week = current_week
    WHERE circle_id = NEW.circle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_memory_insert_update_streak
  AFTER INSERT ON public.Memory
  FOR EACH ROW EXECUTE FUNCTION public.update_circle_streak();
```

**Sunday evening streak-saver nudge** — add to the daily cron:
```ts
// Every Sunday at 7pm UTC
// For each circle where:
//   - current_streak_weeks >= 2 (streak worth saving)
//   - last_upload_week != this week (no upload yet this week)
// → push to owner only: "Your {N}-week streak ends tonight — add a quick memory?"
```

**Shareable achievement cards** — at 4, 12, and 52 consecutive weeks, show an in-app celebration:
```
"🎉 The Johnson family has shared memories for 12 weeks in a row!"
[Share to WhatsApp] [Share to Instagram Stories]
```
Generate as a canvas card (same approach as milestone cards and Year in Review).

**Definition of done:** Upload a memory each week for 3 weeks → streak shows as 🔥 3 on the timeline header. Skip a week → streak resets to 0. Sunday push fires when streak ≥ 2 and no upload yet that week.

### Step 12.4 — Quiet circle nudge (14-day inactivity)

If no uploads in 14 days, send a soft nudge to the circle owner only (not all members).

```ts
// Daily cron — check circles with no recent uploads
// Use Circle.last_memory_at (pre-computed by handle_memory_insert trigger).
// Do NOT query MAX(Memory.created_at) per circle — it does not scale.
// Do NOT filter by visibility — a private upload still means the circle is active.
const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

const { data: quietCircles } = await supabase
  .from("Circle")
  .select("id, quiet_nudge_count, quiet_nudge_last_sent_at")
  .or(`last_memory_at.is.null,last_memory_at.lt.${cutoff}`)
  .lt("quiet_nudge_count", 3)                                           // hard stop: max 3 nudges per quiet period
  .or(`quiet_nudge_last_sent_at.is.null,quiet_nudge_last_sent_at.lt.${cutoff}`) // min 14 days between nudges

for (const circle of quietCircles) {
  const { data: owner } = await supabase
    .from("CircleMember")
    .select("user_id")
    .eq("circle_id", circle.id)
    .eq("role", "owner")
    .single()

  // Check prefs before sending
  await sendPush(owner.user_id, {
    title: "Your story has been quiet",
    body: "Add a memory this week to keep the story going →",
    deep_link: "/",
  })

  // Increment nudge count and record send time so the cron respects the hard stop
  await supabase
    .from("Circle")
    .update({
      quiet_nudge_count: circle.quiet_nudge_count + 1,
      quiet_nudge_last_sent_at: new Date().toISOString(),
    })
    .eq("id", circle.id)
}
```

**Definition of done:** 7 days after launch, the first weekly digest email arrives. 30 days after a circle's first upload, the "Your First Month" recap email arrives (no push — email only, per Step 12.3). 14 days after the last upload, the owner gets a quiet nudge push.

---

## Milestone 13: Pre-Launch Checklist

**Do not share the app with anyone outside your immediate circle until every item here is checked.** Security and quality issues are exponentially harder to fix after real users have data in the system.

---

### Security (highest priority — check these first)
- [ ] `supabase db test` — all RLS policy tests passing
- [ ] User A cannot read User B's private memories — manually verified
- [ ] User A cannot read circles they don't belong to — manually verified
- [ ] No raw Supabase Storage paths in any API response — grep all routes for `storage_path`, `media_path`, and any other Storage path columns; only signed URLs may be returned to the client
- [ ] No secrets, tokens, or internal paths appear in browser console or network tab
- [ ] HTTP security headers present on all responses (verify with securityheaders.com)
- [ ] File upload: attempt to upload a `.exe` renamed as `.jpg` — must be rejected
- [ ] Invite spam protection active: sending more than 10 pending invites to the same circle returns 429 (server-side pending-invite count cap — Phase 1 mechanism; Upstash sliding-window rate limiting is Phase 2)
- [ ] `pnpm audit --audit-level high` passes with zero high/critical vulnerabilities
- [ ] All error messages shown to users are human-readable — no stack traces, no raw DB errors
- [ ] OWASP ZAP basic scan run against staging — all critical/high findings resolved
- [ ] Service role key confirmed absent from any client-side code (`grep -r "SERVICE_ROLE" src/`)

### Data integrity
- [ ] Upload quota enforcement tested: upload at 100% → blocked with friendly message
- [ ] Storage usage increments correctly on upload, decrements on delete
- [ ] Memory date ordering correct: uploading old photo inserts at historical position
- [ ] Invite token: single-use confirmed (accepting twice returns error)
- [ ] Invite token: expired token returns friendly error, not 500
- [ ] Soft delete: deleted user's memories remain visible in circle timeline as "Deleted Member"

### Testing
- [ ] `pnpm test` — all unit + integration tests passing
- [ ] `pnpm test:e2e` — creator onboarding + invited member flows passing
- [ ] Stripe webhook handlers tested in Stripe test mode — verify correct behavior for each event:
  - `checkout.session.completed` → `User.subscription_status` upgrades, `Circle.subscription_status` mirrors
  - `invoice.payment_succeeded` → subscription renewed, status stays at paid tier
  - `invoice.payment_failed` → `Circle.subscription_status = "grace"`, `grace_period_until = now() + 7 days`
  - `customer.subscription.deleted` → `Circle.subscription_status = "grace"`, `grace_period_until = now() + 30 days`; `User.subscription_status` must NOT change to `"free"` yet — voluntary cancellation gets 30-day grace, not immediate downgrade
- [ ] On This Day cron tested on seed data — push fires correctly

### User experience
- [ ] Complete onboarding flow on real iPhone (iOS Safari) — no broken layouts
- [ ] Complete onboarding flow on real Android (Chrome) — no broken layouts
- [ ] Invite link opened on fresh device with no account — magic link flow works end to end
- [ ] Grandparent view-only link tested — timeline visible without login, no upload/comment controls
- [ ] All error states verified with friendly messages: storage full, file too large, video too long, expired invite, invalid invite
- [ ] "Add to Home Screen" prompt tested on Android — app installs correctly
- [ ] Timeline scrolled to 50+ memories — no performance degradation or blank cards
- [ ] Lighthouse score ≥ 80 performance on mobile (run in CI)
- [ ] axe-core: zero critical accessibility violations
- [ ] Minimum tap target size 44×44px on all buttons — verified on mobile

### Email & DNS
- [ ] SPF record added and verified on `tinybit.app`
- [ ] DKIM record added and verified on `tinybit.app`
- [ ] DMARC record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@tinybit.app`
- [ ] Resend domain shows "Verified"
- [ ] Invite email lands in inbox on Gmail — not spam
- [ ] Invite email lands in inbox on Hotmail/Outlook — not spam
- [ ] Invite email renders correctly on mobile (iOS Mail + Gmail app)

### Legal & compliance
- [ ] Privacy policy live at `our-story.tinybit.app/privacy`
- [ ] Terms of service live at `our-story.tinybit.app/terms`
- [ ] Age gate on signup — users under 13 blocked
- [ ] Cookie consent banner active for EU users
- [ ] Privacy policy covers: data collected, Supabase/Stripe/Resend as processors, right to deletion, right to export
- [ ] GDPR data deletion tested: request deletion → `deleted_at` set → hard purge scheduled in 30 days

### Monitoring & support

**Create health endpoint** — Better Uptime needs a URL to monitor. Without this, the "downtime alert" checklist item below cannot be completed.

`server/api/health.get.ts`:
```ts
import { serverSupabaseServiceRole } from "#supabase/server"

export default defineEventHandler(async (event) => {
  // Use service role to bypass RLS — this is a server-side liveness check only.
  // The anon client would be blocked by RLS on the User table even when the DB is healthy.
  const supabase = await serverSupabaseServiceRole(event)
  const { error } = await supabase.from("User").select("id").limit(1)
  if (error) {
    console.error("[health] DB unreachable", error)
    throw createError({ statusCode: 503, message: "DB unreachable" })
  }
  return { status: "ok", timestamp: new Date().toISOString() }
})
```

- [ ] Health endpoint live: `GET /api/health` returns `{ status: "ok" }` with HTTP 200
- [ ] Sentry receiving errors in production (throw a test error, verify it appears)
- [ ] Sentry alert: error rate > 1% triggers email notification
- [ ] Better Uptime: monitor `https://our-story.tinybit.app/api/health` — check every 1 minute
- [ ] Better Uptime status page live at status page URL
- [ ] Better Uptime: downtime alert configured (email + SMS within 1 minute)
- [ ] Vercel deployment notifications configured (failed deploy = immediate alert)
- [ ] Supabase usage alerts: warn at 80% of storage, DB size, and bandwidth limits
- [ ] Crisp support chat working in production — test message arrives in Crisp dashboard
- [ ] `support@our-story.tinybit.app` email confirmed working (send test, receive it)

---

## Build Order Summary

| Milestone | What | Blocks |
|---|---|---|
| 1 | Project foundation + PostHog analytics | Everything |
| 2 | DB schema + RLS | All data features |
| 3 | Auth + account deletion + data export | All user features |
| 4 | Circle + invites + VP screens + solo mode + invited member welcome | Timeline, upload |
| 5 | Upload (single + batch) | Timeline |
| 6 | Timeline | Memory features |
| 7 | Memory features (notes, visibility, milestones, quick note, download & share) | Social layer |
| 8 | Comments + reactions (incl. guest reactions) | Retention |
| 9 | Viewer-role access (swipe nav, first-open splash) | — |
| 10 | Push + On This Day | Retention |
| 11 | PWA + mobile polish | Launch |
| 12 | Early retention (digest + email reactions, milestone triple-nudge, anniversary, quiet nudge) | Phase 1 exit criteria |
| 13 | Pre-launch checklist | Going live |
