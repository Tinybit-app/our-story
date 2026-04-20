import { chromium, type FullConfig } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Local Supabase credentials — read from env vars.
// Add to your .env (gitignored):
//   SUPABASE_URL=http://127.0.0.1:54321    (or NUXT_PUBLIC_SUPABASE_URL)
//   SUPABASE_KEY=<anon key>                 (or NUXT_PUBLIC_SUPABASE_KEY)
//   SUPABASE_SERVICE_ROLE_KEY=<service role key>
// Values for local dev are printed by `supabase status`.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY ?? process.env.NUXT_PUBLIC_SUPABASE_KEY ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NUXT_SUPABASE_SECRET_KEY ?? ''

// Cookie name: sb-{hostname.split('.')[0]}-auth-token
// For http://127.0.0.1:54321, hostname = '127.0.0.1', split('.')[0] = '127'
const SESSION_COOKIE_NAME = 'sb-127-auth-token'

const TEST_EMAIL = 'e2e-onboarding@ourstory.test'
const TEST_PASSWORD = 'E2eTestOnboarding1!'
const STORAGE_STATE_PATH = 'tests/.auth/user.json'

export default async function globalSetup(_config: FullConfig) {
  // Ensure .auth directory exists
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true })

  // Create test user via admin API (idempotent — ignores 422 if already exists)
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      // full_name triggers the handle_new_user trigger to set first_name,
      // ensuring needsProfile = false on the real /api/auth/membership endpoint
      user_metadata: { full_name: 'E2E Test' },
    }),
  })

  if (!createRes.ok && createRes.status !== 422) {
    throw new Error(`Failed to create E2E test user (${createRes.status}): ${await createRes.text()}`)
  }

  // Sign in via password grant to get a real session
  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })

  if (!tokenRes.ok) {
    throw new Error(`Failed to sign in E2E test user (${tokenRes.status}): ${await tokenRes.text()}`)
  }

  const session = await tokenRes.json()

  // @nuxtjs/supabase v2 uses @supabase/ssr which stores sessions as cookies.
  // Cookie value format: "base64-" + base64url(JSON.stringify(session))
  // The base64url here is standard base64 with + → - and / → _ and no padding.
  const sessionJson = JSON.stringify(session)
  const b64 = Buffer.from(sessionJson, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  const cookieValue = `base64-${b64}`

  // Inject cookie into a browser context and save storage state
  const browser = await chromium.launch()
  const context = await browser.newContext()
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])
  await context.storageState({ path: STORAGE_STATE_PATH })
  await browser.close()
}
