/**
 * Circle type picker E2E tests (build plan §4.10.5)
 *
 * Feature: owner can change circle_type from /circle-settings at any time.
 * A segmented 4-column grid of all types is shown; the current type is
 * pre-selected. Selecting a different type auto-saves via PATCH (no Save
 * button — settings page uses Apple Rows pattern).
 *
 * Tests:
 *  1. Circle type picker is visible to owners in circle settings
 *  2. Current circle type is pre-selected (active class)
 *  3. Clicking the already-selected type does not fire PATCH
 *  4. Selecting a different type fires PATCH immediately
 *  5. Circle type picker is not shown to non-owners (redirect to /members)
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

function mockMembership(page: any) {
  return page.route('**/api/auth/membership**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hasMembership: true,
        needsProfile: false,
        deletedAt: null,
      }),
    }),
  )
}

function mockCirclesList(
  page: any,
  role: string = 'owner',
  circle_type: string = 'parents',
) {
  return page.route('**/api/circles**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        circles: [
          {
            id: CIRCLE_ID,
            name: 'Smith Family',
            circle_type,
            memberCount: 2,
            role,
            anniversary_date: null,
          },
        ],
      }),
    })
  })
}

function mockCircleDetail(
  page: any,
  role: string = 'owner',
  circle_type: string = 'parents',
) {
  return page.route(`**/api/circles/${CIRCLE_ID}**`, (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: CIRCLE_ID,
        name: 'Smith Family',
        circle_type,
        memberCount: 2,
        role,
        anniversary_date: null,
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
      body: JSON.stringify({
        members: [],
        invites: [],
        myRole: 'owner',
        memoryCount: 0,
      }),
    })
  })
}

function mockChildrenApi(page: any) {
  return page.route('**/api/circles/*/children**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ children: [] }),
    })
  })
}

async function goToSettings(page: any) {
  await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
  // The circle type section heading is always present for owners
  await expect(page.getByText('Circle type').first()).toBeVisible({
    timeout: 10_000,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Circle type picker (4.10.5)', () => {
  test('circle type picker is visible to owners in circle settings', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockCircleDetail(page)
    await mockCircleMembers(page)
    await mockChildrenApi(page)

    await goToSettings(page)
    // All 8 options should be rendered
    await expect(
      page.getByRole('button', { name: /New parents/i }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Couple/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Family/i })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Friend group/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Caregiving/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Travel group/i }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Just me/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Other/i })).toBeVisible()
  })

  test('current circle type is pre-selected (highlighted)', async ({
    page,
  }) => {
    await mockMembership(page)
    // circle_type = 'couple'
    await mockCirclesList(page, 'owner', 'couple')
    await mockCircleDetail(page, 'owner', 'couple')
    await mockCircleMembers(page)
    await mockChildrenApi(page)

    await goToSettings(page)
    // Selected segmented-control button carries `bg-background text-foreground shadow-sm`.
    // We assert `bg-background` — it uniquely identifies the active state inside the
    // rounded segment group (unselected siblings have only text-muted-foreground).
    const coupleBtn = page.getByRole('button', { name: /^Couple/i })
    await expect(coupleBtn).toHaveClass(/bg-background/)
  })

  test('clicking the already-selected type does not fire PATCH', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'owner', 'parents')
    await mockCircleDetail(page, 'owner', 'parents')
    await mockCircleMembers(page)
    await mockChildrenApi(page)

    let patchCount = 0
    await page.route(`**/api/circles/${CIRCLE_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchCount += 1
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: CIRCLE_ID, circle_type: 'parents' }),
        })
      } else {
        await route.continue()
      }
    })

    await goToSettings(page)
    // "New parents" is already selected — clicking it should be a no-op
    await page.getByRole('button', { name: /New parents/i }).click()
    await page.waitForTimeout(500)
    expect(patchCount).toBe(0)
  })

  test('selecting a different type fires PATCH /api/circles/:id with circleType', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page, 'owner', 'parents')
    await mockCircleDetail(page, 'owner', 'parents')
    await mockCircleMembers(page)
    await mockChildrenApi(page)

    let patchBody: any = null
    await page.route(`**/api/circles/${CIRCLE_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: CIRCLE_ID,
            circle_type: patchBody.circleType,
          }),
        })
      } else {
        await route.continue()
      }
    })

    await goToSettings(page)
    // Auto-save: clicking a new type fires PATCH immediately, no Save button.
    await page.getByRole('button', { name: /Friend group/i }).click()

    await expect.poll(() => patchBody, { timeout: 5_000 }).toMatchObject({
      circleType: 'friends',
    })
  })

  test('circle type picker is not shown to non-owners', async ({ page }) => {
    await mockMembership(page)
    // Non-owners get redirected away by watchEffect, so mock as viewer
    // The redirect goes to /members — just verify the picker is absent
    await mockCirclesList(page, 'member', 'parents')
    await mockCircleDetail(page, 'member', 'parents')
    await mockCircleMembers(page)
    await mockChildrenApi(page)

    await page.goto(`/circle-settings?circle=${CIRCLE_ID}`)
    // Non-owners are redirected; page should not have the picker
    await page.waitForTimeout(1_000)
    await expect(page.getByText('Circle type')).not.toBeVisible()
  })
})
