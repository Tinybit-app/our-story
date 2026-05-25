/**
 * Optional translator passed in by the caller. Matches the relevant shape of
 * Vue I18n v9's `t()` so we don't pull a runtime dependency into a pure
 * helper. When provided, the function renders fully localized output. When
 * absent, it falls back to English strings (used by unit tests and any
 * non-Vue caller).
 */
type Translator = (
  key: string,
  values?: Record<string, unknown>,
  choice?: number,
) => string

/**
 * computeAnniversaryDisplay — returns a human-readable anniversary label.
 *
 * Rules:
 *   - null/undefined anniversaryDate → null
 *   - future date                    → null (date not yet reached)
 *   - < 1 year                       → "N days together · Since [date]"
 *   - 1+ years, couple               → "Year N together · Since [date]"
 *   - 1+ years, other types          → "Year N of [circleName] · Since [date]"
 *
 * When a `t` translator is supplied, the same shapes are looked up under the
 * `anniversary.*` namespace and respect the active locale.
 *
 * @param anniversaryDate ISO date string (YYYY-MM-DD) or null/undefined
 * @param now             Reference date (defaults to today; injectable for tests)
 * @param locale          BCP 47 locale tag for date formatting (e.g. 'en', 'zh-CN')
 * @param circleType      Circle type — determines label phrasing
 * @param circleName      Circle name — used in label for non-couple circles
 * @param t               Optional Vue I18n translator; absent → English fallback
 */
export function computeAnniversaryDisplay(
  anniversaryDate: string | null | undefined,
  now: Date = new Date(),
  locale: string = 'en',
  circleType: string = 'couple',
  circleName: string = '',
  t?: Translator,
): string | null {
  if (!anniversaryDate) return null

  // Parse as local date (not UTC) to avoid timezone off-by-one
  const [y, m, d] = anniversaryDate.split('-').map(Number)
  const since = new Date(y, m - 1, d)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  // Use UTC arithmetic for totalDays to avoid DST-induced off-by-one errors
  const sinceUtc = Date.UTC(
    since.getFullYear(),
    since.getMonth(),
    since.getDate(),
  )
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const totalDays = Math.floor((todayUtc - sinceUtc) / 86_400_000)
  if (totalDays < 0) return null // anniversary date is in the future

  const sinceLabel = since.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Full years elapsed (calendar-aware)
  let years = today.getFullYear() - since.getFullYear()
  const monthDiff = today.getMonth() - since.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < since.getDate())) {
    years--
  }

  if (years < 1) {
    if (t) {
      return t(
        'anniversary.daysTogether',
        { n: totalDays, since: sinceLabel },
        totalDays,
      )
    }
    const label = totalDays === 1 ? '1 day' : `${totalDays} days`
    return `${label} together · Since ${sinceLabel}`
  }

  const yearNum = years + 1
  if (circleType === 'couple') {
    if (t) {
      return t('anniversary.yearTogether', { year: yearNum, since: sinceLabel })
    }
    return `Year ${yearNum} together · Since ${sinceLabel}`
  }

  if (t) {
    return t('anniversary.yearOf', {
      year: yearNum,
      circle: circleName,
      since: sinceLabel,
    })
  }
  return `Year ${yearNum} of ${circleName} · Since ${sinceLabel}`
}
