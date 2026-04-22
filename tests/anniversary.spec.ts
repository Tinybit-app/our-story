/**
 * Anniversary anchoring E2E tests (build plan §4.10.4)
 *
 * Feature: couple circles can set an anniversary_date. The timeline header shows
 * "Year N together · Since [date]" (or "N days together") beneath the circle name.
 * Circle settings shows the anniversary input only for couple circle owners.
 *
 * Tests:
 *  1. Anniversary display appears on timeline for a couple circle with anniversary_date set
 *  2. Anniversary display is absent for a non-couple circle
 *  3. Anniversary display is absent when no anniversary_date is set for a couple circle
 *  4. Circle settings shows anniversary input for couple circle owner
 *  5. Circle settings does NOT show anniversary input for non-couple circle owners
 *  6. Saving anniversary date calls PATCH /api/circles/:id with anniversaryDate
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const MEMORY_DATE = '2024-04-15T00:00:00.000Z'

function makeMemory(id: string) {
  return {
    id,
    owner_user_id: 'user-1',
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: 'A lovely memory',
    memory_date: MEMORY_DATE,
    milestone_label: null,
    milestone_is_custom: false,
    created_at: MEMORY_DATE,
    memorymedia: [],
    user: { first_name: 'Dao', last_name: 'Z', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
    memory_children: [],
    memory_members: [],
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

function mockCirclesList(
  page: any,
  circle_type: string,
  extra: Record<string, unknown> = {},
) {
  return page.route('**/api/circles**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        circles: [{
          id: CIRCLE_ID,
          name: 'Our Story',
          circle_type,
          memberCount: 2,
          role: 'owner',
          anniversary_date: null,
          ...extra,
        }],
      }),
    })
  })
}

function mockTimeline(page: any, memories: ReturnType<typeof makeMemory>[]) {
  return page.route('**/api/timeline**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memories, nextCursor: null, children: [], members: [] }),
    })
  )
}

function mockCircleDetail(
  page: any,
  circle_type: string,
  extra: Record<string, unknown> = {},
) {
  return page.route(`**/api/circles/${CIRCLE_ID}**`, (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: CIRCLE_ID,
        name: 'Our Story',
        circle_type,
        memberCount: 2,
        role: 'owner',
        anniversary_date: null,
        ...extra,
      }),
    })
  })
}

function mockCircleMembers(page: any) {
  return page.route('**/api/circles/*/members**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ members: [] }),
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Anniversary anchoring (4.10.4)', () => {

  test('anniversary display appears on timeline for a couple circle with anniversary_date set', async ({ page }) => {
    await mockMembership(page)
    // Couple circle with anniversary 2 years before a known date
    await mockCirclesList(page, 'couple', { anniversary_date: '2022-06-15' })
    await mockTimeline(page, [makeMemory('mem-1')])

    await page.goto('/timeline')
    // Wait for the circles mock to load (confirms page is fully hydrated)
    await expect(page.getByRole('button', { name: 'Our Story' })).toBeVisible({ timeout: 15_000 })
    // The header should show the anniversary subtitle
    await expect(page.getByText(/together · Since/)).toBeVisible({ timeout: 10_000 })
  })

  test('anniversary display is absent for a non-couple circle', async ({ page }) => {
    await mockMembership(page)
    // Family circle — anniversary section should not render
    await mockCirclesList(page, 'family', { anniversary_date: '2022-06-15' })
    await mockTimeline(page, [makeMemory('mem-1')])

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Our Story' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/together · Since/)).not.toBeVisible()
  })

  test('anniversary display is absent when no anniversary_date is set', async ({ page }) => {
    await mockMembership(page)
    // Couple circle with no anniversary_date
    await mockCirclesList(page, 'couple') // anniversary_date: null
    await mockTimeline(page, [makeMemory('mem-1')])

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Our Story' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/together · Since/)).not.toBeVisible()
  })

  test('circle settings shows anniversary input for couple circle owner', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'couple')
    await mockCircleDetail(page, 'couple')
    await mockCircleMembers(page)
    await page.route('**/api/circles/*/children**', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) })
    })

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    await expect(page.getByText('Anniversary', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[aria-label="Anniversary date"]')).toBeVisible()
  })

  test('circle settings does NOT show anniversary input for non-couple circle', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'family')
    await mockCircleDetail(page, 'family')
    await mockCircleMembers(page)
    await page.route('**/api/circles/*/children**', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) })
    })

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    // Wait for the settings page to load (danger zone is always present)
    await expect(page.getByText(/danger zone/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Anniversary', { exact: true })).not.toBeVisible()
    await expect(page.locator('input[aria-label="Anniversary date"]')).not.toBeVisible()
  })

  test('saving anniversary date calls PATCH /api/circles/:id with anniversaryDate', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'couple')
    await mockCircleDetail(page, 'couple')
    await mockCircleMembers(page)
    await page.route('**/api/circles/*/children**', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) })
    })

    let patchBody: any = null
    await page.route(`**/api/circles/${CIRCLE_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: CIRCLE_ID, anniversary_date: patchBody.anniversaryDate }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    await expect(page.locator('input[aria-label="Anniversary date"]')).toBeVisible({ timeout: 10_000 })

    // Set a date and save — scope to the anniversary section to avoid matching the circle type Save button
    await page.locator('input[aria-label="Anniversary date"]').fill('2022-06-15')
    await page.locator('input[aria-label="Anniversary date"]').locator('../..').getByRole('button', { name: 'Save' }).click()

    await page.waitForTimeout(500)
    expect(patchBody).toMatchObject({ anniversaryDate: '2022-06-15' })
  })

})
