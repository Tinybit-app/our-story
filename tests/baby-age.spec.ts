/**
 * Baby age stamp E2E tests (build plan §4.10.1)
 *
 * Tests:
 *  1. Baby age stamp appears on polaroid cards when date_of_birth is set
 *  2. Baby age stamp is absent when date_of_birth is null
 *  3. Circle settings shows a birth date input (owner only)
 *  4. Saving a birth date calls PATCH /api/circles/:id with dateOfBirth
 */

import { test, expect } from '@playwright/test'

// Use the owner auth session (set up by globalSetup)
test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const MEMORY_DATE = '2024-04-15T00:00:00.000Z' // April 15, 2024
const DATE_OF_BIRTH = '2024-01-01'              // Jan 1, 2024 → "3 months, 2 weeks"

function makeMemory(id: string) {
  return {
    id,
    owner_user_id: 'user-1',
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: 'A cute moment',
    memory_date: MEMORY_DATE,
    milestone_label: null,
    milestone_is_custom: false,
    created_at: MEMORY_DATE,
    memorymedia: [],
    user: { first_name: 'Dao', last_name: 'Z', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
  }
}

function mockMembership(page: any) {
  return page.route('**/api/auth/membership**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
    })
  )
}

function mockCircles(page: any, dateOfBirth: string | null) {
  return page.route('**/api/circles**', (route: any) => {
    // Pass non-GET calls through to the real server
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        circles: [{
          id: CIRCLE_ID,
          name: 'Smith Family',
          circle_type: 'parents',
          date_of_birth: dateOfBirth,
          memberCount: 2,
          role: 'owner',
        }],
      }),
    })
  })
}

function mockTimeline(page: any, dateOfBirth: string | null) {
  return page.route('**/api/timeline**', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        memories: [makeMemory('mem-1')],
        nextCursor: null,
        dateOfBirth,
      }),
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Baby age stamp (4.10.1)', () => {

  test('age stamp appears on polaroid card when date_of_birth is set', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, DATE_OF_BIRTH)
    await mockTimeline(page, DATE_OF_BIRTH)

    await page.goto('/timeline')
    // The computed age for Jan 1 → Apr 15 is "3 months, 2 weeks"
    await expect(page.getByText('3 months, 2 weeks')).toBeVisible({ timeout: 10_000 })
  })

  test('age stamp is not shown when date_of_birth is null', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, null)
    await mockTimeline(page, null)

    await page.goto('/timeline')
    // Wait for the header circle name — confirms timeline loaded
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 10_000 })
    // No age stamp should be present
    await expect(page.getByText(/months|weeks|days old|year/i)).not.toBeVisible()
  })

  test('circle settings shows a birth date input for owners', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, null)
    await page.route('**/api/circles/*/members**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: [], invites: [], myRole: 'owner', memoryCount: 0 }),
      })
    )

    await page.goto('/circle-settings')
    await expect(page.getByLabel("Baby's date of birth")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
  })

  test('saving birth date sends PATCH request with dateOfBirth', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, null)
    await page.route('**/api/circles/*/members**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: [], invites: [], myRole: 'owner', memoryCount: 0 }),
      })
    )

    let patchBody: any = null
    await page.route('**/api/circles/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      } else {
        await route.continue()
      }
    })

    await page.goto('/circle-settings')
    await page.getByLabel("Baby's date of birth").fill('2024-01-01')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Wait briefly for the PATCH to fire
    await page.waitForTimeout(500)
    expect(patchBody).toMatchObject({ dateOfBirth: '2024-01-01' })
  })

})
