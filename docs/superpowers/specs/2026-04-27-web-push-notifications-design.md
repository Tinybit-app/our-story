# 10.1 — Basic Web Push Notifications

## Overview

Add Web Push notifications so circle members are alerted when new content is shared — uploads, comments, and reactions. Includes PWA foundation (manifest + service worker), push subscription management, notification dispatch from Nitro server routes, and a contextual permission prompt.

## Decisions

- **Web Push only** — no native push via Capacitor (Phase 2)
- **Dispatch inline from Nitro routes** — not via Supabase Edge Functions or DB triggers. Follows the existing pattern (emails sent inline from Nitro routes)
- **Upload notifications triggered by client** — after a successful upload (which happens in the `upload-media` Edge Function), the client calls `POST /api/push/notify` to dispatch push. Server validates the memory exists and the caller is the uploader
- **All circle members notified** (except the actor) — opt-out model matching the design spec's philosophy. Members control noise via push_enabled toggle and circle mute
- **Batch coalescing via notification tags** — no server-side debounce timers. Uses the Web Push `tag` field so the browser replaces previous notifications silently instead of stacking

## 1. PWA Foundation

### `public/manifest.json`

```json
{
  "name": "Our Story",
  "short_name": "Our Story",
  "start_url": "/timeline",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Linked via `nuxt.config.ts` → `app.head.link`: `{ rel: 'manifest', href: '/manifest.json' }`.

No PWA Nuxt module — hand-rolled manifest + service worker registration to keep scope minimal.

### Service worker registration

`app/plugins/service-worker.client.ts` — registers `sw.js` on app mount:

```ts
export default defineNuxtPlugin(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
  }
})
```

### App icons

`public/icon-192.png` and `public/icon-512.png` — required for manifest and notification icon. Generate from existing favicon/brand asset.

## 2. Push Subscription Management

### Database: `PushSubscription` table (new migration)

```sql
CREATE TABLE PushSubscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscription_user ON PushSubscription(user_id);
```

RLS policies:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

One user can have multiple subscriptions (multiple devices/browsers). Keyed on `endpoint` (unique) — re-subscribing from same browser upserts.

### VAPID keys

Generated once via `web-push generate-vapid-keys`, stored as env vars:
- `VAPID_PUBLIC_KEY` — also exposed via `runtimeConfig.public.vapidPublicKey` (client needs it for `PushManager.subscribe()`)
- `VAPID_PRIVATE_KEY` — server-only
- `VAPID_SUBJECT` — `mailto:` contact email, server-only

### API routes

**`POST /api/push/subscribe`**
- Body: `{ endpoint: string, keys: { p256dh: string, auth: string } }`
- Auth required
- Upserts subscription (ON CONFLICT on endpoint → update keys)
- Returns 200

**`DELETE /api/push/subscribe`**
- Body: `{ endpoint: string }`
- Auth required
- Deletes the subscription row matching endpoint + user_id
- Returns 200

### Client composable: `usePushNotifications()`

```ts
// app/composables/usePushNotifications.ts
export function usePushNotifications() {
  const isSupported = computed(() =>
    'serviceWorker' in navigator && 'PushManager' in window
  )

  const permissionState = ref<PermissionState>('default')

  async function requestPermission(): Promise<boolean> { /* ... */ }
  async function unsubscribe(): Promise<void> { /* ... */ }

  return { isSupported, permissionState, requestPermission, unsubscribe }
}
```

- `requestPermission()` — triggers browser prompt, subscribes via PushManager with VAPID public key, POSTs subscription to `/api/push/subscribe`
- `unsubscribe()` — unsubscribes from PushManager, DELETEs from server
- `permissionState` — reactive, initialized from `Notification.permission`

## 3. Notification Dispatch

### Server utility: `server/utils/pushNotify.ts`

Core function: `sendPushToCircle(circleId, excludeUserId, payload)`

1. Fetch all circle members except `excludeUserId`
2. For each member, check `NotificationPreference`:
   - Skip if `circle_muted = true`
   - Skip if `push_enabled = false`
   - Skip if current time is within quiet hours
3. Fetch their `PushSubscription` rows (may be multiple devices)
4. Send via `web-push` library with VAPID signing
5. On 410 Gone response (expired subscription), delete the subscription row
6. Fire-and-forget — never blocks the API response

### Dependency

`web-push` npm package — handles VAPID signing and push protocol.

### Payload shape

```json
{
  "title": "Emma added a memory",
  "body": "First steps at the park",
  "tag": "upload-{circleId}-{userId}",
  "renotify": false,
  "data": {
    "url": "/timeline?circle={circleId}&memory={memoryId}"
  }
}
```

- `tag` groups notifications by (event type, circle, actor) so the browser replaces rather than stacks
- `renotify: true` on the first notification in a 30-minute window (buzz/sound), `false` for subsequent updates (silent replacement)
- Title uses the actor's first name + action verb
- Body is the note/comment text truncated to ~100 chars, or "shared a photo/video" if no text

### Rolling window for renotify

To determine whether a notification is the "first" in a window (should buzz) or an update (silent), the server counts memories in the same circle by the same user where `created_at >= now() - interval '30 minutes'`. If count = 1 (the current upload is the only one), it's the first → `renotify: true`. If count > 1 → `renotify: false`. The title also updates: count = 1 uses the singular form, count > 1 uses "{name} added N memories".

### Trigger points

| Event | Where dispatched | Title template | Body | Tag |
|-------|-----------------|----------------|------|-----|
| Upload (photo/video) | `POST /api/push/notify` (client calls after upload) | "{name} added a memory" / "{name} added N memories" | note or "shared a photo/video" | `upload-{circleId}-{userId}` |
| Quick note | `POST /api/memories/quick-note` (inline) | "{name} added a note" / "{name} added N memories" | note text truncated | `upload-{circleId}-{userId}` |
| Comment | `POST /api/memories/[id]/comments` (inline) | "{name} commented" | comment text truncated | `comment-{circleId}-{userId}` |
| Reaction | `POST /api/memories/[id]/reactions` (inline) | "{name} reacted {emoji}" | — | `reaction-{circleId}-{userId}` |

Uploads and quick notes share the same tag prefix (`upload-`) so they coalesce together.

### `POST /api/push/notify` route

- Body: `{ memoryId: string }`
- Validates auth
- Confirms the memory exists and `owner_user_id` matches the caller
- Looks up the circle from the memory row
- Calls `sendPushToCircle()` with appropriate payload
- Returns 200 immediately

### Notification copy and circle type

Title uses the actor's `first_name`. For the body, the copy adapts based on `circle_type` where appropriate (e.g., "Your family" vs "Your circle" in the prompt banner). Pulled from the circle row.

## 4. Service Worker

### `public/sw.js`

**Push event** — display the notification:

```js
self.addEventListener('push', (event) => {
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      tag: data.tag,
      renotify: data.renotify,
      data: { url: data.data.url }
    })
  )
})
```

**Notification click** — deep link to the memory:

```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/timeline'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      clients.openWindow(url)
    })
  )
})
```

**Deep link targets:**
- All notification types link to: `/timeline?circle={circleId}&memory={memoryId}`
- Opens the timeline with the memory expanded in the existing modal/detail view
- No new routes needed

## 5. Permission Prompt

### When to show

Not on first load. Contextually triggered:
- **Condition:** User opens the app and there are new memories since their last visit (from other members)
- **UI:** Dismissable banner at the top of the timeline
- **Copy:** "Stay in the loop — get notified when your circle shares new memories"
- **Buttons:** **Enable** / **Later**

### Behavior

- **Enable** → calls `usePushNotifications().requestPermission()` → browser permission prompt → if granted, subscribes and hides banner
- **Later** → hides banner, stores timestamp in localStorage (`push_prompt_snoozed_at`), don't re-show for 7 days
- **Browser prompt denied** → never show the banner again (store `push_prompt_denied` in localStorage)
- **Not shown if** `isSupported` is false (old browsers, HTTP, no PushManager)
- **Not shown if** already subscribed (permission already granted)

## 6. Settings UI

Minimal for 10.1 — two toggles added to the existing circle settings page:

- **Push notifications** — on/off toggle (maps to `NotificationPreference.push_enabled`)
- **Mute this circle** — on/off toggle (maps to `NotificationPreference.circle_muted`)

Auto-creates the `NotificationPreference` row on first toggle if it doesn't exist (upsert).

### Deferred to 10.3

Full notification preferences UI:
- Quiet hours (start/end time pickers)
- Email digest frequency (daily/weekly/off)
- Per-circle mute (already done in 10.1, but as part of a dedicated preferences page)

## 7. Build Plan Updates

Add to the progress tracker:

```
- [ ] 10.1 Basic push (new upload, comment, reaction) — Web Push via VAPID + service worker; inline dispatch from Nitro routes; upload notifications triggered by client post-upload; batch coalescing via notification tags; contextual permission prompt; push_enabled + circle_muted toggles in circle settings
- [ ] 10.3 Full notification preferences UI — quiet hours, email digest frequency, per-circle mute — dedicated settings page wired to existing NotificationPreference table
```

## Out of Scope

- Offline caching / full PWA offline support (milestone 11)
- Native push via Capacitor / FCM / APNs (Phase 2)
- On This Day notifications (step 10.2)
- Full notification preferences page with quiet hours and email digest (step 10.3)
- Email digest notifications (table exists, UI and send logic deferred)
