import { describe, it, expect } from "vitest"
import { z } from "zod"

const itemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draft"), draftMemoryId: z.uuid() }),
  z.object({ type: z.literal("text"), textContent: z.string().min(1).max(2000) }),
])

const uploadBatchSchema = z.object({
  circleId: z.uuid(),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  note: z.string().max(2000).nullable().optional(),
  milestoneLabel: z.string().max(40).nullable().optional(),
  childIds: z.array(z.uuid()).max(10).optional(),
  memberIds: z.array(z.uuid()).max(50).optional(),
  coverIndex: z.number().int().nonnegative().nullable().optional(),
  items: z.array(itemSchema).min(2).max(20),
})

describe("upload-batch schema", () => {
  const baseValid = {
    circleId: "11111111-2222-4333-8444-555555555555",
    memoryDate: "2026-05-09",
    items: [
      { type: "draft" as const, draftMemoryId: "11111111-2222-4333-8444-555555555556" },
      { type: "draft" as const, draftMemoryId: "11111111-2222-4333-8444-555555555557" },
    ],
  }

  it("accepts a valid batch with 2 photo drafts", () => {
    expect(uploadBatchSchema.safeParse(baseValid).success).toBe(true)
  })

  it("accepts mixed drafts + text items", () => {
    const r = uploadBatchSchema.safeParse({
      ...baseValid,
      items: [
        { type: "draft", draftMemoryId: "11111111-2222-4333-8444-555555555556" },
        { type: "text", textContent: "And then she smiled." },
      ],
    })
    expect(r.success).toBe(true)
  })

  it("rejects fewer than 2 items", () => {
    expect(
      uploadBatchSchema.safeParse({ ...baseValid, items: [baseValid.items[0]] }).success
    ).toBe(false)
  })

  it("rejects more than 20 items", () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      type: "text" as const,
      textContent: `Slide ${i}`,
    }))
    expect(uploadBatchSchema.safeParse({ ...baseValid, items }).success).toBe(false)
  })

  it("rejects invalid coverIndex (negative)", () => {
    const r = uploadBatchSchema.safeParse({ ...baseValid, coverIndex: -1 })
    expect(r.success).toBe(false)
  })

  it("rejects empty text content", () => {
    const r = uploadBatchSchema.safeParse({
      ...baseValid,
      items: [
        baseValid.items[0],
        { type: "text", textContent: "" },
      ],
    })
    expect(r.success).toBe(false)
  })
})
