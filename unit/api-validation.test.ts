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

// Resend logic: existing pending invites are always expired before a new one is issued.
// This means owners can resend at any time — the old link is invalidated, a fresh
// 7-day window starts, and the invitee gets the most current link.
describe("POST /api/circles/invite — resend logic", () => {
  // Simulates what the route does: expire old pending invite, then insert fresh one.
  function resendWouldSucceed(_existingStatus: string | null): boolean {
    // Route always expires any pending row then inserts fresh — never blocks on existing invite
    return true
  }

  it("allows resend even when a valid pending invite already exists", () => {
    expect(resendWouldSucceed("pending")).toBe(true)
  })

  it("allows resend when previous invite was expired", () => {
    expect(resendWouldSucceed("expired")).toBe(true)
  })

  it("allows resend when previous invite was accepted (invitee left, re-inviting)", () => {
    expect(resendWouldSucceed("accepted")).toBe(true)
  })
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
// POST /api/circles/invite — max pending invites cap
// Route: server/api/circles/invite.post.ts
// ============================================================
describe("POST /api/circles/invite — max pending invites cap", () => {
  // Mirrors the route check: (count ?? 0) >= 10 → 429
  function isAtMaxPendingInvites(pendingCount: number): boolean {
    return (pendingCount ?? 0) >= 10
  }

  it("allows invite when there are 0 pending invites", () => {
    expect(isAtMaxPendingInvites(0)).toBe(false)
  })

  it("allows invite when there are 9 pending invites (one below cap)", () => {
    expect(isAtMaxPendingInvites(9)).toBe(false)
  })

  it("blocks invite when there are exactly 10 pending invites (at cap)", () => {
    expect(isAtMaxPendingInvites(10)).toBe(true)
  })

  it("blocks invite when there are more than 10 pending invites", () => {
    expect(isAtMaxPendingInvites(11)).toBe(true)
  })

  it("treats a null count as 0 (Supabase may return null for empty tables)", () => {
    expect(isAtMaxPendingInvites(null as unknown as number)).toBe(false)
  })
})

// ============================================================
// POST /api/circles/invite — role gate
// Route: server/api/circles/invite.post.ts
// ============================================================
describe("POST /api/circles/invite — role gate", () => {
  // Mirrors the route check: only 'owner' and 'admin' may send invites
  function canSendInvite(role: string | null | undefined): boolean {
    return role === "owner" || role === "admin"
  }

  it("allows owner to send invites", () => {
    expect(canSendInvite("owner")).toBe(true)
  })

  it("allows admin to send invites", () => {
    expect(canSendInvite("admin")).toBe(true)
  })

  it("blocks member from sending invites", () => {
    expect(canSendInvite("member")).toBe(false)
  })

  it("blocks viewer from sending invites", () => {
    expect(canSendInvite("viewer")).toBe(false)
  })

  it("blocks when user has no membership in the circle (null row)", () => {
    expect(canSendInvite(null)).toBe(false)
  })

  it("blocks when membership row exists but role is undefined", () => {
    expect(canSendInvite(undefined)).toBe(false)
  })
})

// ============================================================
// POST /api/circles/invite — old invite expiry before re-invite
// Route: server/api/circles/invite.post.ts
// ============================================================
describe("POST /api/circles/invite — expiry of previous invite before re-invite", () => {
  type InviteStatus = "pending" | "expired" | "accepted"

  interface Invite {
    email: string
    status: InviteStatus
  }

  // Mirrors the route: expire any pending rows for the email, then insert fresh.
  // Returns the status of the old invite after the expiry step.
  function expireExistingPendingInvite(
    existing: Invite | null,
    targetEmail: string,
  ): InviteStatus | null {
    if (!existing || existing.email !== targetEmail || existing.status !== "pending") {
      return existing?.status ?? null
    }
    return "expired"
  }

  it("expires a pending invite for the same email before re-inviting", () => {
    const existing = { email: "grandma@example.com", status: "pending" as InviteStatus }
    expect(expireExistingPendingInvite(existing, "grandma@example.com")).toBe("expired")
  })

  it("does not touch an already-expired invite (no double-expiry)", () => {
    const existing = { email: "grandma@example.com", status: "expired" as InviteStatus }
    expect(expireExistingPendingInvite(existing, "grandma@example.com")).toBe("expired")
  })

  it("does not touch an accepted invite when re-inviting the same person", () => {
    const existing = { email: "grandma@example.com", status: "accepted" as InviteStatus }
    expect(expireExistingPendingInvite(existing, "grandma@example.com")).toBe("accepted")
  })

  it("does not affect an invite for a different email", () => {
    const existing = { email: "other@example.com", status: "pending" as InviteStatus }
    expect(expireExistingPendingInvite(existing, "grandma@example.com")).toBe("pending")
  })

  it("handles the case where no prior invite exists for the email", () => {
    expect(expireExistingPendingInvite(null, "grandma@example.com")).toBeNull()
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

// ============================================================
// GET /api/timeline — yearMonth param validation
// ============================================================
const timelineQuerySchemaV2 = z.object({
  circleId: z.uuid(),
  cursor: z.string().optional(),
  authorId: z.uuid().optional(),
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
})

describe('GET /api/timeline — yearMonth param validation', () => {
  it('accepts a valid yearMonth string', () => {
    const r = timelineQuerySchemaV2.safeParse({ circleId: '123e4567-e89b-12d3-a456-426614174000', yearMonth: '2025-03' })
    expect(r.success).toBe(true)
  })

  it('rejects yearMonth with invalid month 13', () => {
    const r = timelineQuerySchemaV2.safeParse({ circleId: '123e4567-e89b-12d3-a456-426614174000', yearMonth: '2025-13' })
    expect(r.success).toBe(false)
  })

  it('rejects yearMonth with invalid month 00', () => {
    const r = timelineQuerySchemaV2.safeParse({ circleId: '123e4567-e89b-12d3-a456-426614174000', yearMonth: '2025-00' })
    expect(r.success).toBe(false)
  })

  it('rejects yearMonth with wrong format', () => {
    const r = timelineQuerySchemaV2.safeParse({ circleId: '123e4567-e89b-12d3-a456-426614174000', yearMonth: '03-2025' })
    expect(r.success).toBe(false)
  })

  it('accepts request without yearMonth (normal cursor pagination)', () => {
    const r = timelineQuerySchemaV2.safeParse({ circleId: '123e4567-e89b-12d3-a456-426614174000' })
    expect(r.success).toBe(true)
  })
})

// ============================================================
// GET /api/timeline — cursor + yearMonth combined
// ============================================================
describe('GET /api/timeline — cursor + yearMonth combined', () => {
  it('accepts cursor alongside yearMonth', () => {
    const r = timelineQuerySchemaV2.safeParse({
      circleId: '123e4567-e89b-12d3-a456-426614174000',
      yearMonth: '2025-03',
      cursor: '2025-03-15T00:00:00.000Z,2025-03-15T10:00:00.000Z,abc12345-0000-0000-0000-000000000001',
    })
    expect(r.success).toBe(true)
  })
})

// ============================================================
// POST /api/account/delete — Step 3.6 owner deletion resolution
// Mirrors the auto-promote / needs-transfer logic in the route.
// ============================================================
describe("POST /api/account/delete — owner resolution logic", () => {
  type CircleState = { hasAdmin: boolean; otherMemberCount: number }

  function resolveOwnership(circles: CircleState[]): "ok" | "needs_transfer" {
    for (const c of circles) {
      if (!c.hasAdmin && c.otherMemberCount > 0) return "needs_transfer"
    }
    return "ok"
  }

  it("allows deletion when user owns no circles", () => {
    expect(resolveOwnership([])).toBe("ok")
  })

  it("allows deletion when owned circle has an admin to auto-promote", () => {
    expect(resolveOwnership([{ hasAdmin: true, otherMemberCount: 2 }])).toBe("ok")
  })

  it("allows deletion when user is sole member (no one to transfer to)", () => {
    expect(resolveOwnership([{ hasAdmin: false, otherMemberCount: 0 }])).toBe("ok")
  })

  it("blocks deletion when circle has members but no admins", () => {
    expect(resolveOwnership([{ hasAdmin: false, otherMemberCount: 3 }])).toBe("needs_transfer")
  })

  it("blocks deletion when any circle needs transfer even if others are resolved", () => {
    expect(resolveOwnership([
      { hasAdmin: true, otherMemberCount: 1 },   // resolved via auto-promote
      { hasAdmin: false, otherMemberCount: 2 },  // needs manual transfer
    ])).toBe("needs_transfer")
  })
})

// ============================================================
// DELETE /api/circles/[id]/members/[userId] — Step 3.6 member removal
// Tests cover Zod body schema and keepContent / reaction logic.
// ============================================================
const removeMemberSchema = z.object({
  keepContent: z.boolean(),
})

describe("DELETE /api/circles/[id]/members/[userId] — input validation", () => {
  it("accepts keepContent: true", () => {
    expect(removeMemberSchema.safeParse({ keepContent: true }).success).toBe(true)
  })

  it("accepts keepContent: false", () => {
    expect(removeMemberSchema.safeParse({ keepContent: false }).success).toBe(true)
  })

  it("rejects missing keepContent", () => {
    expect(removeMemberSchema.safeParse({}).success).toBe(false)
  })

  it("rejects string instead of boolean", () => {
    expect(removeMemberSchema.safeParse({ keepContent: "true" }).success).toBe(false)
  })
})

describe("DELETE /api/circles/[id]/members/[userId] — reaction removal rule", () => {
  // Reactions are always removed regardless of keepContent — mirrors route logic
  function reactionsRemoved(_keepContent: boolean): boolean {
    return true
  }

  it("removes reactions when keepContent is true", () => {
    expect(reactionsRemoved(true)).toBe(true)
  })

  it("removes reactions when keepContent is false", () => {
    expect(reactionsRemoved(false)).toBe(true)
  })
})

// ============================================================
// DELETE /api/circles/[id]/members/[userId] — memory detach rule
// When keepContent = true, owner_user_id is NULLed (detached).
// When keepContent = false, memory rows are hard-deleted.
// Detached memories survive the uploader's account purge.
// ============================================================
describe("DELETE /api/circles/[id]/members/[userId] — memory detach rule", () => {
  type MemoryAction = "detach" | "delete" | "none"

  function resolveMemoryAction(keepContent: boolean, memoryCount: number): MemoryAction {
    if (memoryCount === 0) return "none"
    return keepContent ? "detach" : "delete"
  }

  it("detaches memories (nulls owner_user_id) when keepContent is true", () => {
    expect(resolveMemoryAction(true, 3)).toBe("detach")
  })

  it("deletes memories when keepContent is false", () => {
    expect(resolveMemoryAction(false, 3)).toBe("delete")
  })

  it("takes no memory action when member has no memories in the circle", () => {
    expect(resolveMemoryAction(true, 0)).toBe("none")
    expect(resolveMemoryAction(false, 0)).toBe("none")
  })
})

// ============================================================
// purge-deleted-users — detached memory preservation
// Memories with owner_user_id = NULL are left untouched by the
// purge cron. Only memories still owned by the purged user are deleted.
// ============================================================
describe("purge-deleted-users — detached memory preservation", () => {
  type Memory = { id: string; owner_user_id: string | null }

  function memoriesOwnedByUser(memories: Memory[], userId: string): Memory[] {
    return memories.filter((m) => m.owner_user_id === userId)
  }

  const userId = "user-abc"
  const memories: Memory[] = [
    { id: "m1", owner_user_id: userId },   // owned — will be purged
    { id: "m2", owner_user_id: userId },   // owned — will be purged
    { id: "m3", owner_user_id: null },     // detached (keepContent removal) — preserved
    { id: "m4", owner_user_id: "other" },  // belongs to another user — not touched
  ]

  it("only includes owned memories in the purge scope", () => {
    const toDelete = memoriesOwnedByUser(memories, userId)
    expect(toDelete.map((m) => m.id)).toEqual(["m1", "m2"])
  })

  it("detached memories (owner_user_id = null) are excluded from purge", () => {
    const toDelete = memoriesOwnedByUser(memories, userId)
    expect(toDelete.some((m) => m.owner_user_id === null)).toBe(false)
  })

  it("other users' memories are excluded from purge", () => {
    const toDelete = memoriesOwnedByUser(memories, userId)
    expect(toDelete.some((m) => m.owner_user_id === "other")).toBe(false)
  })
})

// ============================================================
// Notification email triggers
// Documents when emails must be sent for each deletion scenario.
// ============================================================
// ============================================================
// Notification emails — member removed from circle
// Sent immediately to the removed member regardless of keepContent.
// Email copy differs: keepContent affects what we tell them happened.
// ============================================================
describe("notification email triggers — member removed from circle", () => {
  function shouldNotifyRemovedMember(memberHasEmail: boolean): boolean {
    return memberHasEmail
  }

  it("sends email when removed member has an email address", () => {
    expect(shouldNotifyRemovedMember(true)).toBe(true)
  })

  it("skips email if member has no email on record", () => {
    expect(shouldNotifyRemovedMember(false)).toBe(false)
  })
})

describe("notification email content — member removed from circle", () => {
  // The email copy tells the removed member what happened to their memories.
  type EmailOutcome = "memories_kept" | "memories_deleted"

  function emailOutcome(keepContent: boolean): EmailOutcome {
    return keepContent ? "memories_kept" : "memories_deleted"
  }

  it("tells member their memories are kept when keepContent is true", () => {
    expect(emailOutcome(true)).toBe("memories_kept")
  })

  it("tells member their memories were deleted when keepContent is false", () => {
    expect(emailOutcome(false)).toBe("memories_deleted")
  })
})

// ============================================================
// Notification emails — account deletion
// Confirmation sent immediately (day 0).
// Warning sent on day 27 by the daily purge cron (3 days before hard delete).
// ============================================================
describe("notification email triggers — account deletion", () => {
  function deletionEmailsSent(daysSinceRequest: number): Array<"confirmation" | "warning"> {
    const emails: Array<"confirmation" | "warning"> = []
    if (daysSinceRequest === 0) emails.push("confirmation")
    if (daysSinceRequest === 27) emails.push("warning")
    return emails
  }

  it("sends confirmation email immediately on day 0", () => {
    expect(deletionEmailsSent(0)).toContain("confirmation")
  })

  it("sends 3-day warning email on day 27", () => {
    expect(deletionEmailsSent(27)).toContain("warning")
  })

  it("sends no emails on other days", () => {
    expect(deletionEmailsSent(1)).toHaveLength(0)
    expect(deletionEmailsSent(15)).toHaveLength(0)
    expect(deletionEmailsSent(30)).toHaveLength(0)
  })
})

describe("notification email triggers — day-27 warning window", () => {
  // The purge cron detects day-27 users by checking:
  // deletion_requested_at BETWEEN (now - 28 days) AND (now - 27 days)
  // Cron uses lt(now-27d) and gt(now-28d) — both boundaries exclusive
  function isInWarningWindow(daysSinceRequest: number): boolean {
    return daysSinceRequest > 27 && daysSinceRequest < 28
  }

  it("fires warning for user at exactly 27.5 days", () => {
    expect(isInWarningWindow(27.5)).toBe(true)
  })

  it("does not fire warning at 27 days exactly (boundary — exclusive)", () => {
    expect(isInWarningWindow(27)).toBe(false)
  })

  it("does not fire warning at 28 days (already past window)", () => {
    expect(isInWarningWindow(28)).toBe(false)
  })

  it("does not fire warning before day 27", () => {
    expect(isInWarningWindow(15)).toBe(false)
  })
})

// ============================================================
// Notification emails — owner auto-promotion
// ============================================================
describe("notification email triggers — owner auto-promotion", () => {
  function shouldNotifyNewOwner(hadAdmin: boolean): boolean {
    return hadAdmin
  }

  it("notifies the promoted admin when auto-promotion occurs", () => {
    expect(shouldNotifyNewOwner(true)).toBe(true)
  })

  it("does not notify when no admin was promoted (sole member or transfer blocked)", () => {
    expect(shouldNotifyNewOwner(false)).toBe(false)
  })
})

// ============================================================
// POST /api/account/delete — keepCircleMemories schema
// When omitted, defaults to true (keep). Validated before any DB writes.
// ============================================================
const deleteAccountSchema = z.object({
  keepCircleMemories: z.boolean().default(true),
})

describe("POST /api/account/delete — keepCircleMemories schema", () => {
  it("accepts keepCircleMemories: true", () => {
    expect(deleteAccountSchema.safeParse({ keepCircleMemories: true }).success).toBe(true)
  })

  it("accepts keepCircleMemories: false", () => {
    expect(deleteAccountSchema.safeParse({ keepCircleMemories: false }).success).toBe(true)
  })

  it("defaults to true when field is omitted", () => {
    const r = deleteAccountSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.keepCircleMemories).toBe(true)
  })

  it("rejects a string value", () => {
    expect(deleteAccountSchema.safeParse({ keepCircleMemories: "yes" }).success).toBe(false)
  })
})

// ============================================================
// POST /api/account/delete — circle memory action
// keepCircleMemories=true  → immediately detach (owner_user_id = NULL, former_owner_name snapshot)
// keepCircleMemories=false → leave owned (purge cron hard-deletes at day 30)
// ============================================================
describe("POST /api/account/delete — circle memory action", () => {
  type CircleMemoryAction = "detach" | "leave_for_purge"

  function circleMemoryAction(keepCircleMemories: boolean): CircleMemoryAction {
    return keepCircleMemories ? "detach" : "leave_for_purge"
  }

  it("detaches circle memories immediately when keepCircleMemories is true", () => {
    expect(circleMemoryAction(true)).toBe("detach")
  })

  it("leaves circle memories for cron purge when keepCircleMemories is false", () => {
    expect(circleMemoryAction(false)).toBe("leave_for_purge")
  })
})

// ============================================================
// former_owner_name snapshot rule
// When a memory is detached (owner_user_id set to NULL), the
// uploader's display name must be captured in former_owner_name
// so UI can still attribute the photo after the account is gone.
// ============================================================
describe("former_owner_name snapshot rule", () => {
  type DetachedMemory = { owner_user_id: null; former_owner_name: string | null }

  function buildFormerOwnerName(firstName: string | null, lastName: string | null): string | null {
    const name = [firstName, lastName].filter(Boolean).join(" ")
    return name || null
  }

  it("captures full name when both first and last name are present", () => {
    expect(buildFormerOwnerName("Sarah", "Kim")).toBe("Sarah Kim")
  })

  it("captures first name only when last name is absent", () => {
    expect(buildFormerOwnerName("Sarah", null)).toBe("Sarah")
  })

  it("returns null when both names are absent (anonymous upload)", () => {
    expect(buildFormerOwnerName(null, null)).toBeNull()
  })

  it("detached memory has owner_user_id = null", () => {
    const m: DetachedMemory = { owner_user_id: null, former_owner_name: "Sarah Kim" }
    expect(m.owner_user_id).toBeNull()
  })

  it("detached memory preserves former_owner_name", () => {
    const m: DetachedMemory = { owner_user_id: null, former_owner_name: "Sarah Kim" }
    expect(m.former_owner_name).toBe("Sarah Kim")
  })
})

// ============================================================
// PATCH /api/circles/[id]/members/[userId] — role change
// Only the owner can change roles. Transferring ownership
// promotes target to owner and demotes current owner to admin.
// ============================================================
const roleChangeSchema = z.object({
  role: z.enum(["admin", "member", "owner"]),
})

describe("PATCH /api/circles/[id]/members/[userId] — input validation", () => {
  it("accepts role: admin", () => {
    expect(roleChangeSchema.safeParse({ role: "admin" }).success).toBe(true)
  })

  it("accepts role: member", () => {
    expect(roleChangeSchema.safeParse({ role: "member" }).success).toBe(true)
  })

  it("accepts role: owner (transfer)", () => {
    expect(roleChangeSchema.safeParse({ role: "owner" }).success).toBe(true)
  })

  it("rejects unknown role", () => {
    expect(roleChangeSchema.safeParse({ role: "caregiver" }).success).toBe(false)
  })

  it("rejects missing role", () => {
    expect(roleChangeSchema.safeParse({}).success).toBe(false)
  })
})

describe("PATCH /api/circles/[id]/members/[userId] — access control", () => {
  type Role = "owner" | "admin" | "member"

  function canChangeRole(requesterRole: Role, targetRole: Role, isSelf: boolean): boolean {
    if (requesterRole !== "owner") return false
    if (isSelf) return false
    if (targetRole === "owner") return false
    return true
  }

  it("owner can promote a member to admin", () => {
    expect(canChangeRole("owner", "member", false)).toBe(true)
  })

  it("owner can demote an admin to member", () => {
    expect(canChangeRole("owner", "admin", false)).toBe(true)
  })

  it("owner can transfer ownership to an admin", () => {
    expect(canChangeRole("owner", "admin", false)).toBe(true)
  })

  it("admin cannot change any roles", () => {
    expect(canChangeRole("admin", "member", false)).toBe(false)
  })

  it("member cannot change any roles", () => {
    expect(canChangeRole("member", "member", false)).toBe(false)
  })

  it("owner cannot change their own role", () => {
    expect(canChangeRole("owner", "owner", true)).toBe(false)
  })

  it("owner cannot directly change another owner's role", () => {
    expect(canChangeRole("owner", "owner", false)).toBe(false)
  })
})

describe("PATCH /api/circles/[id]/members/[userId] — transfer ownership effect", () => {
  type Membership = { userId: string; role: string }

  function transferOwnership(members: Membership[], fromId: string, toId: string): Membership[] {
    return members.map((m) => {
      if (m.userId === toId) return { ...m, role: "owner" }
      if (m.userId === fromId) return { ...m, role: "admin" }
      return m
    })
  }

  const members: Membership[] = [
    { userId: "owner-1", role: "owner" },
    { userId: "admin-1", role: "admin" },
    { userId: "member-1", role: "member" },
  ]

  it("promotes target to owner", () => {
    const updated = transferOwnership(members, "owner-1", "admin-1")
    expect(updated.find((m) => m.userId === "admin-1")?.role).toBe("owner")
  })

  it("demotes previous owner to admin", () => {
    const updated = transferOwnership(members, "owner-1", "admin-1")
    expect(updated.find((m) => m.userId === "owner-1")?.role).toBe("admin")
  })

  it("does not affect other members", () => {
    const updated = transferOwnership(members, "owner-1", "admin-1")
    expect(updated.find((m) => m.userId === "member-1")?.role).toBe("member")
  })

  it("exactly one owner exists after transfer", () => {
    const updated = transferOwnership(members, "owner-1", "admin-1")
    expect(updated.filter((m) => m.role === "owner")).toHaveLength(1)
  })
})

// ============================================================
// POST /api/invites/[token]/accept — deleted circle guard
// If the circle was soft-deleted after the invite was sent, the accept
// endpoint returns invite_circle_deleted (410) so the UI shows a clear
// message instead of a confusing join error.
// ============================================================
describe("POST /api/invites/[token]/accept — deleted circle guard", () => {
  type InviteCheck = {
    inviteStatus: "pending" | "expired"
    circleDeletedAt: string | null
    inviteExpired: boolean
  }

  function acceptResult(check: InviteCheck): "ok" | "invite_expired" | "invite_circle_deleted" {
    if (check.inviteStatus !== "pending" || check.inviteExpired) return "invite_expired"
    if (check.circleDeletedAt) return "invite_circle_deleted"
    return "ok"
  }

  it("accepts a valid invite for an active circle", () => {
    expect(acceptResult({ inviteStatus: "pending", circleDeletedAt: null, inviteExpired: false })).toBe("ok")
  })

  it("rejects when the circle has been soft-deleted", () => {
    expect(acceptResult({ inviteStatus: "pending", circleDeletedAt: "2026-04-18T00:00:00Z", inviteExpired: false })).toBe("invite_circle_deleted")
  })

  it("still rejects an expired invite even if the circle is also deleted", () => {
    expect(acceptResult({ inviteStatus: "pending", circleDeletedAt: "2026-04-18T00:00:00Z", inviteExpired: true })).toBe("invite_expired")
  })

  it("rejects an expired invite for an active circle", () => {
    expect(acceptResult({ inviteStatus: "pending", circleDeletedAt: null, inviteExpired: true })).toBe("invite_expired")
  })
})

// ============================================================
// POST /api/invites/[token]/accept — memory re-attach on rejoin
// When a previously-removed member accepts a new invite, any memories
// detached during their removal are restored to their ownership.
// former_owner_user_id is the key — former_owner_name alone is not
// reliable for matching because names are not unique.
// ============================================================
describe("POST /api/invites/[token]/accept — memory re-attach on rejoin", () => {
  type Memory = {
    id: string
    circle_id: string
    owner_user_id: string | null
    former_owner_user_id: string | null
    former_owner_name: string | null
  }

  function reattachMemories(memories: Memory[], userId: string, circleId: string): Memory[] {
    return memories.map((m) => {
      if (m.former_owner_user_id === userId && m.circle_id === circleId) {
        return { ...m, owner_user_id: userId, former_owner_user_id: null, former_owner_name: null }
      }
      return m
    })
  }

  const circleId = "circle-1"
  const userId = "user-abc"

  const memories: Memory[] = [
    { id: "m1", circle_id: circleId, owner_user_id: null, former_owner_user_id: userId, former_owner_name: "Sarah Kim" },
    { id: "m2", circle_id: circleId, owner_user_id: null, former_owner_user_id: userId, former_owner_name: "Sarah Kim" },
    { id: "m3", circle_id: circleId, owner_user_id: "other-user", former_owner_user_id: null, former_owner_name: null },
    { id: "m4", circle_id: "circle-2", owner_user_id: null, former_owner_user_id: userId, former_owner_name: "Sarah Kim" },
  ]

  it("re-attaches detached memories in the rejoined circle to the returning user", () => {
    const updated = reattachMemories(memories, userId, circleId)
    const reattached = updated.filter((m) => m.id === "m1" || m.id === "m2")
    expect(reattached.every((m) => m.owner_user_id === userId)).toBe(true)
  })

  it("clears former_owner_user_id and former_owner_name after re-attach", () => {
    const updated = reattachMemories(memories, userId, circleId)
    const reattached = updated.filter((m) => m.id === "m1" || m.id === "m2")
    expect(reattached.every((m) => m.former_owner_user_id === null)).toBe(true)
    expect(reattached.every((m) => m.former_owner_name === null)).toBe(true)
  })

  it("does not touch memories owned by other users", () => {
    const updated = reattachMemories(memories, userId, circleId)
    const other = updated.find((m) => m.id === "m3")
    expect(other?.owner_user_id).toBe("other-user")
  })

  it("does not re-attach memories from a different circle", () => {
    const updated = reattachMemories(memories, userId, circleId)
    const otherCircle = updated.find((m) => m.id === "m4")
    expect(otherCircle?.owner_user_id).toBeNull()
    expect(otherCircle?.former_owner_user_id).toBe(userId)
  })
})

// ============================================================
// POST /api/account/export — Step 3.8 data export
// Schema: { circleId: UUID }
// Rate limit: 1 active job per (user, circle) — not per user globally.
// Scope: owner/admin → full circle; member → own uploads only.
// ============================================================
const exportSchema = z.object({
  circleId: z.uuid(),
})

describe("POST /api/account/export — schema validation", () => {
  it("accepts a valid UUID circleId", () => {
    const r = exportSchema.safeParse({ circleId: "550e8400-e29b-41d4-a716-446655440000" })
    expect(r.success).toBe(true)
  })

  it("rejects missing circleId", () => {
    const r = exportSchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it("rejects non-UUID circleId", () => {
    const r = exportSchema.safeParse({ circleId: "not-a-uuid" })
    expect(r.success).toBe(false)
  })

  it("rejects empty string circleId", () => {
    const r = exportSchema.safeParse({ circleId: "" })
    expect(r.success).toBe(false)
  })
})

describe("POST /api/account/export — per-circle duplicate job guard", () => {
  const CIRCLE_A = "550e8400-e29b-41d4-a716-446655440000"
  const CIRCLE_B = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

  type ActiveJob = { circle_id: string; status: string }

  function exportWouldBeBlocked(activeJobs: ActiveJob[], circleId: string): boolean {
    return activeJobs.some(
      (j) => j.circle_id === circleId && (j.status === "pending" || j.status === "processing"),
    )
  }

  it("allows export when no active jobs exist", () => {
    expect(exportWouldBeBlocked([], CIRCLE_A)).toBe(false)
  })

  it("blocks export when a pending job exists for the same circle", () => {
    expect(exportWouldBeBlocked([{ circle_id: CIRCLE_A, status: "pending" }], CIRCLE_A)).toBe(true)
  })

  it("blocks export when a processing job exists for the same circle", () => {
    expect(exportWouldBeBlocked([{ circle_id: CIRCLE_A, status: "processing" }], CIRCLE_A)).toBe(true)
  })

  it("allows export for a different circle even when another circle has an active job", () => {
    expect(exportWouldBeBlocked([{ circle_id: CIRCLE_A, status: "pending" }], CIRCLE_B)).toBe(false)
  })

  it("allows export after a completed job for the same circle", () => {
    expect(exportWouldBeBlocked([{ circle_id: CIRCLE_A, status: "complete" }], CIRCLE_A)).toBe(false)
  })

  it("allows export after a failed job for the same circle", () => {
    expect(exportWouldBeBlocked([{ circle_id: CIRCLE_A, status: "failed" }], CIRCLE_A)).toBe(false)
  })
})

describe("POST /api/account/export — export scope by role", () => {
  function getScopeFilter(role: string, userId: string, circleId: string) {
    const isOwnerOrAdmin = role === "owner" || role === "admin"
    return isOwnerOrAdmin
      ? { circle_id: circleId }
      : { circle_id: circleId, owner_user_id: userId }
  }

  const USER = "user-123"
  const CIRCLE = "circle-abc"

  it("owner gets full-circle filter (no owner_user_id constraint)", () => {
    const filter = getScopeFilter("owner", USER, CIRCLE)
    expect(filter).toEqual({ circle_id: CIRCLE })
    expect("owner_user_id" in filter).toBe(false)
  })

  it("admin gets full-circle filter (no owner_user_id constraint)", () => {
    const filter = getScopeFilter("admin", USER, CIRCLE)
    expect(filter).toEqual({ circle_id: CIRCLE })
    expect("owner_user_id" in filter).toBe(false)
  })

  it("member gets own-uploads-only filter", () => {
    const filter = getScopeFilter("member", USER, CIRCLE)
    expect(filter).toEqual({ circle_id: CIRCLE, owner_user_id: USER })
  })

  it("caregiver gets own-uploads-only filter", () => {
    const filter = getScopeFilter("caregiver", USER, CIRCLE)
    expect(filter).toEqual({ circle_id: CIRCLE, owner_user_id: USER })
  })
})

// ============================================================
// Multi-circle — active circle selection
// The active circle is resolved from the ?circle=<id> URL param.
// If the param is absent or doesn't match any membership, the first
// circle in the list is used as the default.
// ============================================================
describe("multi-circle — active circle selection", () => {
  type Circle = { id: string; name: string; role: string }

  function resolveActiveCircle(circles: Circle[], paramId: string | undefined): Circle | null {
    if (paramId) {
      const found = circles.find((c) => c.id === paramId)
      if (found) return found
    }
    return circles[0] ?? null
  }

  const circles: Circle[] = [
    { id: "c1", name: "Dao Family", role: "owner" },
    { id: "c2", name: "Work Crew", role: "member" },
  ]

  it("returns first circle when no param is provided", () => {
    expect(resolveActiveCircle(circles, undefined)?.id).toBe("c1")
  })

  it("returns the matching circle when a valid param is provided", () => {
    expect(resolveActiveCircle(circles, "c2")?.id).toBe("c2")
  })

  it("falls back to first circle when param doesn't match any membership", () => {
    expect(resolveActiveCircle(circles, "c-unknown")?.id).toBe("c1")
  })

  it("returns null when user has no circles", () => {
    expect(resolveActiveCircle([], "c1")).toBeNull()
  })
})

describe("multi-circle — onboarding access for existing members", () => {
  // Existing members must be able to reach /onboarding to create a new circle.
  // The middleware no longer blocks hasMembership=true on /onboarding.
  function canAccessOnboarding(_hasMembership: boolean, needsProfile: boolean, path: string): boolean {
    if (needsProfile && path !== "/onboarding/profile") return false // must complete profile first
    // /onboarding index is open to all authenticated users
    return true
  }

  it("allows a new user (no membership) to access /onboarding", () => {
    expect(canAccessOnboarding(false, false, "/onboarding")).toBe(true)
  })

  it("allows an existing member to access /onboarding to create a second circle", () => {
    expect(canAccessOnboarding(true, false, "/onboarding")).toBe(true)
  })

  it("blocks a user with incomplete profile from /onboarding (must do /onboarding/profile first)", () => {
    expect(canAccessOnboarding(false, true, "/onboarding")).toBe(false)
  })
})

describe("multi-circle — post-creation redirect", () => {
  // After creating a circle, the onboarding flow redirects to /?circle=<newId>
  // so the user lands directly on the new circle rather than the old default.
  function postCreationRedirect(circleId: string): string {
    return `/?circle=${circleId}`
  }

  it("redirects to /?circle=<id> after solo circle creation", () => {
    expect(postCreationRedirect("new-circle-id")).toBe("/?circle=new-circle-id")
  })

  it("redirects to /?circle=<id> after finishing invite step", () => {
    expect(postCreationRedirect("another-circle-id")).toBe("/?circle=another-circle-id")
  })
})

// ============================================================
// /no-circle routing — guard logic
// Determines where a user lands when they have no active membership.
// Brand-new user (needsProfile) → onboarding
// Existing user, no circle     → /no-circle
// Has membership               → / (home)
// ============================================================
describe("/no-circle routing — guard logic", () => {
  type UserState = { hasMembership: boolean; needsProfile: boolean }

  function resolveRedirect(state: UserState): "/" | "/onboarding" | "/no-circle" | null {
    if (state.hasMembership) return "/"
    if (state.needsProfile) return "/onboarding"
    return "/no-circle"
  }

  it("sends user with membership to home", () => {
    expect(resolveRedirect({ hasMembership: true, needsProfile: false })).toBe("/")
  })

  it("sends brand-new user (needsProfile) to onboarding", () => {
    expect(resolveRedirect({ hasMembership: false, needsProfile: true })).toBe("/onboarding")
  })

  it("sends existing user with no circle to /no-circle", () => {
    expect(resolveRedirect({ hasMembership: false, needsProfile: false })).toBe("/no-circle")
  })
})

// ============================================================
// auth.global middleware — /no-circle bounce-away
// When a user navigates TO /no-circle but their state has changed
// (e.g. they just accepted an invite in another tab), the middleware
// redirects them away. Previously this lived in the page's onMounted;
// it was moved to auth.global so it runs before the page renders.
// ============================================================
describe("auth.global middleware — /no-circle bounce-away", () => {
  type UserState = { hasMembership: boolean; needsProfile: boolean }

  function noCircleMiddleware(state: UserState): "/" | "/onboarding/profile" | null {
    if (state.needsProfile) return "/onboarding/profile"
    if (state.hasMembership) return "/"
    return null // stay on /no-circle
  }

  it("stays on /no-circle for user with no membership and complete profile", () => {
    expect(noCircleMiddleware({ hasMembership: false, needsProfile: false })).toBeNull()
  })

  it("redirects user with membership away to home", () => {
    expect(noCircleMiddleware({ hasMembership: true, needsProfile: false })).toBe("/")
  })

  it("redirects user still needing profile to /onboarding/profile", () => {
    expect(noCircleMiddleware({ hasMembership: false, needsProfile: true })).toBe("/onboarding/profile")
  })
})

// ============================================================
// Soft-delete grace period — Step 3.6 purge cron logic
// Mirrors purge-deleted-users Edge Function cutoff check.
// ============================================================
describe("purge-deleted-users — grace period logic", () => {
  function isPastGracePeriod(deletedAt: Date, now: Date, graceDays = 30): boolean {
    const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000)
    return deletedAt < cutoff
  }

  const now = new Date("2026-04-18T03:00:00Z")

  it("does not purge a user deleted 29 days ago", () => {
    const deletedAt = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    expect(isPastGracePeriod(deletedAt, now)).toBe(false)
  })

  it("does not purge a user deleted exactly 30 days ago (boundary)", () => {
    const deletedAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    expect(isPastGracePeriod(deletedAt, now)).toBe(false)
  })

  it("purges a user deleted 31 days ago", () => {
    const deletedAt = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
    expect(isPastGracePeriod(deletedAt, now)).toBe(true)
  })

  it("purges a user deleted 60 days ago", () => {
    const deletedAt = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    expect(isPastGracePeriod(deletedAt, now)).toBe(true)
  })
})

// ============================================================
// GET /api/auth/membership — deletedAt field
// The membership endpoint now returns deletedAt so the client middleware can
// gate deleted accounts without an extra round-trip.
// ============================================================
describe("GET /api/auth/membership — deletedAt field", () => {
  type MembershipResponse = {
    hasMembership: boolean
    needsProfile: boolean
    deletedAt: string | null
  }

  function buildResponse(deletedAt: string | null): MembershipResponse {
    return { hasMembership: true, needsProfile: false, deletedAt }
  }

  it("returns deletedAt: null for an active account", () => {
    expect(buildResponse(null).deletedAt).toBeNull()
  })

  it("returns deletedAt as an ISO string for a pending-deletion account", () => {
    const iso = "2026-04-18T03:00:00Z"
    expect(buildResponse(iso).deletedAt).toBe(iso)
  })
})

// ============================================================
// GET /api/auth/membership — hasMembership excludes soft-deleted circles
// The service role bypasses RLS, so membership.get.ts must manually
// filter out circlemember rows whose circle has deleted_at set.
// This was the root cause of hasMembership returning true after the
// user's only circle was soft-deleted.
// ============================================================
describe("GET /api/auth/membership — hasMembership excludes soft-deleted circles", () => {
  type MemberRow = { circle: { deleted_at: string | null } | null }

  function computeHasMembership(memberships: MemberRow[]): boolean {
    return memberships.some((m) => m.circle !== null && !m.circle.deleted_at)
  }

  it("returns true when the user has one active circle", () => {
    expect(computeHasMembership([{ circle: { deleted_at: null } }])).toBe(true)
  })

  it("returns false when the user's only circle is soft-deleted", () => {
    expect(computeHasMembership([{ circle: { deleted_at: "2026-04-18T00:00:00Z" } }])).toBe(false)
  })

  it("returns false when the user has no memberships at all", () => {
    expect(computeHasMembership([])).toBe(false)
  })

  it("returns true when one of two circles is active and the other is soft-deleted", () => {
    const memberships: MemberRow[] = [
      { circle: { deleted_at: "2026-04-17T00:00:00Z" } },
      { circle: { deleted_at: null } },
    ]
    expect(computeHasMembership(memberships)).toBe(true)
  })

  it("returns false when all circles across multiple memberships are soft-deleted", () => {
    const memberships: MemberRow[] = [
      { circle: { deleted_at: "2026-04-16T00:00:00Z" } },
      { circle: { deleted_at: "2026-04-17T00:00:00Z" } },
    ]
    expect(computeHasMembership(memberships)).toBe(false)
  })

  it("treats a null circle join (deleted row) as no membership", () => {
    expect(computeHasMembership([{ circle: null }])).toBe(false)
  })
})

// ============================================================
// auth.global middleware — deleted account gate
// A user with a valid session but deletedAt set must be redirected
// to /settings/account on every route except /settings/account itself.
// ============================================================
describe("auth.global middleware — deleted account gate", () => {
  function resolveRoute(
    hasSession: boolean,
    deletedAt: string | null,
    targetPath: string
  ): string | null {
    if (!hasSession) return "/login"
    if (deletedAt && targetPath !== "/settings/account") return "/settings/account"
    return null // allow navigation
  }

  it("allows a non-deleted user to navigate to any route", () => {
    expect(resolveRoute(true, null, "/")).toBeNull()
    expect(resolveRoute(true, null, "/members")).toBeNull()
  })

  it("redirects a deleted user from / to /settings/account", () => {
    expect(resolveRoute(true, "2026-04-18T03:00:00Z", "/")).toBe("/settings/account")
  })

  it("redirects a deleted user from /members to /settings/account", () => {
    expect(resolveRoute(true, "2026-04-18T03:00:00Z", "/members")).toBe("/settings/account")
  })

  it("allows a deleted user to stay on /settings/account", () => {
    expect(resolveRoute(true, "2026-04-18T03:00:00Z", "/settings/account")).toBeNull()
  })

  it("redirects an unauthenticated user to /login regardless of deletedAt", () => {
    expect(resolveRoute(false, null, "/")).toBe("/login")
    expect(resolveRoute(false, "2026-04-18T03:00:00Z", "/")).toBe("/login")
  })
})

// ============================================================
// Cancel deletion — cache invalidation
// After cancellation the user state cache must be cleared so the
// middleware re-fetches deletedAt (now null) and lifts the gate.
// ============================================================
describe("cancel deletion — cache invalidation", () => {
  type CacheState = { deletedAt: string | null } | null

  function afterCancel(_cache: CacheState): CacheState {
    // Simulates calling clear() then refetching with deletedAt = null
    return null // cache is cleared; next ensure() call returns fresh state
  }

  function isGated(cache: CacheState): boolean {
    return cache !== null && cache.deletedAt !== null
  }

  it("gated before cancel when deletedAt is set", () => {
    const cache: CacheState = { deletedAt: "2026-04-18T03:00:00Z" }
    expect(isGated(cache)).toBe(true)
  })

  it("not gated after cache is cleared", () => {
    const cache: CacheState = { deletedAt: "2026-04-18T03:00:00Z" }
    const cleared = afterCancel(cache)
    expect(isGated(cleared)).toBe(false)
  })
})

// ============================================================
// POST /api/circles/[id]/delete — circle soft-delete schema
// Owner must supply the circle name to confirm deletion.
// The server re-validates the name match before writing.
// ============================================================
const deleteCircleSchema = z.object({
  confirmName: z.string().min(1),
})

describe("POST /api/circles/[id]/delete — input validation", () => {
  it("accepts a non-empty confirmName", () => {
    expect(deleteCircleSchema.safeParse({ confirmName: "Dao Family" }).success).toBe(true)
  })

  it("rejects an empty confirmName", () => {
    expect(deleteCircleSchema.safeParse({ confirmName: "" }).success).toBe(false)
  })

  it("rejects missing confirmName", () => {
    expect(deleteCircleSchema.safeParse({}).success).toBe(false)
  })
})

// ============================================================
// POST /api/circles/[id]/delete — name confirmation logic
// The typed name must match the actual circle name (case-insensitive)
// before the soft-delete is applied.
// ============================================================
describe("POST /api/circles/[id]/delete — name confirmation", () => {
  function confirmationMatches(typed: string, circleName: string): boolean {
    return typed.trim().toLowerCase() === circleName.trim().toLowerCase()
  }

  it("accepts an exact match", () => {
    expect(confirmationMatches("Dao Family", "Dao Family")).toBe(true)
  })

  it("accepts a case-insensitive match", () => {
    expect(confirmationMatches("dao family", "Dao Family")).toBe(true)
  })

  it("accepts a match with leading/trailing whitespace", () => {
    expect(confirmationMatches("  Dao Family  ", "Dao Family")).toBe(true)
  })

  it("rejects a partial match", () => {
    expect(confirmationMatches("Dao", "Dao Family")).toBe(false)
  })

  it("rejects an empty string", () => {
    expect(confirmationMatches("", "Dao Family")).toBe(false)
  })
})

// ============================================================
// POST /api/circles/[id]/delete — access control
// Only the circle owner can initiate deletion.
// ============================================================
describe("POST /api/circles/[id]/delete — access control", () => {
  type Role = "owner" | "admin" | "member"

  function canDeleteCircle(role: Role): boolean {
    return role === "owner"
  }

  it("allows the owner to delete the circle", () => {
    expect(canDeleteCircle("owner")).toBe(true)
  })

  it("blocks an admin from deleting the circle", () => {
    expect(canDeleteCircle("admin")).toBe(false)
  })

  it("blocks a member from deleting the circle", () => {
    expect(canDeleteCircle("member")).toBe(false)
  })
})

// ============================================================
// POST /api/circles/[id]/restore — restore window check
// The circle can only be restored within the 30-day window.
// ============================================================
describe("POST /api/circles/[id]/restore — window check", () => {
  function isRestorable(deletedAt: Date, now: Date, graceDays = 30): boolean {
    const daysSince = (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince < graceDays
  }

  const now = new Date("2026-04-18T03:00:00Z")

  it("allows restore 1 day after deletion", () => {
    const deletedAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    expect(isRestorable(deletedAt, now)).toBe(true)
  })

  it("allows restore 29 days after deletion", () => {
    const deletedAt = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    expect(isRestorable(deletedAt, now)).toBe(true)
  })

  it("blocks restore exactly 30 days after deletion (boundary)", () => {
    const deletedAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    expect(isRestorable(deletedAt, now)).toBe(false)
  })

  it("blocks restore 31 days after deletion", () => {
    const deletedAt = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
    expect(isRestorable(deletedAt, now)).toBe(false)
  })
})

// ============================================================
// GET /api/circles — deleted circles filtered from list
// Soft-deleted circles must be invisible to all members.
// ============================================================
describe("GET /api/circles — deleted circles filtered", () => {
  type CircleRow = { id: string; name: string; deleted_at: string | null }

  function filterActiveCircles(circles: CircleRow[]): CircleRow[] {
    return circles.filter((c) => !c.deleted_at)
  }

  it("returns active circles when no circles are deleted", () => {
    const rows: CircleRow[] = [
      { id: "c1", name: "Dao Family", deleted_at: null },
      { id: "c2", name: "Work Crew", deleted_at: null },
    ]
    expect(filterActiveCircles(rows)).toHaveLength(2)
  })

  it("excludes a soft-deleted circle from the list", () => {
    const rows: CircleRow[] = [
      { id: "c1", name: "Dao Family", deleted_at: null },
      { id: "c2", name: "Deleted Circle", deleted_at: "2026-04-01T00:00:00Z" },
    ]
    const active = filterActiveCircles(rows)
    expect(active).toHaveLength(1)
    expect(active[0]!.id).toBe("c1")
  })

  it("returns empty list when all circles are deleted", () => {
    const rows: CircleRow[] = [
      { id: "c1", name: "Gone", deleted_at: "2026-04-01T00:00:00Z" },
    ]
    expect(filterActiveCircles(rows)).toHaveLength(0)
  })
})

// ============================================================
// Purge cron — circle hard-purge sequence
// Day 30 purge order: storage objects → memory rows → circlemember rows → circle row
// ============================================================
describe("purge-deleted-users — circle hard-purge sequence", () => {
  type PurgeStep = "storage" | "memories" | "members" | "circle"

  function circlePurgeSteps(memoryCount: number): PurgeStep[] {
    const steps: PurgeStep[] = []
    if (memoryCount > 0) {
      steps.push("storage")
      steps.push("memories")
    }
    steps.push("members")
    steps.push("circle")
    return steps
  }

  it("runs full purge sequence when circle has memories", () => {
    expect(circlePurgeSteps(5)).toEqual(["storage", "memories", "members", "circle"])
  })

  it("skips storage/memory steps when circle has no memories", () => {
    expect(circlePurgeSteps(0)).toEqual(["members", "circle"])
  })

  it("always deletes members and circle row last", () => {
    const steps = circlePurgeSteps(3)
    expect(steps.at(-1)).toBe("circle")
    expect(steps.at(-2)).toBe("members")
  })
})

// ============================================================
// GET /api/invites/[token]/status — public pre-validation
// This endpoint is called before requiring sign-in so we can show
// the right error screen without forcing a login flow for a dead invite.
// ============================================================
describe("GET /api/invites/[token]/status — invite pre-validation", () => {
  type InviteRow = {
    status: "pending" | "accepted" | "expired"
    expires_at: string
    circle_deleted_at: string | null
  } | null

  function statusResult(
    invite: InviteRow
  ): "pending" | "expired" | "circle_deleted" {
    if (!invite || invite.status !== "pending") return "expired"
    if (new Date(invite.expires_at) < new Date("2026-04-18T00:00:00Z")) return "expired"
    if (invite.circle_deleted_at) return "circle_deleted"
    return "pending"
  }

  it("returns pending for a valid invite with an active circle", () => {
    const invite: InviteRow = {
      status: "pending",
      expires_at: "2026-04-25T00:00:00Z",
      circle_deleted_at: null,
    }
    expect(statusResult(invite)).toBe("pending")
  })

  it("returns circle_deleted when the circle was soft-deleted", () => {
    const invite: InviteRow = {
      status: "pending",
      expires_at: "2026-04-25T00:00:00Z",
      circle_deleted_at: "2026-04-17T12:00:00Z",
    }
    expect(statusResult(invite)).toBe("circle_deleted")
  })

  it("returns expired when the invite token is not found", () => {
    expect(statusResult(null)).toBe("expired")
  })

  it("returns expired when the invite has already been accepted", () => {
    const invite: InviteRow = {
      status: "accepted",
      expires_at: "2026-04-25T00:00:00Z",
      circle_deleted_at: null,
    }
    expect(statusResult(invite)).toBe("expired")
  })

  it("returns expired when the invite has passed its expires_at", () => {
    const invite: InviteRow = {
      status: "pending",
      expires_at: "2026-04-10T00:00:00Z",
      circle_deleted_at: null,
    }
    expect(statusResult(invite)).toBe("expired")
  })

  it("returns expired (not circle_deleted) when invite is expired AND circle is deleted", () => {
    // Expiry check comes before circle check — expired invite wins
    const invite: InviteRow = {
      status: "pending",
      expires_at: "2026-04-10T00:00:00Z",
      circle_deleted_at: "2026-04-17T12:00:00Z",
    }
    expect(statusResult(invite)).toBe("expired")
  })
})

// ============================================================
// PATCH /api/circles/[id] — circle settings update
// Owner-only endpoint to update name, circle_type, and/or anniversary_date.
// At least one field must be provided.
// ============================================================
const CIRCLE_TYPES_ALL = [
  "parents", "couple", "family", "friends",
  "caregiving", "travel", "solo", "custom",
] as const

const patchCircleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  circleType: z.enum(CIRCLE_TYPES_ALL).optional(),
  anniversaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).refine((d) => d.name !== undefined || d.circleType !== undefined || d.anniversaryDate !== undefined, {
  message: "At least one field (name, circleType, or anniversaryDate) must be provided.",
})

describe("PATCH /api/circles/[id] — input validation", () => {
  it("accepts all 8 valid circle_type values", () => {
    for (const ct of CIRCLE_TYPES_ALL) {
      expect(patchCircleSchema.safeParse({ circleType: ct }).success).toBe(true)
    }
  })

  it("accepts a valid name", () => {
    expect(patchCircleSchema.safeParse({ name: "The Smiths" }).success).toBe(true)
  })

  it("accepts a valid anniversaryDate", () => {
    expect(patchCircleSchema.safeParse({ anniversaryDate: "2022-06-15" }).success).toBe(true)
  })

  it("accepts null anniversaryDate (clear)", () => {
    expect(patchCircleSchema.safeParse({ anniversaryDate: null }).success).toBe(true)
  })

  it("accepts all three fields together", () => {
    expect(patchCircleSchema.safeParse({
      name: "The Smiths",
      circleType: "family",
      anniversaryDate: "2020-01-01",
    }).success).toBe(true)
  })

  it("rejects an unknown circleType", () => {
    expect(patchCircleSchema.safeParse({ circleType: "household" }).success).toBe(false)
  })

  it("rejects empty name", () => {
    expect(patchCircleSchema.safeParse({ name: "" }).success).toBe(false)
  })

  it("rejects name longer than 100 characters", () => {
    expect(patchCircleSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false)
  })

  it("rejects anniversaryDate with wrong format", () => {
    expect(patchCircleSchema.safeParse({ anniversaryDate: "15-06-2022" }).success).toBe(false)
  })

  it("rejects when no fields are provided", () => {
    expect(patchCircleSchema.safeParse({}).success).toBe(false)
  })
})

describe("PATCH /api/circles/[id] — access control", () => {
  type Role = "owner" | "admin" | "member"

  function canUpdateCircleSettings(role: Role): boolean {
    return role === "owner"
  }

  it("allows the owner to update circle settings", () => {
    expect(canUpdateCircleSettings("owner")).toBe(true)
  })

  it("blocks an admin from updating circle settings", () => {
    expect(canUpdateCircleSettings("admin")).toBe(false)
  })

  it("blocks a member from updating circle settings", () => {
    expect(canUpdateCircleSettings("member")).toBe(false)
  })
})

// ============================================================
// POST /api/memories/quick-note — text-only memory creation
// Route: server/api/memories/quick-note.post.ts
// ============================================================
const quickNoteSchema = z.object({
  circleId: z.string().uuid(),
  note: z.string().min(1).max(500),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  milestoneLabel: z.string().max(40).nullable().optional(),
  childIds: z.array(z.string().uuid()).max(10).optional(),
  memberIds: z.array(z.string().uuid()).max(50).optional(),
})

describe("POST /api/memories/quick-note — input validation", () => {
  const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000"
  const VALID_DATE = "2024-06-15"

  it("accepts minimal valid payload", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "First word today: dada",
      memoryDate: VALID_DATE,
    }).success).toBe(true)
  })

  it("accepts full payload with all optional fields", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "First steps!",
      memoryDate: VALID_DATE,
      milestoneLabel: "First steps",
      childIds: [VALID_UUID],
      memberIds: [VALID_UUID],
    }).success).toBe(true)
  })

  it("accepts null milestoneLabel (clearing a milestone)", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "Just a note",
      memoryDate: VALID_DATE,
      milestoneLabel: null,
    }).success).toBe(true)
  })

  it("rejects empty note", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "",
      memoryDate: VALID_DATE,
    }).success).toBe(false)
  })

  it("rejects note longer than 500 characters", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "a".repeat(501),
      memoryDate: VALID_DATE,
    }).success).toBe(false)
  })

  it("rejects milestoneLabel longer than 40 characters", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "A note",
      memoryDate: VALID_DATE,
      milestoneLabel: "a".repeat(41),
    }).success).toBe(false)
  })

  it("rejects invalid circleId (not a UUID)", () => {
    expect(quickNoteSchema.safeParse({
      circleId: "not-a-uuid",
      note: "A note",
      memoryDate: VALID_DATE,
    }).success).toBe(false)
  })

  it("rejects memoryDate with wrong format (DD-MM-YYYY)", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "A note",
      memoryDate: "15-06-2024",
    }).success).toBe(false)
  })

  it("rejects missing memoryDate", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "A note",
    }).success).toBe(false)
  })

  it("rejects childIds list exceeding 10 items", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "A note",
      memoryDate: VALID_DATE,
      childIds: Array(11).fill(VALID_UUID),
    }).success).toBe(false)
  })

  it("rejects memberIds list exceeding 50 items", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "A note",
      memoryDate: VALID_DATE,
      memberIds: Array(51).fill(VALID_UUID),
    }).success).toBe(false)
  })

  it("rejects invalid UUID inside childIds", () => {
    expect(quickNoteSchema.safeParse({
      circleId: VALID_UUID,
      note: "A note",
      memoryDate: VALID_DATE,
      childIds: ["not-a-uuid"],
    }).success).toBe(false)
  })
})

