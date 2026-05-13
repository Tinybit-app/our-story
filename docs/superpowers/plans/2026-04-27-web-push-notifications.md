# Web Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Web Push notifications so circle members are alerted when new memories, comments, or reactions are shared.

**Architecture:** PWA manifest + service worker for push reception. VAPID-signed Web Push via `web-push` npm package, dispatched inline from Nitro server routes. Upload notifications triggered by client post-upload via a dedicated API route. Batch coalescing via notification tags (browser replaces, no server-side timers). Notification preferences checked server-side before each send.

**Tech Stack:** web-push (npm), Service Worker Push API, Notification API, Supabase (PushSubscription table + RLS)

**Spec:** `docs/superpowers/specs/2026-04-27-web-push-notifications-design.md`

---

## File Structure

### New files

| File                                             | Responsibility                                            |
| ------------------------------------------------ | --------------------------------------------------------- |
| `public/manifest.json`                           | PWA web app manifest                                      |
| `public/sw.js`                                   | Service worker — push event + notification click handlers |
| `public/icon-192.png`                            | App icon 192x192 for manifest + notifications             |
| `public/icon-512.png`                            | App icon 512x512 for manifest                             |
| `app/plugins/service-worker.client.ts`           | Registers service worker on app mount                     |
| `app/composables/usePushNotifications.ts`        | Client-side push subscription management                  |
| `app/components/PushPromptBanner.vue`            | Contextual banner prompting user to enable push           |
| `supabase/migrations/026_push_subscriptions.sql` | PushSubscription table + RLS policies                     |
| `server/api/push/subscribe.post.ts`              | Store push subscription                                   |
| `server/api/push/subscribe.delete.ts`            | Remove push subscription                                  |
| `server/api/push/notify.post.ts`                 | Dispatch push for uploads (called by client)              |
| `server/utils/pushNotify.ts`                     | Core push dispatch utility                                |
| `unit/pushNotify.test.ts`                        | Unit tests for push notification logic                    |

### Modified files

| File                                         | Change                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `nuxt.config.ts`                             | Add manifest link to `app.head`, add VAPID public key to `runtimeConfig.public`, add VAPID private key + subject to `runtimeConfig` |
| `app/components/UploadMemory.vue`            | Call `POST /api/push/notify` after successful upload                                                                                |
| `server/api/memories/[id]/comments.post.ts`  | Call `sendPushToCircle()` after comment insert                                                                                      |
| `server/api/memories/[id]/reactions.post.ts` | Call `sendPushToCircle()` after reaction insert (only for new reactions, not removals)                                              |
| `server/api/memories/quick-note.post.ts`     | Call `sendPushToCircle()` after quick note insert                                                                                   |
| `app/pages/timeline/index.vue`               | Add `PushPromptBanner` component                                                                                                    |
| `app/pages/circle-settings.vue`              | Add push on/off + mute toggles                                                                                                      |
| `app/types/database.ts`                      | Regenerate to include PushSubscription table                                                                                        |
| `supabase/tests/rls.test.sql`                | Add RLS tests for PushSubscription                                                                                                  |
| `docs/build-plan.md`                         | Update 10.1 description, add 10.3                                                                                                   |

---

## Task 1: Database Migration — PushSubscription Table

**Files:**

- Create: `supabase/migrations/026_push_subscriptions.sql`
- Modify: `supabase/tests/rls.test.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/026_push_subscriptions.sql`:

```sql
-- Push subscription storage for Web Push notifications
CREATE TABLE PushSubscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscription_user ON PushSubscription(user_id);

-- RLS
ALTER TABLE PushSubscription ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own push subscriptions"
  ON PushSubscription FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own push subscriptions"
  ON PushSubscription FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own push subscriptions"
  ON PushSubscription FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Add RLS tests for PushSubscription**

In `supabase/tests/rls.test.sql`, increment the plan count by 4 and add these tests after the existing tests (before `SELECT * FROM finish();`):

```sql
-- ============================================================
-- PUSH SUBSCRIPTION RLS
-- ============================================================

-- Fixture: push subscription for user_a
INSERT INTO public.PushSubscription (id, user_id, endpoint, p256dh, auth)
VALUES ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
        'https://push.example.com/user_a', 'p256dh_key_a', 'auth_key_a');

-- user_a can read own push subscriptions
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
SELECT results_eq(
  $$ SELECT count(*)::int FROM PushSubscription WHERE user_id = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY[1],
  'user_a can read own push subscriptions'
);

