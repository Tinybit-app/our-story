import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── Value proposition screens (build plan §4.4) ───────────────────────────────
// Shown once before the circle type picker for first-time users.
// Never shown again once dismissed (tracked in localStorage).
test.describe('Value proposition screens', () => {
  test.beforeEach(async ({ page }) => {
    // Fresh user: no membership, no profile issues
    await page.route('**/api/auth/membership**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasMembership: false, needsProfile: false, deletedAt: null }),
      })
    )
    // Clear the "seen" flag so each test starts fresh
    await page.addInitScript(() => {
      localStorage.removeItem('value_prop_seen')
    })
  })

  // ── Redirect ────────────────────────────────────────────────────────────────

  test('visiting /onboarding redirects to /onboarding/value-prop when not yet seen', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForURL(/\/onboarding\/value-prop/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/onboarding\/value-prop/)
  })

  // ── Screen 1 content ────────────────────────────────────────────────────────

  test('screen 1 shows the "photos get buried" pain copy', async ({ page }) => {
    await page.goto('/onboarding/value-prop')
    await expect(page.getByText(/photos get buried/i)).toBeVisible({ timeout: 10_000 })
  })

  test('a skip button is visible on screen 1', async ({ page }) => {
    await page.goto('/onboarding/value-prop')
    await expect(page.getByRole('button', { name: /skip/i })).toBeVisible({ timeout: 10_000 })
  })

  test('progress indicator shows 3 steps', async ({ page }) => {
    await page.goto('/onboarding/value-prop')
    const dots = page.locator('[data-testid="value-prop-dot"]')
    await expect(dots).toHaveCount(3, { timeout: 10_000 })
  })

  // ── Navigation ──────────────────────────────────────────────────────────────

  test('clicking Next on screen 1 advances to screen 2', async ({ page }) => {
    await page.goto('/onboarding/value-prop')
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/beautifully kept/i)).toBeVisible({ timeout: 5_000 })
  })

  test('clicking Next twice reaches screen 3', async ({ page }) => {
    await page.goto('/onboarding/value-prop')
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/works for/i)).toBeVisible({ timeout: 5_000 })
  })

  test('"Start your story" CTA on screen 3 navigates to /onboarding', async ({ page }) => {
    await page.goto('/onboarding/value-prop')
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /start your story/i }).click()
    await page.waitForURL(/\/onboarding$/, { timeout: 5_000 })
    await expect(page).toHaveURL(/\/onboarding$/)
  })

  // ── Skip ────────────────────────────────────────────────────────────────────

  test('skipping from screen 1 navigates to /onboarding', async ({ page }) => {
    await page.goto('/onboarding/value-prop')
    await page.getByRole('button', { name: /skip/i }).click()
    await page.waitForURL(/\/onboarding$/, { timeout: 5_000 })
    await expect(page).toHaveURL(/\/onboarding$/)
  })

  // ── Existing member creating a second circle ────────────────────────────────

  test('existing member navigating to /onboarding skips value-prop entirely', async ({ page }) => {
    await page.route('**/api/auth/membership**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
      })
    )
    // value_prop_seen is NOT set — but membership means it should be skipped anyway
    await page.goto('/onboarding')
    await page.waitForTimeout(500)
    await expect(page).not.toHaveURL(/\/value-prop/)
    await expect(page).toHaveURL(/\/onboarding$/)
  })

  // ── Shown once ──────────────────────────────────────────────────────────────

  test('/onboarding does NOT redirect when value_prop_seen flag is already set', async ({ page }) => {
    // Pre-set the localStorage flag before navigation
    await page.addInitScript(() => {
      localStorage.setItem('value_prop_seen', '1')
    })
    await page.goto('/onboarding')
    // Should stay on /onboarding (circle type picker), not bounce to value-prop
    await page.waitForTimeout(500)
    await expect(page).not.toHaveURL(/\/value-prop/)
    await expect(page).toHaveURL(/\/onboarding$/)
  })
})
