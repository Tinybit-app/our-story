/**
 * Notification Settings E2E tests (build plan §10.3)
 *
 * Feature: per-circle notification preferences (push toggle, mute toggle, email digest).
 *
 * Tests:
 *  1. Page loads and renders all 3 controls (push toggle, mute toggle, digest buttons)
 *  2. Circle selector pills appear for multi-circle users
 *  3. Circle selector hidden for single-circle users (circle name shown instead)
 *  4. Mute active note appears when the mute checkbox is checked
 *  5. Bell icon link to /notification-settings exists in the timeline header
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

// ── Shared mock data ──────────────────────────────────────────────────────────

const CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const CIRCLE_ID_2 = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

const CIRCLE_ONE = {
  id: CIRCLE_ID,
  name: 'Smith Family',
  circle_type: 'family',
  memberCount: 2,
  role: 'owner',
  anniversary_date: null,
}

const CIRCLE_TWO = {
  id: CIRCLE_ID_2,
  name: 'Weekend Crew',
  circle_type: 'friends',
  memberCount: 3,
  role: 'member',
  anniversary_date: null,
}

// A minimal memory for the timeline test
const PHOTO_MEMORY = {
  id: 'cccccccc-3333-4333-8333-cccccccccccc',
  owner_user_id: '33004370-b407-4087-84c8-5dca9fc73ce0',
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
  memoryreaction: [],
  memorycomment: [],
  memory_children: [],
  memory_members: [],
}

// ── Helper mocks ──────────────────────────────────────────────────────────────

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

function mockCircles(page: any, circles: any[]) {
  return page.route('**/api/circles**', (route: any) => {
    if (route.request().method() !== 'GET') return route.continue()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ circles }),
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

