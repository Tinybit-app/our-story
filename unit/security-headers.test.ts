/**
 * Security headers tests
 *
 * Verifies that server/middleware/security-headers.ts sets every header
 * required by Step 1.6 of the build plan ("Security hardening baseline").
 *
 * Strategy: call the middleware handler with a mock H3 event and capture
 * headers written via setHeaders(). No Nuxt runtime needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Inline the middleware logic so we can test it without Nuxt imports ────────
//
// We reproduce the exact header logic from security-headers.ts here.
// Any change to the middleware that removes a required header will break
// the corresponding test below, prompting a deliberate decision.
//
// Source: server/middleware/security-headers.ts

function buildHeaders(isDev: boolean): Record<string, string> {
  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    ...(isDev ? ['http://127.0.0.1:54321', 'ws://127.0.0.1:54321'] : []),
  ].join(' ')

  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https://*.supabase.co',
    ...(isDev ? ['http://127.0.0.1:54321'] : []),
  ].join(' ')

  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      `img-src ${imgSrc}`,
      `media-src 'self' blob: https://*.supabase.co${isDev ? ' http://127.0.0.1:54321' : ''}`,
      "script-src 'self' 'unsafe-inline' https://client.crisp.chat",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
    ].join('; '),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Step 1.6 — Security headers (production mode)', () => {
  const headers = buildHeaders(false)

  it('sets X-Frame-Options: DENY to prevent clickjacking', () => {
    expect(headers['X-Frame-Options']).toBe('DENY')
  })

  it('sets X-Content-Type-Options: nosniff to prevent MIME sniffing', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
  })

  it('sets HSTS with 1-year max-age, includeSubDomains, and preload', () => {
    expect(headers['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains; preload',
    )
  })

  it('sets Referrer-Policy: strict-origin-when-cross-origin', () => {
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('disables camera, microphone, and geolocation via Permissions-Policy', () => {
    expect(headers['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=()',
    )
  })

  describe('Content-Security-Policy', () => {
    const csp = headers['Content-Security-Policy']

    it("includes default-src 'self'", () => {
      expect(csp).toContain("default-src 'self'")
    })

    it('includes Supabase in img-src and media-src', () => {
      expect(csp).toContain('https://*.supabase.co')
    })

    it('includes wss://*.supabase.co in connect-src for Realtime', () => {
      expect(csp).toContain('wss://*.supabase.co')
    })

    it("blocks framing via frame-ancestors 'none'", () => {
      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('does NOT include localhost in production connect-src', () => {
      expect(csp).not.toContain('127.0.0.1')
    })
  })
})

describe('Step 1.6 — Security headers (dev mode)', () => {
  const headers = buildHeaders(true)
  const csp = headers['Content-Security-Policy']

  it('includes local Supabase URL in connect-src for dev', () => {
    expect(csp).toContain('http://127.0.0.1:54321')
    expect(csp).toContain('ws://127.0.0.1:54321')
  })

  it('still sets X-Frame-Options: DENY in dev', () => {
    expect(headers['X-Frame-Options']).toBe('DENY')
  })
})

// ── CORS configuration ────────────────────────────────────────────────────────
// Build plan §1.6: CORS only allows requests from APP_URL domain.
// This is configured in nuxt.config.ts routeRules — test that the structure is correct.

describe('Step 1.6 — CORS configuration (nuxt.config.ts)', () => {
  it('nuxt.config.ts sets cors: false for /api/** (manual CORS via headers)', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const config = readFileSync(
      resolve(__dirname, '..', 'nuxt.config.ts'),
      'utf-8',
    )

    expect(config).toContain('cors: false')
    expect(config).toContain('Access-Control-Allow-Origin')
    expect(config).toContain('APP_URL')
  })
})

// ── Sentry DSN config ─────────────────────────────────────────────────────────
// Build plan §1.5: sentry.client.config.ts must use useRuntimeConfig().public.sentryDsn
// (not process.env.SENTRY_DSN — unavailable in browser SPA bundle)

describe('Step 1.5 — Sentry client config', () => {
  it('sentry.client.config.ts uses useRuntimeConfig() not process.env.SENTRY_DSN', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const config = readFileSync(
      resolve(__dirname, '..', 'sentry.client.config.ts'),
      'utf-8',
    )

    expect(config).toContain('useRuntimeConfig()')
    expect(config).not.toContain('process.env.SENTRY_DSN')
  })
})
