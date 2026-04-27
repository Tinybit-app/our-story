/**
 * Main timeline — year-at-a-time E2E tests
 *
 * The /timeline page (index) loads all memories for the latest year on first
 * render, then loads the previous year automatically when the IntersectionObserver
 * sentinel scrolls into view.
 *
 * Tests:
 *  1. First load fetches the latest year automatically (no year param)
 *  2. Scrolling to the bottom triggers a previous-year fetch (year param passed)
 *  3. Memories from the previous year are appended to memoriesFlat
 *  4. No load-more trigger when prevYear is null (all years loaded)
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

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
          name: 'Smith Family',
          circle_type: 'family',
          memberCount: 2,
          role: 'owner',
          anniversary_date: null,
        }],
      }),
    })
  })
}

function mockProfile(page: any) {
  return page.route('**/api/profile**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ firstName: 'Alice', lastName: 'Smith', avatarUrl: null, locale: 'en' }),
    })
  })
}

function makeMemory(id: string, date: string) {
  return {
    id,
    owner_user_id: '00000000-dead-beef-0000-000000000001',
    circle_id: CIRCLE_ID,
    note: `Memory ${id}`,
    milestone_label: null,
    memory_date: date,
    visibility: 'circle',
    former_owner_name: null,
    former_owner_user_id: null,
    memorymedia: [],
    memoryreaction: [],
    memorycomment: [],
    memory_children: [],
    memory_members: [],
    user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
  }
}

test.describe('Main timeline — year-at-a-time loading', () => {

  test('first load fetches the latest year without a year param', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const year2025Memories = [makeMemory('m-2025-1', '2025-06-15'), makeMemory('m-2025-2', '2025-03-10')]
    let firstCallYear: string | null | undefined = undefined
    let callCount = 0

    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      callCount++
      if (callCount === 1) {
        firstCallYear = url.searchParams.get('year')
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memories: year2025Memories, prevYear: null, children: [], members: [] }),
      })
    })

    await page.goto('/timeline')

    // Timeline should render with memories from the (mocked) latest year
    await expect(page.getByText(/Memory m-2025-1/).first()).toBeVisible({ timeout: 10_000 })

    // First call should NOT send a year param (auto-detect)
    expect(firstCallYear).toBeNull()
  })

  test('scrolling to bottom triggers previous-year fetch with correct year param', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const year2025Memories = Array.from({ length: 3 }, (_, i) =>
      makeMemory(`m-2025-${i}`, `2025-0${i + 1}-15`)
    )
    const year2024Memories = Array.from({ length: 3 }, (_, i) =>
      makeMemory(`m-2024-${i}`, `2024-0${i + 1}-15`)
    )

    let secondCallYear: string | null = null
    let callCount = 0

    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      callCount++
      if (callCount === 1) {
        // First load — return 2025 memories with prevYear=2024
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ memories: year2025Memories, prevYear: 2024, children: [], members: [] }),
        })
      }
      // Subsequent load — should have year=2024
      secondCallYear = url.searchParams.get('year')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memories: year2024Memories, prevYear: null, children: [], members: [] }),
      })
    })

    await page.goto('/timeline')
    await expect(page.getByText(/Memory m-2025-0/)).toBeVisible({ timeout: 10_000 })

    // Scroll to bottom to trigger IntersectionObserver sentinel
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Wait for 2024 memories to be appended
    await page.waitForFunction(
      () => document.querySelectorAll('article').length >= 6,
      { timeout: 10_000 }
    )

    // Verify the second call was made with year=2024
    expect(secondCallYear).toBe('2024')
    await expect(page.getByText(/Memory m-2024-0/)).toBeVisible({ timeout: 5_000 })
  })

  test('no further loads when prevYear is null', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memories = [makeMemory('m-2025-1', '2025-06-15')]
    let callCount = 0

    await page.route('**/api/timeline**', (route) => {
      callCount++
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // prevYear null — no more years to load
        body: JSON.stringify({ memories, prevYear: null, children: [], members: [] }),
      })
    })

    await page.goto('/timeline')
    await expect(page.getByText(/Memory m-2025-1/)).toBeVisible({ timeout: 10_000 })

    // Scroll to trigger the sentinel
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Wait a tick — no second call should fire
    await page.waitForTimeout(500)
    expect(callCount).toBe(1)
  })

})
