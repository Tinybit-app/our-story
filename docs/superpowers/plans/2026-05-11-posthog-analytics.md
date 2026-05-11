# PostHog Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire PostHog Cloud EU analytics into the Nuxt client with a typed, explicit 12-event catalog and no PII.

**Architecture:** A client-only Nuxt plugin initializes `posthog-js` (autocapture off, DNT respected). A pure factory function `createAnalytics(posthog)` provides typed `track`, `identifyUser`, `resetUser` methods — easy to unit-test. A Nuxt composable `useAnalytics()` wraps the factory using `useNuxtApp().$posthog`. Identity is set once after login (`identify(user.id, { circle_count })`) and cleared on logout (`reset()`). Each event call site lives at the natural action site (post-upload, comment submit, etc.).

**Tech Stack:** Nuxt 3/4, `posthog-js`, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-11-posthog-analytics-design.md`

---

## File Structure

**Create:**
- `app/plugins/posthog.client.ts` — initializes posthog-js, provides `$posthog`
- `app/composables/useAnalytics.ts` — `createAnalytics(posthog)` factory + `useAnalytics()` composable
- `unit/useAnalytics.test.ts` — vitest unit tests for the factory

**Modify:**
- `nuxt.config.ts:103-108` — add `posthogKey`, `posthogHost` to `runtimeConfig.public`
- `.env.example` — add `NUXT_PUBLIC_POSTHOG_KEY`, `NUXT_PUBLIC_POSTHOG_HOST`
- `package.json` — add `posthog-js`
- `app/app.vue` — watch supabase user, identify/reset
- `app/pages/confirm.vue` — emit `user_signed_up` on successful OTP
- Circle creation site (onboarding page or `circle-settings.vue` for adding a circle) — emit `circle_created`
- `app/components/ShareLinksSheet.vue` or invite UI — emit `member_invited`
- `app/pages/invite/[token].vue` — emit `member_joined`
- `app/components/UploadMemory.vue` — emit `memory_uploaded` + `memory_shared_to_circle`
- `app/components/MemoryModal.vue` — emit `comment_added`, `reaction_added`
- `app/components/MilestoneShareModal.vue` — emit `milestone_created`
- `app/pages/settings/account.vue` — emit `export_requested`
- `docs/build-plan.md` §1.7 — mark complete with implementation notes
- `docs/design-spec.md` analytics section — replace self-hosted block with Cloud EU

---

## Task 1: Install posthog-js

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the SDK**

Run: `pnpm add posthog-js`
Expected: `posthog-js` appears in `dependencies`, lockfile updated.

- [ ] **Step 2: Verify**

Run: `grep posthog-js package.json`
Expected: `"posthog-js": "^1.x.x"` line.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add posthog-js for analytics"
```

---

## Task 2: Add env vars and runtimeConfig

**Files:**
- Modify: `.env.example`
- Modify: `nuxt.config.ts:103-108`

- [ ] **Step 1: Append PostHog env section to `.env.example`**

Add at the end of `.env.example`:

```
# PostHog — analytics (Phase 1, Cloud EU)
# https://eu.posthog.com → Project Settings → API key
# Leave empty locally to disable events in dev (plugin no-ops)
NUXT_PUBLIC_POSTHOG_KEY=
NUXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

- [ ] **Step 2: Add to `runtimeConfig.public` in `nuxt.config.ts`**

Locate the `public:` block (currently around line 103):

```ts
public: {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  sentryDsn: process.env.SENTRY_DSN,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
},
```

Change to:

```ts
public: {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  sentryDsn: process.env.SENTRY_DSN,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  posthogKey: process.env.NUXT_PUBLIC_POSTHOG_KEY,
  posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
},
```

- [ ] **Step 3: Verify Nuxt config still loads**

Run: `pnpm typecheck` (or `pnpm dev --no-launch` if no typecheck script — abort with Ctrl-C once it boots without errors)
Expected: no TypeScript errors related to `nuxt.config.ts`.

- [ ] **Step 4: Commit**

```bash
git add .env.example nuxt.config.ts
git commit -m "feat(analytics): wire posthog env vars into runtimeConfig"
```

---

## Task 3: Create the Nuxt client plugin

**Files:**
- Create: `app/plugins/posthog.client.ts`

- [ ] **Step 1: Write the plugin**

Create `app/plugins/posthog.client.ts`:

```ts
import posthog from "posthog-js"

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const key = config.public.posthogKey as string | undefined
  const host = (config.public.posthogHost as string) || "https://eu.i.posthog.com"

  // No key set (typical in local dev) → plugin no-ops, composable will see undefined
  if (!key) {
    return {
      provide: { posthog: null },
    }
  }

  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: true,
    persistence: "localStorage",
    respect_dnt: true,
    disable_session_recording: true,
  })

  return {
    provide: { posthog },
  }
})
```

- [ ] **Step 2: Add TypeScript shim for `$posthog`**

Append to `app/types/database.ts` (or create `app/types/nuxt.d.ts` if neater — but the project keeps types in `app/types/`):

Create `app/types/nuxt.d.ts`:

```ts
import type { PostHog } from "posthog-js"

