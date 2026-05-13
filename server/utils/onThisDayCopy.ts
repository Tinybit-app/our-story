// Pure helpers for On This Day push notification copy — locale-aware.
// Mirrored verbatim in supabase/functions/send-on-this-day/onThisDayCopy.ts
// (Deno can't import from Nitro, so the file is duplicated 1:1).

export type Locale = 'en' | 'zh-CN' | 'fr'

export function buildOnThisDayPushTitle(yearsAgo: number, locale: Locale): string {
  if (locale === 'zh-CN') return `${yearsAgo} 年前的今天`
  if (locale === 'fr') return `Il y a ${yearsAgo} an${yearsAgo === 1 ? '' : 's'} aujourd'hui`
  return `On this day, ${yearsAgo} year${yearsAgo === 1 ? '' : 's'} ago`
}

export function buildOnThisDayPushBody(
  uploaderName: string,
  note: string | null,
  locale: Locale,
): string {
  if (note && note.trim().length > 0) {
    return truncate(note, 80)
  }
  if (locale === 'zh-CN') return `${uploaderName} 添加了一条记忆`
  if (locale === 'fr') return `${uploaderName} a ajouté un souvenir`
  return `${uploaderName} added a memory`
}

export function buildFirstMonthMemoryPushTitle(locale: Locale): string {
  if (locale === 'zh-CN') return '你们最初的一段回忆'
  if (locale === 'fr') return 'Un souvenir de votre premier mois'
  return 'A memory from your first month'
}

export function buildFirstMonthMemoryPushBody(
  uploaderName: string,
  note: string | null,
  locale: Locale,
): string {
  if (note && note.trim().length > 0) {
    return truncate(note, 80)
  }
  if (locale === 'zh-CN') return `${uploaderName} 添加了一条记忆`
  if (locale === 'fr') return `${uploaderName} a ajouté un souvenir`
  return `${uploaderName} added a memory`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}
