import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── No-circle page ────────────────────────────────────────────────────────────
// Tests for the /no-circle screen shown when an authenticated user has no circle.
test.describe('No-circle screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/membership**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasMembership: false, needsProfile: false, deletedAt: null }),
      })
    )
    // No pending deletions by default
    await page.route('**/api/circles/deleted**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ circles: [] }),
      })
    )
  })

  test('unauthenticated visit to /timeline redirects to /no-circle when no membership', async ({ page }) => {
    await page.goto('/timeline')
    await page.waitForURL(/\/no-circle/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/no-circle/)
  })

  test('shows heading and description', async ({ page }) => {
    await page.goto('/no-circle')
    await expect(page.getByRole('heading', { name: /not in any circle/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/invite hasn't arrived/i)).toBeVisible()
  })

  test('"Create a new circle" CTA links to /onboarding', async ({ page }) => {
    await page.goto('/no-circle')
    const cta = page.getByRole('link', { name: /create a new circle/i })
    await expect(cta).toBeVisible({ timeout: 10_000 })
    await expect(cta).toHaveAttribute('href', '/onboarding')
  })

  test('shows "Waiting for an invite?" info block', async ({ page }) => {
    await page.goto('/no-circle')
    await expect(page.getByText(/waiting for an invite/i)).toBeVisible({ timeout: 10_000 })
  })

  test('no pending-deletion banner when there are no deleted circles', async ({ page }) => {
    await page.goto('/no-circle')
    await expect(page.getByText(/recently deleted a circle/i)).not.toBeVisible({ timeout: 10_000 })
  })

  test('pending-deletion banner appears when deleted circles exist', async ({ page }) => {
    // Override: return one deleted circle
    await page.route('**/api/circles/deleted**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ circles: [{ id: 'dead-circle-id', name: 'Old Circle' }] }),
      })
    )

    await page.goto('/no-circle')
    await expect(page.getByText(/recently deleted a circle/i)).toBeVisible({ timeout: 10_000 })
    // Banner should link to account settings
    await expect(page.getByRole('link', { name: /restore from account settings/i })).toHaveAttribute('href', '/settings/account')
  })

  test('authenticated user with membership is redirected away from /no-circle to /timeline', async ({ page }) => {
    // Override: user has a membership
    await page.route('**/api/auth/membership**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
      })
    )
    // Provide circles + empty timeline so /timeline can render
    await page.route('**/api/circles**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ circles: [{ id: 'aaaaaaaa-1111-1111-1111-111111111111', name: 'Our Family', circle_type: 'family', memberCount: 1, role: 'owner' }] }),
      })
    )
    await page.route('**/api/timeline**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memories: [], nextCursor: null }),
      })
    )

    await page.goto('/no-circle')
    await page.waitForURL(/\/timeline/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/timeline/)
  })
})
