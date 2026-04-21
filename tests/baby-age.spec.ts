/**
 * Baby age stamp E2E tests (build plan §4.10.1)
 *
 * Model: per-memory child tagging via `memory_children` junction table.
 * Age stamps only appear when children are explicitly tagged on a memory.
 *
 * Tests:
 *  1. Baby age stamp appears on polaroid cards when children are tagged on the memory
 *  2. Baby age stamp is absent when no children are tagged on the memory
 *  3. Circle settings shows a children manager (owner only)
 *  4. Adding a child calls POST /api/circles/:id/children
 *  5. Upload form shows child picker when the circle has children
 *  6. Age stamp pill shows child name and age as a combined pill badge on the card
 *  7. Modal caption tab shows child age pill when the memory is opened
 */

import { test, expect } from '@playwright/test'

// Use the owner auth session (set up by globalSetup)
test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const MEMORY_DATE = '2024-04-15T00:00:00.000Z' // April 15, 2024
const CHILD = { id: 'child-1', name: 'Emma', date_of_birth: '2024-01-01' } // Jan 1, 2024 → "3 months, 2 weeks"

/**
 * Build a base memory. Pass `memoryChildren` to tag children on this specific memory —
 * the age stamp is derived from `memory_children`, not from a global children array.
 */
function makeMemory(id: string, memoryChildren: typeof CHILD[] = []) {
  return {
    id,
    owner_user_id: 'user-1',
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: 'A cute moment',
    memory_date: MEMORY_DATE,
    milestone_label: null,
    milestone_is_custom: false,
    created_at: MEMORY_DATE,
    memorymedia: [],
    user: { first_name: 'Dao', last_name: 'Z', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
    // Per-memory child tags — age stamp is computed from these, not from the top-level children array
    memory_children: memoryChildren.map((c) => ({
      child_id: c.id,
      childprofile: { id: c.id, name: c.name, date_of_birth: c.date_of_birth },
    })),
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
          circle_type: 'parents',
          memberCount: 2,
          role: 'owner',
        }],
      }),
    })
  })
}

/**
 * Mock the timeline API. `circleChildren` is the list of children available for the upload
 * form picker — it does NOT drive age stamps. Age stamps come from `memory.memory_children`.
 */
function mockTimeline(page: any, memories: ReturnType<typeof makeMemory>[], circleChildren: typeof CHILD[] = []) {
  return page.route('**/api/timeline**', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        memories,
        nextCursor: null,
        children: circleChildren,
        members: [],
      }),
    })
  })
}

function mockChildrenApi(page: any, children: typeof CHILD[]) {
  return page.route('**/api/circles/*/children**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ children }),
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Baby age stamp (4.10.1)', () => {

  test('age stamp appears on polaroid card when children are tagged on the memory', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    // Tag CHILD on this specific memory — age stamp derives from memory_children
    await mockTimeline(page, [makeMemory('mem-1', [CHILD])], [CHILD])

    await page.goto('/timeline')
    // The computed age for Jan 1 → Apr 15 is "3 months, 2 weeks", labeled with the child's name
    await expect(page.getByText('Emma')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('3 months, 2 weeks')).toBeVisible({ timeout: 10_000 })
  })

  test('age stamp is not shown when no children are tagged on the memory', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    // Memory has no tagged children even though the circle has a child profile
    await mockTimeline(page, [makeMemory('mem-1')], [CHILD])

    await page.goto('/timeline')
    // Wait for the header circle name — confirms timeline loaded
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 10_000 })
    // No age stamp should be present (memory_children is empty)
    await expect(page.getByText(/months|weeks|days old|year/i)).not.toBeVisible()
  })

  test('circle settings shows children manager for owners', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockChildrenApi(page, [])
    await page.route('**/api/circles/*/members**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: [], invites: [], myRole: 'owner', memoryCount: 0 }),
      })
    )

    await page.goto('/circle-settings')
    await expect(page.getByPlaceholder('Name')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /add child/i })).toBeVisible()
  })

  test('adding a child calls POST /api/circles/:id/children', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockChildrenApi(page, [])
    await page.route('**/api/circles/*/members**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: [], invites: [], myRole: 'owner', memoryCount: 0 }),
      })
    )

    let postBody: any = null
    await page.route('**/api/circles/*/children', async (route) => {
      if (route.request().method() === 'POST') {
        postBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ child: { id: 'child-new', name: 'Emma', date_of_birth: '2024-01-01' } }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/circle-settings')
    await page.getByPlaceholder('Name').fill('Emma')
    await page.getByLabel('Date of birth').fill('2024-01-01')
    await page.getByRole('button', { name: /add child/i }).click()

    // Wait briefly for the POST to fire
    await page.waitForTimeout(500)
    expect(postBody).toMatchObject({ name: 'Emma', dateOfBirth: '2024-01-01' })
  })

  test('upload form shows child picker when the circle has children', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    // Pass CHILD in circleChildren — the timeline API returns this alongside memories
    // so UploadMemory has the list of children to render in the picker
    await mockTimeline(page, [makeMemory('mem-1')], [CHILD])

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 10_000 })

    // Trigger the file input to open the upload form with a mock file
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    })

    // The child picker should show the child's name as a selectable chip
    await expect(page.getByText('Emma')).toBeVisible({ timeout: 5_000 })
  })

  test('age stamp pill shows child name and age together on the polaroid card', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [makeMemory('mem-1', [CHILD])], [CHILD])

    await page.goto('/timeline')
    // Both name and age appear in the pill badge — they must both be visible simultaneously
    await expect(page.getByText('Emma')).toBeVisible({ timeout: 10_000 })
    const agePill = page.locator('span', { hasText: 'Emma' }).filter({ hasText: '3 months, 2 weeks' })
    await expect(agePill).toBeVisible()
  })

  test('modal caption tab shows child age pill when memory is opened', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page, [makeMemory('mem-1', [CHILD])], [CHILD])

    // Stub reactions and comments so the modal can fully open
    await page.route('**/api/memories/mem-1/reactions', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reactions: [] }) })
    )
    await page.route('**/api/memories/mem-1/comments', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) })
    )

    await page.goto('/timeline')
    // Open the memory by clicking its card (the note text identifies it)
    await page.getByText('A cute moment').click()

    // Wait for modal to open — the caption tab is default
    // Both name and age must be visible in the modal caption area
    await expect(page.getByText('Emma').nth(1)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('3 months, 2 weeks').nth(1)).toBeVisible()
  })

})
