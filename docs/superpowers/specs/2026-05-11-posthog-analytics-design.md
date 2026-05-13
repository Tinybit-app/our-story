# 1.7 — PostHog Analytics Setup

## Overview

Wire PostHog analytics into the Nuxt client for Phase 1, using **PostHog Cloud EU** (not self-hosted). Capture an explicit, typed catalog of 12 product events — no autocapture, no PII. Identify users by `user.id` after login so retention and funnel metrics work across devices.

This replaces the design spec's earlier "self-hostable at `analytics.our-story.tinybit.app`" plan, which was overhead-heavy for a 0–50 user Phase 1.

## Decisions

- **Host:** PostHog Cloud EU (`https://eu.i.posthog.com`). Free tier covers Phase 1 volume.
- **SDK:** `posthog-js` client-side only. No `posthog-node` in Phase 1.
- **Autocapture:** `false`. Only explicit `track()` calls.
- **Pageviews:** `capture_pageview: true` — Nuxt route changes auto-captured.
- **Persistence:** `localStorage`.
- **Identity:** `posthog.identify(user.id, { circle_count })` once auth resolves. `posthog.reset()` on logout. Anonymous events pre-auth get aliased on signup automatically.
- **PII:** never log emails, names, memory notes, URLs, or file names. IDs only.
- **Opt-out:** `respect_dnt: true`. No settings toggle in Phase 1.
- **Stripe events:** catalog reserved, no call site until Phase 2 billing.
- **Local dev:** no env var → composable no-ops. Zero events in dev unless the dev sets the key.

## 1. Plugin

**Path:** `plugins/posthog.client.ts`

```ts
import posthog from 'posthog-js'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const key = config.public.posthogKey
  const host = config.public.posthogHost

  if (!key) return // no-op when key is unset (local dev)

  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: true,
    persistence: 'localStorage',
    respect_dnt: true,
    loaded: (ph) => {
      if (import.meta.dev) ph.debug(false)
    },
  })

  return {
    provide: { posthog },
  }
})
```

## 2. Composable

**Path:** `app/composables/useAnalytics.ts`

Typed wrapper. Event names and payload shapes enforced at compile time via a discriminated union.

```ts
type AnalyticsEvent =
  | { name: 'user_signed_up'; props: { method: 'email' } }
  | {
      name: 'circle_created'
      props: { circle_id: string; circle_type: CircleType }
    }
  | {
      name: 'member_invited'
      props: { circle_id: string; invite_method: 'link' }
    }
  | {
      name: 'member_joined'
      props: { circle_id: string; joined_via: 'invite' }
    }
  | {
      name: 'memory_uploaded'
      props: {
        circle_id: string
        memory_type: 'photo' | 'video' | 'note' | 'mixed'
        visibility: 'circle' | 'private'
        media_count: number
      }
    }
  | {
      name: 'memory_shared_to_circle'
      props: { circle_id: string; memory_id: string }
    }
  | { name: 'comment_added'; props: { circle_id: string; memory_id: string } }
  | {
      name: 'reaction_added'
      props: { circle_id: string; memory_id: string; emoji: string }
    }
  | {
      name: 'milestone_created'
      props: { circle_id: string; milestone_type: string }
    }
  | { name: 'export_requested'; props: { circle_id: string; format: 'zip' } }
  | {
      name: 'subscription_upgraded'
      props: { tier: 'plus'; interval: 'monthly' | 'annual' }
    }
  | { name: 'subscription_cancelled'; props: { tier: 'plus' } }

export function useAnalytics() {
  const { $posthog } = useNuxtApp()

  function track<E extends AnalyticsEvent>(name: E['name'], props: E['props']) {
    if (!$posthog) return
    $posthog.capture(name, props)
  }

  function identifyUser(userId: string, props?: { circle_count?: number }) {
    if (!$posthog) return
    $posthog.identify(userId, props)
  }

  function resetUser() {
    if (!$posthog) return
    $posthog.reset()
  }

  return { track, identifyUser, resetUser }
}
```

The discriminated union means `track('memory_uploaded', { circle_id })` fails at compile (missing `memory_type`, `visibility`, `media_count`).

## 3. Identity wiring

- After successful login/signup OTP, call `identifyUser(user.id, { circle_count })`. Best site: wherever the session is first observed becoming non-null (likely a watcher in the app shell or a layout setup hook).
- On logout, call `resetUser()` to detach the anonymous ID from the previous person.
- Pre-auth events (e.g., visiting `/`) attach to the anonymous distinct_id and get aliased on identify — PostHog handles this automatically.

