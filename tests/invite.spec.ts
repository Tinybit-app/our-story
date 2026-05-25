import { test, expect } from '@playwright/test'

const VALID_TOKEN = 'test-invite-token-aaaa-bbbbbbbbbbbb'
const TEST_CIRCLE_ID = 'cccccccc-dddd-eeee-ffff-111111111111'

// ── Unauthenticated: pre-validation before login ───────────────────────────
// These tests exercise the GET /api/invites/[token]/status check that runs
// before any auth is required, so no storageState is needed.
test.describe('Invite flow — unauthenticated pre-validation', () => {
  test('expired invite shows error without forcing login', async ({ page }) => {
    await page.route(`**/api/invites/${VALID_TOKEN}/status**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'expired' }),
      }),
    )

    await page.goto(`/invite/${VALID_TOKEN}`)

    await expect(page.getByText('This invite has expired')).toBeVisible({
      timeout: 10_000,
    })
    // User should still be on the invite page — not bounced to login
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('deleted-circle invite shows error without forcing login', async ({
    page,
  }) => {
    await page.route(`**/api/invites/${VALID_TOKEN}/status**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'circle_deleted' }),
      }),
    )

    await page.goto(`/invite/${VALID_TOKEN}`)

    await expect(page.getByText('This circle has been deleted')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('both error states show a "Go to sign in" link', async ({ page }) => {
    await page.route(`**/api/invites/${VALID_TOKEN}/status**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'expired' }),
      }),
    )

    await page.goto(`/invite/${VALID_TOKEN}`)
    await expect(page.getByText('This invite has expired')).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByRole('link', { name: 'Go to sign in' }),
    ).toBeVisible()
  })

  test('valid invite stores token in cookie and redirects to /login', async ({
    page,
  }) => {
    await page.route(`**/api/invites/${VALID_TOKEN}/status**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'pending' }),
      }),
    )

    await page.goto(`/invite/${VALID_TOKEN}`)
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    // pending_invite_token cookie must be set so the /confirm page can pick it up
    const cookies = await page.context().cookies()
    const inviteCookie = cookies.find((c) => c.name === 'pending_invite_token')
    expect(inviteCookie).toBeDefined()
    expect(inviteCookie!.value).toBe(VALID_TOKEN)
  })
})

// ── Authenticated: auto-accept on arrival ─────────────────────────────────
// When an already-logged-in user opens an invite link the page should call
// the accept API immediately and redirect to the timeline.
test.describe('Invite flow — authenticated auto-accept', () => {
  test.use({ storageState: 'tests/.auth/user.json' })

  test.beforeEach(async ({ page }) => {
    // Return hasMembership: true so the /timeline redirect is allowed
    await page.route('**/api/auth/membership**', (route) =>
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
  })

  test('valid invite auto-accepts and redirects to timeline with welcome flag', async ({
    page,
  }) => {
    await page.route(`**/api/invites/${VALID_TOKEN}/status**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'pending' }),
      }),
    )
    await page.route(`**/api/invites/${VALID_TOKEN}/accept**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, circleId: TEST_CIRCLE_ID }),
      }),
    )

    await page.goto(`/invite/${VALID_TOKEN}`)
    await page.waitForURL(/\/timeline/, { timeout: 10_000 })

    const url = page.url()
    expect(url).toContain(`circle=${TEST_CIRCLE_ID}`)
    expect(url).toContain('welcome=1')
  })

  test('accept failure shows an error and clears the invite cookie', async ({
    page,
  }) => {
    await page.route(`**/api/invites/${VALID_TOKEN}/status**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'pending' }),
      }),
    )
    await page.route(`**/api/invites/${VALID_TOKEN}/accept**`, (route) =>
      route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'invite_expired' }),
      }),
    )

    await page.goto(`/invite/${VALID_TOKEN}`)

    // Error UI should be shown
    await expect(page.getByRole('link', { name: 'Go to sign in' })).toBeVisible(
      { timeout: 10_000 },
    )

    // Cookie must be cleared on failure so the user is not trapped in a retry loop
    const cookies = await page.context().cookies()
    const inviteCookie = cookies.find((c) => c.name === 'pending_invite_token')
    expect(inviteCookie?.value ?? '').toBe('')
  })
})

// ── Post-login cookie pickup via /confirm ──────────────────────────────────
// After a magic-link login, the user lands on /confirm. If pending_invite_token
// is set, /confirm should redirect back to /invite/[token] rather than the app.
test.describe('Invite flow — post-login cookie pickup', () => {
  test.use({ storageState: 'tests/.auth/user.json' })

  test('/confirm redirects to /invite/[token] when pending_invite_token cookie is set', async ({
    page,
  }) => {
    // Use hasMembership: true so auth.global.ts lets /confirm render.
    // (In the real flow, /confirm is reached via a magic-link callback before any
    //  session exists in storage, so the middleware never sees a session. In tests
    //  we have a pre-existing session, so we need membership=true to avoid the
    //  no-membership redirect that would fire before the watchEffect can read the cookie.)
    await page.route('**/api/auth/membership**', (route) =>
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

    // Simulate the cookie that /invite/[token] sets before redirecting to login
    await page.context().addCookies([
      {
        name: 'pending_invite_token',
        value: VALID_TOKEN,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto('/confirm')

    await page.waitForURL(new RegExp(`/invite/${VALID_TOKEN}`), {
      timeout: 10_000,
    })
    await expect(page).toHaveURL(new RegExp(`/invite/${VALID_TOKEN}`))
  })
})
