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
  owner_user_id: string
  visibility: 'private' | 'circle'
  note: string | null
  memory_date: string
  milestone_label: string | null
  milestone_is_custom: boolean
  created_at: string
  memorymedia: MediaItem[]
  user: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null
  memoryreaction: { id: string; emoji: string; user_id: string; user: { first_name: string | null; last_name: string | null } | null }[]
  memorycomment: { id: string }[]
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

const MONTH_CAP = 12

export function useTimeline(memoriesRef: Ref<Memory[]>): {
  monthGroups: ComputedRef<MonthGroup[]>
  yearInfos: ComputedRef<YearInfo[]>
} {
  const monthGroups = computed<MonthGroup[]>(() => {
    const map = new Map<string, { year: number; month: number; memories: Memory[]; total: number }>()

    for (const memory of memoriesRef.value) {
      const d = new Date(memory.memory_date)
      const year = d.getUTCFullYear()
      const month = d.getUTCMonth() + 1
      const key = `${year}-${String(month).padStart(2, '0')}`

      if (!map.has(key)) {
        map.set(key, { year, month, memories: [], total: 0 })
      }

      const group = map.get(key)!
      group.total++
      group.memories.push(memory)
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, { year, month, memories, total }]) => ({
        year,
        month,
        label: new Date(year, month - 1).toLocaleDateString('en-US', {
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
