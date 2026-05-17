/**
 * Timeline mosaic — viewport-driven column count E2E tests
 *
 * The /timeline mosaic page uses CSS media queries to render:
 *  - 3 columns at viewport < 768px (mobile)
 *  - 4 columns at viewport ≥ 768px (desktop)
 *
 * Tests:
 *  1. Renders 3 columns at mobile viewport (< 768px)
 *  2. Renders 4 columns at desktop viewport (≥ 768px)
 *  3. Crossing the 768px boundary swaps column count dynamically
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
    memorymedia: [
      {
        id: `media-${id}`,
        memory_id: id,
        storage_path: `test/${id}.jpg`,
        media_type: 'image',
        created_at: date,
      },
    ],
    memoryreaction: [],
    memorycomment: [],
    memory_children: [],
    memory_members: [],
    user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
  }
}

test.describe('timeline mosaic · viewport-driven column count', () => {
  test('renders 3 columns at mobile viewport (< 768px)', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memories = [
      makeMemory('m-2025-1', '2025-06-15'),
      makeMemory('m-2025-2', '2025-05-10'),
      makeMemory('m-2025-3', '2025-04-20'),
    ]

    await page.route('**/api/timeline**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          memories,
          prevYear: null,
          children: [],
          members: [],
        }),
      })
    })

    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/timeline')
    await page.waitForSelector('.grid', { timeout: 10_000 })

    const cols = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).getPropertyValue('grid-template-columns'),
    )

    // Count tracks. 3 tracks → 2 spaces between → 3 tokens when split.
    const trackCount = cols.trim().split(/\s+/).length
    expect(trackCount).toBe(3)
  })

  test('renders 4 columns at desktop viewport (≥ 768px)', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memories = [
      makeMemory('m-2025-1', '2025-06-15'),
      makeMemory('m-2025-2', '2025-05-10'),
      makeMemory('m-2025-3', '2025-04-20'),
      makeMemory('m-2025-4', '2025-03-05'),
    ]

    await page.route('**/api/timeline**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          memories,
          prevYear: null,
          children: [],
          members: [],
        }),
      })
    })

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/timeline')
    await page.waitForSelector('.grid', { timeout: 10_000 })

    const cols = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).getPropertyValue('grid-template-columns'),
    )

    const trackCount = cols.trim().split(/\s+/).length
    expect(trackCount).toBe(4)
  })

  test('crossing the 768px boundary swaps column count', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockProfile(page)

    const memories = [
      makeMemory('m-2025-1', '2025-06-15'),
      makeMemory('m-2025-2', '2025-05-10'),
      makeMemory('m-2025-3', '2025-04-20'),
      makeMemory('m-2025-4', '2025-03-05'),
    ]

    await page.route('**/api/timeline**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          memories,
          prevYear: null,
          children: [],
          members: [],
        }),
      })
    })

    // Start at desktop (4 cols)
    await page.setViewportSize({ width: 800, height: 800 })
    await page.goto('/timeline')
    await page.waitForSelector('.grid', { timeout: 10_000 })

    let cols = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).getPropertyValue('grid-template-columns'),
    )
    let trackCount = cols.trim().split(/\s+/).length
    expect(trackCount).toBe(4)

    // Resize to mobile (< 768px → 3 cols)
    await page.setViewportSize({ width: 700, height: 800 })
    // Brief settle for the CSS media query to re-evaluate
    await page.waitForTimeout(50)

    cols = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).getPropertyValue('grid-template-columns'),
    )
    trackCount = cols.trim().split(/\s+/).length
    expect(trackCount).toBe(3)

    // Resize back to desktop (≥ 768px → 4 cols)
    await page.setViewportSize({ width: 800, height: 800 })
    await page.waitForTimeout(50)

    cols = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).getPropertyValue('grid-template-columns'),
    )
    trackCount = cols.trim().split(/\s+/).length
    expect(trackCount).toBe(4)
  })
})
