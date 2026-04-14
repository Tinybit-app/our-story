import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // Wait for Vue to finish rendering (SPA — client-side only)
    await page.getByPlaceholder('your@email.com').waitFor({ timeout: 20_000 })
  })

  test('shows wordmark, headline and subtitle', async ({ page }) => {
    await expect(page.getByText('Our Story', { exact: false })).toBeVisible()
    await expect(page.getByRole('heading', { name: /every moment worth keeping/i })).toBeVisible()
    await expect(page.getByText('For you, your family, your friends.')).toBeVisible()
  })

  test('shows both sign-in methods', async ({ page }) => {
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
    await expect(page.getByPlaceholder('your@email.com')).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with email/i })).toBeVisible()
  })

  test('shows success message after valid email submission', async ({ page }) => {
    // Intercept the Supabase OTP request so we don't need real credentials
    await page.route('**/auth/v1/otp**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

    await page.getByPlaceholder('your@email.com').fill('test@example.com')
    await page.getByRole('button', { name: /continue with email/i }).click()

    await expect(page.getByText(/check your inbox/i)).toBeVisible()
  })

  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})