-- user_b cannot read user_a push subscriptions
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002"}';
SELECT results_eq(
  $$ SELECT count(*)::int FROM PushSubscription WHERE user_id = '00000000-0000-0000-0000-000000000001' $$,
  ARRAY[0],
  'user_b cannot read user_a push subscriptions'
);

-- user_b cannot delete user_a push subscriptions
SELECT throws_ok(
  $$ DELETE FROM PushSubscription WHERE user_id = '00000000-0000-0000-0000-000000000001' $$,
  NULL,
  'user_b cannot delete user_a push subscriptions'
);

-- user_a can delete own push subscriptions
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
SELECT lives_ok(
  $$ DELETE FROM PushSubscription WHERE id = '50000000-0000-0000-0000-000000000001' $$,
  'user_a can delete own push subscriptions'
);
```

- [ ] **Step 3: Reset database and run RLS tests**

Run: `pnpm db:reset && pnpm db:test`
Expected: All tests pass including the 4 new PushSubscription tests.

- [ ] **Step 4: Regenerate TypeScript types**

Run: `pnpm db:types`
Verify `app/types/database.ts` now includes `PushSubscription` with `Row`, `Insert`, `Update` types.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/026_push_subscriptions.sql supabase/tests/rls.test.sql app/types/database.ts
git commit -m "feat(push): add PushSubscription table with RLS"
```

---

## Task 2: PWA Foundation — Manifest + Service Worker

**Files:**

- Create: `public/manifest.json`, `public/sw.js`, `public/icon-192.png`, `public/icon-512.png`, `app/plugins/service-worker.client.ts`
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Create the web app manifest**

Create `public/manifest.json`:

