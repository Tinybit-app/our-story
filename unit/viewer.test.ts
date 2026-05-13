/**
 * Viewer-role unit tests (build plan §4.5)
 *
 * Covers:
 *  1. signViewerToken / verifyViewerToken — the stateless JWT that grants
 *     read-only access to a circle's timeline without a Supabase account.
 *  2. POST /api/reactions/guest — Zod input validation schema.
 *
 * From design spec:
 *   "Owner generates view-only link → Create signed JWT: { circle_id, role: 'viewer', exp: 30 days }"
 *   "POST /api/reactions/guest { viewerToken, memoryId, emoji }"
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { signViewerToken, verifyViewerToken } from '../server/utils/viewerJwt'

const TEST_SECRET = 'test-secret-at-least-32-chars-long!!'
const TEST_CIRCLE_ID = 'aaaaaaaa-1111-4111-8111-111111111111'
const BASE_VIEWER_LINK_ID = '10000000-0000-0000-0000-000000000001'
const BASE_NONCE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

// ── signViewerToken ───────────────────────────────────────────────────────────

describe('signViewerToken', () => {
  it('returns a non-empty string token', () => {
    const token = signViewerToken(
      TEST_CIRCLE_ID,
      TEST_SECRET,
      undefined,
      BASE_VIEWER_LINK_ID,
      BASE_NONCE,
    )
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('returns a dot-separated JWT (header.payload.signature)', () => {
    const token = signViewerToken(
      TEST_CIRCLE_ID,
      TEST_SECRET,
      undefined,
      BASE_VIEWER_LINK_ID,
      BASE_NONCE,
    )
    expect(token.split('.')).toHaveLength(3)
  })
})

// ── verifyViewerToken ─────────────────────────────────────────────────────────

describe('verifyViewerToken — valid token', () => {
  it('returns the circle_id embedded in the token', () => {
    const token = signViewerToken(
      TEST_CIRCLE_ID,
      TEST_SECRET,
      undefined,
      BASE_VIEWER_LINK_ID,
      BASE_NONCE,
    )
    const payload = verifyViewerToken(token, TEST_SECRET)
    expect(payload.circle_id).toBe(TEST_CIRCLE_ID)
  })

  it("returns role 'viewer'", () => {
    const token = signViewerToken(
      TEST_CIRCLE_ID,
      TEST_SECRET,
      undefined,
      BASE_VIEWER_LINK_ID,
      BASE_NONCE,
    )
    const payload = verifyViewerToken(token, TEST_SECRET)
    expect(payload.role).toBe('viewer')
  })
})

describe('verifyViewerToken — wrong secret', () => {
  it('throws when the token was signed with a different secret', () => {
    const token = signViewerToken(
      TEST_CIRCLE_ID,
      TEST_SECRET,
      undefined,
      BASE_VIEWER_LINK_ID,
      BASE_NONCE,
    )
    expect(() => verifyViewerToken(token, 'wrong-secret-that-is-long-enough!!')).toThrow()
  })
})

describe('verifyViewerToken — expired token', () => {
  it('throws when the token is past its expiry', () => {
    // Sign with exp already in the past
    const token = signViewerToken(TEST_CIRCLE_ID, TEST_SECRET, -1, BASE_VIEWER_LINK_ID, BASE_NONCE)
    expect(() => verifyViewerToken(token, TEST_SECRET)).toThrow(/expired/i)
  })
})

describe('verifyViewerToken — tampered token', () => {
  it('throws when the payload has been modified', () => {
    const token = signViewerToken(
      TEST_CIRCLE_ID,
      TEST_SECRET,
      undefined,
      BASE_VIEWER_LINK_ID,
      BASE_NONCE,
    )
    const [header, , sig] = token.split('.')
    // Encode a different circle_id
    const fakePart = Buffer.from(
      JSON.stringify({
        circle_id: 'bbbbbbbb-2222-4222-8222-222222222222',
        role: 'viewer',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url')
    expect(() => verifyViewerToken(`${header}.${fakePart}.${sig}`, TEST_SECRET)).toThrow()
  })
})

// ── POST /api/reactions/guest — input validation ──────────────────────────────

const VALID_EMOJIS = ['❤️', '😂', '😮', '😢', '👏'] as const

const guestReactionSchema = z.object({
  viewerToken: z.string().min(1),
  memoryId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  emoji: z.enum(VALID_EMOJIS),
})

describe('POST /api/reactions/guest — input validation', () => {
  it('accepts a valid payload', () => {
    expect(
      guestReactionSchema.safeParse({
        viewerToken: 'some.valid.token',
        memoryId: 'cccccccc-3333-4333-8333-333333333333',
        emoji: '❤️',
      }).success,
    ).toBe(true)
  })

  it('rejects missing viewerToken', () => {
    expect(
      guestReactionSchema.safeParse({
        memoryId: 'cccccccc-3333-4333-8333-333333333333',
        emoji: '❤️',
      }).success,
    ).toBe(false)
  })

  it('rejects empty viewerToken', () => {
    expect(
      guestReactionSchema.safeParse({
        viewerToken: '',
        memoryId: 'cccccccc-3333-4333-8333-333333333333',
        emoji: '❤️',
      }).success,
    ).toBe(false)
  })

  it('rejects non-UUID memoryId', () => {
    expect(
      guestReactionSchema.safeParse({
        viewerToken: 'some.valid.token',
        memoryId: 'not-a-uuid',
        emoji: '❤️',
      }).success,
    ).toBe(false)
  })

  it('rejects an unsupported emoji', () => {
    expect(
      guestReactionSchema.safeParse({
        viewerToken: 'some.valid.token',
        memoryId: 'cccccccc-3333-4333-8333-333333333333',
        emoji: '🎉',
      }).success,
    ).toBe(false)
  })

  it('rejects missing emoji', () => {
    expect(
      guestReactionSchema.safeParse({
        viewerToken: 'some.valid.token',
        memoryId: 'cccccccc-3333-4333-8333-333333333333',
      }).success,
    ).toBe(false)
  })

  it('accepts all 5 supported emoji values', () => {
    for (const emoji of VALID_EMOJIS) {
      expect(
        guestReactionSchema.safeParse({
          viewerToken: 'some.valid.token',
          memoryId: 'cccccccc-3333-4333-8333-333333333333',
          emoji,
        }).success,
      ).toBe(true)
    }
  })
})

// ── signViewerToken — extended payload with viewer_link_id + nonce ─────────────

const TEST_LINK_ID = 'dddddddd-4444-4444-8444-444444444444'
const TEST_NONCE = 'eeeeeeee-5555-4555-8555-555555555555'

describe('signViewerToken — extended payload with viewer_link_id + nonce', () => {
  it('embeds viewer_link_id in the token payload', () => {
    const token = signViewerToken(TEST_CIRCLE_ID, TEST_SECRET, undefined, TEST_LINK_ID, TEST_NONCE)
    const payload = verifyViewerToken(token, TEST_SECRET)
    expect(payload.viewer_link_id).toBe(TEST_LINK_ID)
  })

  it('embeds nonce in the token payload', () => {
    const token = signViewerToken(TEST_CIRCLE_ID, TEST_SECRET, undefined, TEST_LINK_ID, TEST_NONCE)
    const payload = verifyViewerToken(token, TEST_SECRET)
    expect(payload.nonce).toBe(TEST_NONCE)
  })

  it('verifies correctly when viewer_link_id and nonce are present', () => {
    const token = signViewerToken(TEST_CIRCLE_ID, TEST_SECRET, undefined, TEST_LINK_ID, TEST_NONCE)
    expect(() => verifyViewerToken(token, TEST_SECRET)).not.toThrow()
  })
})
