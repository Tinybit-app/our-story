import type { InjectionKey } from 'vue'

export interface MemoryItem {
  id: string
  memory_date: string
  signedUrl: string | null
  thumbnailUrl: string | null
  mediaType: 'image' | 'video' | null
  note: string | null
}

export interface YearGroup {
  year: number
  memories: MemoryItem[]
  loading: boolean
  loaded: boolean
  truncated: boolean
}

interface MonthGroup {
  month: number
  memories: MemoryItem[]
}

export type MemoryPickerReturn = ReturnType<typeof useMemoryPicker>
export const MEMORY_PICKER_KEY = Symbol(
  'memory-picker',
) as InjectionKey<MemoryPickerReturn>

export function useMemoryPicker(circleId: Ref<string>) {
  const { locale } = useI18n()

  // ── State ────────────────────────────────────────────────
  const selectedMemoryIds = ref(new Set<string>())
  const yearsLoading = ref(false)
  const yearGroups = ref<YearGroup[]>([])
  const collapsedYears = ref(new Set<number>())
  const collapsedMonths = ref(new Set<string>())

  // ── Date helpers ─────────────────────────────────────────
  function getMonth(dateStr: string): number {
    return parseInt(dateStr.substring(5, 7), 10)
  }

  function getMonthGroups(group: YearGroup): MonthGroup[] {
    const byMonth = new Map<number, MemoryItem[]>()
    for (const m of group.memories) {
      const month = getMonth(m.memory_date)
      if (!byMonth.has(month)) byMonth.set(month, [])
      byMonth.get(month)!.push(m)
    }
    return [...byMonth.entries()]
      .map(([month, memories]) => ({ month, memories }))
      .sort((a, b) => b.month - a.month)
  }

  function monthName(month: number): string {
    return new Date(2000, month - 1).toLocaleString(locale.value, {
      month: 'long',
    })
  }

  function formatTileDate(dateStr: string): string {
    const d = dateStr.substring(0, 10)
    return new Date(d + 'T12:00:00').toLocaleDateString(locale.value, {
      month: 'short',
      day: 'numeric',
    })
  }

  // ── Selection stats (single O(N) pass) ───────────────────
  const selectionStats = computed(() => {
    const byYear = new Map<number, { sel: number; total: number }>()
    const byYM = new Map<string, { sel: number; total: number }>()
    for (const g of yearGroups.value) {
      if (!g.loaded) continue
      let ySel = 0
      for (const m of g.memories) {
        const mo = getMonth(m.memory_date)
        const k = `${g.year}-${mo}`
        if (!byYM.has(k)) byYM.set(k, { sel: 0, total: 0 })
        const ms = byYM.get(k)!
        ms.total++
        if (selectedMemoryIds.value.has(m.id)) {
          ms.sel++
          ySel++
        }
      }
      byYear.set(g.year, { sel: ySel, total: g.memories.length })
    }
    return { byYear, byYM }
  })

  // ── Selection queries ────────────────────────────────────
  function isYearFullySelected(year: number): boolean {
    const s = selectionStats.value.byYear.get(year)
    return s !== undefined && s.total > 0 && s.sel === s.total
  }

  function isYearPartiallySelected(year: number): boolean {
    const s = selectionStats.value.byYear.get(year)
    return s !== undefined && s.sel > 0 && s.sel < s.total
  }

  function isMonthSelected(
    year: number,
    month: number,
  ): 'full' | 'partial' | 'none' {
    const s = selectionStats.value.byYM.get(`${year}-${month}`)
    if (!s || s.sel === 0) return 'none'
    return s.sel === s.total ? 'full' : 'partial'
  }

  function yearCheckboxClass(year: number): string {
    if (isYearFullySelected(year)) return 'bg-primary border-primary'
    if (isYearPartiallySelected(year)) return 'border-primary bg-primary/10'
    return 'border-border'
  }

  function monthCheckboxClass(year: number, month: number): string {
    const state = isMonthSelected(year, month)
    if (state === 'full') return 'bg-primary border-primary'
    if (state === 'partial') return 'border-primary bg-primary/10'
    return 'border-border/60'
  }

  // ── Toggle actions ───────────────────────────────────────
  function toggleYear(year: number) {
    const group = yearGroups.value.find((g) => g.year === year)
    if (!group?.loaded) return
    const s = new Set(selectedMemoryIds.value)
    if (isYearFullySelected(year)) {
      group.memories.forEach((m) => s.delete(m.id))
    } else {
      group.memories.forEach((m) => s.add(m.id))
    }
    selectedMemoryIds.value = s
  }

  function toggleMonth(year: number, month: number) {
    const group = yearGroups.value.find((g) => g.year === year)
    if (!group?.loaded) return
    const monthMems = group.memories.filter(
      (m) => getMonth(m.memory_date) === month,
    )
    const state = isMonthSelected(year, month)
    const s = new Set(selectedMemoryIds.value)
    if (state === 'full') {
      monthMems.forEach((m) => s.delete(m.id))
    } else {
      monthMems.forEach((m) => s.add(m.id))
    }
    selectedMemoryIds.value = s
  }

  function toggleMemory(id: string) {
    const s = new Set(selectedMemoryIds.value)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    selectedMemoryIds.value = s
  }

  function clearSelection() {
    selectedMemoryIds.value = new Set()
  }

  function setSelection(ids: string[]) {
    selectedMemoryIds.value = new Set(ids)
  }

  // ── Collapse ─────────────────────────────────────────────
  function toggleYearCollapsed(year: number) {
    const s = new Set(collapsedYears.value)
    if (s.has(year)) s.delete(year)
    else s.add(year)
    collapsedYears.value = s
  }

  function autoCollapseMonths(group: YearGroup) {
    const months = getMonthGroups(group)
    if (months.length <= 1) return
    const s = new Set(collapsedMonths.value)
    for (let i = 1; i < months.length; i++) {
      s.add(`${group.year}-${months[i]!.month}`)
    }
    collapsedMonths.value = s
  }

  function toggleMonthCollapsed(year: number, month: number) {
    const key = `${year}-${month}`
    const s = new Set(collapsedMonths.value)
    if (s.has(key)) s.delete(key)
    else s.add(key)
    collapsedMonths.value = s
  }

  // ── Data loading ─────────────────────────────────────────
  function mapMemory(m: any): MemoryItem {
    const media = m.memorymedia?.[0] ?? null
    const isVideo = media?.media_type === 'video'
    return {
      id: m.id,
      memory_date: m.memory_date,
      signedUrl: media?.url ?? null,
      thumbnailUrl: isVideo ? null : (media?.thumbnailUrl ?? null),
      mediaType: media
        ? media.media_type === 'video'
          ? 'video'
          : 'image'
        : null,
      note: m.note ?? null,
    }
  }

  async function loadYears() {
    yearsLoading.value = true
    try {
      const data = await $fetch<{ years: number[] }>('/api/timeline/years', {
        query: { circleId: circleId.value },
      })
      yearGroups.value = data.years.map((year) => ({
        year,
        memories: [],
        loading: false,
        loaded: false,
        truncated: false,
      }))
    } catch {
      yearGroups.value = []
    } finally {
      yearsLoading.value = false
    }
  }

  async function loadYearMemories(year: number) {
    const group = yearGroups.value.find((g) => g.year === year)
    if (!group || group.loaded || group.loading) return
    group.loading = true
    try {
      const data = await $fetch<{ memories: any[]; truncated?: boolean }>(
        '/api/timeline',
        {
          query: { circleId: circleId.value, year, limit: 1000 },
        },
      )
      group.memories = (data.memories ?? []).map(mapMemory)
      group.truncated = data.truncated === true
      group.loaded = true
      autoCollapseMonths(group)
    } catch {
      group.memories = []
      group.loaded = true
    } finally {
      group.loading = false
    }
  }

  async function loadAllMemories() {
    await Promise.all(yearGroups.value.map((g) => loadYearMemories(g.year)))
  }

  async function loadMonthComplete(
    year: number,
    month: number,
  ): Promise<MemoryItem[]> {
    const ym = `${year}-${String(month).padStart(2, '0')}`
    const all: MemoryItem[] = []
    let cursor: string | null = null
    let hasMore = true
    while (hasMore) {
      const query: Record<string, string> = {
        circleId: circleId.value,
        yearMonth: ym,
      }
      if (cursor) query.cursor = cursor
      const res = (await ($fetch as Function)('/api/timeline', { query })) as {
        memories: any[]
        nextCursor: string | null
      }
      all.push(...(res.memories ?? []).map(mapMemory))
      cursor = res.nextCursor ?? null
      hasMore = cursor !== null
    }
    return all
  }

  async function loadYearComplete(year: number) {
    const group = yearGroups.value.find((g) => g.year === year)
    if (!group) return
    group.loading = true
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) => loadMonthComplete(year, i + 1)),
      )
      group.memories = results.flat()
      group.truncated = false
      group.loaded = true
      autoCollapseMonths(group)
    } catch {
      // Keep existing data on failure
    } finally {
      group.loading = false
    }
  }

  function reset() {
    selectedMemoryIds.value = new Set()
    yearGroups.value = []
    yearsLoading.value = false
    collapsedYears.value = new Set()
    collapsedMonths.value = new Set()
  }

  // ── Computed helpers ─────────────────────────────────────
  const isAnyYearLoading = computed(() =>
    yearGroups.value.some((g) => g.loading),
  )
  const hasMemories = computed(() => yearGroups.value.length > 0)

  return {
    // State
    selectedMemoryIds,
    yearsLoading,
    yearGroups,
    collapsedYears,
    collapsedMonths,
    // Computed
    isAnyYearLoading,
    hasMemories,
    selectionStats,
    // Date helpers
    getMonthGroups,
    monthName,
    formatTileDate,
    // Selection
    isYearFullySelected,
    isYearPartiallySelected,
    isMonthSelected,
    yearCheckboxClass,
    monthCheckboxClass,
    toggleYear,
    toggleMonth,
    toggleMemory,
    clearSelection,
    setSelection,
    // Collapse
    toggleYearCollapsed,
    toggleMonthCollapsed,
    // Data loading
    loadYears,
    loadAllMemories,
    loadYearComplete,
    reset,
  }
}