/** Mock GET /api/notification-preferences (server API route). */
function mockNotificationPrefs(
  page: any,
  prefs: Record<string, any> | null = null,
) {
  const defaults = {
    push_enabled: true,
    circle_muted: false,
    email_digest_frequency: 'monthly',
  }
  return page.route('**/api/notification-preferences**', (route: any) => {
    const method = route.request().method()
    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(prefs ?? defaults),
      })
    } else if (method === 'PATCH') {
      // Let individual tests intercept PATCH if they need to capture the body;
      // this fallback just acknowledges the save.
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    } else {
      route.continue()
    }
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Notification settings (10.3)', () => {
  test('page loads and renders all 3 controls', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE])
    await mockNotificationPrefs(page, {
      push_enabled: true,
      circle_muted: false,
      email_digest_frequency: 'monthly',
    })

    await page.goto('/notification-settings')

    // Wait for the loading spinner to disappear (circles loaded)
    await expect(page.getByText('Smith Family')).toBeVisible({
      timeout: 10_000,
    })

    // Push toggle visible
    await expect(page.getByText('Push notifications')).toBeVisible()
    const pushCheckbox = page.locator('input[type="checkbox"]').first()
    await expect(pushCheckbox).toBeVisible()

    // Mute toggle visible
    await expect(page.getByText('Mute this circle')).toBeVisible()
    const muteCheckbox = page.locator('input[type="checkbox"]').nth(1)
    await expect(muteCheckbox).toBeVisible()

    // Email digest segmented control visible
    await expect(page.getByText('Email digest')).toBeVisible()
    await expect(page.getByRole('button', { name: /weekly/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /monthly/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /off/i })).toBeVisible()
  })

  test('circle selector pills appear for multi-circle users', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE, CIRCLE_TWO])
    await mockNotificationPrefs(page, null)

    await page.goto('/notification-settings')

    // Both circle name pills should render
    await expect(
      page.getByRole('button', { name: 'Smith Family' }),
    ).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByRole('button', { name: 'Weekend Crew' }),
    ).toBeVisible()
  })

  test('circle selector hidden for single-circle users', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE])
    await mockNotificationPrefs(page, null)

    await page.goto('/notification-settings')

    // Circle name shown as text, not as a pill button
    await expect(page.getByText('Smith Family')).toBeVisible({
      timeout: 10_000,
    })

    // There should be no pill button for the circle (the name is rendered in a <p>, not a <button>)
    await expect(
      page.getByRole('button', { name: 'Smith Family' }),
    ).not.toBeAttached()
  })

  test('mute active note appears when the mute checkbox is checked', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE])
    // Start with mute enabled so the note is visible immediately
    await mockNotificationPrefs(page, {
      push_enabled: true,
      circle_muted: true,
      email_digest_frequency: 'monthly',
    })

    await page.goto('/notification-settings')

    // Wait for the page to fully load
    await expect(page.getByText('Smith Family')).toBeVisible({
      timeout: 10_000,
    })

    // The mute active note should be visible because circle_muted is true
    await expect(
      page.getByText(
        'Push notifications and email digests from this circle are paused.',
      ),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('mute active note hidden when not muted', async ({ page }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE])
    await mockNotificationPrefs(page, {
      push_enabled: true,
      circle_muted: false,
      email_digest_frequency: 'monthly',
    })

    await page.goto('/notification-settings')

    await expect(page.getByText('Smith Family')).toBeVisible({
      timeout: 10_000,
    })

    // Mute note must NOT be present
    await expect(
      page.getByText(
        'Push notifications and email digests from this circle are paused.',
      ),
    ).not.toBeAttached()
  })

  test('toggling push calls PATCH /api/notification-preferences', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE])
    await mockNotificationPrefs(page, {
      push_enabled: true,
      circle_muted: false,
      email_digest_frequency: 'monthly',
    })

    // Capture the PATCH request body
    let patchBody: any = null
    await page.route('**/api/notification-preferences', (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postDataJSON()
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/notification-settings')
    await expect(page.getByText('Smith Family')).toBeVisible({
      timeout: 10_000,
    })

    // Click the push checkbox to toggle it off (currently on). Set up the
    // response listener BEFORE the click so we don't race past the PATCH.
    const pushCheckbox = page.locator('input[type="checkbox"]').first()
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/notification-preferences') &&
          r.request().method() === 'PATCH',
      ),
      pushCheckbox.click(),
    ])

    expect(patchBody).toMatchObject({
      circleId: CIRCLE_ID,
      push_enabled: false,
    })
  })

  test('toggling mute calls PATCH /api/notification-preferences', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE])
    await mockNotificationPrefs(page, {
      push_enabled: true,
      circle_muted: false,
      email_digest_frequency: 'monthly',
    })

    // Capture the PATCH request body
    let patchBody: any = null
    await page.route('**/api/notification-preferences', (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postDataJSON()
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/notification-settings')
    await expect(page.getByText('Smith Family')).toBeVisible({
      timeout: 10_000,
    })

    // Click the mute checkbox to toggle it on (currently off). Listener
    // before click — see push test for rationale.
    const muteCheckbox = page.locator('input[type="checkbox"]').nth(1)
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/notification-preferences') &&
          r.request().method() === 'PATCH',
      ),
      muteCheckbox.click(),
    ])

    expect(patchBody).toMatchObject({ circleId: CIRCLE_ID, circle_muted: true })
  })

  test('changing digest calls PATCH /api/notification-preferences', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE])
    await mockNotificationPrefs(page, {
      push_enabled: true,
      circle_muted: false,
      email_digest_frequency: 'monthly',
    })

    // Capture the PATCH request body
    let patchBody: any = null
    await page.route('**/api/notification-preferences', (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postDataJSON()
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/notification-settings')
    await expect(page.getByText('Smith Family')).toBeVisible({
      timeout: 10_000,
    })

    // Click the "Weekly" button (currently on "Monthly"). Listener before
    // click — see push test for rationale.
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/notification-preferences') &&
          r.request().method() === 'PATCH',
      ),
      page.getByRole('button', { name: /weekly/i }).click(),
    ])

    expect(patchBody).toMatchObject({
      circleId: CIRCLE_ID,
      email_digest_frequency: 'weekly',
    })
  })

  test('bell icon link to /notification-settings exists in timeline header', async ({
    page,
  }) => {
    await mockMembership(page)
    await mockCircles(page, [CIRCLE_ONE])
    await mockTimeline(page, [PHOTO_MEMORY])
    // Suppress any Supabase calls from other parts of the timeline
    await page.route('**/rest/v1/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    )

    await page.goto('/timeline')

    // Wait for the timeline to be ready (circle name in header)
    await expect(
      page.getByRole('button', { name: 'Smith Family' }),
    ).toBeVisible({
      timeout: 15_000,
    })

    // There should be an anchor/NuxtLink pointing to /notification-settings
    const bellLink = page.locator('a[href="/notification-settings"]')
    await expect(bellLink).toBeAttached({ timeout: 5_000 })
  })
})
