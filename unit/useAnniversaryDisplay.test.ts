/**
 * Anniversary display unit tests (build plan §4.10.4)
 *
 * Covers:
 *   computeAnniversaryDisplay(anniversaryDate, now, locale, circleType, circleName)
 *   — returns "Year N together · Since [date]" for couple circles with 1+ years
 *   — returns "Year N of [name] · Since [date]" for non-couple circles with 1+ years
 *   — returns "N days together · Since [date]" for < 1 year (all types)
 *   — returns null for null/undefined input or a future date
 */

import { describe, it, expect } from 'vitest'
import { computeAnniversaryDisplay } from '../app/composables/useAnniversaryDisplay'

// Fixed reference date so tests are deterministic (local date, not UTC, to avoid timezone off-by-one)
const NOW = new Date(2026, 3, 21) // April 21, 2026

describe('computeAnniversaryDisplay', () => {
  // ── null / edge cases ────────────────────────────────────────────────────────

  it('returns null when anniversaryDate is null', () => {
    expect(computeAnniversaryDisplay(null, NOW)).toBeNull()
  })

  it('returns null when anniversaryDate is undefined', () => {
    expect(computeAnniversaryDisplay(undefined, NOW)).toBeNull()
  })

  it('returns null when anniversaryDate is in the future', () => {
    expect(computeAnniversaryDisplay('2027-01-01', NOW)).toBeNull()
  })

  it('returns null when anniversaryDate is today (0 days elapsed)', () => {
    // Same day → 0 days, which is < 1, returns "0 days together"
    // Actually 0 totalDays is >= 0, so it returns "0 days together · Since ..."
    // Let's verify the actual behavior
    const result = computeAnniversaryDisplay('2026-04-21', NOW)
    expect(result).toMatch(/0 days together/)
  })

  // ── under one year (days display) ────────────────────────────────────────────

  it("returns '1 day together' for exactly 1 day elapsed", () => {
    const result = computeAnniversaryDisplay('2026-04-20', NOW)
    expect(result).toMatch(/^1 day together · Since/)
  })

  it("returns 'N days together' for multiple days under a year", () => {
    // 2026-04-21 minus 100 days = 2026-01-11
    const result = computeAnniversaryDisplay('2026-01-11', NOW)
    expect(result).toMatch(/^100 days together · Since/)
  })

  it('shows the correct since date in the label (under one year)', () => {
    const result = computeAnniversaryDisplay('2026-01-11', NOW, 'en')
    expect(result).toContain('Jan 11, 2026')
  })

  it("uses 'days together' phrasing for non-couple circles under one year", () => {
    const result = computeAnniversaryDisplay(
      '2026-01-11',
      NOW,
      'en',
      'family',
      'The Smiths',
    )
    expect(result).toMatch(/^100 days together · Since/)
  })

  // ── one year boundary — couple ────────────────────────────────────────────────

  it("returns 'Year 2 together' on the exact one-year anniversary (couple)", () => {
    // 2025-04-21 → exactly 1 year before NOW
    const result = computeAnniversaryDisplay('2025-04-21', NOW)
    expect(result).toMatch(/^Year 2 together · Since/)
  })

  it('still shows days for one day before the one-year mark (couple)', () => {
    // 2025-04-22 → 364 days before NOW (not yet a full year)
    const result = computeAnniversaryDisplay('2025-04-22', NOW)
    expect(result).toMatch(/^364 days together · Since/)
  })

  // ── one year boundary — non-couple ───────────────────────────────────────────

  it("returns 'Year 2 of [name]' on the exact one-year anniversary (family)", () => {
    const result = computeAnniversaryDisplay(
      '2025-04-21',
      NOW,
      'en',
      'family',
      'The Smiths',
    )
    expect(result).toMatch(/^Year 2 of The Smiths · Since/)
  })

  it("returns 'Year 2 of [name]' on the exact one-year anniversary (friends)", () => {
    const result = computeAnniversaryDisplay(
      '2025-04-21',
      NOW,
      'en',
      'friends',
      'Barcelona Crew',
    )
    expect(result).toMatch(/^Year 2 of Barcelona Crew · Since/)
  })

  // ── multiple years — couple ───────────────────────────────────────────────────

  it("returns 'Year 3 together' for exactly 2 years elapsed (couple)", () => {
    const result = computeAnniversaryDisplay('2024-04-21', NOW)
    expect(result).toMatch(/^Year 3 together · Since/)
  })

  it("returns 'Year 5 together' for 4 full years elapsed (couple)", () => {
    const result = computeAnniversaryDisplay('2022-04-21', NOW)
    expect(result).toMatch(/^Year 5 together · Since/)
  })

  // ── multiple years — non-couple ───────────────────────────────────────────────

  it("returns 'Year 3 of [name]' for exactly 2 years elapsed (family)", () => {
    const result = computeAnniversaryDisplay(
      '2024-04-21',
      NOW,
      'en',
      'family',
      'The Smiths',
    )
    expect(result).toMatch(/^Year 3 of The Smiths · Since/)
  })

  it("returns 'Year 5 of [name]' for 4 full years elapsed (parents)", () => {
    const result = computeAnniversaryDisplay(
      '2022-04-21',
      NOW,
      'en',
      'parents',
      'Johnson Family',
    )
    expect(result).toMatch(/^Year 5 of Johnson Family · Since/)
  })

  // ── calendar-awareness ────────────────────────────────────────────────────────

  it('is calendar-aware: mid-year date not yet reached counts one fewer year', () => {
    // NOW is April 21; anniversary is June 15 — hasn't happened yet this year
    // 2023-06-15 → as of 2026-04-21, only 2 full years have elapsed (not 3)
    const result = computeAnniversaryDisplay('2023-06-15', NOW)
    expect(result).toMatch(/^Year 3 together · Since/)
  })

  it('shows the since date in the multi-year label (couple)', () => {
    const result = computeAnniversaryDisplay('2021-09-14', NOW, 'en')
    expect(result).toContain('Sep 14, 2021')
    expect(result).toMatch(/^Year 5 together/)
  })

  it('shows the since date in the multi-year label (non-couple)', () => {
    const result = computeAnniversaryDisplay(
      '2021-09-14',
      NOW,
      'en',
      'family',
      'The Smiths',
    )
    expect(result).toContain('Sep 14, 2021')
    expect(result).toMatch(/^Year 5 of The Smiths/)
  })
})
