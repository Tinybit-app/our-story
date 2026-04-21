/**
 * Member tagging E2E tests (build plan §4.10.6)
 *
 * Model: per-memory member tagging via `memory_members` junction table.
 * Any member who uploads a memory can tag which circle members appear in it.
 * Tagged members receive an email notification. Avatar bubbles appear on cards.
 *
 * Tests:
 *  1. Avatar bubble appears on polaroid card when a member is tagged
 *  2. No avatar bubbles when memory_members is empty
 *  3. Upload form shows member chips when the circle has members
 *  4. Tagging a member calls POST /api/memories/:id/members
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const MEMORY_DATE = '2024-04-15T00:00:00.000Z'

const MEMBER = { userId: 'user-2', firstName: 'Sarah', lastName: 'Lee', avatarUrl: null }

function makeMemory(
  id: string,
  opts: {
    memoryMembers?: typeof MEMBER[]
  } = {},
) {
  const { memoryMembers = [] } = opts
  return {
    id,
    owner_user_id: 'user-1',
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: 'A moment together',
    memory_date: MEMORY_DATE,
    milestone_label: null,
    milestone_is_custom: false,
    created_at: MEMORY_DATE,
    memorymedia: [],
    user: { first_name: 'Dao', last_name: 'Z', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
    memory_children: [],
    memory_members: memoryMembers.map((m) => ({
      user_id: m.userId,
      user: { id: m.userId, first_name: m.firstName, last_name: m.lastName, avatar_url: m.avatarUrl },
    })),
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

function mockCircles(page: any) {
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
        }],
      }),
    })
  })
}

function mockTimeline(
  page: any,
  memories: ReturnType<typeof makeMemory>[],
  circleMembers: typeof MEMBER[] = [],
) {
  return page.route('**/api/timeline**', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        memories,
        nextCursor: null,
        children: [],
        members: circleMembers.map((m) => ({
          userId: m.userId,
          firstName: m.firstName,
          lastName: m.lastName,
          avatarUrl: m.avatarUrl,
        })),
      }),
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Member tagging (4.10.6)', () => {

  test('avatar bubble appears on polaroid card when a member is tagged', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [makeMemory('mem-1', { memoryMembers: [MEMBER] })], [MEMBER])

    await page.goto('/timeline')
    // The avatar bubble for Sarah should be rendered (via title or initials)
    // The card shows initials "SL" when no avatar_url is set
    await expect(page.getByText('SL')).toBeVisible({ timeout: 10_000 })
  })

  test('no avatar bubbles when memory_members is empty', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [makeMemory('mem-1')], [MEMBER])

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 10_000 })
    // "SL" initials should not be present
    await expect(page.getByText('SL')).not.toBeVisible()
  })

  test('upload form shows member chips when the circle has members', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [makeMemory('mem-1')], [MEMBER])

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 10_000 })

    // Trigger upload form with a fake file
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    })

    // Sarah's chip should appear in the "Who's in this memory?" picker
    await expect(page.getByText('Sarah')).toBeVisible({ timeout: 5_000 })
  })

  test('tagging a member calls POST /api/memories/:id/members', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [makeMemory('mem-1')], [MEMBER])

    // Intercept the upload edge function
    const FAKE_MEMORY_ID = 'mem-new-001'
    await page.route('**/functions/v1/upload-media', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memoryId: FAKE_MEMORY_ID }),
      })
    })

    // Capture the members tag request
    let membersBody: any = null
    await page.route(`**/api/memories/${FAKE_MEMORY_ID}/members`, async (route) => {
      if (route.request().method() === 'POST') {
        membersBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 10_000 })

    // Open upload form
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    })

    // Tag Sarah
    await page.getByText('Sarah').click()

    // Submit the upload
    await page.getByRole('button', { name: /upload/i }).click()

    // Wait for the members POST to fire
    await page.waitForTimeout(800)
    expect(membersBody).toMatchObject({ userIds: [MEMBER.userId] })
  })

})
