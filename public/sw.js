// Service worker: push notifications + offline asset caching
// Offline upload queue is Phase 2 (Capacitor)

const CACHE_NAME = 'our-story-v1'

// Static assets to precache on install (app shell)
const PRECACHE_URLS = [
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
]

// ── Install: precache static assets ────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ── Activate: clean up old caches ──────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: cache strategy ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests (POST uploads, PATCH, DELETE, etc.)
  if (request.method !== 'GET') return

  // Skip API calls and Supabase requests — always go to network
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) return

  // Nuxt build assets (_nuxt/*): cache-first (hashed filenames, immutable)
  if (url.pathname.startsWith('/_nuxt/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Static assets (icons, fonts, images in /public): cache-first
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|css)$/) ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // HTML pages: network-first with cache fallback (stale-while-revalidate feel)
  // This ensures users get fresh content but can still load the app shell offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})

// ── Push notifications ─────────────────────────────────────
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
    })
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
    })
  )
})
