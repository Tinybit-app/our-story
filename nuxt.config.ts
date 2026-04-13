// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  css: ["~/assets/css/globals.css"],

  modules: [
    "@nuxtjs/supabase",
    "@nuxtjs/tailwindcss",
    "@vueuse/nuxt",
    "@sentry/nuxt/module",
  ],

  supabase: {
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      exclude: ["/invite/*", "/view/*"],
    },
  },

  sentry: {
    sourceMapsUploadOptions: {
      project: "our-story",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },

  runtimeConfig: {
    resendApiKey: process.env.RESEND_API_KEY,
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    jwtSecret: process.env.JWT_SECRET,
    sentryAuthToken: process.env.SENTRY_AUTH_TOKEN,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      sentryDsn: process.env.SENTRY_DSN,
    },
  },
});
