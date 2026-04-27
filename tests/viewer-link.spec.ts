/**
 * Viewer link management E2E tests (build plan §4.11 / viewer-link feature)
 *
 * Tests:
 *  1. Owner sees Share button; member does not
 *  2. Create full-timeline link → /view loads the splash
 *  3. Create selection link → viewer sees only selected memories
 *  4. Revoke link → DELETE called for correct link id + viewer gets invalid error
 *  5. Referral CTA appears after scrolling 3+ memories
 *  6. Empty state when selection link has no memories
 *  7. Expired link badge shown in sheet; Renew opens create sheet
 *
 * Auth strategy:
 *  - Owner dashboard tests (Share sheet on /timeline): use `test.use({ storageState })`
 *    inside a describe block so the auth session is scoped to those tests only.
 *  - Public viewer page tests (/view): no storageState — the viewer JWT is the
 *    only credential. The auth middleware allows /view without a session.
 *    We use `test.use({ storageState: undefined })` explicitly on the viewer
 *    describe block to override any inherited storageState.
 */

import { test, expect } from '@playwright/test'
import { signViewerToken } from '../server/utils/viewerJwt'

// ── Shared constants ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const LINK_ID_FULL = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const LINK_ID_SEL  = 'dddddddd-4444-4444-8444-dddddddddddd'
const MEMORY_ID_1  = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee'
const MEMORY_ID_2  = 'ffffffff-6666-4666-8666-ffffffffffff'
const MEMORY_ID_3  = 'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa'

// This matches the test JWT secret used in viewer.spec.ts — tests mock the API so
// the token only needs to be structurally valid for client-side routing to work.
const TEST_SECRET = 'test-viewer-secret-at-least-32-chars!!'

const TEST_NONCE = 'test-nonce-fixed'

function makeViewerToken(linkId = LINK_ID_FULL, expirySeconds = 30 * 24 * 60 * 60) {
  return signViewerToken(CIRCLE_ID, TEST_SECRET, expirySeconds, linkId, TEST_NONCE)
}

// ── Common route mocks ────────────────────────────────────────────────────────

function mockMembership(page: any) {
  return page.route('**/api/auth/membership**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasMembership: true, needsProfile: false, deletedAt: null }),
    })
  )
}

function mockCircles(page: any, role: 'owner' | 'member' = 'owner') {
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
          role,
          anniversary_date: null,
        }],
      }),
    })
  })
}

function mockTimeline(page: any, memories: any[] = []) {
  return page.route('**/api/timeline**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memories, nextCursor: null, children: [], members: [] }),
    })
  )
}