declare module "#app" {
  interface NuxtApp {
    $posthog: PostHog | null
  }
}

export {}
```

- [ ] **Step 3: Run dev server to verify plugin loads cleanly**

Run: `pnpm dev` (let it boot, hit `http://localhost:3000`, then Ctrl-C)
Expected: no console errors about `posthog`. With key unset, network tab shows no posthog requests.

- [ ] **Step 4: Commit**

```bash
git add app/plugins/posthog.client.ts app/types/nuxt.d.ts
git commit -m "feat(analytics): add posthog client plugin (autocapture off, DNT respected)"
```

---

## Task 4: Create useAnalytics composable with unit tests (TDD)

**Files:**
- Create: `unit/useAnalytics.test.ts`
- Create: `app/composables/useAnalytics.ts`

- [ ] **Step 1: Write the failing test**

Create `unit/useAnalytics.test.ts`:

```ts
/**
 * Analytics composable unit tests (build plan §1.7)
 *
 * Tests the pure factory createAnalytics(posthog) — the Nuxt composable
 * useAnalytics() just wraps this factory with useNuxtApp().$posthog.
 *
 * Covers:
 *   - No-op behavior when posthog is null (key unset / local dev)
 *   - Capture proxied through to posthog.capture with exact name + props
 *   - identifyUser and resetUser proxy through correctly
 */

import { describe, it, expect, vi } from "vitest"
import { createAnalytics } from "../app/composables/useAnalytics"

function makeMockPostHog() {
  return {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  }
}

describe("createAnalytics", () => {
  describe("when posthog is null (key unset)", () => {
    it("track is a no-op", () => {
      const a = createAnalytics(null)
      expect(() => a.track("user_signed_up", { method: "email" })).not.toThrow()
    })

    it("identifyUser is a no-op", () => {
      const a = createAnalytics(null)
      expect(() => a.identifyUser("user-123", { circle_count: 2 })).not.toThrow()
    })

    it("resetUser is a no-op", () => {
      const a = createAnalytics(null)
      expect(() => a.resetUser()).not.toThrow()
    })
  })

  describe("when posthog is present", () => {
    it("track calls posthog.capture with name and props", () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.track("memory_uploaded", {
        circle_id: "c1",
        memory_type: "photo",
        visibility: "circle",
        media_count: 3,
      })
      expect(ph.capture).toHaveBeenCalledWith("memory_uploaded", {
        circle_id: "c1",
        memory_type: "photo",
        visibility: "circle",
        media_count: 3,
      })
    })

    it("identifyUser calls posthog.identify with userId and props", () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.identifyUser("user-123", { circle_count: 2 })
      expect(ph.identify).toHaveBeenCalledWith("user-123", { circle_count: 2 })
    })

    it("identifyUser works without props", () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.identifyUser("user-123")
      expect(ph.identify).toHaveBeenCalledWith("user-123", undefined)
    })

    it("resetUser calls posthog.reset", () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.resetUser()
      expect(ph.reset).toHaveBeenCalledOnce()
    })

    it("track passes through circle_created event", () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.track("circle_created", { circle_id: "c1", circle_type: "parents" })
      expect(ph.capture).toHaveBeenCalledWith("circle_created", {
        circle_id: "c1",
        circle_type: "parents",
      })
    })

    it("track passes through reaction_added event with emoji", () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.track("reaction_added", { circle_id: "c1", memory_id: "m1", emoji: "❤️" })
      expect(ph.capture).toHaveBeenCalledWith("reaction_added", {
        circle_id: "c1",
        memory_id: "m1",
        emoji: "❤️",
      })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test unit/useAnalytics.test.ts`
