/**
 * API input validation tests
 *
 * Verifies that the Zod schemas used in server API routes enforce the
 * constraints defined in the build plan (§1.6 security hardening: "validate
 * all user input with Zod — never use raw request body") and design spec.
 *
 * These tests define the same schemas as the routes so they can be run
 * without standing up Nuxt. Any divergence between these and the actual
 * route schemas is a signal to align them.
 */

import { describe, it, expect } from "vitest"
import { z } from "zod"

// ============================================================
// POST /api/circles/create — schema from server/api/circles/create.post.ts
// ============================================================
const CIRCLE_TYPES = [
  "parents", "couple", "family", "friends",
  "caregiving", "travel", "solo", "custom",
] as const

const createCircleSchema = z.object({
  name: z.string().min(1).max(100),
  circleType: z.enum(CIRCLE_TYPES),
})

describe("POST /api/circles/create — input validation", () => {
  it("accepts valid name and circleType", () => {
    const r = createCircleSchema.safeParse({ name: "The Dao Family", circleType: "parents" })
    expect(r.success).toBe(true)
  })

  it("accepts all 8 valid circle_type values from design spec", () => {
    for (const ct of CIRCLE_TYPES) {
      const r = createCircleSchema.safeParse({ name: "Test", circleType: ct })
      expect(r.success).toBe(true)
    }
  })

  it("rejects an unknown circleType", () => {
    const r = createCircleSchema.safeParse({ name: "Test", circleType: "household" })
    expect(r.success).toBe(false)
  })

  it("rejects empty name", () => {
    const r = createCircleSchema.safeParse({ name: "", circleType: "custom" })
    expect(r.success).toBe(false)
  })

  it("rejects name longer than 100 characters", () => {
    const r = createCircleSchema.safeParse({ name: "a".repeat(101), circleType: "custom" })
    expect(r.success).toBe(false)
  })

  it("rejects missing circleType", () => {
    const r = createCircleSchema.safeParse({ name: "Test" })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// POST /api/circles/invite — schema from server/api/circles/invite.post.ts
// ============================================================
const inviteSchema = z.object({
  circleId: z.uuid(),
  email: z.email(),
})

describe("POST /api/circles/invite — input validation", () => {
  it("accepts valid UUID and email", () => {
    const r = inviteSchema.safeParse({
      circleId: "123e4567-e89b-12d3-a456-426614174000",
      email: "grandma@example.com",
    })
    expect(r.success).toBe(true)
  })

  it("rejects invalid UUID format for circleId", () => {
    const r = inviteSchema.safeParse({ circleId: "not-a-uuid", email: "a@b.com" })
    expect(r.success).toBe(false)
  })

  it("rejects invalid email", () => {
    const r = inviteSchema.safeParse({
      circleId: "123e4567-e89b-12d3-a456-426614174000",
      email: "not-an-email",
    })
    expect(r.success).toBe(false)
  })

  it("rejects missing email", () => {
    const r = inviteSchema.safeParse({ circleId: "123e4567-e89b-12d3-a456-426614174000" })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// GET /api/timeline — schema from server/api/timeline.get.ts
// ============================================================
const timelineQuerySchema = z.object({
  circleId: z.uuid(),
  cursor: z.string().optional(),
})

describe("GET /api/timeline — input validation", () => {
  it("accepts valid circleId", () => {
    const r = timelineQuerySchema.safeParse({ circleId: "123e4567-e89b-12d3-a456-426614174000" })
    expect(r.success).toBe(true)
  })

  it("accepts valid circleId with optional cursor", () => {
    const r = timelineQuerySchema.safeParse({
      circleId: "123e4567-e89b-12d3-a456-426614174000",
      cursor: "2024-01-01T00:00:00Z,123e4567-e89b-12d3-a456-426614174001",
    })
    expect(r.success).toBe(true)
  })

  it("rejects missing circleId", () => {
    const r = timelineQuerySchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it("rejects non-UUID circleId", () => {
    const r = timelineQuerySchema.safeParse({ circleId: "my-circle" })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// PATCH /api/profile — schema from server/api/profile.patch.ts
// Step 3.4 (locale + avatar) not yet implemented; only firstName/lastName active.
// ============================================================
const profileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
})

describe("PATCH /api/profile — input validation", () => {
  it("accepts valid firstName", () => {
    const r = profileSchema.safeParse({ firstName: "Dao" })
    expect(r.success).toBe(true)
  })

  it("accepts firstName and optional lastName", () => {
    const r = profileSchema.safeParse({ firstName: "Dao", lastName: "Zheng" })
    expect(r.success).toBe(true)
  })

  it("rejects missing firstName (required)", () => {
    const r = profileSchema.safeParse({ lastName: "Zheng" })
    expect(r.success).toBe(false)
  })

  it("rejects empty firstName", () => {
    const r = profileSchema.safeParse({ firstName: "" })
    expect(r.success).toBe(false)
  })
})
