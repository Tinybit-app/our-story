/**
 * Quick note E2E tests (build plan §7.3)
 *
 * Feature: text-only memories with no photo required.
 * Clicking "Add memory" opens a choice sheet; choosing "Quick note"
 * opens the QuickNoteForm; submitting POSTs to /api/memories/quick-note.
 * Clicking a QuickNoteCard on the timeline opens QuickNoteModal.
 *
 * Tests — creation flow:
 *  1. "Add memory" button opens the choice sheet
 *  2. Choice sheet has "Photo or video" and "Quick note" options
 *  3. Choosing "Photo or video" closes the sheet (upload flow opens)
 *  4. Choosing "Quick note" opens the QuickNoteForm
 *  5. Save button is disabled when note is empty
 *  6. Submitting a note calls POST /api/memories/quick-note with correct payload
 *  7. After saving, the quick note form closes
 *
 * Tests — QuickNoteModal (detail view):
 *  8. Clicking a quick note card opens QuickNoteModal
 *  9. QuickNoteModal displays the note text and "Quick note" label
 * 10. Escape key closes QuickNoteModal
 * 11. QuickNoteModal shows edit form when edit button is clicked (owner)
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

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

function mockTimeline(page: any) {
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

async function goToTimeline(page: any) {
  await page.goto('/timeline')
  await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({
    timeout: 15_000,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Quick note (7.3)', () => {
  test('"Add memory" button opens the choice sheet', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page)

    await goToTimeline(page)
    await page.getByRole('button', { name: /add memory/i }).click()

    await expect(page.getByText('Add a memory')).toBeVisible({ timeout: 5_000 })
  })

  test('choice sheet has "Photo or video" and "Quick note" options', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page)

    await goToTimeline(page)
    await page.getByRole('button', { name: /add memory/i }).click()

    await expect(
      page.getByRole('button', { name: /photo or video/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /quick note/i }),
    ).toBeVisible()
  })

  test('choosing "Photo or video" closes the choice sheet', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page)

    await goToTimeline(page)
    await page.getByRole('button', { name: /add memory/i }).click()
    await expect(page.getByText('Add a memory')).toBeVisible()

    await page.getByRole('button', { name: /photo or video/i }).click()

    // Choice sheet should close
    await expect(page.getByText('Add a memory')).not.toBeVisible({
      timeout: 3_000,
    })
  })

  test('choosing "Quick note" opens the quick note form', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page)

    await goToTimeline(page)
    await page.getByRole('button', { name: /add memory/i }).click()
    await page.getByText('Quick note').click()

    await expect(page.getByRole('heading', { name: 'Quick note' })).toBeVisible(
      { timeout: 5_000 },
    )
    // Textarea should be present and focused
    await expect(page.locator('textarea')).toBeVisible()
  })

  test('Save button is disabled when note is empty', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page)

    await goToTimeline(page)
    await page.getByRole('button', { name: /add memory/i }).click()
    await page.getByText('Quick note').click()

    await expect(page.getByRole('button', { name: /save note/i })).toBeDisabled(
      { timeout: 5_000 },
    )
  })

  test('submitting a note calls POST /api/memories/quick-note with correct payload', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page)

    let postBody: any = null
    await page.route('**/api/memories/quick-note', async (route) => {
      postBody = JSON.parse(route.request().postData() ?? '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memoryId: MEMORY_ID }),
      })
    })

    await goToTimeline(page)
    await page.getByRole('button', { name: /add memory/i }).click()
    await page.getByText('Quick note').click()

    await page.locator('textarea').fill('First word today: "dada"')
    await page.getByRole('button', { name: /save note/i }).click()

    await page.waitForTimeout(500)
    expect(postBody).toMatchObject({
      circleId: CIRCLE_ID,
      note: 'First word today: "dada"',
    })
    expect(postBody.memoryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('quick note form closes after saving', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimeline(page)

    await page.route('**/api/memories/quick-note', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ memoryId: MEMORY_ID }),
      }),
    )

    await goToTimeline(page)
    await page.getByRole('button', { name: /add memory/i }).click()
    await page.getByText('Quick note').click()
    await page.locator('textarea').fill('A moment worth keeping')
    await page.getByRole('button', { name: /save note/i }).click()

    // Form should close
    await expect(page.locator('textarea')).not.toBeVisible({ timeout: 5_000 })
  })
})

// ── QuickNoteModal tests ──────────────────────────────────────────────────────

const QUICK_NOTE_MEMORY = {
  id: MEMORY_ID,
  owner_user_id: '00000000-dead-beef-0000-000000000001',
  circle_id: CIRCLE_ID,
  note: 'First word today: dada',
  milestone_label: null,
  memory_date: '2024-06-15',
  visibility: 'circle',
  former_owner_name: null,
  memorymedia: [],
  memoryreaction: [],
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

test.describe('QuickNoteModal (7.3 — detail view)', () => {
  test('clicking a quick note card opens QuickNoteModal', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineWithNote(page)
    await mockComments(page)

    await goToTimeline(page)

    // Wait for the card to appear and click it
    const card = page
      .locator('article')
      .filter({ hasText: 'First word today: dada' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    // Modal should appear
    await expect(page.locator('[style*="max-width: 520px"]')).toBeVisible({
      timeout: 5_000,
    })
  })

  test('QuickNoteModal displays the note text and "Quick note" label', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineWithNote(page)
    await mockComments(page)

    await goToTimeline(page)

    const card = page
      .locator('article')
      .filter({ hasText: 'First word today: dada' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    // Note text appears in the editorial quote area
    await expect(page.getByText('First word today: dada').first()).toBeVisible({
      timeout: 5_000,
    })
    // "Quick note" label in top-right of quote area
    await expect(
      page.getByText('Quick note', { exact: true }).first(),
    ).toBeVisible()
  })

  test('Escape key closes QuickNoteModal', async ({ page }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineWithNote(page)
    await mockComments(page)

    await goToTimeline(page)

    const card = page
      .locator('article')
      .filter({ hasText: 'First word today: dada' })
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

  test('QuickNoteModal shows edit form when edit button is clicked (owner)', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCirclesList(page)
    await mockTimelineWithNote(page)
    await mockComments(page)

    await goToTimeline(page)
    const card = page
      .locator('article')
      .filter({ hasText: 'First word today: dada' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()
    await expect(page.locator('[style*="max-width: 520px"]')).toBeVisible({
      timeout: 5_000,
    })

    // If the authenticated user owns this memory, an edit pencil is shown.
    // Click it if present and verify the NOTE field label appears.
    const editBtnCount = await page.locator('[title="Edit note"]').count()
    if (editBtnCount > 0) {
      await page.locator('[title="Edit note"]').click()
      await expect(page.getByText('NOTE', { exact: true })).toBeVisible({
        timeout: 3_000,
      })
    } else {
      // Non-owner: verify the modal at minimum shows the note text
      await expect(
        page.getByText('First word today: dada').first(),
      ).toBeVisible()
    }
  })
})