```json
{
  "name": "Our Story",
  "short_name": "Our Story",
  "start_url": "/timeline",
  "display": "standalone",
  "background_color": "#fffdf8",
  "theme_color": "#fffdf8",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create app icons**

Generate `public/icon-192.png` (192x192) and `public/icon-512.png` (512x512) from the existing brand/favicon. These are simple placeholder icons — can be refined later. Use a solid background with "OS" text or the app's visual identity.

- [ ] **Step 3: Create the service worker**

Create `public/sw.js`:

```js
// Service worker for Web Push notifications
// No offline caching — that's milestone 11

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      tag: data.tag,
      renotify: data.renotify !== false,
      data: { url: data.data?.url || '/timeline' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/timeline'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      return clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 4: Create the service worker registration plugin**

Create `app/plugins/service-worker.client.ts`:

```ts
export default defineNuxtPlugin(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
  }
})
```

- [ ] **Step 5: Add manifest link to nuxt.config.ts**

In `nuxt.config.ts`, add to the `app.head.link` array:

```ts
{ rel: 'manifest', href: '/manifest.json' },
```

- [ ] **Step 6: Add VAPID keys to runtime config**

In `nuxt.config.ts`, add to `runtimeConfig`:

```ts
vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
vapidSubject: process.env.VAPID_SUBJECT,
```

And to `runtimeConfig.public`:

```ts
vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
```

- [ ] **Step 7: Generate VAPID keys and add to .env**

Run: `npx web-push generate-vapid-keys`

Add the output to your `.env` file:

```
VAPID_PUBLIC_KEY=<generated public key>
VAPID_PRIVATE_KEY=<generated private key>
VAPID_SUBJECT=mailto:hello@our-story.tinybit.app
```

- [ ] **Step 8: Install web-push dependency**

Run: `pnpm add web-push`

- [ ] **Step 9: Verify dev server starts and manifest loads**

Run: `pnpm dev`
Open browser → DevTools → Application tab → verify manifest is loaded and service worker is registered.

- [ ] **Step 10: Commit**

```bash
git add public/manifest.json public/sw.js public/icon-192.png public/icon-512.png app/plugins/service-worker.client.ts nuxt.config.ts package.json pnpm-lock.yaml
git commit -m "feat(push): add PWA manifest, service worker, and VAPID config"
```

---

## Task 3: Push Subscription API Routes

**Files:**

- Create: `server/api/push/subscribe.post.ts`, `server/api/push/subscribe.delete.ts`

- [ ] **Step 1: Create the subscribe endpoint**

Create `server/api/push/subscribe.post.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid subscription data.' })

  const { endpoint, keys } = result.data

  // Upsert: if endpoint already exists, update the keys (browser may regenerate)
  const { error } = await supabase
    .from('pushsubscription')
    .upsert(
      { user_id: user.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' },
    )

  if (error) {
    console.error('[push/subscribe] upsert error:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to save subscription.' })
  }

  return { ok: true }
})
```

- [ ] **Step 2: Create the unsubscribe endpoint**

Create `server/api/push/subscribe.delete.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  endpoint: z.string().url(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request.' })

  const { error } = await supabase
    .from('pushsubscription')
    .delete()
    .eq('endpoint', result.data.endpoint)
    .eq('user_id', user.sub)

  if (error) {
    console.error('[push/unsubscribe] delete error:', error.message)
    throw createError({ statusCode: 500, message: 'Failed to remove subscription.' })
  }

  return { ok: true }
})
```

- [ ] **Step 3: Verify routes respond**

Run: `pnpm dev`
Test with curl (expect 401 since no auth):

```bash
curl -X POST http://localhost:3000/api/push/subscribe -H "Content-Type: application/json" -d '{}'
```

Expected: 401 Unauthorized

- [ ] **Step 4: Commit**

```bash
git add server/api/push/subscribe.post.ts server/api/push/subscribe.delete.ts
git commit -m "feat(push): add subscribe/unsubscribe API routes"
```

---

## Task 4: Client Composable — usePushNotifications

**Files:**

- Create: `app/composables/usePushNotifications.ts`

- [ ] **Step 1: Create the composable**

Create `app/composables/usePushNotifications.ts`:

```ts
export function usePushNotifications() {
  const config = useRuntimeConfig()

  const isSupported = computed(
    () =>
      import.meta.client &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window,
  )

  const permissionState = ref<NotificationPermission>(
    import.meta.client && 'Notification' in window ? Notification.permission : 'default',
  )

  async function requestPermission(): Promise<boolean> {
    if (!isSupported.value) return false

    const permission = await Notification.requestPermission()
    permissionState.value = permission

    if (permission !== 'granted') return false

    try {
      const registration = await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.public.vapidPublicKey as string),
      })

      const raw = subscription.toJSON()
      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: {
          endpoint: raw.endpoint,
          keys: {
            p256dh: raw.keys!.p256dh,
            auth: raw.keys!.auth,
          },
        },
      })

      return true
    } catch (err) {
      console.error('[push] subscription failed:', err)
      return false
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!isSupported.value) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await $fetch('/api/push/subscribe', {
          method: 'DELETE',
          body: { endpoint },
        })
      }
    } catch (err) {
      console.error('[push] unsubscribe failed:', err)
    }
  }

  return { isSupported, permissionState, requestPermission, unsubscribe }
}

// Convert VAPID public key from base64url to Uint8Array for PushManager.subscribe()
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
```

- [ ] **Step 2: Verify composable is auto-imported**

Run: `pnpm dev`
In browser console or a test component, verify `usePushNotifications()` is available and `isSupported` returns a boolean.

- [ ] **Step 3: Commit**

```bash
git add app/composables/usePushNotifications.ts
git commit -m "feat(push): add usePushNotifications composable"
```

---

## Task 5: Push Dispatch Utility

**Files:**

- Create: `server/utils/pushNotify.ts`, `unit/pushNotify.test.ts`

- [ ] **Step 1: Write the unit tests**

Create `unit/pushNotify.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildPushPayload } from '../server/utils/pushNotify'

describe('buildPushPayload', () => {
  it('builds upload payload with note (singular)', () => {
    const payload = buildPushPayload({
      type: 'upload',
      actorName: 'Emma',
      circleId: 'circle-1',
      actorUserId: 'user-1',
      memoryId: 'mem-1',
      bodyText: 'First steps at the park',
      recentUploadCount: 1,
    })
    expect(payload.title).toBe('Emma added a memory')
    expect(payload.body).toBe('First steps at the park')
    expect(payload.tag).toBe('upload-circle-1-user-1')
    expect(payload.renotify).toBe(true)
    expect(payload.data.url).toBe('/timeline?circle=circle-1&memory=mem-1')
  })

  it('builds upload payload (plural, silent)', () => {
    const payload = buildPushPayload({
      type: 'upload',
      actorName: 'Emma',
      circleId: 'circle-1',
      actorUserId: 'user-1',
      memoryId: 'mem-3',
      bodyText: null,
      recentUploadCount: 5,
    })
    expect(payload.title).toBe('Emma added 5 memories')
    expect(payload.body).toBe("Check out what's new")
    expect(payload.tag).toBe('upload-circle-1-user-1')
    expect(payload.renotify).toBe(false)
  })

  it('builds upload payload without note (singular)', () => {
    const payload = buildPushPayload({
      type: 'upload',
      actorName: 'Dad',
      circleId: 'c-2',
      actorUserId: 'u-2',
      memoryId: 'm-2',
      bodyText: null,
      recentUploadCount: 1,
    })
    expect(payload.title).toBe('Dad added a memory')
    expect(payload.body).toBe('Shared a new memory')
  })

  it('builds comment payload', () => {
    const payload = buildPushPayload({
      type: 'comment',
      actorName: 'Mom',
      circleId: 'c-1',
      actorUserId: 'u-1',
      memoryId: 'm-1',
      bodyText: 'This is so cute!',
    })
    expect(payload.title).toBe('Mom commented')
    expect(payload.body).toBe('This is so cute!')
    expect(payload.tag).toBe('comment-c-1-u-1')
    expect(payload.renotify).toBe(true)
  })

  it('builds reaction payload', () => {
    const payload = buildPushPayload({
      type: 'reaction',
      actorName: 'Dad',
      circleId: 'c-1',
      actorUserId: 'u-1',
      memoryId: 'm-1',
      emoji: '❤️',
    })
    expect(payload.title).toBe('Dad reacted ❤️')
    expect(payload.body).toBe('')
    expect(payload.tag).toBe('reaction-c-1-u-1')
    expect(payload.renotify).toBe(true)
  })

  it('truncates long body text to 100 chars', () => {
    const longText = 'A'.repeat(150)
    const payload = buildPushPayload({
      type: 'comment',
      actorName: 'Mom',
      circleId: 'c-1',
      actorUserId: 'u-1',
      memoryId: 'm-1',
      bodyText: longText,
    })
    expect(payload.body.length).toBeLessThanOrEqual(103)
    expect(payload.body.endsWith('…')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- unit/pushNotify.test.ts`
Expected: FAIL — `buildPushPayload` is not defined.

- [ ] **Step 3: Write the push utility**

Create `server/utils/pushNotify.ts`:

```ts
import webpush from 'web-push'

// ─────────────────────────────────────────────────────────────
// Payload builder (exported for unit tests)
// ─────────────────────────────────────────────────────────────

interface PushPayloadInput {
  type: 'upload' | 'comment' | 'reaction'
  actorName: string
  circleId: string
  actorUserId: string
  memoryId: string
  bodyText?: string | null
  emoji?: string
  recentUploadCount?: number
}

interface PushPayload {
  title: string
  body: string
  tag: string
  renotify: boolean
  data: { url: string }
}

export function buildPushPayload(input: PushPayloadInput): PushPayload {
  const { type, actorName, circleId, actorUserId, memoryId } = input

  const url = `/timeline?circle=${circleId}&memory=${memoryId}`
  const tag = `${type}-${circleId}-${actorUserId}`

  let title: string
  let body: string
  let renotify = true

  switch (type) {
    case 'upload': {
      const count = input.recentUploadCount ?? 1
      renotify = count <= 1
      title = count > 1 ? `${actorName} added ${count} memories` : `${actorName} added a memory`
      body =
        count > 1
          ? "Check out what's new"
          : input.bodyText
            ? truncate(input.bodyText, 100)
            : 'Shared a new memory'
      break
    }
    case 'comment':
      title = `${actorName} commented`
      body = input.bodyText ? truncate(input.bodyText, 100) : ''
      break
    case 'reaction':
      title = `${actorName} reacted ${input.emoji ?? ''}`
      body = ''
      break
  }

  return { title, body, tag, renotify, data: { url } }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

// ─────────────────────────────────────────────────────────────
// Push dispatcher
// ─────────────────────────────────────────────────────────────

export async function sendPushToCircle(
  supabase: any,
  circleId: string,
  excludeUserId: string,
  payload: PushPayload,
): Promise<void> {
  const config = useRuntimeConfig()

  webpush.setVapidDetails(
    config.vapidSubject as string,
    config.public.vapidPublicKey as string,
    config.vapidPrivateKey as string,
  )

  // 1. Get all circle members except the actor
  const { data: members } = await supabase
    .from('circlemember')
    .select('user_id')
    .eq('circle_id', circleId)
    .neq('user_id', excludeUserId)

  if (!members?.length) return

  const memberIds = members.map((m: any) => m.user_id)

  // 2. Check notification preferences — skip muted or push-disabled
  const { data: prefs } = await supabase
    .from('notificationpreference')
    .select('user_id, push_enabled, circle_muted, quiet_hours_start, quiet_hours_end')
    .eq('circle_id', circleId)
    .in('user_id', memberIds)

  const prefsMap = new Map<string, any>()
  for (const p of prefs ?? []) {
    prefsMap.set(p.user_id, p)
  }

  // Filter to users who should receive push
  const eligibleUserIds = memberIds.filter((uid: string) => {
    const pref = prefsMap.get(uid)
    if (!pref) return true // no prefs row → defaults (push_enabled=true, not muted)
    if (pref.circle_muted) return false
    if (!pref.push_enabled) return false
    if (pref.quiet_hours_start && pref.quiet_hours_end) {
      if (isWithinQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)) return false
    }
    return true
  })

  if (!eligibleUserIds.length) return

  // 3. Get push subscriptions for eligible users
  const { data: subscriptions } = await supabase
    .from('pushsubscription')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', eligibleUserIds)

  if (!subscriptions?.length) return

  // 4. Send push to each subscription (fire-and-forget)
  const pushPayload = JSON.stringify(payload)

  for (const sub of subscriptions) {
    webpush
      .sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
      )
      .catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — clean up
          await supabase.from('pushsubscription').delete().eq('id', sub.id)
        } else {
          console.error('[push] send failed:', err.message)
        }
      })
  }
}

function isWithinQuietHours(start: string, end: string): boolean {
  const now = new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`

  // Handle overnight ranges (e.g., 22:00 – 08:00)
  if (start <= end) {
    return hhmm >= start && hhmm < end
  }
  return hhmm >= start || hhmm < end
}
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `pnpm test -- unit/pushNotify.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/pushNotify.ts unit/pushNotify.test.ts
git commit -m "feat(push): add push dispatch utility with payload builder"
```

