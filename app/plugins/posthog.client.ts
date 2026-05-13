import posthog from 'posthog-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const key = config.public.posthogKey as string | undefined
  const host =
    (config.public.posthogHost as string) || 'https://eu.i.posthog.com'

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
    persistence: 'localStorage',
    respect_dnt: true,
    disable_session_recording: true,
  })

  return {
    provide: { posthog },
  }
})