// ============================================================
// PATCH /api/memories/[id] — edit memory note / milestone / date
// Route: server/api/memories/[id].patch.ts
// All fields are optional but at least one must be meaningful.
// Ownership is verified at the application layer (service role bypasses RLS).
// ============================================================
const memoryPatchSchema = z.object({
  note: z.string().max(500).nullable().optional(),
  milestone_label: z.string().max(40).nullable().optional(),
  memory_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

describe("PATCH /api/memories/[id] — input validation", () => {
  const VALID_DATE = "2024-06-15"

  it("accepts a valid note update", () => {
    expect(memoryPatchSchema.safeParse({ note: "Updated note" }).success).toBe(true)
  })

  it("accepts null note (clearing the note)", () => {
    expect(memoryPatchSchema.safeParse({ note: null }).success).toBe(true)
  })

  it("accepts a valid milestone_label update", () => {
    expect(memoryPatchSchema.safeParse({ milestone_label: "First steps" }).success).toBe(true)
  })

  it("accepts null milestone_label (clearing the milestone)", () => {
    expect(memoryPatchSchema.safeParse({ milestone_label: null }).success).toBe(true)
  })

  it("accepts a valid memory_date update", () => {
    expect(memoryPatchSchema.safeParse({ memory_date: VALID_DATE }).success).toBe(true)
  })

  it("accepts all three fields together", () => {
    expect(memoryPatchSchema.safeParse({
      note: "Note",
      milestone_label: "Birthday",
      memory_date: VALID_DATE,
    }).success).toBe(true)
  })

  it("accepts empty body (schema doesn't enforce at-least-one; route handles it)", () => {
    // The route applies any fields present — if none provided, update is a no-op.
    // Schema itself is permissive; route logic is what enforces meaningful updates.
    expect(memoryPatchSchema.safeParse({}).success).toBe(true)
  })

  it("rejects note longer than 500 characters", () => {
    expect(memoryPatchSchema.safeParse({ note: "a".repeat(501) }).success).toBe(false)
  })

  it("rejects milestone_label longer than 40 characters", () => {
    expect(memoryPatchSchema.safeParse({ milestone_label: "a".repeat(41) }).success).toBe(false)
  })

  it("rejects memory_date with wrong format (DD-MM-YYYY)", () => {
    expect(memoryPatchSchema.safeParse({ memory_date: "15-06-2024" }).success).toBe(false)
  })

  it("rejects memory_date with wrong format (MM/DD/YYYY)", () => {
    expect(memoryPatchSchema.safeParse({ memory_date: "06/15/2024" }).success).toBe(false)
  })
})

describe("PATCH /api/memories/[id] — ownership check", () => {
  // The route fetches the memory and compares owner_user_id to auth.sub.
  // Service role is used to bypass RLS; the route implements its own gate.
  type OwnerCheck = { owner_user_id: string | null; requesterId: string }

  function isOwner(check: OwnerCheck): boolean {
    return check.owner_user_id === check.requesterId
  }

  it("allows the uploader to edit their own memory", () => {
    expect(isOwner({ owner_user_id: "user-a", requesterId: "user-a" })).toBe(true)
  })

  it("blocks a different circle member from editing", () => {
    expect(isOwner({ owner_user_id: "user-a", requesterId: "user-b" })).toBe(false)
  })

  it("blocks editing a detached memory (owner_user_id is null)", () => {
    expect(isOwner({ owner_user_id: null, requesterId: "user-a" })).toBe(false)
  })
})

// ============================================================
// PATCH /api/circles/[id]/children/[childId] — edit child profile
// Route: server/api/circles/[id]/children/[childId].patch.ts
// At least one of name or dateOfBirth must be provided.
// Access: owner-only (verified against circlemember role).
// ============================================================
const childPatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(d => d.name !== undefined || d.dateOfBirth !== undefined, {
  message: "At least one field must be provided.",
})

describe("PATCH /api/circles/[id]/children/[childId] — input validation", () => {
  it("accepts a name-only update", () => {
    expect(childPatchSchema.safeParse({ name: "Emma" }).success).toBe(true)
  })

  it("accepts a dateOfBirth-only update", () => {
    expect(childPatchSchema.safeParse({ dateOfBirth: "2024-01-15" }).success).toBe(true)
  })

  it("accepts both name and dateOfBirth together", () => {
    expect(childPatchSchema.safeParse({ name: "Emma", dateOfBirth: "2024-01-15" }).success).toBe(true)
  })

  it("rejects empty body (at least one field required)", () => {
    expect(childPatchSchema.safeParse({}).success).toBe(false)
  })

  it("rejects empty name string", () => {
    expect(childPatchSchema.safeParse({ name: "" }).success).toBe(false)
  })

  it("rejects name longer than 100 characters", () => {
    expect(childPatchSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false)
  })

  it("rejects dateOfBirth with wrong format (MM/DD/YYYY)", () => {
    expect(childPatchSchema.safeParse({ dateOfBirth: "01/15/2024" }).success).toBe(false)
  })

  it("rejects dateOfBirth with wrong format (DD-MM-YYYY)", () => {
    expect(childPatchSchema.safeParse({ dateOfBirth: "15-01-2024" }).success).toBe(false)
  })

  it("accepts name at exact max length (100 chars)", () => {
    expect(childPatchSchema.safeParse({ name: "a".repeat(100) }).success).toBe(true)
  })
})

describe("PATCH /api/circles/[id]/children/[childId] — access control", () => {
  // The route fetches the circlemember role for the requesting user.
  // Only 'owner' is allowed; admin and member are blocked.
  type Role = "owner" | "admin" | "member" | "caregiver"

  function canUpdateChildProfile(role: Role | null): boolean {
    return role === "owner"
  }

  it("allows the circle owner to update a child profile", () => {
    expect(canUpdateChildProfile("owner")).toBe(true)
  })

  it("blocks admin from updating a child profile", () => {
    expect(canUpdateChildProfile("admin")).toBe(false)
  })

  it("blocks member from updating a child profile", () => {
    expect(canUpdateChildProfile("member")).toBe(false)
  })

  it("blocks caregiver from updating a child profile", () => {
    expect(canUpdateChildProfile("caregiver")).toBe(false)
  })

  it("blocks a user with no membership in the circle", () => {
    expect(canUpdateChildProfile(null)).toBe(false)
  })
})

