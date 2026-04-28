export function usePushNotifications() {
  const config = useRuntimeConfig()

  const isSupported = computed(() =>
    import.meta.client &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )

  const permissionState = ref<NotificationPermission>(
    import.meta.client && 'Notification' in window ? Notification.permission : 'default'
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
