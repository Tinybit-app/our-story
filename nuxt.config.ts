// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,

  app: {
    head: {
      title: 'Our Story',
      meta: [{ name: 'description', content: 'Your circle of memories.' }],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap',
        },
      ],
    },
  },

  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  css: ["~/assets/css/globals.css"],

  components: [{ path: "~/components", extensions: ["vue"] }],

  modules: [
    "@nuxtjs/supabase",
    "@nuxtjs/tailwindcss",
    "@vueuse/nuxt",
    "@sentry/nuxt/module",
    "@nuxtjs/color-mode",
  ],

  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
  },

  supabase: {
    types: "~/types/database.ts",
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

  routeRules: {
    "/api/**": {
      cors: false, // handled manually in security-headers middleware
      headers: {
        "Access-Control-Allow-Origin": process.env.APP_URL ?? "https://our-story.tinybit.app",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  },

  runtimeConfig: {
    resendApiKey: process.env.RESEND_API_KEY,
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    jwtSecret: process.env.JWT_SECRET,
    sentryAuthToken: process.env.SENTRY_AUTH_TOKEN,
    appUrl: process.env.APP_URL,  // used in invite emails and view-only links
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      sentryDsn: process.env.SENTRY_DSN,
    },
  },
});
