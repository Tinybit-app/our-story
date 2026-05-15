/**
 * Month overflow page E2E tests
 *
 * The /timeline/[year]/[month] page shows all memories for a given calendar
 * month (no pagination cap). It is reached by clicking "View all" in a month
 * group that has more memories than the timeline's inline limit.
 *
 * This page uses MemoryShell (the unified animation wrapper), so opening any
 * memory — photo, video, or quick note — must trigger the correct modal.
 *
 * Tests:
 *  1. Visiting an invalid year/month redirects to /timeline
 *  2. Valid page with no memories shows the empty-state message
 *  3. Valid page with memories renders the correct count label
 *  4. Clicking a quick-note card opens MemoryShell (QuickNoteModal inside)
 *  5. Escape key closes the modal opened from the month page
 *  6. Back link navigates to /timeline
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const MEMORY_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

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

function mockTimelineEmpty(page: any) {
  return page.route('**/api/timeline**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        memories: [],
        nextCursor: null,
        children: [],
        members: [],
      }),
    }),
  )
}

const QUICK_NOTE_MEMORY = {
  id: MEMORY_ID,
  owner_user_id: '00000000-dead-beef-0000-000000000001',
  circle_id: CIRCLE_ID,
  note: 'She said mama for the first time today',
  milestone_label: null,
  memory_date: '2024-06-15',
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

function mockTimelineWithNote(page: any) {
  return page.route('**/api/timeline**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        memories: [QUICK_NOTE_MEMORY],
        nextCursor: null,
        children: [],
        members: [],
      }),
    }),
  )
}

function mockComments(page: any) {
  return page.route(`**/api/memories/${MEMORY_ID}/comments**`, (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ comments: [] }),
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Month overflow page (/timeline/[year]/[month])', () => {
  test('invalid year/month redirects to /timeline', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineEmpty(page)

    await page.goto('/timeline/2024/99')
    await page.waitForURL(/\/timeline$/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/timeline$/)
  })

  test('month page with no memories shows empty-state message', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineEmpty(page)

    await page.goto('/timeline/2024/06')
    // Header should show the month label
    await expect(page.getByText('June 2024', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    // Empty state
    await expect(page.getByText(/no memories/i)).toBeVisible({ timeout: 5_000 })
  })

  test('month page shows memory count label when memories exist', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineWithNote(page)

    await page.goto('/timeline/2024/06')
    // Count label: "1 memory" or "X memories"
    await expect(page.getByText(/1 memory|memories/i)).toBeVisible({
      timeout: 10_000,
    })
  })

  test('clicking a quick-note card opens MemoryShell with the note', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineWithNote(page)
    await mockComments(page)

    await page.goto('/timeline/2024/06')

    const card = page
      .locator('article')
      .filter({ hasText: 'She said mama for the first time today' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    // MemoryShell renders the card with inline max-width: 520px for quick notes
    await expect(page.locator('[style*="max-width: 520px"]')).toBeVisible({
      timeout: 5_000,
    })
    // Note content is shown inside the modal
    await expect(
      page.getByText('She said mama for the first time today').first(),
    ).toBeVisible()
  })

  test('Escape key closes the modal opened from the month page', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineWithNote(page)
    await mockComments(page)

    await page.goto('/timeline/2024/06')

    const card = page
      .locator('article')
      .filter({ hasText: 'She said mama for the first time today' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    await expect(page.locator('[style*="max-width: 520px"]')).toBeVisible({
      timeout: 5_000,
    })

    await page.keyboard.press('Escape')

    await expect(page.locator('[style*="max-width: 520px"]')).not.toBeVisible({
      timeout: 3_000,
    })
  })

  test('back link returns to /timeline', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineEmpty(page)

    await page.goto('/timeline/2024/06')
    await expect(page.getByText('June 2024', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    // The back link uses NuxtLink to /timeline?circle=<id> — preserves the
    // active circle so the user returns to where they were.
    await page.getByRole('link', { name: /back/i }).click()
    await page.waitForURL(/\/timeline(\?|$)/, { timeout: 5_000 })
    await expect(page).toHaveURL(/\/timeline(\?|$)/)
  })

  // ── Load-more pagination ─────────────────────────────────────────────────────

  test('clicking "Load more" button loads the next page and appends memories', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)

    // Generate 24 stub memories for the first page
    const page1Memories = Array.from({ length: 24 }, (_, i) => ({
      id: `memory-${String(i).padStart(3, '0')}`,
      owner_user_id: '00000000-dead-beef-0000-000000000001',
      circle_id: CIRCLE_ID,
      note: null,
      milestone_label: null,
      memory_date: `2024-06-${String(15 - Math.floor(i / 2)).padStart(2, '0')}`,
      visibility: 'circle',
      former_owner_name: null,
      former_owner_user_id: null,
      memorymedia: [],
      memoryreaction: [],
      memorycomment: [],
      memory_children: [],
      memory_members: [],
      user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
    }))

    // 3 extra memories for the second page
    const page2Memories = Array.from({ length: 3 }, (_, i) => ({
      id: `memory-extra-${i}`,
      owner_user_id: '00000000-dead-beef-0000-000000000001',
      circle_id: CIRCLE_ID,
      note: `Extra note ${i}`,
      milestone_label: null,
      memory_date: '2024-06-01',
      visibility: 'circle',
      former_owner_name: null,
      former_owner_user_id: null,
      memorymedia: [],
      memorycomment: [],
      memoryreaction: [],
      memory_children: [],
      memory_members: [],
      user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
    }))

    let page2Fetched = false

    await page.route('**/api/timeline**', (route) => {
      const url = new URL(route.request().url())
      const cursor = url.searchParams.get('cursor')
      if (cursor === 'cursor-page-2') {
        page2Fetched = true
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            memories: page2Memories,
            nextCursor: null,
            children: [],
            members: [],
          }),
        })
      }
      // First page — returns a cursor so the Load more button appears
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          memories: page1Memories,
          nextCursor: 'cursor-page-2',
          children: [],
          members: [],
        }),
      })
    })

    await page.goto('/timeline/2024/06')

    // Wait for first page to render — count label shows 24
    await expect(page.getByText(/24 memories/i)).toBeVisible({
      timeout: 10_000,
    })

    // "Load more" button should be visible (nextCursor is set)
    const loadMoreBtn = page.getByRole('button', { name: /load more/i })
    await expect(loadMoreBtn).toBeVisible({ timeout: 5_000 })

    // Click it
    await loadMoreBtn.click()

    // Wait for second-page memories to append
    await page.waitForFunction(
      () => document.querySelectorAll('article').length >= 27,
      {
        timeout: 10_000,
      },
    )

    // Verify second-page memories were appended
    expect(page2Fetched).toBe(true)
    await expect(page.getByText(/Extra note 0/)).toBeVisible({ timeout: 5_000 })

    // "Load more" button gone — nextCursor is now null
    await expect(loadMoreBtn).not.toBeVisible({ timeout: 3_000 })
  })
})