---

## Task 6: Notify API Route (Upload Trigger)

**Files:**

- Create: `server/api/push/notify.post.ts`

- [ ] **Step 1: Create the notify endpoint**

Create `server/api/push/notify.post.ts`:

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { buildPushPayload, sendPushToCircle } from '~/server/utils/pushNotify'

const bodySchema = z.object({
  memoryId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user?.sub) throw createError({ statusCode: 401 })

  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid request.' })
  const { memoryId } = result.data

  // Verify the memory exists and the caller is the owner
  const { data: memory } = await supabase
    .from('memory')
    .select('id, circle_id, owner_user_id, note, created_at')
    .eq('id', memoryId)
    .maybeSingle()

  if (!memory) throw createError({ statusCode: 404 })
  if (memory.owner_user_id !== user.sub) throw createError({ statusCode: 403 })

  // Get actor name
  const { data: actor } = await supabase
    .from('user')
    .select('first_name')
    .eq('id', user.sub)
    .single()

  const actorName = actor?.first_name ?? 'Someone'

  // Count recent uploads by this user in this circle (last 30 minutes) for coalescing
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('memory')
    .select('id', { count: 'exact', head: true })
    .eq('circle_id', memory.circle_id)
    .eq('owner_user_id', user.sub)
    .gte('created_at', thirtyMinAgo)

  const payload = buildPushPayload({
    type: 'upload',
    actorName,
    circleId: memory.circle_id,
    actorUserId: user.sub,
    memoryId,
    bodyText: memory.note,
    recentUploadCount: count ?? 1,
  })

  // Fire-and-forget — don't block the response
  sendPushToCircle(supabase, memory.circle_id, user.sub, payload).catch((err) =>
    console.error('[push/notify] dispatch error:', err),
  )

  return { ok: true }
})
```

- [ ] **Step 2: Commit**

```bash
git add server/api/push/notify.post.ts
git commit -m "feat(push): add upload notification endpoint"
```

---

## Task 7: Wire Push Into Existing Routes

**Files:**

- Modify: `server/api/memories/[id]/comments.post.ts`
- Modify: `server/api/memories/[id]/reactions.post.ts`
- Modify: `server/api/memories/quick-note.post.ts`
- Modify: `app/components/UploadMemory.vue`

- [ ] **Step 1: Add push to comments route**

In `server/api/memories/[id]/comments.post.ts`, add the import at the top:

```ts
import { buildPushPayload, sendPushToCircle } from '~/server/utils/pushNotify'
```

After the comment insert succeeds and before the fresh comments query (after line 43), add:

```ts
// Push notification (fire-and-forget)
const { data: actor } = await supabase.from('user').select('first_name').eq('id', user.sub).single()

