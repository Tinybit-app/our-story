# Our Story

## Key docs

- **Design spec:** `docs/design-spec.md` — product decisions, data model, architecture, feature specs
- **Design spec summary:** `docs/design-spec-summary.md` — quick reference (tech stack, pricing, phases)
- **Build plan:** `docs/build-plan.md` — Phase 1 step-by-step implementation with progress tracker

Always check the build plan progress tracker before starting work to see what's done and what's next.

## Stack

- **Frontend:** Nuxt + shadcn-vue + Tailwind
- **Backend:** Supabase (Auth, DB, Storage, Realtime)
- **Email:** Resend + React Email
- **Error tracking:** Sentry
- **Analytics:** PostHog
- **Tests:** Vitest (unit), Playwright (E2E), pgTAP (RLS)

## Rules

- Never return `storage_path` in any API response — signed URLs only
- Every API route validates auth with `serverSupabaseUser` before touching data
- Validate all user input with `zod` — never use raw request body
- All schema changes go through migration files — never edit schema in Supabase dashboard
- RLS tests must pass before merging any migration
