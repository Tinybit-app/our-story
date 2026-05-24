/**
 * Emoji reactions E2E tests (build plan §8.2)
 *
 * Feature: toggle emoji reactions on memories (add if absent, remove if present).
 * Reactions appear as chips on mosaic cells (photo and note), MemoryModal, and QuickNoteModal.
 *
 * Tests:
 *  1. Existing reaction chips render on photo mosaic cell
 *  2. Emoji picker opens on + button click
 *  3. Picking an emoji calls POST /api/memories/:id/reactions and chip appears
 *  4. Clicking an existing chip (own reaction) removes it (toggle off)
 *  5. MemoryModal shows reaction chips and picker
 *  6. Quick-note mosaic cell shows existing reaction chip
 *  7. QuickNoteModal shows reaction chips and picker
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const MEMORY_ID = 'cccccccc-3333-4333-8333-cccccccccccc'
const QN_MEMORY_ID = 'dddddddd-4444-4444-8444-dddddddddddd'
const MY_USER_ID = '33004370-b407-4087-84c8-5dca9fc73ce0'
const OTHER_USER_ID = 'ffffffff-0000-4000-8000-ffffffffffff'

function makePhotoMemory(reactions: any[] = []) {
  return {
    id: MEMORY_ID,
    owner_user_id: MY_USER_ID,
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: 'A birthday moment',
    memory_date: '2024-06-15T00:00:00.000Z',
    milestone_label: null,
    milestone_is_custom: false,
    created_at: '2024-06-15T00:00:00.000Z',
    memorymedia: [
      {
        id: 'media-1',
        url: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/photo-thumb.jpg',
        media_type: 'image',
      },
    ],
    user: { first_name: 'Dao', last_name: 'Z', avatar_url: null },
    memoryreaction: reactions,
    memorycomment: [],
    memory_children: [],
    memory_members: [],
  }
}

function makeQuickNoteMemory(reactions: any[] = []) {
  return {
    id: QN_MEMORY_ID,
    owner_user_id: MY_USER_ID,
    former_owner_name: null,
    visibility: 'circle',
    note: 'First steps today!',
    memory_date: '2024-06-15T00:00:00.000Z',
    milestone_label: null,
    milestone_is_custom: false,
    created_at: '2024-06-15T00:00:00.000Z',
    memorymedia: [],
    user: { first_name: 'Dao', last_name: 'Z', avatar_url: null },
    memoryreaction: reactions,
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

function mockComments(page: any, memoryId: string) {
  return page.route(`**/api/memories/${memoryId}/comments**`, (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ comments: [] }),
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Emoji reactions (8.2)', () => {
  // The mosaic cell no longer carries reaction UI — chips and the add-reaction
  // picker live exclusively inside MemoryDetail (see "MemoryModal shows
  // reaction chips and picker" below for the photo case, and "QuickNoteModal
  // shows reaction chips and picker" further down for the quick-note case).
  // The single non-redundant scenario kept from the old card-surface suite is
  // toggling an own reaction *off* — covered here against the modal.

  test('clicking own reaction chip in modal calls POST to toggle it off', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [
      makePhotoMemory([
        {
          id: 'r1',
          emoji: '❤️',
          user_id: MY_USER_ID,
          guest_name: null,
          user: { first_name: 'Dao', last_name: 'Z' },
        },
      ]),
    ])
    await mockComments(page, MEMORY_ID)

    let postCalled = false
    await page.route(
      `**/api/memories/${MEMORY_ID}/reactions**`,
      async (route) => {
        if (route.request().method() === 'POST') {
          postCalled = true
          // Return empty reactions (removed)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ reactions: [] }),
          })
        } else {
          await route.continue()
        }
      },
    )

    await page.goto('/timeline')
    await expect(
      page.getByRole('button', { name: 'Smith Family' }),
    ).toBeVisible({
      timeout: 15_000,
    })

    // Open the modal — reactions are only rendered there now.
    await page.locator('.mosaic-cell').first().click()

    const modal = page.locator('.fixed.inset-0')

    // The heart chip should be visible (own reaction, highlighted)
    await expect(modal.locator('button', { hasText: '❤️' }).first()).toBeVisible(
      { timeout: 5_000 },
    )

    // Click the chip to toggle off
    await modal.locator('button', { hasText: '❤️' }).first().click()

    await page.waitForTimeout(500)
    expect(postCalled).toBe(true)
  })

  test('MemoryModal shows reaction chips and picker', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [
      makePhotoMemory([
        {
          id: 'r1',
          emoji: '😍',
          user_id: OTHER_USER_ID,
          guest_name: null,
          user: { first_name: 'Alice', last_name: 'S' },
        },
      ]),
    ])
    await mockComments(page, MEMORY_ID)

    let postEmoji: string | null = null
    await page.route(
      `**/api/memories/${MEMORY_ID}/reactions**`,
      async (route) => {
        if (route.request().method() === 'POST') {
          const body = JSON.parse(route.request().postData() ?? '{}')
          postEmoji = body.emoji
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              reactions: [
                {
                  id: 'r1',
                  emoji: '😍',
                  user_id: OTHER_USER_ID,
                  guest_name: null,
                  user: { first_name: 'Alice', last_name: 'S' },
                },
                {
                  id: 'r-new',
                  emoji: body.emoji,
                  user_id: MY_USER_ID,
                  guest_name: null,
                  user: { first_name: 'Dao', last_name: 'Z' },
                },
              ],
            }),
          })
        } else {
          await route.continue()
        }
      },
    )

    await page.goto('/timeline')
    await page.locator('.mosaic-cell').first().click()

    // Existing reaction chip should be visible in modal
    // (mosaic cell reaction overlay hidden - v-if="isHovered" is false when modal is open)
    await expect(page.locator('button', { hasText: '😍' }).first()).toBeVisible(
      { timeout: 5_000 },
    )

    // Add-reaction button visible in modal (smiley icon + aria-label)
    const modalPickerBtn = page
      .getByRole('button', { name: /add reaction/i })
      .first()
    await expect(modalPickerBtn).toBeVisible({ timeout: 5_000 })

    // Click to open picker and pick an emoji
    await modalPickerBtn.click()
    await expect(page.locator('button', { hasText: '🎉' }).first()).toBeVisible(
      { timeout: 3_000 },
    )
    await page.locator('button', { hasText: '🎉' }).first().click()

    await page.waitForTimeout(500)
    expect(postEmoji).toBe('🎉')
  })

  test('QuickNoteModal shows reaction chips and picker', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [
      makeQuickNoteMemory([
        {
          id: 'r1',
          emoji: '👏',
          user_id: OTHER_USER_ID,
          guest_name: null,
          user: { first_name: 'Alice', last_name: 'S' },
        },
      ]),
    ])

    let postEmoji: string | null = null
    await page.route(
      `**/api/memories/${QN_MEMORY_ID}/reactions**`,
      async (route) => {
        if (route.request().method() === 'POST') {
          const body = JSON.parse(route.request().postData() ?? '{}')
          postEmoji = body.emoji
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              reactions: [
                {
                  id: 'r1',
                  emoji: '👏',
                  user_id: OTHER_USER_ID,
                  guest_name: null,
                  user: { first_name: 'Alice', last_name: 'S' },
                },
                {
                  id: 'r-new',
                  emoji: body.emoji,
                  user_id: MY_USER_ID,
                  guest_name: null,
                  user: { first_name: 'Dao', last_name: 'Z' },
                },
              ],
            }),
          })
        } else {
          await route.continue()
        }
      },
    )
    await page.route(
      `**/api/memories/${QN_MEMORY_ID}/comments**`,
      async (route) => {
        if (route.request().method() !== 'GET') return route.continue()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ comments: [] }),
        })
      },
    )

    await page.goto('/timeline')
    const card = page
      .locator('.mosaic-cell')
      .filter({ hasText: 'First steps today!' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    // The modal renders via Teleport to body — scope to the fixed overlay div
    const modal = page.locator('.fixed.inset-0')

    // Existing chip should appear in QuickNoteModal
    await expect(modal.locator('button', { hasText: '👏' })).toBeVisible({
      timeout: 5_000,
    })

    // Pick a new emoji via the modal's add-reaction button (aria-label match)
    await modal.getByRole('button', { name: /add reaction/i }).click()
    await expect(modal.locator('button', { hasText: '🔥' })).toBeVisible({
      timeout: 3_000,
    })
    await modal.locator('button', { hasText: '🔥' }).click()

    await page.waitForTimeout(500)
    expect(postEmoji).toBe('🔥')
  })
})