const payload = buildPushPayload({
  type: 'comment',
  actorName: actor?.first_name ?? 'Someone',
  circleId: memory.circle_id,
  actorUserId: user.sub,
  memoryId,
  bodyText: body,
})

sendPushToCircle(supabase, memory.circle_id, user.sub, payload).catch((err) =>
  console.error('[push] comment notify error:', err),
)
```

- [ ] **Step 2: Add push to reactions route**

In `server/api/memories/[id]/reactions.post.ts`, add the import at the top:

```ts
import { buildPushPayload, sendPushToCircle } from '~/server/utils/pushNotify'
```

Inside the `else` block after a new reaction is inserted (after line 56), add:

```ts
// Push notification for new reaction (fire-and-forget)
const { data: actor } = await supabase.from('user').select('first_name').eq('id', user.sub).single()

const reactionPayload = buildPushPayload({
  type: 'reaction',
  actorName: actor?.first_name ?? 'Someone',
  circleId: memory.circle_id,
  actorUserId: user.sub,
  memoryId,
  emoji,
})

sendPushToCircle(supabase, memory.circle_id, user.sub, reactionPayload).catch((err) =>
  console.error('[push] reaction notify error:', err),
)
```

- [ ] **Step 3: Add push to quick-note route**

In `server/api/memories/quick-note.post.ts`, add the import at the top:

```ts
import { buildPushPayload, sendPushToCircle } from '~/server/utils/pushNotify'
```

After the memory is created and children/members are tagged (before the final return at line 66), add:

```ts
// Push notification (fire-and-forget)
const { data: actor } = await supabase.from('user').select('first_name').eq('id', user.sub).single()