Expected: FAIL — module `../app/composables/useAnalytics` not found / `createAnalytics` is not exported.

- [ ] **Step 3: Implement the composable**

Create `app/composables/useAnalytics.ts`:

```ts
import type { PostHog } from "posthog-js"

/**
 * Discriminated union of every analytics event in the Phase 1 catalog.
 * Adding a new event = adding a variant here. TypeScript enforces the
 * (name, props) shape at every call site — no string typos, no rogue
 * properties.
 *
 * Spec: docs/superpowers/specs/2026-05-11-posthog-analytics-design.md §2
 */
export type AnalyticsEvent =
  | { name: "user_signed_up"; props: { method: "email" } }
  | { name: "circle_created"; props: { circle_id: string; circle_type: string } }
  | { name: "member_invited"; props: { circle_id: string; invite_method: "link" } }
  | { name: "member_joined"; props: { circle_id: string; joined_via: "invite" } }
  | {
      name: "memory_uploaded"
      props: {
        circle_id: string
        memory_type: "photo" | "video" | "note" | "mixed"
        visibility: "circle" | "private"
        media_count: number
      }
    }
  | { name: "memory_shared_to_circle"; props: { circle_id: string; memory_id: string } }
  | { name: "comment_added"; props: { circle_id: string; memory_id: string } }
  | { name: "reaction_added"; props: { circle_id: string; memory_id: string; emoji: string } }
  | { name: "milestone_created"; props: { circle_id: string; milestone_type: string } }
  | { name: "export_requested"; props: { circle_id: string; format: "zip" } }
  | { name: "subscription_upgraded"; props: { tier: "plus"; interval: "monthly" | "annual" } }
  | { name: "subscription_cancelled"; props: { tier: "plus" } }

type EventName = AnalyticsEvent["name"]
type PropsFor<N extends EventName> = Extract<AnalyticsEvent, { name: N }>["props"]

/**
 * Pure factory — easy to unit test without Nuxt context.
 * Pass `null` to no-op (matches the "key unset / DNT browser" case where
 * the plugin provides `$posthog: null`).
 */
export function createAnalytics(posthog: PostHog | null) {
  return {
    track<N extends EventName>(name: N, props: PropsFor<N>) {
      if (!posthog) return
      posthog.capture(name, props)
    },
    identifyUser(userId: string, props?: { circle_count?: number }) {
      if (!posthog) return
      posthog.identify(userId, props)
    },
    resetUser() {
      if (!posthog) return
      posthog.reset()
    },
  }
}

/**
 * Nuxt composable — wraps the factory with `useNuxtApp().$posthog`.
 */
export function useAnalytics() {
  const { $posthog } = useNuxtApp()
  return createAnalytics(($posthog as PostHog | null) ?? null)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test unit/useAnalytics.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useAnalytics.ts unit/useAnalytics.test.ts
git commit -m "feat(analytics): typed useAnalytics composable + tests"
```

---

## Task 5: Wire identify on auth state, reset on logout

**Files:**
- Modify: `app/app.vue`

- [ ] **Step 1: Inspect current `app/app.vue`**

Run: `cat app/app.vue`
Expected output:

```vue
<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
```

- [ ] **Step 2: Add a watcher that identifies the user when session resolves**

Rewrite `app/app.vue`:

