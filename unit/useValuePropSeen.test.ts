/**
 * useValuePropSeen composable tests
 *
 * The value proposition screens (build plan §4.4) are shown exactly once,
 * on the user's first visit to /onboarding before any circle exists.
 * The "seen" state is persisted in localStorage so it survives a page refresh
 * but resets if the user clears storage (acceptable — they'll just see it again).
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { useValuePropSeen } from "../app/composables/useValuePropSeen"

// ── localStorage stub (Node environment has no localStorage) ──────────────────
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
}
vi.stubGlobal("localStorage", localStorageMock)

beforeEach(() => {
  localStorageMock.clear()
})

// ── hasSeen ───────────────────────────────────────────────────────────────────

describe("useValuePropSeen — hasSeen()", () => {
  it("returns false when localStorage has no entry", () => {
    const { hasSeen } = useValuePropSeen()
    expect(hasSeen()).toBe(false)
  })

  it("returns true after markAsSeen() is called", () => {
    const { hasSeen, markAsSeen } = useValuePropSeen()
    markAsSeen()
    expect(hasSeen()).toBe(true)
  })

  it("returns true when localStorage already contains the flag from a previous session", () => {
    localStorage.setItem("value_prop_seen", "1")
    const { hasSeen } = useValuePropSeen()
    expect(hasSeen()).toBe(true)
  })

  it("returns false when localStorage entry has been cleared", () => {
    const { hasSeen, markAsSeen } = useValuePropSeen()
    markAsSeen()
    localStorage.clear()
    expect(hasSeen()).toBe(false)
  })
})

// ── markAsSeen ────────────────────────────────────────────────────────────────

describe("useValuePropSeen — markAsSeen()", () => {
  it("persists the flag so a fresh composable instance sees it as seen", () => {
    const first = useValuePropSeen()
    first.markAsSeen()

    // Simulate a new component instance reading the same localStorage
    const second = useValuePropSeen()
    expect(second.hasSeen()).toBe(true)
  })

  it("is idempotent — calling it twice does not throw or break hasSeen", () => {
    const { hasSeen, markAsSeen } = useValuePropSeen()
    expect(() => {
      markAsSeen()
      markAsSeen()
    }).not.toThrow()
    expect(hasSeen()).toBe(true)
  })
})
