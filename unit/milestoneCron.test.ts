import { describe, it, expect } from "vitest"
import {
  getMilestoneKeyForAge,
  getAnniversaryYear,
  MONTH_MILESTONES,
  YEAR_MILESTONES,
} from "../server/utils/milestoneCron"

describe("getMilestoneKeyForAge", () => {
  it("returns null for ages with no milestone", () => {
    expect(getMilestoneKeyForAge("2026-01-01", "2026-01-15")).toBeNull()
  })

  it("returns '1mo' for exactly 1 month old", () => {
    expect(getMilestoneKeyForAge("2026-01-15", "2026-02-15")).toBe("1mo")
  })

  it("returns '6mo' for exactly 6 months old", () => {
    expect(getMilestoneKeyForAge("2025-08-09", "2026-02-09")).toBe("6mo")
  })

  it("returns '12mo' for exactly 12 months old", () => {
    expect(getMilestoneKeyForAge("2025-02-09", "2026-02-09")).toBe("12mo")
  })

  it("returns '18mo' for exactly 18 months old", () => {
    expect(getMilestoneKeyForAge("2024-08-09", "2026-02-09")).toBe("18mo")
  })

  it("returns '2yr' for exactly 24 months old", () => {
    expect(getMilestoneKeyForAge("2024-02-09", "2026-02-09")).toBe("2yr")
  })

  it("returns '3yr' for exactly 3 years old", () => {
    expect(getMilestoneKeyForAge("2023-02-09", "2026-02-09")).toBe("3yr")
  })

  it("returns null for ages beyond 18yr cap", () => {
    expect(getMilestoneKeyForAge("2007-02-09", "2026-02-09")).toBeNull()
  })

  it("returns null when target_date is before dob", () => {
    expect(getMilestoneKeyForAge("2026-06-01", "2026-01-01")).toBeNull()
  })

  it("month milestones list contains expected values", () => {
    expect(MONTH_MILESTONES).toEqual([1, 2, 3, 6, 9, 12, 18])
  })

  it("year milestones list contains expected values", () => {
    expect(YEAR_MILESTONES).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18])
  })
})

describe("getAnniversaryYear", () => {
  it("returns N when targetDate is the same MM-DD as anniversaryDate, year diff = N", () => {
    expect(getAnniversaryYear("2020-05-09", "2026-05-09")).toBe(6)
  })

  it("returns null when MM-DD differs", () => {
    expect(getAnniversaryYear("2020-05-09", "2026-05-10")).toBeNull()
  })

  it("returns null when target is before anniversary date (negative year)", () => {
    expect(getAnniversaryYear("2030-05-09", "2026-05-09")).toBeNull()
  })

  it("returns null when targetDate is the same year as anniversaryDate (year 0)", () => {
    expect(getAnniversaryYear("2026-05-09", "2026-05-09")).toBeNull()
  })

  it("handles leap year Feb 29 — anniversary moves to Feb 28 in non-leap year", () => {
    expect(getAnniversaryYear("2020-02-29", "2025-02-28")).toBe(5)
  })

  it("returns N for Feb 29 anniversary on Feb 29 in leap year", () => {
    expect(getAnniversaryYear("2020-02-29", "2024-02-29")).toBe(4)
  })
})
