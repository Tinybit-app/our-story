import { describe, it, expect } from "vitest"
import { buildPushPayload } from "../server/utils/pushNotify"

describe("buildPushPayload", () => {
  it("builds upload payload with note (singular)", () => {
    const payload = buildPushPayload({
      type: "upload",
      actorName: "Emma",
      circleId: "circle-1",
      actorUserId: "user-1",
      memoryId: "mem-1",
      bodyText: "First steps at the park",
      recentUploadCount: 1,
    })
    expect(payload.title).toBe("Emma added a memory")
    expect(payload.body).toBe("First steps at the park")
    expect(payload.tag).toBe("upload-circle-1-user-1")
    expect(payload.renotify).toBe(true)
    expect(payload.data.url).toBe("/timeline?circle=circle-1&memory=mem-1")
  })

  it("builds upload payload (plural, silent)", () => {
    const payload = buildPushPayload({
      type: "upload",
      actorName: "Emma",
      circleId: "circle-1",
      actorUserId: "user-1",
      memoryId: "mem-3",
      bodyText: null,
      recentUploadCount: 5,
    })
    expect(payload.title).toBe("Emma added 5 memories")
    expect(payload.body).toBe("Check out what's new")
    expect(payload.tag).toBe("upload-circle-1-user-1")
    expect(payload.renotify).toBe(false)
  })

  it("builds upload payload without note (singular)", () => {
    const payload = buildPushPayload({
      type: "upload",
      actorName: "Dad",
      circleId: "c-2",
      actorUserId: "u-2",
      memoryId: "m-2",
      bodyText: null,
      recentUploadCount: 1,
    })
    expect(payload.title).toBe("Dad added a memory")
    expect(payload.body).toBe("Shared a new memory")
  })

  it("builds comment payload", () => {
    const payload = buildPushPayload({
      type: "comment",
      actorName: "Mom",
      circleId: "c-1",
      actorUserId: "u-1",
      memoryId: "m-1",
      bodyText: "This is so cute!",
    })
    expect(payload.title).toBe("Mom commented")
    expect(payload.body).toBe("This is so cute!")
    expect(payload.tag).toBe("comment-c-1-u-1")
    expect(payload.renotify).toBe(true)
  })

  it("builds reaction payload", () => {
    const payload = buildPushPayload({
      type: "reaction",
      actorName: "Dad",
      circleId: "c-1",
      actorUserId: "u-1",
      memoryId: "m-1",
      emoji: "❤️",
    })
    expect(payload.title).toBe("Dad reacted ❤️")
    expect(payload.body).toBe("")
    expect(payload.tag).toBe("reaction-c-1-u-1")
    expect(payload.renotify).toBe(true)
  })

  it("truncates long body text to 100 chars", () => {
    const longText = "A".repeat(150)
    const payload = buildPushPayload({
      type: "comment",
      actorName: "Mom",
      circleId: "c-1",
      actorUserId: "u-1",
      memoryId: "m-1",
      bodyText: longText,
    })
    expect(payload.body.length).toBeLessThanOrEqual(103)
    expect(payload.body.endsWith("…")).toBe(true)
  })
})
