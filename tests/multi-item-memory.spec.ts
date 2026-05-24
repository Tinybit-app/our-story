/**
 * Multi-item memories E2E (5.4)
 *
 * Tests the rendering side: stack visual, count badge, carousel modal.
 * Upload-flow tests would require complex mocking — skip for now and rely on manual verification.
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const MEMORY_ID = 'cccccccc-3333-4333-8333-cccccccccccc'

// The authenticated test user's ID (from tests/.auth/user.json)
const MY_USER_ID = '33004370-b407-4087-84c8-5dca9fc73ce0'

const MULTI_ITEM_MEMORY = {
  id: MEMORY_ID,
  owner_user_id: MY_USER_ID,
  former_owner_name: null,
  former_owner_user_id: null,
  visibility: 'circle',
  note: 'Birthday party',
  memory_date: '2024-06-15T00:00:00.000Z',
  milestone_label: null,
  milestone_is_custom: false,
  created_at: '2024-06-15T00:00:00.000Z',
  memorymedia: [
    {
      id: 'media-cover',
      url: 'https://example.com/cover.jpg',
      thumbnailUrl: 'https://example.com/cover-thumb.jpg',
      media_type: 'photo',
    },
  ],
  media_count: 5,
  cover_text_content: null,
  user: { first_name: 'Dao', last_name: 'Z', avatar_url: null },
  memoryreaction: [],
  memorycomment: [],
  memory_children: [],
  memory_members: [],
}

const MULTI_ITEM_SLIDES = [
  {
    id: 'media-cover',
    mediaType: 'photo',
    url: 'https://example.com/cover.jpg',
    displayOrder: 0,
  },
  {
    id: 'media-2',
    mediaType: 'photo',
    url: 'https://example.com/photo2.jpg',
    displayOrder: 1,
  },
  {
    id: 'media-3',
    mediaType: 'text',
    textContent: 'And then she smiled',
    displayOrder: 2,
  },
  {
    id: 'media-4',
    mediaType: 'photo',
    url: 'https://example.com/photo3.jpg',
    displayOrder: 3,
  },
  {
    id: 'media-5',
    mediaType: 'video',
    url: 'https://example.com/video.mp4',
    displayOrder: 4,
  },
]

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

function mockCircles(page: any) {
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

function mockTimeline(page: any, memories: any[]) {
  return page.route('**/api/timeline**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        memories,
        nextCursor: null,
        children: [],
        members: [],
      }),
    }),
  )
}

function mockSlides(page: any, memoryId: string, slides: any[]) {
  return page.route(`**/api/memories/${memoryId}/slides`, (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ slides }),
    }),
  )
}

function mockComments(page: any) {
  return page.route('**/api/memories/*/comments**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ comments: [] }),
    }),
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Multi-item memories (5.4)', () => {
  test('multi-item memory shows carousel "X / N" counter inside MemoryViewer', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [MULTI_ITEM_MEMORY])
    await mockSlides(page, MEMORY_ID, MULTI_ITEM_SLIDES)
    await mockComments(page)

    await page.goto('/timeline')

    // Multi-item count is no longer rendered on the mosaic cell; it lives in
    // MemoryViewer's carousel controls inside the modal.
    await page.locator('.mosaic-cell').first().click()

    const modal = page.locator('.fixed.inset-0')
    await expect(modal.getByText('1 / 5')).toBeVisible({ timeout: 10_000 })
  })

  test('single-item memory has no carousel counter (carousel branch is not rendered)', async ({
    page,
  }) => {
    const singleItem = {
      ...MULTI_ITEM_MEMORY,
      id: 'cccccccc-3333-4333-8333-aaaaaaaaaaaa',
      media_count: 1,
    }

    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [singleItem])
    await mockComments(page)

    await page.goto('/timeline')
    await page.locator('.mosaic-cell').first().click()

    const modal = page.locator('.fixed.inset-0')
    // MemoryViewer renders the carousel branch only when media_count > 1;
    // single-item memories use the still-photo branch with no slide counter.
    await expect(modal.getByText(/^\d+ \/ \d+$/)).not.toBeVisible()
  })
})
