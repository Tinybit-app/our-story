# Global Theme & Login Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the warm & nostalgic global theme (light + dark) for the entire app, then implement the approved login page design as the first page using that theme.

**Architecture:** Theme tokens live entirely in `globals.css` as HSL CSS variables (shadcn-vue convention) — every page and component in the app inherits them automatically via Tailwind utility classes (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, etc.). Dark mode is triggered by the `.dark` class on `<html>` — auto-applied by a watcher in `app.vue` that reads `prefers-color-scheme`. No page needs its own color definitions; they all reference the global tokens.

**Tech Stack:** Nuxt 4, Vue 3, Tailwind CSS v3, shadcn-vue, `@nuxtjs/tailwindcss`

---

## File Map

| File                         | Change                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| `app/assets/css/globals.css` | Replace default shadcn tokens with warm palette (light + dark) |
| `tailwind.config.ts`         | Add `font-display` serif stack, update `--radius` to `0.75rem` |
| `app/app.vue`                | Add `useColorScheme` to auto-apply `.dark` class               |
| `app/pages/login.vue`        | Full rewrite — editorial layout per approved design            |
| `tests/login.spec.ts`        | Playwright smoke test                                          |

---

## Task 1: Set global theme tokens (applies to all pages)

**Files:**

- Modify: `app/assets/css/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace CSS variables in `globals.css`**

Replace the entire file contents with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Warm & nostalgic — light mode */
    --background: 33 20% 94%; /* #f4f1ee warm cream */
    --foreground: 20 16% 14%; /* #2c2420 dark espresso */
    --card: 0 0% 100%; /* #ffffff white lift */
    --card-foreground: 20 16% 14%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 16% 14%;
    --primary: 20 16% 14%; /* #2c2420 dark espresso */
    --primary-foreground: 33 20% 94%; /* #f4f1ee cream */
    --secondary: 33 14% 88%; /* #e8e4df warm border */
    --secondary-foreground: 20 16% 14%;
    --muted: 33 14% 88%;
    --muted-foreground: 26 10% 49%; /* #8a7f74 warm stone */
    --accent: 33 40% 65%; /* #c8a882 warm amber */
    --accent-foreground: 20 16% 14%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 30 14% 88%; /* #e8e4df */
    --input: 30 14% 88%;
    --ring: 33 40% 65%; /* #c8a882 amber focus ring */
    --radius: 0.75rem; /* 12px base */
  }

  .dark {
    /* Warm & nostalgic — dark mode */
    --background: 25 15% 9%; /* #1a1512 dark espresso brown */
    --foreground: 33 30% 92%; /* #f0ebe4 warm off-white */
    --card: 20 16% 14%; /* #2c2420 lifted dark brown */
    --card-foreground: 33 30% 92%;
    --popover: 20 16% 14%;
    --popover-foreground: 33 30% 92%;
    --primary: 33 40% 65%; /* #c8a882 amber — CTA in dark mode */
    --primary-foreground: 25 15% 9%;
    --secondary: 22 8% 22%; /* #3d3530 dark border */
    --secondary-foreground: 33 30% 92%;
    --muted: 22 8% 22%;
    --muted-foreground: 26 10% 49%; /* #8a7f74 warm stone (shared) */
    --accent: 33 40% 65%; /* #c8a882 amber (shared) */
    --accent-foreground: 25 15% 9%;
    --destructive: 0 62% 30%;
    --destructive-foreground: 0 0% 98%;
    --border: 22 8% 22%; /* #3d3530 */
    --input: 22 8% 22%;
    --ring: 33 40% 65%;
    --radius: 0.75rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Add `font-display` to `tailwind.config.ts`**

In the `theme.extend` block, add a `fontFamily` entry after `borderRadius`:

```ts
fontFamily: {
  display: ['Georgia', 'ui-serif', '"Times New Roman"', 'serif'],
},
```

- [ ] **Step 3: Verify Tailwind picks up the new tokens**

```bash
pnpm dev
```

Open `http://localhost:3000`. The page background should now be warm cream `#f4f1ee` instead of white. If it's still white, check that `globals.css` is still listed in `nuxt.config.ts` under `css`.

- [ ] **Step 4: Commit**

```bash
git add app/assets/css/globals.css tailwind.config.ts
git commit -m "update theme tokens to warm & nostalgic palette"
```

---

## Task 2: Auto dark mode detection

**Files:**

- Modify: `app/app.vue`

- [ ] **Step 1: Add color scheme watcher to `app.vue`**

Replace the full file:

```vue
<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Auto-apply .dark class based on system preference
const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

watchEffect(() => {
  document.documentElement.classList.toggle('dark', prefersDark.value)
})
</script>
```

`useMediaQuery` is provided by `@vueuse/core` which is already installed.

- [ ] **Step 2: Verify dark mode toggles**

```bash
pnpm dev
```