function makeExpiredLink(token: string) {
  return {
    id: LINK_ID_FULL,
    mode: 'full',
    label: 'Full timeline',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    isExpired: true,
    memoryCount: null,
    dateRange: null,
    token,
    createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// ── Owner dashboard tests (authenticated) ─────────────────────────────────────

test.describe('Viewer link management — owner dashboard', () => {
  test.use({ storageState: 'tests/.auth/user.json' })

  // ── 1. Share button visibility ─────────────────────────────────────────────

  test('owner sees Share button', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, 'owner')
    await mockTimeline(page)
    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 15_000 })
    // Share button appears when circle.role === 'owner'
    await expect(page.getByRole('button', { name: /share/i })).toBeVisible({ timeout: 5_000 })
  })

  test('member does not see Share button', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, 'member')
    await mockTimeline(page)
    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /share/i })).not.toBeVisible()
  })

  // ── 2. Create full-timeline link ────────────────────────────────────────────

  test('create full-timeline link → POST called with mode:full', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page)

    const createdToken = makeViewerToken(LINK_ID_FULL)
    let postBody: any = null

    // Viewer-links: empty GET first, then handle POST
    await page.route(`**/api/circles/${CIRCLE_ID}/viewer-links`, async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      } else if (method === 'POST') {
        postBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: LINK_ID_FULL,
            mode: 'full',
            label: 'Full timeline',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isExpired: false,
            memoryCount: null,
            dateRange: null,
            token: createdToken,
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 15_000 })

    // Open the Share sheet
    await page.getByRole('button', { name: /share/i }).click()

    // Empty state — click Create link button
    await expect(page.getByText('Share your circle')).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /create a link/i }).click()

    // CreateLinkSheet opens — verify its heading is visible
    await expect(page.getByRole('heading', { name: 'Create a link' })).toBeVisible({ timeout: 5_000 })

    // Click the submit button and wait for the POST response
    const [_postResponse] = await Promise.all([
      page.waitForResponse(r => r.url().includes('viewer-links') && r.request().method() === 'POST'),
      page.locator('button:has-text("Create a link")').last().click(),
    ])
    expect(postBody).toMatchObject({ mode: 'full' })

    // Navigate to the viewer URL and verify it loads
    await page.route('**/api/viewer/timeline**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          circleName: 'Test Circle',
          ownerFirstName: 'Alice',
          linkLabel: 'Full timeline',
          mode: 'full',
          selectionDateRange: null,
          memories: [
            { id: 'mem-1', memory_date: '2024-01-15', note: 'Hello', signedUrl: null, mediaType: null }
          ],
        },
      })
    })
    await page.goto(`/view?token=${createdToken}`)

    // The viewer page shows a splash screen first — dismiss it
    await page.getByRole('button', { name: /see the memories/i }).click()
    // Verify at least one memory card is shown
    await expect(page.locator('article').first()).toBeVisible()
  })

  // ── 5. Revoke link → DELETE called for correct link ID ─────────────────────

  test('revoke link → DELETE is called for the correct link id', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page)

    const token = makeViewerToken(LINK_ID_FULL)
    let deleteCalledForId: string | null = null

    await page.route(`**/api/circles/${CIRCLE_ID}/viewer-links**`, async (route) => {
      const method = route.request().method()
      const url = route.request().url()

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: LINK_ID_FULL,
            mode: 'full',
            label: 'Full timeline',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isExpired: false,
            memoryCount: null,
            dateRange: null,
            token,
            createdAt: new Date().toISOString(),
          }]),
        })
      } else if (method === 'DELETE') {
        const parts = url.split('/')
        deleteCalledForId = parts[parts.length - 1]
        await route.fulfill({ status: 204, body: '' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 15_000 })

    // Open share sheet
    await page.getByRole('button', { name: /share/i }).click()
    await expect(page.getByText('Full timeline').first()).toBeVisible({ timeout: 5_000 })

    // Click revoke icon button (aria-label: "Revoke link")
    await page.getByRole('button', { name: /revoke link/i }).click()

    // Confirm inline revoke dialog
    await expect(page.getByText(/revoke this link/i)).toBeVisible({ timeout: 3_000 })
    const [_deleteResponse] = await Promise.all([
      page.waitForResponse(r => r.url().includes('viewer-links') && r.request().method() === 'DELETE'),
      page.getByRole('button', { name: /^revoke$/i }).click(),
    ])
    expect(deleteCalledForId).toBe(LINK_ID_FULL)
  })

  // ── 8. Expired link badge → Renew opens create sheet ──────────────────────

  test('expired link badge shown in sheet; Renew opens create sheet', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page)
    await mockTimeline(page)

    const expiredToken = makeViewerToken(LINK_ID_FULL, -1)
    // Mock GET (returns expired link) and DELETE (renew deletes then opens CreateLinkSheet)
    await page.route(`**/api/circles/${CIRCLE_ID}/viewer-links**`, async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([makeExpiredLink(expiredToken)]),
        })
      } else if (method === 'DELETE') {
        await route.fulfill({ status: 204, body: '' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: 'Smith Family' })).toBeVisible({ timeout: 15_000 })

    // Open share sheet
    await page.getByRole('button', { name: /share/i }).click()

    // Expired badge should appear
    await expect(page.getByText('Expired').first()).toBeVisible({ timeout: 5_000 })

    // Renew button replaces Copy for expired links
    await expect(page.getByRole('button', { name: /renew/i })).toBeVisible()

    // Click Renew → should open CreateLinkSheet
    await page.getByRole('button', { name: /renew/i }).click()

    // CreateLinkSheet heading
    await expect(page.getByRole('heading', { name: 'Create a link' })).toBeVisible({ timeout: 5_000 })
  })

})

// ── Public viewer page tests (no auth session) ────────────────────────────────