// Count recent uploads for coalescing
const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
const { count: recentCount } = await supabase
  .from('memory')
  .select('id', { count: 'exact', head: true })
  .eq('circle_id', circleId)
  .eq('owner_user_id', user.sub)
  .gte('created_at', thirtyMinAgo)

const payload = buildPushPayload({
  type: 'upload',
  actorName: actor?.first_name ?? 'Someone',
  circleId,
  actorUserId: user.sub,
  memoryId: memory.id,
  bodyText: note,
  recentUploadCount: recentCount ?? 1,
})

sendPushToCircle(supabase, circleId, user.sub, payload).catch((err) =>
  console.error('[push] quick-note notify error:', err),
)
```

- [ ] **Step 4: Add push trigger to UploadMemory.vue**

In `app/components/UploadMemory.vue`, inside the `xhr.onload` handler, after the `Promise.allSettled` block for tagging children/members (around line 849), add a push notification call:

```ts
// Trigger push notification (fire-and-forget)
$fetch('/api/push/notify', {
  method: 'POST',
  body: { memoryId: result.memoryId },
}).catch(() => {}) // silent — push failure should never affect upload UX
```

- [ ] **Step 5: Run all unit tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/api/memories/[id]/comments.post.ts server/api/memories/[id]/reactions.post.ts server/api/memories/quick-note.post.ts app/components/UploadMemory.vue
git commit -m "feat(push): wire notifications into upload, comment, and reaction routes"
```

---

## Task 8: Push Prompt Banner

**Files:**

- Create: `app/components/PushPromptBanner.vue`
- Modify: `app/pages/timeline/index.vue`

- [ ] **Step 1: Create the banner component**

Create `app/components/PushPromptBanner.vue`:

```vue
<template>
  <div
    v-if="shouldShow"
    class="mx-5 mb-4 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
  >
    <div class="mt-0.5 flex-shrink-0">
      <svg
        class="h-5 w-5 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        viewBox="0 0 24 24"
      >
        <path
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium leading-snug text-foreground">
        {{ t('push.promptTitle') }}
      </p>
      <p class="mt-0.5 text-xs text-muted-foreground">
        {{ t('push.promptBody') }}
      </p>
      <div class="mt-3 flex items-center gap-2">
        <button
          class="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          @click="enable"
        >
          {{ t('push.enable') }}
        </button>
        <button
          class="rounded-lg px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          @click="snooze"
        >
          {{ t('push.later') }}
        </button>
      </div>
    </div>
    <button
      class="flex-shrink-0 p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
      @click="snooze"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { isSupported, permissionState, requestPermission } = usePushNotifications()

const dismissed = ref(false)

const SNOOZE_KEY = 'push_prompt_snoozed_at'
const DENIED_KEY = 'push_prompt_denied'
const SNOOZE_DAYS = 7

const shouldShow = computed(() => {
  if (!import.meta.client) return false
  if (!isSupported.value) return false
  if (dismissed.value) return false
  if (permissionState.value === 'granted') return false
  if (localStorage.getItem(DENIED_KEY) === 'true') return false

  const snoozedAt = localStorage.getItem(SNOOZE_KEY)
  if (snoozedAt) {
    const elapsed = Date.now() - Number(snoozedAt)
    if (elapsed < SNOOZE_DAYS * 24 * 60 * 60 * 1000) return false
  }

  return true
})

async function enable() {
  const granted = await requestPermission()
  if (!granted && Notification.permission === 'denied') {
    localStorage.setItem(DENIED_KEY, 'true')
  }
  dismissed.value = true
}

function snooze() {
  localStorage.setItem(SNOOZE_KEY, String(Date.now()))
  dismissed.value = true
}
</script>
```

