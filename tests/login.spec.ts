import { test, expect } from '@playwright/test'

// ── Login page ────────────────────────────────────────────────────────────────
// Tests that require the login page to be loaded first.
test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // Wait for Vue to finish rendering (SPA — client-side only)
    await page.getByPlaceholder('your@email.com').waitFor({ timeout: 20_000 })
  })

  test('shows wordmark, headline and subtitle', async ({ page }) => {
    await expect(
      page.locator('p').filter({ hasText: 'Our Story' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /every moment worth keeping/i }),
    ).toBeVisible()
    await expect(
      page.getByText('For you, your family, your friends.'),
    ).toBeVisible()
  })

  test('shows the magic-link sign-in method', async ({ page }) => {
    // Google SSO is deferred to Phase 2 (build-plan §3.1) — only magic link in Phase 1.
    await expect(page.getByPlaceholder('your@email.com')).toBeVisible()
    await expect(
      page.getByRole('button', { name: /continue with email/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /continue with google/i }),
    ).toHaveCount(0)
  })

  test('shows success message after valid email submission', async ({
    page,
  }) => {
    // Intercept the Supabase OTP request so we don't need real credentials
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      }),
    )

    await page.getByPlaceholder('your@email.com').fill('test@example.com')
    await page.getByRole('button', { name: /continue with email/i }).click()

    await expect(page.getByText(/check your inbox/i)).toBeVisible()
  })
})

// ── Landing page ──────────────────────────────────────────────────────────────
test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('unauthenticated visit stays on /', async ({ page }) => {
    await expect(page).toHaveURL('http://localhost:3000/')
  })

  test('shows hero headline', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('shows Start free CTA linking to /login', async ({ page }) => {
    const cta = page.getByRole('link', { name: /start free/i }).first()
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/login')
  })

  test('shows How it works section', async ({ page }) => {
    await expect(page.getByText(/not storage/i)).toBeVisible()
  })

  test('shows pricing summary link to /pricing', async ({ page }) => {
    const link = page.getByRole('link', { name: /see pricing/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/pricing')
  })
})

// ── Pricing page ──────────────────────────────────────────────────────────────
test.describe('Pricing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')
  })

  test('unauthenticated visit stays on /pricing', async ({ page }) => {
    await expect(page).toHaveURL('http://localhost:3000/pricing')
  })

  test('shows Free, Plus, and Pro tier cards', async ({ page }) => {
    await expect(page.getByText(/^free$/i).first()).toBeVisible()
    await expect(page.getByText(/^plus$/i).first()).toBeVisible()
    await expect(page.getByText(/^pro$/i).first()).toBeVisible()
  })

  test('shows FAQ section', async ({ page }) => {
    await expect(page.getByText(/questions/i).first()).toBeVisible()
  })
})

// ── Auth routing ──────────────────────────────────────────────────────────────
// These tests verify redirect behaviour for protected routes.
// Each test navigates directly to the target URL with no prior app state
// so there is no risk of Supabase client initialisation from a prior
// navigation bleeding into the session check.
test.describe('Auth routing', () => {
  test('unauthenticated visit to /timeline redirects to /login', async ({
    page,
  }) => {
    await page.goto('/timeline')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
