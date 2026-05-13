/**
 * useCircleTypeConfig composable tests
 *
 * Verifies that each supported circle_type returns the correct
 * per-type content (empty state copy, milestone placeholder, milestone chips)
 * and that unknown/null/undefined types fall back to the default config.
 *
 * These rules come from build plan §4.9: "circle_type is a purely UX/marketing
 * signal — sets copy, chips, and empty state only."
 */

import { describe, it, expect } from 'vitest'
import { useCircleTypeConfig } from '../app/composables/useCircleTypeConfig'

const ALL_CIRCLE_TYPES = [
  'parents',
  'couple',
  'family',
  'friends',
  'caregiving',
  'travel',
  'solo',
] as const

// ── Known types return non-empty config ──────────────────────────────────────

describe('useCircleTypeConfig — all known types return non-empty config', () => {
  for (const type of ALL_CIRCLE_TYPES) {
    it(`returns a config for "${type}"`, () => {
      const cfg = useCircleTypeConfig(type)
      expect(cfg.emptyTitle).toBeTruthy()
      expect(cfg.emptyDesc).toBeTruthy()
      expect(cfg.milestonePlaceholder).toBeTruthy()
      expect(cfg.milestoneShort).toBeTruthy()
    })
  }
})

// ── Per-type spot-checks ─────────────────────────────────────────────────────

describe('useCircleTypeConfig — parents type', () => {
  it('has family/baby-focused empty title', () => {
    const { emptyTitle } = useCircleTypeConfig('parents')
    expect(emptyTitle).toMatch(/milestone/i)
  })

  it('has at least 3 milestone chips', () => {
    const { milestoneChips } = useCircleTypeConfig('parents')
    expect(milestoneChips.length).toBeGreaterThanOrEqual(3)
  })

  it("includes 'First steps' in milestone chips", () => {
    const { milestoneChips } = useCircleTypeConfig('parents')
    expect(milestoneChips).toContain('First steps')
  })
})

describe('useCircleTypeConfig — couple type', () => {
  it('has relationship-focused empty title', () => {
    const { emptyTitle } = useCircleTypeConfig('couple')
    expect(emptyTitle).toBeTruthy()
  })

  it('includes anniversary-related chip', () => {
    const { milestoneChips } = useCircleTypeConfig('couple')
    const hasAnniversary = milestoneChips.some((c) =>
      /anniversary|engaged|wedding/i.test(c),
    )
    expect(hasAnniversary).toBe(true)
  })
})

describe('useCircleTypeConfig — solo type', () => {
  it('has personal-focused empty title', () => {
    const { emptyTitle } = useCircleTypeConfig('solo')
    expect(emptyTitle).toBeTruthy()
  })

  it('has at least 3 milestone chips', () => {
    const { milestoneChips } = useCircleTypeConfig('solo')
    expect(milestoneChips.length).toBeGreaterThanOrEqual(3)
  })
})

// ── Fallback behaviour ────────────────────────────────────────────────────────

describe('useCircleTypeConfig — fallback for unknown/missing types', () => {
  it('returns fallback config for unknown type', () => {
    const cfg = useCircleTypeConfig('household')
    expect(cfg.emptyTitle).toBeTruthy()
    expect(cfg.emptyDesc).toBeTruthy()
  })

  it('returns fallback config for null', () => {
    const cfg = useCircleTypeConfig(null)
    expect(cfg.emptyTitle).toBeTruthy()
  })

  it('returns fallback config for undefined', () => {
    const cfg = useCircleTypeConfig(undefined)
    expect(cfg.emptyTitle).toBeTruthy()
  })

  it('returns fallback config for empty string', () => {
    const cfg = useCircleTypeConfig('')
    expect(cfg.emptyTitle).toBeTruthy()
  })

  it('fallback returns an empty milestoneChips array (no spurious chips)', () => {
    const { milestoneChips } = useCircleTypeConfig('unknown-type')
    expect(milestoneChips).toEqual([])
  })
})

// ── 'custom' type ─────────────────────────────────────────────────────────────

describe('useCircleTypeConfig — custom type falls back to default', () => {
  it("returns fallback config for 'custom' (no dedicated config)", () => {
    // 'custom' is a valid circleType in the API but has no specialised copy
    const cfg = useCircleTypeConfig('custom')
    expect(cfg.emptyTitle).toBeTruthy()
    // custom has no chips
    expect(cfg.milestoneChips).toEqual([])
  })
})

// ── Shape contract ────────────────────────────────────────────────────────────

describe('useCircleTypeConfig — returned object shape', () => {
  it('always returns all required fields', () => {
    for (const type of [...ALL_CIRCLE_TYPES, 'custom', null, undefined]) {
      const cfg = useCircleTypeConfig(type as string | null | undefined)
      expect(typeof cfg.emptyTitle).toBe('string')
      expect(typeof cfg.emptyDesc).toBe('string')
      expect(typeof cfg.milestonePlaceholder).toBe('string')
      expect(typeof cfg.milestoneShort).toBe('string')
      expect(Array.isArray(cfg.milestoneChips)).toBe(true)
    }
  })

  it('milestoneShort always contains the sparkle marker', () => {
    for (const type of ALL_CIRCLE_TYPES) {
      const { milestoneShort } = useCircleTypeConfig(type)
      expect(milestoneShort).toContain('✦')
    }
  })
})
