import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

const CIRCLE_1 = {
  id: 'aaaaaaaa-1111-1111-1111-111111111111',
  name: 'The Smith Family',
  circle_type: 'family',
  memberCount: 3,
  role: 'owner',
}

const CIRCLE_2 = {
  id: 'bbbbbbbb-2222-2222-2222-222222222222',
  name: 'Couple Goals',
  circle_type: 'couple',
  memberCount: 2,
  role: 'owner',
}

test.describe('Multi-circle support', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/membership**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
      }),
    )
    await page.route('**/api/circles**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ circles: [CIRCLE_1, CIRCLE_2] }),
      }),
    )
    // Return empty timeline so we don't need real DB data
    await page.route('**/api/timeline**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memories: [], nextCursor: null }),
      }),
    )
  })

  // ── Active circle selection ─────────────────────────────────────────────
  test('no ?circle= param shows the first circle by default', async ({ page }) => {
    await page.goto('/timeline')
    // Wait for page to render the circle name
    await expect(page.getByRole('button', { name: CIRCLE_1.name })).toBeVisible({ timeout: 15_000 })
  })

  test('?circle=<id> param selects the matching circle', async ({ page }) => {
    await page.goto(`/timeline?circle=${CIRCLE_2.id}`)
    await expect(page.getByRole('button', { name: CIRCLE_2.name })).toBeVisible({ timeout: 15_000 })
  })

  test('unknown ?circle= param falls back to the first circle', async ({ page }) => {
    await page.goto('/timeline?circle=00000000-dead-beef-dead-000000000000')
    await expect(page.getByRole('button', { name: CIRCLE_1.name })).toBeVisible({ timeout: 15_000 })
  })

  // ── Circle switcher UI ──────────────────────────────────────────────────
  test('clicking the circle name opens the switcher modal', async ({ page }) => {
    await page.goto('/timeline')
    await page.getByRole('button', { name: CIRCLE_1.name }).waitFor({ timeout: 15_000 })

    await page.getByRole('button', { name: CIRCLE_1.name }).click()

    await expect(page.getByText('Your circles')).toBeVisible({ timeout: 5_000 })
  })

  test('switcher modal lists all circles', async ({ page }) => {
    await page.goto('/timeline')
    await page.getByRole('button', { name: CIRCLE_1.name }).waitFor({ timeout: 15_000 })
    await page.getByRole('button', { name: CIRCLE_1.name }).click()

    await expect(page.getByText('Your circles')).toBeVisible()
    // Scope to list items so CIRCLE_1.name doesn't collide with the header button
    await expect(page.getByRole('listitem').filter({ hasText: CIRCLE_1.name })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: CIRCLE_2.name })).toBeVisible()
  })

  test('clicking a circle in the switcher updates the ?circle= URL param', async ({ page }) => {
    await page.goto('/timeline')
    await page.getByRole('button', { name: CIRCLE_1.name }).waitFor({ timeout: 15_000 })
    await page.getByRole('button', { name: CIRCLE_1.name }).click()
    await expect(page.getByText('Your circles')).toBeVisible()

    // Click CIRCLE_2 in the switcher
    await page.getByText(CIRCLE_2.name).click()

    await expect(page).toHaveURL(new RegExp(`circle=${CIRCLE_2.id}`), { timeout: 5_000 })
  })

  test('after switching circles the new circle name appears in the header', async ({ page }) => {
    await page.goto('/timeline')
    await page.getByRole('button', { name: CIRCLE_1.name }).waitFor({ timeout: 15_000 })
    await page.getByRole('button', { name: CIRCLE_1.name }).click()
    await expect(page.getByText('Your circles')).toBeVisible()

    await page.getByText(CIRCLE_2.name).click()

    // Header should now show CIRCLE_2
    await expect(page.getByRole('button', { name: CIRCLE_2.name })).toBeVisible({ timeout: 5_000 })
  })

  test('"Start new circle" button in the switcher navigates to /onboarding', async ({ page }) => {
    await page.goto('/timeline')
    await page.getByRole('button', { name: CIRCLE_1.name }).waitFor({ timeout: 15_000 })
    await page.getByRole('button', { name: CIRCLE_1.name }).click()
    await expect(page.getByText('Your circles')).toBeVisible()

    // The "start new circle" button is identified by its icon + position; use a broader selector
    await page.getByRole('button', { name: /start.*circle|new circle/i }).click()

    await page.waitForURL('/onboarding', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/onboarding/)
  })

  test('clicking the backdrop closes the switcher', async ({ page }) => {
    await page.goto('/timeline')
    await page.getByRole('button', { name: CIRCLE_1.name }).waitFor({ timeout: 15_000 })
    await page.getByRole('button', { name: CIRCLE_1.name }).click()
    await expect(page.getByText('Your circles')).toBeVisible()

    // Click the overlay backdrop (not the modal card)
    await page.locator('.absolute.inset-0.bg-black\\/40').click({ position: { x: 10, y: 10 } })

    await expect(page.getByText('Your circles')).not.toBeVisible({ timeout: 3_000 })
  })
})