```vue
<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const { identifyUser, resetUser } = useAnalytics()
const supabase = useSupabaseClient()

// Track the last identified user.id so we don't re-identify on every render
const lastIdentifiedId = ref<string | null>(null)

watchEffect(async () => {
  const u = user.value
  if (u && u.id !== lastIdentifiedId.value) {
    // Fetch a lightweight property for the person profile — circle count.
    // Failure here must not block the app; analytics is best-effort.
    let circleCount: number | undefined
    try {
      const { count } = await supabase
        .from("CircleMember")
        .select("*", { count: "exact", head: true })
        .eq("user_id", u.id)
      circleCount = count ?? undefined
    } catch {
      circleCount = undefined
    }
    identifyUser(u.id, circleCount !== undefined ? { circle_count: circleCount } : undefined)
    lastIdentifiedId.value = u.id
  } else if (!u && lastIdentifiedId.value) {
    resetUser()
    lastIdentifiedId.value = null
  }
})
</script>
```

- [ ] **Step 3: Manual smoke test**

Run: `pnpm dev`
Open: `http://localhost:3000` in a browser with `NUXT_PUBLIC_POSTHOG_KEY` set in `.env`
Log in, then open DevTools → Network → filter `i.posthog.com`
Expected: an `/e/` request with `distinct_id` matching `user.id` and an `$identify` event payload. Without the key set, no requests at all.
Then log out → expect a `$create_alias`/`reset` or just no further posthog requests under the old ID.

- [ ] **Step 4: Commit**

```bash
git add app/app.vue
git commit -m "feat(analytics): identify supabase user on login, reset on logout"
```

---

## Task 6: Emit user_signed_up on confirm.vue

**Files:**
- Modify: `app/pages/confirm.vue`

- [ ] **Step 1: Locate the OTP success branch**

Run: `grep -n "verifyOtp\|signInWithOtp\|router.push\|navigateTo" app/pages/confirm.vue`
Expected: lines showing where verification succeeds and the user is redirected (e.g., to `/onboarding` or `/timeline`).

- [ ] **Step 2: Emit `user_signed_up` once, only on first-ever confirm**

The confirm page is hit on every magic-link login. We only want `user_signed_up` on the **initial** signup — distinguish using `created_at` vs `last_sign_in_at` from `useSupabaseUser()` returned after verifyOtp resolves.

In the success block (right after `verifyOtp` resolves successfully and before the redirect), add:

```ts
const { track } = useAnalytics()
const u = useSupabaseUser()

// Heuristic: first sign-in if last_sign_in_at is null or equals created_at.
// Supabase sets last_sign_in_at AFTER verifyOtp returns, so check created_at distance.
if (u.value) {
  const created = new Date(u.value.created_at).getTime()
  const lastSignIn = u.value.last_sign_in_at
    ? new Date(u.value.last_sign_in_at).getTime()
    : created
  // First sign-in if created and last_sign_in differ by less than 5 seconds
  if (Math.abs(lastSignIn - created) < 5000) {
    track("user_signed_up", { method: "email" })
  }
}
```

Place `const { track } = useAnalytics()` near the other composable calls at the top of `<script setup>`, and the conditional `track(...)` block inside the OTP success handler.

- [ ] **Step 3: Manual verify**

Run: `pnpm dev`, in incognito sign up with a fresh email, complete OTP.
Open DevTools → Network → `i.posthog.com` → confirm one event named `user_signed_up` with `properties.method = "email"`.

- [ ] **Step 4: Commit**

```bash
git add app/pages/confirm.vue
git commit -m "feat(analytics): emit user_signed_up on initial OTP confirm"
```

---

## Task 7: Emit circle_created on successful circle insert

**Files:**
- Modify: circle creation site

- [ ] **Step 1: Locate circle creation calls**

Run: `grep -rn "from('Circle')\|from(\"Circle\")" app/pages app/components | grep -i "insert" | head -10`
Expected: locations where a new Circle row is inserted. Most likely: `app/pages/onboarding/` step or `app/pages/circle-settings.vue` (when adding a new circle).

- [ ] **Step 2: Add the event right after a successful insert**

In each circle-create site, after the insert resolves successfully and you have the new circle row (`data.id`, `data.circle_type`), add:

```ts
const { track } = useAnalytics()

// ... after insert succeeds and you have the new circle row:
track("circle_created", {
  circle_id: newCircle.id,
  circle_type: newCircle.circle_type,
})
```

