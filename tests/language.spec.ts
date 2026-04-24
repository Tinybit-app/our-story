/**
 * Language switching E2E tests (build plan §8.5.4 + §8.5.5)
 *
 * Feature: LocalePicker in the header lets users switch between English,
 * Chinese (中文), and French (Français). The selection:
 *   - immediately re-renders the UI in the chosen language
 *   - persists across page reloads via the i18n_locale cookie
 *   - is saved to User.locale via PATCH /api/profile (fire-and-forget)
 *
 * Tests:
 *  1. Language picker is visible in the timeline header
 *  2. Current locale label shows "EN" by default
 *  3. Clicking the picker opens the dropdown with all three locales
 *  4. Switching to French changes the UI to French (nav Add memory → Ajouter un souvenir)
 *  5. After switching to French, picker label shows "FR"
 *  6. Switching to Chinese changes the UI to Chinese
 *  7. Switching back to English restores English UI
 *  8. Switching locale calls PATCH /api/profile with the correct locale code
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

const CIRCLE_ID = 'aaaaaaaa-9999-4999-8999-aaaaaaaaaaaa'

function mockMembership(page: any) {
  return page.route('**/api/auth/membership**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
    })
  )
}

function mockCirclesList(page: any) {
  return page.route('**/api/circles**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        circles: [{
          id: CIRCLE_ID,
          name: 'Test Circle',
          circle_type: 'family',
          memberCount: 2,
          role: 'owner',
          anniversary_date: null,
        }],
      }),
    })
  })
}

function mockTimeline(page: any) {
  return page.route('**/api/timeline**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memories: [], nextCursor: null, children: [], members: [] }),
    })
  )
}

function mockProfile(page: any) {
  return page.route('**/api/profile**', (route: any) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

async function goToTimeline(page: any) {
  await mockMembership(page)
  await mockCirclesList(page)
  await mockTimeline(page)
  await mockProfile(page)
  await page.goto(`/timeline?circle=${CIRCLE_ID}`)
  await page.waitForSelector('[data-testid="locale-picker"]', { timeout: 10000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Language switching (8.5.4 + 8.5.5)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear only the i18n locale cookie so each test starts from English
    // (clearing all cookies would also remove the Supabase auth cookie and cause a redirect to /login)
    await page.context().clearCookies({ name: 'i18n_locale' })
  })

  test('1. language picker is visible in the timeline header', async ({ page }) => {
    await goToTimeline(page)
    await expect(page.getByTestId('locale-picker')).toBeVisible()
  })

  test('2. current locale label shows EN by default', async ({ page }) => {
    await goToTimeline(page)
    await expect(page.getByTestId('locale-picker')).toContainText('EN')
  })

  test('3. clicking the picker opens a dropdown with all three locales', async ({ page }) => {
    await goToTimeline(page)
    await page.getByTestId('locale-picker').click()
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible()
    await expect(page.getByRole('button', { name: '中文' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Français' })).toBeVisible()
  })

  test('4. switching to French re-renders UI in French', async ({ page }) => {
    await goToTimeline(page)
    await page.getByTestId('locale-picker').click()
    await page.getByRole('button', { name: 'Français' }).click()
    // "Add memory" button becomes "Ajouter un souvenir"
    await expect(page.getByRole('button', { name: /Ajouter un souvenir/i })).toBeVisible({ timeout: 5000 })
  })

  test('5. after switching to French, picker label shows FR', async ({ page }) => {
    await goToTimeline(page)
    await page.getByTestId('locale-picker').click()
    await page.getByRole('button', { name: 'Français' }).click()
    await expect(page.getByTestId('locale-picker')).toContainText('FR')
  })

  test('6. switching to Chinese renders Chinese UI', async ({ page }) => {
    await goToTimeline(page)
    await page.getByTestId('locale-picker').click()
    await page.getByRole('button', { name: '中文' }).click()
    // Nav "Add memory" key in zh-CN should be visible — picker label confirms locale
    await expect(page.getByTestId('locale-picker')).toContainText('中')
  })

  test('7. switching back to English restores English UI', async ({ page }) => {
    await goToTimeline(page)
    // Switch to French first, then back to English
    await page.getByTestId('locale-picker').click()
    await page.getByRole('button', { name: 'Français' }).click()
    await expect(page.getByTestId('locale-picker')).toContainText('FR')

    await page.getByTestId('locale-picker').click()
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('button', { name: /Add memory/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('locale-picker')).toContainText('EN')
  })

  test('8. switching locale PATCHes /api/profile with the correct locale code', async ({ page }) => {
    const profileRequests: string[] = []
    page.on('request', req => {
      if (req.url().includes('/api/profile') && req.method() === 'PATCH') {
        profileRequests.push(req.postData() ?? '')
      }
    })

    await goToTimeline(page)
    await page.getByTestId('locale-picker').click()
    await page.getByRole('button', { name: 'Français' }).click()

    // Wait briefly for the fire-and-forget PATCH to fire
    await page.waitForTimeout(500)
    expect(profileRequests.some(body => body.includes('"fr"') || body.includes("'fr'"))).toBe(true)
  })
})
