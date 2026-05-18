import { computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface MediaItem {
  id: string
  media_type: string
  url: string | null
  thumbnailUrl: string | null
  file_size: number
}

export interface Memory {
  id: string
  circle_id: string
  owner_user_id: string | null
  former_owner_name: string | null
  former_owner_user_id: string | null
  visibility: 'circle'
  note: string | null
  memory_date: string
  milestone_label: string | null
  created_at: string
  memory_children: {
    child_id: string
    childprofile: { id: string; name: string; date_of_birth: string }
  }[]
  memory_members: {
    user_id: string
    user: {
      id: string
      first_name: string | null
      last_name: string | null
      avatar_url: string | null
    } | null
  }[]
  memorymedia: MediaItem[]
  user: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
  memoryreaction: {
    id: string
    emoji: string
    user_id: string
    user: { first_name: string | null; last_name: string | null } | null
  }[]
  memorycomment: { id: string }[]
  media_count?: number
  cover_text_content?: string | null
  cover_media_id?: string | null
}

export interface MonthGroup {
  year: number
  month: number
  label: string
  memories: Memory[]
  hasMore: boolean
  totalCount: number
  anchorId: string
}

export interface YearInfo {
  year: number
  months: number[]
}

const MONTH_CAP = 24

export function useTimeline(
  memoriesRef: Ref<Memory[]>,
  monthCountsRef?: Ref<Record<string, number>>,
): {
  monthGroups: ComputedRef<MonthGroup[]>
  yearInfos: ComputedRef<YearInfo[]>
} {
  const { locale } = useI18n()

  const monthGroups = computed<MonthGroup[]>(() => {
    const map = new Map<
      string,
      { year: number; month: number; memories: Memory[]; total: number }
    >()

    for (const memory of memoriesRef.value) {
      const d = new Date(memory.memory_date)
      const year = d.getUTCFullYear()
      const month = d.getUTCMonth() + 1
      const key = `${year}-${String(month).padStart(2, '0')}`

      if (!map.has(key)) {
        map.set(key, { year, month, memories: [], total: 0 })
      }

      const group = map.get(key)!
      group.memories.push(memory)
    }

    // Canonical per-month totals come from the RPC; fall back to bucket size.
    const counts = monthCountsRef?.value ?? {}
    for (const [key, group] of map.entries()) {
      group.total = counts[key] ?? group.memories.length
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, { year, month, memories, total }]) => ({
        year,
        month,
        label: new Date(year, month - 1).toLocaleDateString(locale.value, {
          month: 'long',
          year: 'numeric',
        }),
        memories: memories
          .sort((a, b) => b.memory_date.localeCompare(a.memory_date))
          .slice(0, MONTH_CAP),
        hasMore: total > MONTH_CAP,
        totalCount: total,
        anchorId: `anchor-${year}`,
      }))
  })

  const yearInfos = computed<YearInfo[]>(() => {
    const map = new Map<number, Set<number>>()
    for (const group of monthGroups.value) {
      if (!map.has(group.year)) map.set(group.year, new Set())
      map.get(group.year)!.add(group.month)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, monthSet]) => ({
        year,
        months: Array.from(monthSet).sort((a, b) => a - b),
      }))
  })

  return { monthGroups, yearInfos }
}

/**
 * Maps a memory id to a deterministic grid cell variant.
 * ~15% of ids → 'wide' (2-col span), ~13% → 'tall' (2-row span),
 * the rest → 'square'. The hash is stable: the same id always produces
 * the same variant, so re-renders and load-more don't shift the layout.
 */
export function mosaicVariant(id: string): 'square' | 'wide' | 'tall' {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const m = h % 100
  if (m < 15) return 'wide'
  if (m < 28) return 'tall'
  return 'square'
}

/**
 * Like mosaicVariant but guarantees the first memory in a month with 3+
 * memories is always 'wide'. This ensures the mosaic pattern is always
 * visible even for small datasets where probabilistic wide cells are rare.
 */
export function mosaicVariantWithBoost(
  id: string,
  index: number,
  monthSize: number,
): 'square' | 'wide' | 'tall' {
  if (index === 0 && monthSize >= 3) return 'wide'
  return mosaicVariant(id)
}