Add `const { track } = useAnalytics()` once at the top of `<script setup>` if not already present.

- [ ] **Step 3: Manual verify**

Run: `pnpm dev`, log in, create a new circle.
DevTools → Network → confirm a `circle_created` event with `circle_id` and `circle_type` matching what you just created.

- [ ] **Step 4: Commit**

```bash
git add app/pages/
git commit -m "feat(analytics): emit circle_created on Circle insert"
```

---

## Task 8: Emit member_invited and member_joined

**Files:**
- Modify: invite-link UI (likely `app/components/ShareLinksSheet.vue` or similar; grep to find)
- Modify: `app/pages/invite/[token].vue`

- [ ] **Step 1: Locate the "create invite" / "copy invite link" site**

Run: `grep -rln "from('CircleInvite')\|from(\"CircleInvite\")" app/ | head -5`
Run: `grep -rn "invite.*copy\|copyInvite\|invite.*link" app/components app/pages | head -10`
Expected: the file where a new `CircleInvite` row is created or where a link is generated. Most likely `app/components/ShareLinksSheet.vue`.

- [ ] **Step 2: Emit `member_invited` after a successful invite-link creation**

At the place where the invite is successfully created (immediately after the insert resolves), add:

```ts
const { track } = useAnalytics()

// ... after CircleInvite insert succeeds:
track("member_invited", {
  circle_id: invite.circle_id,
  invite_method: "link",
})
```

- [ ] **Step 3: Locate the accept-invite handler**

Run: `grep -n "accept\|verifyOtp\|join\|navigateTo" app/pages/invite/\[token\].vue | head -20`
Expected: the success block where the user is added to the circle and redirected.

- [ ] **Step 4: Emit `member_joined` after a successful accept**

In the success block (after the user is added to the circle and you have `circleId`), add:

```ts
const { track } = useAnalytics()

// ... after circle join succeeds:
track("member_joined", {
  circle_id: circleId,
  joined_via: "invite",
})
```

- [ ] **Step 5: Manual verify**

`pnpm dev`, create an invite from one account → expect `member_invited`. Open the invite link in incognito with a fresh email → after accept → expect `member_joined`.

- [ ] **Step 6: Commit**

```bash
git add app/components/ShareLinksSheet.vue app/pages/invite/\[token\].vue
git commit -m "feat(analytics): emit member_invited and member_joined"
```

---

## Task 9: Emit memory_uploaded + memory_shared_to_circle

**Files:**
- Modify: `app/components/UploadMemory.vue`

- [ ] **Step 1: Locate the upload success branch**

Run: `grep -n "upload-batch\|upload-media\|memory_id\|emit('uploaded'" app/components/UploadMemory.vue | head -20`
Expected: where the upload POST resolves and we have the new memory's id, visibility, and item info.

- [ ] **Step 2: Derive `memory_type` from the items**