- [ ] **Step 2: Add i18n keys**

Add to `locales/en.json` under a new `"push"` key:

```json
{
  "push": {
    "promptTitle": "Stay in the loop",
    "promptBody": "Get notified when your circle shares new memories.",
    "enable": "Enable",
    "later": "Later"
  }
}
```

Add equivalent keys to `locales/zh-CN.json` and `locales/fr.json`:

`zh-CN.json`:

```json
{
  "push": {
    "promptTitle": "保持同步",
    "promptBody": "当你的圈子分享新回忆时收到通知。",
    "enable": "开启",
    "later": "稍后"
  }
}
```

`fr.json`:

```json
{
  "push": {
    "promptTitle": "Restez connecté",
    "promptBody": "Recevez une notification quand votre cercle partage de nouveaux souvenirs.",
    "enable": "Activer",
    "later": "Plus tard"
  }
}
```

- [ ] **Step 3: Add PushPromptBanner to the timeline page**

In `app/pages/timeline/index.vue`, add the banner component just inside the `<main>` content area, above the existing timeline content:

```vue
<PushPromptBanner />
```

- [ ] **Step 4: Verify banner renders in dev**

Run: `pnpm dev`
Open the timeline page in browser. The banner should appear (if Notification permission is 'default'). Click "Later" — banner hides. Refresh — banner stays hidden (localStorage). Clear localStorage → banner reappears.

- [ ] **Step 5: Commit**

```bash
git add app/components/PushPromptBanner.vue app/pages/timeline/index.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(push): add push permission prompt banner on timeline"
```

---

## Task 9: Notification Settings in Circle Settings

**Files:**

- Modify: `app/pages/circle-settings.vue`

- [ ] **Step 1: Add i18n keys for notification settings**

Add to `locales/en.json` under `"circleSettings"`:

```json
{
  "circleSettings": {
    "notifications": "Notifications",
    "notificationsDesc": "Control how you're notified about activity in this circle.",
    "pushNotifications": "Push notifications",
    "pushNotificationsDesc": "Get notified when members share memories, comment, or react.",
    "muteCircle": "Mute this circle",
    "muteCircleDesc": "Pause all notifications from this circle."
  }
}
```

Add equivalent keys to `locales/zh-CN.json` and `locales/fr.json`:

`zh-CN.json`:

```json
{
  "circleSettings": {
    "notifications": "通知",
    "notificationsDesc": "控制你如何收到此圈子活动的通知。",
    "pushNotifications": "推送通知",
    "pushNotificationsDesc": "当成员分享回忆、评论或回应时收到通知。",
    "muteCircle": "静音此圈子",
    "muteCircleDesc": "暂停来自此圈子的所有通知。"
  }
}
```

`fr.json`:

```json
{
  "circleSettings": {
    "notifications": "Notifications",
    "notificationsDesc": "Configurez vos notifications pour ce cercle.",
    "pushNotifications": "Notifications push",
    "pushNotificationsDesc": "Soyez notifié quand les membres partagent des souvenirs, commentent ou réagissent.",
    "muteCircle": "Couper les notifications",
    "muteCircleDesc": "Mettre en pause toutes les notifications de ce cercle."
  }
}
```

- [ ] **Step 2: Add notification toggles to circle-settings.vue**

In `app/pages/circle-settings.vue`, add a new section after the existing sections (but before the danger zone). This section is visible to **all members**, not just owners.

Add to the `<script setup>` section:

