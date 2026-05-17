/**
 * Month view — spread header + navigation + share E2E tests
 *
 * The /timeline/[year]/[month] page renders:
 *  - MonthSpreadHeader with italic month name + sticky pill bar
 *  - Back link to return to main timeline
 *  - Share button to copy canonical URL to clipboard
 *
 * Tests:
 *  1. Spread header renders italic month name + sticky pill bar
 *  2. Back link returns to the main timeline
 *  3. Share button copies the canonical URL to clipboard
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

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

function mockCirclesList(page: any) {
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
            circle_type: 'family',
            memberCount: 2,
            role: 'owner',
            anniversary_date: null,
          },
        ],
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
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Smith',
        avatarUrl: null,
        locale: 'en',
      }),
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

test.describe('month view · /timeline/[year]/[month]', () => {
  test('spread header renders italic month name + sticky pill bar', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memory = makeMemory('m-2026-4', '2026-04-15')

    // Mock the adjacency endpoint
    await page.route('**/api/timeline/months-with-data**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prev: { year: 2026, month: 3 },
          next: { year: 2026, month: 5 },
        }),
      })
    })

    // Mock the timeline endpoint for the month
    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      const yearMonth = url.searchParams.get('yearMonth')
      if (yearMonth === '2026-04') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            memories: [memory],
            nextCursor: null,
            totalCount: 1,
            children: [],
            members: [],
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/timeline/2026/4')
    await page.waitForSelector('.month-spread-header', { timeout: 10_000 })

    // The italic <em> month name should be visible inside .month-title
    const monthTitleEm = page.locator('.month-title em')
    await expect(monthTitleEm).toBeVisible()
    const monthText = await monthTitleEm.textContent()
    expect(monthText).toMatch(/April|Apr/i)

    // The sticky pill bar shows the current month
    const currentPill = page.locator('.pill-bar-inner .current')
    await expect(currentPill).toBeVisible()
    const currentText = await currentPill.textContent()
    expect(currentText).toMatch(/APR/)
  })

  test('back link returns to the main timeline', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memory = makeMemory('m-2026-4', '2026-04-15')

    await page.route('**/api/timeline/months-with-data**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prev: { year: 2026, month: 3 },
          next: { year: 2026, month: 5 },
        }),
      })
    })

    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      const yearMonth = url.searchParams.get('yearMonth')
      if (yearMonth === '2026-04') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            memories: [memory],
            nextCursor: null,
            totalCount: 1,
            children: [],
            members: [],
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/timeline/2026/4')
    await page.waitForSelector('.month-spread-header', { timeout: 10_000 })

    const backLink = page.locator('.month-spread-header .back')
    await expect(backLink).toBeVisible()

    // Click the back link
    await backLink.click()

    // Should navigate back to /timeline (main timeline)
    await page.waitForURL(/\/timeline(\?|$)/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/timeline(\?|$)/)
  })

  test('share button copies the canonical URL to clipboard', async ({
    page,
    context,
  }) => {
    // Grant clipboard permissions for this context
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memory = makeMemory('m-2026-4', '2026-04-15')

    await page.route('**/api/timeline/months-with-data**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prev: { year: 2026, month: 3 },
          next: { year: 2026, month: 5 },
        }),
      })
    })

    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      const yearMonth = url.searchParams.get('yearMonth')
      if (yearMonth === '2026-04') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            memories: [memory],
            nextCursor: null,
            totalCount: 1,
            children: [],
            members: [],
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/timeline/2026/4')
    await page.waitForSelector('.month-spread-header', { timeout: 10_000 })

    const shareBtn = page.locator('.share-btn')
    await expect(shareBtn).toBeVisible()

    // Click the share button
    await shareBtn.click()

    // Wait a moment for the clipboard operation to complete
    await page.waitForTimeout(300)

    // Read the clipboard and verify it contains the month URL
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    )
    expect(clipboardText).toMatch(/\/timeline\/2026\/4/)
  })

  test('spread header memoryCount uses totalCount, not paginated length', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    // Create 3 memory objects for the paginated response
    const memory1 = makeMemory('m-1', '2026-04-15')
    const memory2 = makeMemory('m-2', '2026-04-14')
    const memory3 = makeMemory('m-3', '2026-04-13')

    // Mock the adjacency endpoint
    await page.route('**/api/timeline/months-with-data**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prev: { year: 2026, month: 3 },
          next: { year: 2026, month: 5 },
        }),
      })
    })

    // Mock the timeline endpoint with 3 paginated memories but totalCount of 47
    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      const yearMonth = url.searchParams.get('yearMonth')
      if (yearMonth === '2026-04') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            memories: [memory1, memory2, memory3],
            nextCursor: null,
            totalCount: 47,
            children: [],
            members: [],
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/timeline/2026/4')
    await page.waitForSelector('.month-spread-header', { timeout: 10_000 })

    // The header should display 47 (totalCount), not 3 (memories.length)
    const headerContent = await page.locator('.month-spread-header').textContent()
    expect(headerContent).toContain('47')
  })

  test('clicking the next-month pill navigates to that month', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memory = makeMemory('m-2026-4', '2026-04-15')

    // Mock the timeline endpoint for April
    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      const yearMonth = url.searchParams.get('yearMonth')
      if (yearMonth === '2026-04') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            memories: [memory],
            nextCursor: null,
            totalCount: 1,
            children: [],
            members: [],
          }),
        })
      } else {
        route.continue()
      }
    })

    // Mock the adjacency endpoint with next month available
    // Place this AFTER the timeline mock to ensure both are registered
    await page.route('**/api/timeline/months-with-data**', (route: any) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prev: null,
          next: { year: 2026, month: 5 },
        }),
      })
    })

    await page.goto('/timeline/2026/4')
    await page.waitForSelector('.pill-bar-inner', { timeout: 10_000 })

    // Wait for the next pill link to be visible.
    // The next pill is a NuxtLink inside .pill-bar-inner with class "pill".
    // Since prev is null, there will be one disabled span.pill at the start
    // and one a.pill (NuxtLink) on the right for next month.
    const nextPill = page.locator('.pill-bar-inner a.pill')
    await expect(nextPill).toBeVisible({ timeout: 5_000 })
    await nextPill.click()

    // URL should now be /timeline/2026/5 (with optional ?circle= query).
    await page.waitForURL(/\/timeline\/2026\/5(\?|$)/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/timeline\/2026\/5/)
  })
})
