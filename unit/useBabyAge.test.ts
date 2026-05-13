/**
 * Baby age stamp unit tests (build plan §4.10.1)
 *
 * Covers:
 *   computeBabyAge(dateOfBirth, memoryDate) — returns a human-readable age
 *   string like "3 months, 2 weeks", "2 weeks", "1 year, 4 months", or null
 *   (when memory predates birth).
 *
 * From design spec (§4.10.1):
 *   "Every memory card shows each child's age at time of photo ('Emma · 3 months, 2 weeks').
 *    Children are managed via the ChildProfile table (name + date_of_birth per child)."
 */

import { describe, it, expect } from 'vitest'
import { computeBabyAge } from '../app/composables/useBabyAge'

describe('computeBabyAge', () => {
  // ── null / edge cases ────────────────────────────────────────────────────────

  it('returns null when memory_date is before date_of_birth', () => {
    expect(computeBabyAge('2024-06-15', '2024-06-01')).toBeNull()
  })

  it("returns 'newborn' when memory_date equals date_of_birth (birth day)", () => {
    expect(computeBabyAge('2024-06-15', '2024-06-15')).toBe('newborn')
  })

  it('returns null when dateOfBirth is null', () => {
    expect(computeBabyAge(null, '2024-06-15')).toBeNull()
  })

  // ── days (first 2 weeks) ─────────────────────────────────────────────────────

  it("returns '1 day old' for 1 day after birth", () => {
    expect(computeBabyAge('2024-01-01', '2024-01-02')).toBe('1 day old')
  })

  it("returns '6 days old' for 6 days after birth", () => {
    expect(computeBabyAge('2024-01-01', '2024-01-07')).toBe('6 days old')
  })

  it("returns '13 days old' for 13 days after birth", () => {
    expect(computeBabyAge('2024-01-01', '2024-01-14')).toBe('13 days old')
  })

  // ── weeks (2 weeks – 1 month) ────────────────────────────────────────────────

  it("returns '2 weeks old' for 14 days after birth", () => {
    expect(computeBabyAge('2024-01-01', '2024-01-15')).toBe('2 weeks old')
  })

  it("returns '3 weeks old' for 21 days after birth", () => {
    expect(computeBabyAge('2024-01-01', '2024-01-22')).toBe('3 weeks old')
  })

  // ── months (1 month – 2 years) ───────────────────────────────────────────────

  it("returns '1 month old' for exactly 1 calendar month", () => {
    expect(computeBabyAge('2024-01-15', '2024-02-15')).toBe('1 month old')
  })

  it("returns '2 months, 1 week' for 2 months + 7 days", () => {
    expect(computeBabyAge('2024-01-01', '2024-03-08')).toBe('2 months, 1 week')
  })

  it("returns '3 months, 2 weeks' for 3 months + 14 days", () => {
    expect(computeBabyAge('2024-01-01', '2024-04-15')).toBe('3 months, 2 weeks')
  })

  it("returns '6 months old' for exactly 6 months with no extra weeks", () => {
    expect(computeBabyAge('2024-01-01', '2024-07-01')).toBe('6 months old')
  })

  it("returns '11 months, 3 weeks' close to first birthday", () => {
    expect(computeBabyAge('2024-01-01', '2024-12-22')).toBe(
      '11 months, 3 weeks',
    )
  })

  // ── years (2+ years) ─────────────────────────────────────────────────────────

  it("returns '1 year old' for exactly 1 year", () => {
    expect(computeBabyAge('2023-01-01', '2024-01-01')).toBe('1 year old')
  })

  it("returns '1 year, 3 months' for 15 months", () => {
    expect(computeBabyAge('2023-01-01', '2024-04-01')).toBe('1 year, 3 months')
  })

  it("returns '2 years old' for exactly 2 years", () => {
    expect(computeBabyAge('2022-06-01', '2024-06-01')).toBe('2 years old')
  })

  it("returns '3 years, 6 months' for 3.5 years", () => {
    expect(computeBabyAge('2020-01-01', '2023-07-01')).toBe('3 years, 6 months')
  })
})