```ts
// Notification preferences
const pushEnabled = ref(true)
const circleMuted = ref(false)
const loadingPrefs = ref(true)

async function loadNotificationPrefs() {
  if (!circle.value) return
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { data } = await supabase
    .from('notificationpreference')
    .select('push_enabled, circle_muted')
    .eq('user_id', user.value!.id)
    .eq('circle_id', circle.value.id)
    .maybeSingle()

  if (data) {
    pushEnabled.value = data.push_enabled
    circleMuted.value = data.circle_muted
  }
  loadingPrefs.value = false
}

async function saveNotificationPref(field: 'push_enabled' | 'circle_muted', value: boolean) {
  if (!circle.value) return
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  await supabase.from('notificationpreference').upsert(
    {
      user_id: user.value!.id,
      circle_id: circle.value.id,
      [field]: value,
    },
    { onConflict: 'user_id,circle_id' },
  )
}

watch(
  () => circle.value?.id,
  () => {
    loadNotificationPrefs()
  },
  { immediate: true },
)
```

Add to the `<template>` section (before the danger zone divider):

```vue
<!-- Notification preferences — all members -->
<div>
            <h2 class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              {{ t('circleSettings.notifications') }}
            </h2>
            <p class="text-xs text-muted-foreground mb-4">
              {{ t('circleSettings.notificationsDesc') }}
            </p>

            <div v-if="!loadingPrefs" class="space-y-4">
              <!-- Push toggle -->
              <label class="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <p class="text-sm font-medium text-foreground">{{ t('circleSettings.pushNotifications') }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5">{{ t('circleSettings.pushNotificationsDesc') }}</p>
                </div>
<input
  type="checkbox"
  :checked="pushEnabled"
  class="h-5 w-5 cursor-pointer rounded border-border accent-primary"
  @change="
    pushEnabled = !pushEnabled
    saveNotificationPref('push_enabled', pushEnabled)
  "
/>

<!-- Mute toggle -->
<label class="flex cursor-pointer items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-medium text-foreground">{{ t('circleSettings.muteCircle') }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5">{{ t('circleSettings.muteCircleDesc') }}</p>
                </div>
                <input
                  type="checkbox"
                  :checked="circleMuted"
                  class="w-5 h-5 rounded border-border accent-primary cursor-pointer"
                  @change="circleMuted = !circleMuted; saveNotificationPref('circle_muted', circleMuted)"
                />
              </label>

<div class="h-px bg-border" />
```

- [ ] **Step 3: Verify in dev**

Run: `pnpm dev`
Navigate to circle settings. Verify the notification toggles appear for all members. Toggle push on/off — check the `notificationpreference` table in Supabase to confirm the upsert works.

- [ ] **Step 4: Commit**

```bash
git add app/pages/circle-settings.vue locales/en.json locales/zh-CN.json locales/fr.json
git commit -m "feat(push): add notification toggles in circle settings"
```

---

## Task 10: Update Build Plan + Final Verification

**Files:**

- Modify: `docs/build-plan.md`

- [ ] **Step 1: Update build plan progress tracker**

In `docs/build-plan.md`, update the Milestone 10 section:

Replace:

```
- [ ] 10.1 Basic push (new upload, comment, reaction) — default push_enabled = true on join; prompt to configure on first notification received
```

With:

```
- [ ] 10.1 Basic push (new upload, comment, reaction) — Web Push via VAPID + service worker; inline dispatch from Nitro routes; upload notifications triggered by client post-upload; batch coalescing via notification tags; contextual permission prompt; push_enabled + circle_muted toggles in circle settings
```

Add after the 10.2 line:

```
- [ ] 10.3 Full notification preferences UI — quiet hours, email digest frequency, per-circle mute — dedicated settings page wired to existing NotificationPreference table
```

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All unit tests pass.

Run: `pnpm db:test`
Expected: All RLS tests pass (including 4 new PushSubscription tests).

- [ ] **Step 3: End-to-end manual test**

1. Open the app in two different browsers (or one normal + one incognito)
2. Log in as two different users who share a circle
3. On User A's browser, click "Enable" on the push prompt banner
4. On User B's browser, upload a photo or post a quick note
5. Verify User A receives a push notification
6. Click the notification — verify it opens the timeline with the correct memory
7. Test batch coalescing: upload 3 photos quickly from User B → User A should see one notification that updates silently
8. Test mute: go to circle settings on User A, toggle "Mute this circle" → upload from User B → no notification
9. Test unmute: toggle mute off → upload from User B → notification received

- [ ] **Step 4: Commit build plan update**

```bash
git add docs/build-plan.md
git commit -m "docs: update build plan for 10.1 push notifications and add 10.3"
```