Just before the existing success/emit block (where the memory's items are known), compute:

```ts
type ItemType = "photo" | "video" | "note"
function deriveMemoryType(items: { type?: string | null }[]): "photo" | "video" | "note" | "mixed" {
  const kinds = new Set<ItemType>()
  for (const it of items) {
    if (it.type === "text") kinds.add("note")
    else if (it.type === "video") kinds.add("video")
    else kinds.add("photo")  // photo or unspecified image fallback
  }
  if (kinds.size > 1) return "mixed"
  return kinds.values().next().value ?? "photo"
}
```

You can place `deriveMemoryType` as a local function inside `<script setup>` (not exported).

- [ ] **Step 3: Emit the events after upload success**

In the success branch, after the memory is created:

```ts
const { track } = useAnalytics()

// after upload success — you have: memoryId, circleId, items, visibility
const memoryType = deriveMemoryType(items)
track("memory_uploaded", {
  circle_id: circleId,
  memory_type: memoryType,
  visibility: visibility as "circle" | "private",
  media_count: items.length,
})
if (visibility === "circle") {
  track("memory_shared_to_circle", {
    circle_id: circleId,
    memory_id: memoryId,
  })
}
```

Adapt the variable names to whatever they're actually called in `UploadMemory.vue` (the surrounding code defines them — keep edits surgical).

- [ ] **Step 4: Manual verify**

`pnpm dev`, upload a photo → expect `memory_uploaded` (photo) + `memory_shared_to_circle`. Upload a quick note → expect `memory_uploaded` with `memory_type: "note"`. Upload a photo + note in one memory → expect `memory_type: "mixed"`.

- [ ] **Step 5: Commit**

```bash
git add app/components/UploadMemory.vue
git commit -m "feat(analytics): emit memory_uploaded and memory_shared_to_circle"
```

---

## Task 10: Emit comment_added and reaction_added

**Files:**
- Modify: `app/components/MemoryModal.vue`

- [ ] **Step 1: Locate `toggleReaction` and the comment submit handler**

Run: `grep -n "toggleReaction\|addComment\|insertComment\|submitComment\|from('Comment')\|from(\"Reaction\"" app/components/MemoryModal.vue | head -20`
Expected: the function bodies that perform the insert. `toggleReaction` is at `app/components/MemoryModal.vue:985`.

- [ ] **Step 2: Emit `reaction_added` only when adding (not removing)**

Inside `toggleReaction(emoji)`, locate the branch where the insert succeeds (as opposed to the delete/remove branch). Add:

```ts
const { track } = useAnalytics()

// after a successful insert into Reaction (NOT after a delete):
track("reaction_added", {
  circle_id: props.memory.circle_id,
  memory_id: props.memory.id,
  emoji,
})
```

Toggling off a reaction (delete) should NOT emit any event — only the add half of the toggle fires.

- [ ] **Step 3: Emit `comment_added` after a successful comment insert**

Find the comment submit handler. After the comment is inserted successfully:

```ts
track("comment_added", {
  circle_id: props.memory.circle_id,
  memory_id: props.memory.id,
})
```

Place the `const { track } = useAnalytics()` call once at the top of `<script setup>` (only if not already added).

- [ ] **Step 4: Manual verify**

`pnpm dev`, open a memory, add a comment → expect `comment_added`. Tap a reaction emoji → expect `reaction_added` with the right emoji. Tap the same emoji again to remove → expect NO new event.

- [ ] **Step 5: Commit**

```bash
git add app/components/MemoryModal.vue
git commit -m "feat(analytics): emit comment_added and reaction_added"
```

---

## Task 11: Emit milestone_created

**Files:**
- Modify: milestone creation site (likely `app/components/MilestoneShareModal.vue` or wherever Milestone inserts happen)

- [ ] **Step 1: Locate the milestone insert call**

Run: `grep -rn "from('Milestone')\|from(\"Milestone\")" app/ | head -5`
Expected: the place where a new Milestone row is created, with `milestone_type` available.

- [ ] **Step 2: Emit `milestone_created` after a successful insert**

```ts
const { track } = useAnalytics()

// after Milestone insert succeeds:
track("milestone_created", {
  circle_id: milestone.circle_id,
  milestone_type: milestone.milestone_type,
})
```

- [ ] **Step 3: Manual verify**

`pnpm dev`, create a milestone → expect `milestone_created` with `milestone_type` matching the value inserted (e.g., `"6mo"`, `"1yr"`, `"first_steps"`).

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat(analytics): emit milestone_created"
```

---

## Task 12: Emit export_requested

**Files:**
- Modify: `app/pages/settings/account.vue`

- [ ] **Step 1: Locate the export trigger**

Run: `grep -n "export\|requestExport\|/api/account/export" app/pages/settings/account.vue | head -10`
Expected: the function that POSTs to `/api/account/export`.

- [ ] **Step 2: Emit `export_requested` after a successful POST**

In the success branch (after the export API returns 2xx), add:

```ts
const { track } = useAnalytics()

// after /api/account/export resolves successfully:
track("export_requested", {
  circle_id: activeCircleId,  // whichever circle this export is for
  format: "zip",
})
```

Use whatever the existing variable name is for the active/exporting circle id.

- [ ] **Step 3: Manual verify**

`pnpm dev`, trigger an export from the settings page → expect `export_requested`.

- [ ] **Step 4: Commit**

```bash
git add app/pages/settings/account.vue
git commit -m "feat(analytics): emit export_requested"
```

---

## Task 13: End-to-end verification + docs update

**Files:**
- Modify: `docs/build-plan.md`
- Modify: `docs/design-spec.md`

- [ ] **Step 1: Full event-flow smoke test**

Set `NUXT_PUBLIC_POSTHOG_KEY` in `.env` to a dev project key.
Run: `pnpm dev`
Walk the funnel in one session, with PostHog EU dashboard open at https://eu.posthog.com → Activity → Live events:

1. Sign up with a new email → expect `user_signed_up` + `$identify`
2. Create a circle → `circle_created`
3. Send an invite → `member_invited`
4. Open invite in incognito with another email → after accept: `member_joined`
5. Upload a photo (visibility = circle) → `memory_uploaded` + `memory_shared_to_circle`
6. Open the memory, react with ❤️ → `reaction_added`
7. Add a comment → `comment_added`
8. Create a milestone → `milestone_created`
9. Trigger an export → `export_requested`
10. Sign out → no further events under that distinct_id

Verify all distinct_ids match the user.id once identified, and `circle_count` appears on the person profile in PostHog.

- [ ] **Step 2: DNT smoke test**

In a browser with DNT enabled (Firefox Settings → Privacy → Send "Do Not Track"), repeat any one event. Confirm Network shows zero `i.posthog.com` requests.

- [ ] **Step 3: Update `docs/build-plan.md` §1.7**

Locate the §1.7 entry and mark it complete. Replace the placeholder/TODO line with:

```markdown
- [x] **1.7 PostHog analytics setup** — `posthog-js` plugin (`app/plugins/posthog.client.ts`),
      typed composable (`app/composables/useAnalytics.ts`), 12-event catalog wired at
      natural call sites. PostHog Cloud EU (not self-hosted). `autocapture: false`,
      `respect_dnt: true`. Identify on supabase user resolution; reset on logout.
      Stripe events (`subscription_upgraded`, `subscription_cancelled`) reserved in the
      catalog but no call site until Phase 2 billing.
```

- [ ] **Step 4: Update `docs/design-spec.md` analytics section**

Locate the analytics section (around line 2385). Replace the self-hosted block with:

```markdown
### Analytics — PostHog Cloud EU (Phase 1)

Use **PostHog Cloud EU** for Phase 1. Self-hosting at a subdomain remains an
option to revisit if data-sovereignty or scale demands it; at 0–50 users the
ops overhead is not worth it.

Init in a client-only plugin with `autocapture: false`, `capture_pageview: true`,
`persistence: 'localStorage'`, and `respect_dnt: true`. No PII in payloads —
IDs and enums only. Person profile holds `{ circle_count }` only.

Identify users by `user.id` after auth (`posthog.identify(user.id, { circle_count })`);
`posthog.reset()` on logout. Anonymous pre-auth events get aliased on identify
automatically.
```

Keep the existing event-catalog table and key-metrics list intact below — they're still accurate.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS — including the new `unit/useAnalytics.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add docs/build-plan.md docs/design-spec.md
git commit -m "docs: mark 1.7 complete, update spec to posthog cloud EU"
```

---

## Self-Review Notes

**Spec coverage:**
- Plugin config (autocapture, DNT, persistence, host) → Task 3 ✓
- Typed composable + discriminated union → Task 4 ✓
- Identify on auth, reset on logout → Task 5 ✓
- All 12 events (10 real + 2 reserved Stripe) → Tasks 6–12 ✓
- Stripe events reserved-only → noted in spec §1 of plan and design spec ✓
- PII guards (no emails/names/notes; IDs only) → enforced by the discriminated union ✓
- `respect_dnt` → Task 3 plugin config ✓
- No server-side capture → no Edge Function changes in plan ✓
- Env wiring → Task 2 ✓
- Tests → Task 4 ✓
- Docs → Task 13 ✓

**Type consistency:** `track` / `identifyUser` / `resetUser` are the only three method names — used identically across Tasks 4, 5, 6–12.

**Placeholder scan:** every step shows code or an exact grep command. No TBDs.