Open `http://localhost:3000`. In your OS system settings, toggle between light and dark mode. The page background should switch between warm cream and dark espresso brown.

- [ ] **Step 3: Commit**

```bash
git add app/app.vue
git commit -m "auto-apply dark mode class from system preference"
```

---

## Task 3: Rewrite login page

**Files:**

- Modify: `app/pages/login.vue`

- [ ] **Step 1: Create `GoogleIcon` component**

Create `app/components/GoogleIcon.vue`:

```vue
<template>
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
</template>
```

- [ ] **Step 2: Replace `login.vue` with the approved design**

```vue
<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm">
      <!-- Wordmark -->
      <p
        class="mb-4 text-xs font-bold uppercase tracking-widest text-foreground"
      >
        Our Story
      </p>

      <!-- Headline -->
      <h1
        class="mb-2 font-display text-[1.625rem] font-bold leading-tight text-foreground"
      >
        Every moment worth keeping, in one place.
      </h1>
      <p class="mb-8 text-sm text-muted-foreground">
        For you, your family, your friends.
      </p>

      <!-- Google -->
      <button
        type="button"
        class="mb-2.5 flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-4 py-3.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary"
        @click="signInWithGoogle"
      >
        <GoogleIcon class="h-[18px] w-[18px] shrink-0" />
        Continue with Google
      </button>

      <!-- Divider -->
      <div class="my-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <div class="h-px flex-1 bg-border" />
        or
        <div class="h-px flex-1 bg-border" />
      </div>

      <!-- Email form -->
      <form class="mt-1.5" @submit.prevent="submitEmail">
        <input
          v-model="email"
          type="email"
          placeholder="your@email.com"
          required
          class="mb-2.5 w-full rounded-[12px] border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ loading ? 'Sending…' : 'Continue with email' }}
        </button>
      </form>

      <!-- Success state -->
      <p v-if="sent" class="mt-4 text-center text-sm font-medium text-accent">
        Check your inbox — we sent you a sign-in link.
      </p>

      <!-- Footer note -->
      <p
        v-else
        class="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground"
      >
        We'll send you a sign-in link — no password needed.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

const supabase = useSupabaseClient()
const email = ref('')
const loading = ref(false)
const sent = ref(false)

async function submitEmail() {
  loading.value = true
  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: { emailRedirectTo: `${window.location.origin}/confirm` },
  })
  if (!error) sent.value = true
  loading.value = false
}

async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/confirm` },
  })
}
</script>
```

- [ ] **Step 2: Create `GoogleIcon` component**

Create `app/components/GoogleIcon.vue`:

```vue
<template>
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
</template>
```

- [ ] **Step 3: Verify in browser**

```bash
pnpm dev
```

Open `http://localhost:3000/login`. Verify:

- Background is warm cream (light) or dark espresso brown (dark)
- "OUR STORY" wordmark appears in small caps tracking
- Headline uses serif font (Georgia)
- Google button has white/card background with border and shadow
- "Continue with email" CTA matches the primary color token (dark espresso in light, amber in dark)
- Entering an email and clicking "Continue with email" shows the success message

- [ ] **Step 4: Commit**

```bash
git add app/pages/login.vue app/components/GoogleIcon.vue
git commit -m "redesign login page — warm editorial layout with dark mode"
```

---

## Task 4: Playwright smoke test

**Files:**

- Create: `tests/login.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('shows wordmark, headline and subtitle', async ({ page }) => {
    await expect(page.getByText('Our Story', { exact: false })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /every moment worth keeping/i }),
    ).toBeVisible()
    await expect(
      page.getByText('For you, your family, your friends.'),
    ).toBeVisible()
  })

  test('shows both sign-in methods', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /continue with google/i }),
    ).toBeVisible()
    await expect(page.getByPlaceholder('your@email.com')).toBeVisible()
    await expect(
      page.getByRole('button', { name: /continue with email/i }),
    ).toBeVisible()
  })

  test('shows success message after valid email submission', async ({
    page,
  }) => {
    // Intercept the Supabase OTP request so we don't need real credentials
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({ status: 200, body: '{}' }),
    )

    await page.getByPlaceholder('your@email.com').fill('test@example.com')
    await page.getByRole('button', { name: /continue with email/i }).click()

    await expect(page.getByText(/check your inbox/i)).toBeVisible()
  })

  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})
```

- [ ] **Step 2: Run tests (expect pass)**

```bash
pnpm test:e2e
```

Expected output: `4 passed`

If the dev server isn't running, Playwright will start it automatically via `webServer` config. If there's no `webServer` in `playwright.config.ts`, add it:

```ts
// playwright.config.ts (create if missing)
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:3000' },
})
```

- [ ] **Step 3: Commit**

```bash
git add tests/login.spec.ts playwright.config.ts
git commit -m "add Playwright smoke tests for login page"
```
