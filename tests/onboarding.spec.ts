import { test, expect } from '@playwright/test'

// All tests in this file require an authenticated session.
// The session is created once in tests/globalSetup.ts and stored in tests/.auth/user.json.
test.use({ storageState: 'tests/.auth/user.json' })

// Mock circle ID returned from the mocked create endpoint
const TEST_CIRCLE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    // Return hasMembership: true so the global middleware allows /timeline navigation.
    // Onboarding routes (/onboarding/*) skip the membership check, so this is safe
    // to use across all steps.
    await page.route('**/api/auth/membership**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
      })
    )
  })

  // ── Step 1: Circle type picker ─────────────────────────────────────────────
  test.describe('Circle type picker (/onboarding)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/onboarding')
      // Wait for client-side rendering to complete
      await page.locator('button').filter({ hasText: /new parents/i }).waitFor({ timeout: 20_000 })
    })

    test('shows all 7 circle type buttons', async ({ page }) => {
      const labels = ['New parents', 'Couple', 'Family', 'Friend group', 'Caregiving', 'Travel group', 'Just me']
      for (const label of labels) {
        await expect(page.locator('button').filter({ hasText: label }).first()).toBeVisible()
      }
    })

    test('Continue button is disabled before a type is selected', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    })

    test('Continue button enables after selecting a type', async ({ page }) => {
      await page.locator('button').filter({ hasText: 'Family' }).first().click()
      await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    test('selecting a type and clicking Continue navigates to the name step', async ({ page }) => {
      await page.locator('button').filter({ hasText: 'New parents' }).first().click()
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.waitForURL('/onboarding/name', { timeout: 10_000 })
      await expect(page).toHaveURL(/\/onboarding\/name/)
    })
  })

  // ── Step 2: Circle name ────────────────────────────────────────────────────
  test.describe('Circle name step (/onboarding/name)', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate through type picker to set the onboarding_circle_type cookie
      await page.goto('/onboarding')
      await page.locator('button').filter({ hasText: 'New parents' }).waitFor({ timeout: 20_000 })
      await page.locator('button').filter({ hasText: 'New parents' }).first().click()
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.waitForURL('/onboarding/name')
    })

    test('shows a name input with a type-specific placeholder', async ({ page }) => {
      const input = page.locator('input[type="text"]')
      await expect(input).toBeVisible()
      // Placeholder should be non-empty (type-specific placeholders are configured in name.vue)
      const placeholder = await input.getAttribute('placeholder')
      expect(placeholder).toBeTruthy()
      expect(placeholder!.length).toBeGreaterThan(0)
    })

    test('non-solo circle navigates to the invite step after creation', async ({ page }) => {
      await page.route('**/api/circles/create**', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ circleId: TEST_CIRCLE_ID }),
        })
      )

      await page.locator('input[type="text"]').fill('The Smith Family')
      await page.getByRole('button', { name: 'Continue' }).click()

      await page.waitForURL('/onboarding/invite', { timeout: 10_000 })
      await expect(page).toHaveURL(/\/onboarding\/invite/)
    })

    test('solo circle skips invite and navigates to the timeline', async ({ page }) => {
      // Navigate back to type picker to select solo type
      await page.goto('/onboarding')
      await page.locator('button').filter({ hasText: 'Just me' }).waitFor({ timeout: 20_000 })
      await page.locator('button').filter({ hasText: 'Just me' }).first().click()
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.waitForURL('/onboarding/name')

      await page.route('**/api/circles/create**', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ circleId: TEST_CIRCLE_ID }),
        })
      )

      await page.locator('input[type="text"]').fill('My Journal')
      await page.getByRole('button', { name: 'Continue' }).click()

      await page.waitForURL(/\/timeline/, { timeout: 10_000 })
      await expect(page).toHaveURL(new RegExp(`timeline.*circle=${TEST_CIRCLE_ID}`))
    })

    test('shows an error message when circle creation fails', async ({ page }) => {
      await page.route('**/api/circles/create**', route =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Something went wrong' }),
        })
      )

      await page.locator('input[type="text"]').fill('Test Circle')
      await page.getByRole('button', { name: 'Continue' }).click()

      // Error message should appear on the page
      await expect(page.locator('p').filter({ hasText: /something went wrong/i }).or(
        page.locator('p').filter({ hasText: /went wrong|error|failed/i })
      )).toBeVisible({ timeout: 5_000 })
    })
  })

  // ── Step 3: Invite ─────────────────────────────────────────────────────────
  test.describe('Invite step (/onboarding/invite)', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate through the full flow to reach the invite step
      await page.goto('/onboarding')
      await page.locator('button').filter({ hasText: 'New parents' }).waitFor({ timeout: 20_000 })
      await page.locator('button').filter({ hasText: 'New parents' }).first().click()
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.waitForURL('/onboarding/name')

      await page.route('**/api/circles/create**', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ circleId: TEST_CIRCLE_ID }),
        })
      )

      await page.locator('input[type="text"]').fill('The Smith Family')
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.waitForURL('/onboarding/invite')
    })

    test('shows the email input and action buttons', async ({ page }) => {
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Send invite' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible()
    })

    test('Send invite button is disabled when email is empty', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Send invite' })).toBeDisabled()
    })

    test('sending a valid invite shows a success confirmation', async ({ page }) => {
      await page.route('**/api/circles/invite**', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      )

      await page.locator('input[type="email"]').fill('partner@example.com')
      await page.getByRole('button', { name: 'Send invite' }).click()

      await expect(page.getByText('Invite sent')).toBeVisible({ timeout: 5_000 })
    })

    test('after sending an invite the skip button changes to Continue', async ({ page }) => {
      await page.route('**/api/circles/invite**', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      )

      await page.locator('input[type="email"]').fill('partner@example.com')
      await page.getByRole('button', { name: 'Send invite' }).click()
      await expect(page.getByText('Invite sent')).toBeVisible({ timeout: 5_000 })

      // Skip button label should change to "Continue" after invite is sent
      await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
    })

    test('skipping invite navigates to the timeline with the new circle', async ({ page }) => {
      await page.getByRole('button', { name: 'Skip for now' }).click()

      await page.waitForURL(/\/timeline/, { timeout: 10_000 })
      await expect(page).toHaveURL(new RegExp(`timeline.*circle=${TEST_CIRCLE_ID}`))
    })
  })
})