test.describe('Viewer link management — public viewer page', () => {
  // Explicitly unset storageState so unauthenticated browser context is used.
  // Without this, some test runners may inherit state from previous describe blocks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  test.use({ storageState: { cookies: [], origins: [] } } as any)

  // ── 3. Selection link → viewer sees only selected memories ────────────────

  test('create selection link → viewer sees only selected memories', async ({ page }) => {
    const token = makeViewerToken(LINK_ID_SEL)

    await page.route('**/api/viewer/timeline**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          circleName: 'Smith Family',
          ownerFirstName: 'Dao',
          linkLabel: '2 memories',
          mode: 'selection',
          selectionDateRange: { from: '2024-01-01', to: '2024-12-31' },
          memories: [
            {
              id: MEMORY_ID_1,
              memory_date: '2024-03-10',
              note: 'Selected memory A',
              signedUrl: null,
              mediaType: null,
            },
            {
              id: MEMORY_ID_2,
              memory_date: '2024-09-20',
              note: 'Selected memory B',
              signedUrl: null,
              mediaType: null,
            },
          ],
        }),
      })
    )

    await page.goto(`/view?token=${token}`)

    // Dismiss splash
    await expect(page.getByRole('button', { name: /see the memories/i })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /see the memories/i }).click()

    // Both selected memories should appear
    await expect(page.getByText('Selected memory A')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Selected memory B')).toBeVisible({ timeout: 5_000 })

    // Selection banner (count + date range) should appear
    await expect(page.getByText(/selected memories/i)).toBeVisible()
  })

  // ── 5b. Revoked token → /view shows invalid error ─────────────────────────

  test('revoked link token → /view shows invalid error', async ({ page }) => {
    const token = makeViewerToken(LINK_ID_FULL)

    await page.route('**/api/viewer/timeline**', route =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'invalid' }),
      })
    )

    await page.goto(`/view?token=${token}`)
    await expect(page.getByText(/link is invalid/i)).toBeVisible({ timeout: 10_000 })
  })

  // ── 6. Referral CTA appears after scrolling 3+ memories ──────────────────

  test('referral CTA appears after scrolling 3+ memories', async ({ page }) => {
    const token = makeViewerToken(LINK_ID_FULL)

    await page.route('**/api/viewer/timeline**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          circleName: 'Smith Family',
          ownerFirstName: 'Dao',
          linkLabel: 'Full timeline',
          mode: 'full',
          selectionDateRange: null,
          memories: [
            { id: MEMORY_ID_1, memory_date: '2024-01-01', note: 'First memory', signedUrl: null, mediaType: null },
            { id: MEMORY_ID_2, memory_date: '2024-02-01', note: 'Second memory', signedUrl: null, mediaType: null },
            { id: MEMORY_ID_3, memory_date: '2024-03-01', note: 'Third memory', signedUrl: null, mediaType: null },
          ],
        }),
      })
    )

    await page.goto(`/view?token=${token}`)

    // Dismiss splash
    await expect(page.getByRole('button', { name: /see the memories/i })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /see the memories/i }).click()

    // Verify all 3 memories are rendered
    await expect(page.getByText('Third memory')).toBeVisible({ timeout: 5_000 })

    // Scroll the 3rd article into view to fire the IntersectionObserver.
    // Use evaluate to call scrollIntoView directly — more reliable than Playwright's
    // scrollIntoViewIfNeeded for triggering threshold-based IntersectionObserver.
    await page.locator('article').nth(2).evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }))
    await page.waitForTimeout(500)

    // Referral CTA should appear after the 3rd memory enters the viewport
    await expect(page.getByText(/know someone who.d love this/i)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(/share this app with them/i)).toBeVisible()
  })

  // ── 7. Empty state when selection link has no memories ────────────────────

  test('empty state when selection link has no memories', async ({ page }) => {
    const token = makeViewerToken(LINK_ID_SEL)

    await page.route('**/api/viewer/timeline**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          circleName: 'Smith Family',
          ownerFirstName: 'Dao',
          linkLabel: '0 memories',
          mode: 'selection',
          selectionDateRange: null,
          memories: [],
        }),
      })
    )

    await page.goto(`/view?token=${token}`)

    // Dismiss splash
    await expect(page.getByRole('button', { name: /see the memories/i })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /see the memories/i }).click()

    // Empty state text should appear (viewerLink.emptyState or viewerLink.viewerNoMemories key)
    await expect(page.getByText(/no memories (to show here|shared yet)/i)).toBeVisible({ timeout: 5_000 })
  })

})