## 4. Events catalog

| Event                     | Fired from                                                   | Properties                                            |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `user_signed_up`          | `app/pages/confirm.vue` (post-OTP success, first session)    | `{ method: 'email' }`                                 |
| `circle_created`          | Wherever the Circle insert succeeds (onboarding circle page) | `{ circle_id, circle_type }`                          |
| `member_invited`          | Invite link copy/share UI                                    | `{ circle_id, invite_method: 'link' }`                |
| `member_joined`           | `app/pages/invite/[token].vue` on accept                     | `{ circle_id, joined_via: 'invite' }`                 |
| `memory_uploaded`         | `app/components/UploadMemory.vue` post-success               | `{ circle_id, memory_type, visibility, media_count }` |
| `memory_shared_to_circle` | Same site, when `visibility === 'circle'`                    | `{ circle_id, memory_id }`                            |
| `comment_added`           | Comment composer submit success                              | `{ circle_id, memory_id }`                            |
| `reaction_added`          | Reaction picker tap                                          | `{ circle_id, memory_id, emoji }`                     |
| `milestone_created`       | Milestone creation UI submit                                 | `{ circle_id, milestone_type }`                       |
| `export_requested`        | Export trigger UI                                            | `{ circle_id, format: 'zip' }`                        |
| `subscription_upgraded`   | Stripe checkout success (Phase 2)                            | `{ tier: 'plus', interval }`                          |
| `subscription_cancelled`  | Cancel handler (Phase 2)                                     | `{ tier: 'plus' }`                                    |

**`memory_type` derivation:** at the Memory level, derived from items: `note` if only text slides, `photo`/`video` if uniform, `mixed` if heterogeneous.

## 5. Privacy guards

- `autocapture: false` — no DOM scraping
- Payloads contain only IDs and enums — never user-generated text, emails, file names, or URLs
- Person profile holds `{ circle_count }` only
- `respect_dnt: true` — DNT browsers send zero events
- Session recording: disabled
- Feature flags: not initialized in Phase 1

## 6. Config

### `nuxt.config.ts`

Add to `runtimeConfig.public`:

```ts
runtimeConfig: {
  public: {
    posthogKey: '',           // NUXT_PUBLIC_POSTHOG_KEY
    posthogHost: 'https://eu.i.posthog.com',  // NUXT_PUBLIC_POSTHOG_HOST
  },
},
```

### `.env.example`

```
NUXT_PUBLIC_POSTHOG_KEY=
NUXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

## 7. Testing

### Unit

- `unit/analytics.test.ts`
  - composable returns no-op functions when `$posthog` is undefined (simulates missing key)
  - composable calls `$posthog.capture` with exact event name + props when `$posthog` is present (mock)
  - `identifyUser` and `resetUser` similarly proxy through to mock

### Type-check

- A non-runnable snippet at the bottom of the test file with `// @ts-expect-error` markers verifies the discriminated union rejects wrong event names and missing props at compile time.

### Manual verification

1. Set `NUXT_PUBLIC_POSTHOG_KEY` in local `.env` to a dev project key
2. `pnpm dev`, sign up, create a circle, upload a photo
3. Open PostHog EU dashboard → Activity → Live events. Verify: `user_signed_up`, `circle_created`, `memory_uploaded`, `memory_shared_to_circle` appear in order, each with a distinct_id matching the new user's ID
4. Sign out → verify subsequent events use a fresh anonymous distinct_id

## 8. Out of Scope (Phase 2)

- Server-side capture (`posthog-node` from Edge Functions)
- Session recordings
- Feature flags / A/B testing via PostHog
- Settings-page analytics opt-out toggle (DNT covers it for Phase 1)
- Stripe call sites (catalog entries reserved)
- Custom dashboards / saved insights (set up in PostHog UI, not code)

## 9. Build order

1. `nuxt.config.ts` + `.env.example` (env wiring)
2. `plugins/posthog.client.ts`
3. `app/composables/useAnalytics.ts` + unit tests (TDD)
4. Identity wiring in session watcher
5. Call sites, one or two events per commit (keep diffs small)
6. Manual verification in PostHog EU dashboard

## 10. Docs updates

- `docs/build-plan.md` §1.7 → mark complete with implementation notes
- `docs/design-spec.md` analytics section (lines 2385-2436): replace self-hosted block with Cloud EU; preserve event catalog and key metrics; note `respect_dnt` + identify-on-auth policy
