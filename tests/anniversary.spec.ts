/**
 * Anniversary anchoring E2E tests (build plan §4.10.4)
 *
 * Feature: any circle type can set an anniversary_date. The timeline header shows
 * "Year N together · Since [date]" for couple circles, or
 * "Year N of [circle name] · Since [date]" for all other types.
 * Circle settings shows the anniversary input for all circle types (owner only).
 * Circle owners can also rename the circle from circle settings.
 *
 * Tests:
 *  1. Anniversary display appears on timeline for a couple circle (together · Since)
 *  2. Anniversary display appears on timeline for a non-couple circle (Year N of [name] · Since)
 *  3. Anniversary display is absent when no anniversary_date is set
 *  4. Circle settings shows anniversary input for couple circle owner
 *  5. Circle settings shows anniversary input for non-couple circle owner
 *  6. Saving anniversary date calls PATCH /api/circles/:id with anniversaryDate
 *  7. Circle name field is visible in settings for owner
 *  8. Saving circle name calls PATCH /api/circles/:id with name
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

function mockChildren(page: any) {
  return page.route('**/api/circles/*/children**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Anniversary anchoring (4.10.4)', () => {

  test('anniversary display appears on timeline for a couple circle', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'couple', { anniversary_date: '2022-06-15' })
    await mockTimeline(page, [makeMemory('mem-1')])

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Our Story' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/together · Since/)).toBeVisible({ timeout: 10_000 })
  })

  test('anniversary display appears on timeline for a non-couple circle (Year N of [name])', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'family', { anniversary_date: '2022-06-15' })
    await mockTimeline(page, [makeMemory('mem-1')])

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Our Story' })).toBeVisible({ timeout: 15_000 })
    // Non-couple circles show "Year N of [name] · Since [date]"
    await expect(page.getByText(/of Our Story · Since/)).toBeVisible({ timeout: 10_000 })
  })

  test('anniversary display is absent when no anniversary_date is set', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'couple') // anniversary_date: null
    await mockTimeline(page, [makeMemory('mem-1')])

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Our Story' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/together · Since/)).not.toBeVisible()
    await expect(page.getByText(/of Our Story · Since/)).not.toBeVisible()
  })

  test('circle settings shows anniversary input for couple circle owner', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'couple')
    await mockCircleDetail(page, 'couple')
    await mockCircleMembers(page)
    await mockChildren(page)

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    await expect(page.getByText('Anniversary', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[aria-label="Anniversary date"]')).toBeVisible()
  })

  test('circle settings shows anniversary input for non-couple circle owner', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'family')
    await mockCircleDetail(page, 'family')
    await mockCircleMembers(page)
    await mockChildren(page)

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    await expect(page.getByText('Anniversary', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[aria-label="Anniversary date"]')).toBeVisible()
  })

  test('saving anniversary date calls PATCH /api/circles/:id with anniversaryDate', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'couple')
    await mockCircleDetail(page, 'couple')
    await mockCircleMembers(page)
    await mockChildren(page)

    let patchBody: any = null
    await page.route(`**/api/circles/${CIRCLE_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    await expect(page.locator('input[aria-label="Anniversary date"]')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[aria-label="Anniversary date"]').fill('2022-06-15')
    await page.locator('input[aria-label="Anniversary date"]').locator('../..').getByRole('button', { name: 'Save' }).click()

    await page.waitForTimeout(500)
    expect(patchBody).toMatchObject({ anniversaryDate: '2022-06-15' })
  })

  test('circle name field is visible in settings for owner', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'family')
    await mockCircleDetail(page, 'family')
    await mockCircleMembers(page)
    await mockChildren(page)

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    await expect(page.getByText('Circle name', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[placeholder="Circle name"]')).toBeVisible()
    // Input is pre-filled with the current circle name
    await expect(page.locator('input[placeholder="Circle name"]')).toHaveValue('Our Story')
  })

  test('saving circle name calls PATCH /api/circles/:id with name', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'family')
    await mockCircleDetail(page, 'family')
    await mockCircleMembers(page)
    await mockChildren(page)

    let patchBody: any = null
    await page.route(`**/api/circles/${CIRCLE_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      } else {
        await route.continue()
      }
    })

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    const nameInput = page.locator('input[placeholder="Circle name"]')
    await expect(nameInput).toBeVisible({ timeout: 10_000 })

    await nameInput.fill('The Smiths')
    await nameInput.locator('../..').getByRole('button', { name: 'Save' }).click()

    await page.waitForTimeout(500)
    expect(patchBody).toMatchObject({ name: 'The Smiths' })
  })

})
