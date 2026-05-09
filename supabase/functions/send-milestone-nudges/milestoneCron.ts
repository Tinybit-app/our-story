// Pure helpers for milestone cron — date math and milestone key resolution.
// Mirrored verbatim in supabase/functions/send-milestone-nudges/milestoneCron.ts
// (Deno can't import from Nitro, so the file is duplicated 1:1 like the digest pattern).

export const MONTH_MILESTONES = [1, 2, 3, 6, 9, 12, 18] as const
export const YEAR_MILESTONES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18] as const

/**
 * Given a child's date_of_birth and a target date, return the milestone key
 * (e.g., '6mo', '2yr') if the target date is exactly that age. Else null.
 */
export function getMilestoneKeyForAge(dob: string, targetDate: string): string | null {
  const d = new Date(dob + "T00:00:00Z")
  const t = new Date(targetDate + "T00:00:00Z")
  if (Number.isNaN(d.getTime()) || Number.isNaN(t.getTime())) return null
  if (t.getTime() < d.getTime()) return null

  const dy = d.getUTCFullYear()
  const dm = d.getUTCMonth()
  const dd = d.getUTCDate()
  const ty = t.getUTCFullYear()
  const tm = t.getUTCMonth()
  const td = t.getUTCDate()

  if (dd !== td) return null

  const monthsDiff = (ty - dy) * 12 + (tm - dm)
  if (monthsDiff <= 0) return null

  // Check month milestones first (12mo is in MONTH_MILESTONES, not YEAR_MILESTONES)
  if ((MONTH_MILESTONES as readonly number[]).includes(monthsDiff)) {
    return `${monthsDiff}mo`
  }

  if (monthsDiff % 12 === 0) {
    const years = monthsDiff / 12
    if ((YEAR_MILESTONES as readonly number[]).includes(years)) {
      return `${years}yr`
    }
    return null
  }

  return null
}

/**
 * Given an anniversary anchor date and a target date, return the year N if the
 * target is the Nth anniversary (same MM-DD, N years later, N >= 1). Else null.
 *
 * Leap-year Feb 29 special case: if anchor is Feb 29 and target year is non-leap,
 * accept Feb 28 as the matching day.
 */
export function getAnniversaryYear(anniversaryDate: string, targetDate: string): number | null {
  const a = new Date(anniversaryDate + "T00:00:00Z")
  const t = new Date(targetDate + "T00:00:00Z")
  if (Number.isNaN(a.getTime()) || Number.isNaN(t.getTime())) return null

  const ay = a.getUTCFullYear()
  const am = a.getUTCMonth()
  const ad = a.getUTCDate()
  const ty = t.getUTCFullYear()
  const tm = t.getUTCMonth()
  const td = t.getUTCDate()

  const yearDiff = ty - ay
  if (yearDiff < 1) return null

  if (am === tm && ad === td) return yearDiff

  const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  if (am === 1 && ad === 29 && tm === 1 && td === 28 && !isLeapYear(ty)) {
    return yearDiff
  }

  return null
}
