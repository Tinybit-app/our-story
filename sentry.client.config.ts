import * as Sentry from "@sentry/nuxt"

Sentry.init({
  dsn: useRuntimeConfig().public.sentryDsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
