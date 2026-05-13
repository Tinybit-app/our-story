/**
 * Media download & share E2E tests (build plan §7.5)
 *
 * Verifies that MemoryModal renders the correct action buttons
 * (save to device, share photo) depending on media type.
 *
 * Tests:
 *  1. Download button visible when a photo memory is open in MemoryModal
 *  2. Share button visible when a photo memory is open in MemoryModal
 *  3. Share button NOT present for a video memory (can't canvas-watermark video)
 *  4. Download button present for a video memory
 *  5. Neither button shown for a quick-note memory (no media)
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const MEMORY_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const USER_ID = '00000000-dead-beef-0000-000000000001'

function mockMembership(page: any) {
  return page.route('**/api/auth/membership**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
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

function mockReactionsAndComments(page: any) {
  page.route(`**/api/memories/${MEMORY_ID}/reactions**`, (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reactions: [] }),
    }),
  )
  page.route(`**/api/memories/${MEMORY_ID}/comments**`, (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ comments: [] }),
    }),
  )
}

function mockTimeline(page: any, memories: any[]) {
  return page.route('**/api/timeline**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memories, nextCursor: null, children: [], members: [] }),
    }),
  )
}

function makePhotoMemory() {
  return {
    id: MEMORY_ID,
    owner_user_id: USER_ID,
    circle_id: CIRCLE_ID,
    note: 'A beautiful moment',
    milestone_label: null,
    memory_date: '2024-06-15',
    visibility: 'circle',
    former_owner_name: null,
    memorymedia: [
      {
        id: 'media-1',
        media_type: 'photo',
        file_size: 120000,
        url: 'https://picsum.photos/id/10/800/600',
        thumbnailUrl: 'https://picsum.photos/id/10/400/300',
      },
    ],
    memoryreaction: [],
    memory_children: [],
    memory_members: [],
    memorycomment: [],
    user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
  }
}

function makeVideoMemory() {
  return {
    ...makePhotoMemory(),
    memorymedia: [
      {
        id: 'media-2',
        media_type: 'video',
        file_size: 5000000,
        url: 'https://example.com/video.mp4',
        thumbnailUrl: null,
      },
    ],
  }
}

function makeQuickNoteMemory() {
  return {
    id: MEMORY_ID,
    owner_user_id: USER_ID,
    circle_id: CIRCLE_ID,
    note: 'She smiled at me today',
    milestone_label: null,
    memory_date: '2024-06-15',
    visibility: 'circle',
    former_owner_name: null,
    memorymedia: [],
    memoryreaction: [],
    memory_children: [],
    memory_members: [],
    memorycomment: [],
    user: { first_name: 'Alice', last_name: 'Smith', avatar_url: null },
  }
}

async function openMemoryModal(page: any, cardText: string) {
  const card = page.locator('article').filter({ hasText: cardText })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Media download & share (7.5)', () => {
  test('download button is visible when a photo memory is open', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page, [makePhotoMemory()])
    await mockReactionsAndComments(page)

    await page.goto('/timeline')
    await openMemoryModal(page, 'A beautiful moment')

    await expect(page.getByRole('button', { name: 'Save to device' })).toBeVisible({
      timeout: 8_000,
    })
  })

  test('share button is visible when a photo memory is open', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page, [makePhotoMemory()])
    await mockReactionsAndComments(page)

    await page.goto('/timeline')
    await openMemoryModal(page, 'A beautiful moment')

    await expect(page.getByRole('button', { name: 'Share photo' })).toBeVisible({ timeout: 8_000 })
  })

  test('share button is NOT present for a video memory', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page, [makeVideoMemory()])
    await mockReactionsAndComments(page)

    await page.goto('/timeline')
    // Video card shows a play overlay — click the article to open modal
    const card = page.locator('article').first()
    await expect(card).toBeVisible({ timeout: 15_000 })
    await card.click()

    await expect(page.getByRole('button', { name: 'Save to device' })).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByRole('button', { name: 'Share photo' })).not.toBeVisible()
  })

  test('neither download nor share button shown for a quick-note memory', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page, [makeQuickNoteMemory()])
    await mockReactionsAndComments(page)

    await page.goto('/timeline')
    await openMemoryModal(page, 'She smiled at me today')

    // QuickNoteModal is rendered — no media action buttons
    await expect(page.getByRole('button', { name: 'Save to device' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Share photo' })).not.toBeVisible()
  })
})
