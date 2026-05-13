/**
 * computeBabyAge — returns a human-readable age string for a baby
 * at the time a memory was taken.
 *
 * Rules:
 *   - null/before birth           → null
 *   - 0 days (birth day)          → "newborn"
 *   - 1–13 days                   → "N day(s) old"
 *   - 14 days – <1 month          → "N weeks old"
 *   - 1 month – <2 years          → "N months[, W weeks]"
 *   - 2+ years                    → "N years[, M months]"
 */
export function computeBabyAge(
  dateOfBirth: string | null | undefined,
  memoryDate: string | null | undefined,
): string | null {
  if (!dateOfBirth || !memoryDate) return null

  const dob = new Date(dateOfBirth)
  const mem = new Date(memoryDate)

  // Strip time components so we work purely on calendar dates
  dob.setUTCHours(0, 0, 0, 0)
  mem.setUTCHours(0, 0, 0, 0)

  const totalDays = Math.floor((mem.getTime() - dob.getTime()) / 86_400_000)
  if (totalDays < 0) return null
  if (totalDays === 0) return 'newborn'

  // ── Days: 1–13 ──────────────────────────────────────────────────────────────
  if (totalDays < 14) {
    return totalDays === 1 ? '1 day old' : `${totalDays} days old`
  }

  // Count whole calendar months between dob and mem
  const months = countCalendarMonths(dob, mem)

  // ── Weeks: 14 days – <1 month ────────────────────────────────────────────────
  if (months < 1) {
    const weeks = Math.floor(totalDays / 7)
    return weeks === 1 ? '1 week old' : `${weeks} weeks old`
  }

  // ── Years: 1+ years ─────────────────────────────────────────────────────────
  if (months >= 12) {
    const years = Math.floor(months / 12)
    const remMonths = months % 12
    if (remMonths === 0) return years === 1 ? '1 year old' : `${years} years old`
    const mLabel = remMonths === 1 ? '1 month' : `${remMonths} months`
    const yLabel = years === 1 ? '1 year' : `${years} years`
    return `${yLabel}, ${mLabel}`
  }

  // ── Months: 1–23 months ──────────────────────────────────────────────────────
  // Remaining days after whole months
  const afterMonths = addMonths(dob, months)
  const remDays = Math.floor((mem.getTime() - afterMonths.getTime()) / 86_400_000)
  const remWeeks = Math.floor(remDays / 7)

  const mLabel = months === 1 ? '1 month' : `${months} months`
  if (remWeeks === 0) return `${mLabel} old`
  const wLabel = remWeeks === 1 ? '1 week' : `${remWeeks} weeks`
  return `${mLabel}, ${wLabel}`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Number of whole calendar months between two dates. */
function countCalendarMonths(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())

  // If the day-of-month hasn't been reached yet, subtract one
  if (to.getUTCDate() < from.getUTCDate()) {
    months -= 1
  }

  return Math.max(0, months)
}

/** Return a new Date that is `n` calendar months after `from`. */
function addMonths(from: Date, n: number): Date {
  const result = new Date(from)
  result.setUTCMonth(result.getUTCMonth() + n)
  return result
}
