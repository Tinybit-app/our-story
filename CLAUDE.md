# Our Story

## Key docs

- **Design spec:** `docs/design-spec.md` — product decisions, data model, architecture, feature specs
- **Design spec summary:** `docs/design-spec-summary.md` — quick reference (tech stack, pricing, phases)
- **Build plan:** `docs/build-plan.md` — Phase 1 step-by-step implementation with progress tracker

**Before every implementation task:**

1. Check the build plan progress tracker to see what's done and what's next
2. Read the relevant build plan step(s) in full before writing any code
3. Cross-reference the design spec for the feature being built — implementation must match the spec exactly
4. After implementing, verify against the build plan's "Definition of done" for that step

The build plan and design spec are the source of truth. Do not deviate from them without explicitly discussing the trade-off with the user first.

**After every implementation task:**

Always test the implementation and verify the workflow with the user. This is very important.

Update doc/build-plan.md and doc/design-spec.md with any change in the implementation so that the docs are in sync with the implementation. This is very important

## Stack

- **Frontend:** Nuxt + shadcn-vue + Tailwind
- **Backend:** Supabase (Auth, DB, Storage, Realtime)
- **Email:** Resend + React Email
- **Error tracking:** Sentry
- **Analytics:** PostHog
- **Tests:** Vitest (unit), Playwright (E2E), pgTAP (RLS)

## Terminology

- **UI / copy and Code / DB:** "Circle", "CircleMember", "CircleInvite" — consistent throughout
- Memory visibility values: `'private'` (owner only) and `'circle'` (all circle members)

## UI Layout

- **Main app pages** (any page with a header/nav shell): use `max-w-5xl mx-auto` for both the header inner div and the `<main>` content area
- **Auth/onboarding/modal-like pages** (login, confirm, invite/[token], onboarding/*): use `max-w-sm` centered — these are intentionally narrow
- Never use `max-w-2xl` or `max-w-3xl` for main app page layouts

## Rules

- Never return `storage_path` in any API response — signed URLs only
- Every API route validates auth with `serverSupabaseUser` before touching data
- Validate all user input with `zod` — never use raw request body
- Never expose raw `error.message` to the client — log server-side, return a safe human-readable message
- All schema changes go through migration files — never edit schema in Supabase dashboard
- Migrations must be additive first — never drop a column in the same PR as the feature that removes it
- RLS tests must pass before merging any migration
- Timeline queries order by `memory_date` (not `created_at`) — this drives correct chronological position for old photos uploaded today
- `circle_type` values are: `'parents' | 'couple' | 'family' | 'friends' | 'caregiving' | 'travel' | 'solo' | 'custom'` — validate with `z.enum()`, never `z.string()`
- Sentry client config must use `useRuntimeConfig().public.sentryDsn` — `process.env.SENTRY_DSN` is not available in the browser SPA bundle

## Tests

Unit tests live in `unit/` (Vitest). Run with `pnpm test`.
E2E tests live in `tests/` (Playwright). Run with `pnpm test:e2e`.
RLS tests live in `supabase/tests/` (pgTAP). Run with `pnpm db:test`.

After any migration change: `pnpm db:reset && pnpm db:test`
After any API route change: `pnpm test`
