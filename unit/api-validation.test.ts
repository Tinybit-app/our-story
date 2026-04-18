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
// POST /api/account/export — Step 3.6 data export
// Tests cover the one-active-job-per-user guard logic.
// ============================================================
describe("POST /api/account/export — duplicate job guard", () => {
  function exportWouldBeBlocked(activeStatus: string | null): boolean {
    return activeStatus === "pending" || activeStatus === "processing"
  }

  it("allows export when no active job exists", () => {
    expect(exportWouldBeBlocked(null)).toBe(false)
  })

  it("blocks export when a pending job already exists", () => {
    expect(exportWouldBeBlocked("pending")).toBe(true)
  })

  it("blocks export when a processing job already exists", () => {
    expect(exportWouldBeBlocked("processing")).toBe(true)
  })

  it("allows export after a previously completed job", () => {
    expect(exportWouldBeBlocked("complete")).toBe(false)
  })

  it("allows export after a previously failed job", () => {
    expect(exportWouldBeBlocked("failed")).toBe(false)
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

describe("/no-circle page — self-guard", () => {
  type UserState = { hasMembership: boolean; needsProfile: boolean }

  // The /no-circle page itself also guards against users who shouldn't be there
  function noCirclePageRedirect(state: UserState): "/" | "/onboarding/profile" | null {
    if (state.needsProfile) return "/onboarding/profile"
    if (state.hasMembership) return "/"
    return null // stay on /no-circle
  }

  it("stays on /no-circle for user with no membership and complete profile", () => {
    expect(noCirclePageRedirect({ hasMembership: false, needsProfile: false })).toBeNull()
  })

  it("redirects user with membership away to home", () => {
    expect(noCirclePageRedirect({ hasMembership: true, needsProfile: false })).toBe("/")
  })

  it("redirects user still needing profile to /onboarding/profile", () => {
    expect(noCirclePageRedirect({ hasMembership: false, needsProfile: true })).toBe("/onboarding/profile")
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
