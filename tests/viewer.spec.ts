import { test, expect } from '@playwright/test'
import { signViewerToken } from '../server/utils/viewerJwt'

// Viewer tests use no storageState — the viewer JWT is the credential, not a session.
const TEST_SECRET = 'test-viewer-secret-at-least-32-chars!!'
const TEST_CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-111111111111'

function makeToken(expirySeconds = 30 * 24 * 60 * 60) {
  return signViewerToken(TEST_CIRCLE_ID, TEST_SECRET, expirySeconds)
}

// ── Viewer page (build plan §4.5) ─────────────────────────────────────────────
test.describe('Viewer-role UX', () => {
  // ── Expired link ─────────────────────────────────────────────────────────────

  test('expired token shows a user-friendly expiry message', async ({ page }) => {
    await page.route('**/api/viewer/timeline**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'expired' }),
      }),
    )

    await page.goto(`/view?token=${makeToken(-1)}`)
    await expect(page.getByText(/link has expired/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /send a reminder/i })).toBeVisible()
  })

  test('invalid token shows a generic error', async ({ page }) => {
    await page.goto('/view?token=not.a.valid.token')
    await expect(page.getByText(/link has expired|invalid/i)).toBeVisible({ timeout: 10_000 })
  })

  test('missing token redirects to /login', async ({ page }) => {
    await page.goto('/view')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── First-open splash ─────────────────────────────────────────────────────────

  test('valid token shows the first-open splash', async ({ page }) => {
    await page.route('**/api/viewer/timeline**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          circleName: 'The Smith Family',
          ownerFirstName: 'Dao',
          memories: [],
        }),
      }),
    )

    await page.goto(`/view?token=${makeToken()}`)
    await expect(page.getByText(/never miss a moment/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/no account needed/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /see the memories/i })).toBeVisible()
  })

  test('"See the memories" dismisses splash and shows timeline', async ({ page }) => {
    await page.route('**/api/viewer/timeline**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          circleName: 'The Smith Family',
          ownerFirstName: 'Dao',
          memories: [
            {
              id: 'dddddddd-4444-4444-8444-444444444444',
              memory_date: '2024-06-01',
              note: 'First steps!',
              signedUrl: null,
            },
          ],
        }),
      }),
    )

    await page.goto(`/view?token=${makeToken()}`)
    await page.getByRole('button', { name: /see the memories/i }).click()
    await expect(page.getByText('The Smith Family')).toBeVisible({ timeout: 5_000 })
  })

  // ── Splash shown once per session ─────────────────────────────────────────────

  test('splash is not shown again once dismissed within the same session', async ({ page }) => {
    await page.route('**/api/viewer/timeline**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          circleName: 'The Smith Family',
          ownerFirstName: 'Dao',
          memories: [],
        }),
      }),
    )

    await page.goto(`/view?token=${makeToken()}`)
    await page.getByRole('button', { name: /see the memories/i }).click()

    // Navigate away and back (same session — sessionStorage flag)
    await page.goto(`/view?token=${makeToken()}`)
    await expect(page.getByText(/never miss a moment/i)).not.toBeVisible({ timeout: 3_000 })
  })
})
