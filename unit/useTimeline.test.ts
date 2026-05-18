import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useTimeline } from '~/composables/useTimeline'
import type { Memory } from '~/composables/useTimeline'

vi.stubGlobal('useI18n', () => ({ locale: ref('en') }))

function makeMemory(
  id: string,
  dateStr: string,
  overrides: Partial<Memory> = {},
): Memory {
  return {
    id,
    owner_user_id: 'user-1',
    former_owner_name: null,
    visibility: 'circle',
    note: null,
    memory_date: dateStr,
    milestone_label: null,
    milestone_is_custom: false,
    created_at: dateStr,
    memorymedia: [],
    user: { first_name: 'Test', last_name: 'User', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
    ...overrides,
  }
}

describe('useTimeline', () => {
  it('groups memories into month groups sorted newest first', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-03-15T10:00:00Z'),
      makeMemory('2', '2025-03-10T10:00:00Z'),
      makeMemory('3', '2025-01-05T10:00:00Z'),
    ])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value).toHaveLength(2)
    expect(monthGroups.value[0].year).toBe(2025)
    expect(monthGroups.value[0].month).toBe(3)
    expect(monthGroups.value[0].memories).toHaveLength(2)
    expect(monthGroups.value[1].month).toBe(1)
  })

  it('caps each month at 24 memories and sets hasMore = true when exceeded', () => {
    const memories = ref<Memory[]>(
      Array.from({ length: 28 }, (_, i) =>
        makeMemory(
          `id-${i}`,
          `2025-06-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        ),
      ),
    )
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value).toHaveLength(1)
    expect(monthGroups.value[0].memories).toHaveLength(24)
    expect(monthGroups.value[0].hasMore).toBe(true)
  })

  it('sets hasMore = false when month has exactly 24 memories (all visible)', () => {
    const memories = ref<Memory[]>(
      Array.from({ length: 24 }, (_, i) =>
        makeMemory(
          `id-${i}`,
          `2025-07-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        ),
      ),
    )
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].memories).toHaveLength(24)
    expect(monthGroups.value[0].hasMore).toBe(false)
  })

  it('sets hasMore = false when month has fewer than 24 memories', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-04-01T10:00:00Z'),
      makeMemory('2', '2025-04-02T10:00:00Z'),
    ])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].hasMore).toBe(false)
  })

  it('updates reactively when memories are appended', () => {
    const memories = ref<Memory[]>([makeMemory('1', '2025-03-01T10:00:00Z')])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].memories).toHaveLength(1)

    memories.value = [
      ...memories.value,
      makeMemory('2', '2025-03-15T10:00:00Z'),
    ]
    expect(monthGroups.value[0].memories).toHaveLength(2)
  })

  it('includes correct months in yearInfos', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-03-01T10:00:00Z'),
      makeMemory('2', '2025-01-01T10:00:00Z'),
      makeMemory('3', '2024-12-01T10:00:00Z'),
    ])
    const { yearInfos } = useTimeline(memories)
    expect(yearInfos.value).toHaveLength(2)
    expect(yearInfos.value[0].year).toBe(2025)
    expect(yearInfos.value[0].months).toEqual([1, 3])
    expect(yearInfos.value[1].year).toBe(2024)
    expect(yearInfos.value[1].months).toEqual([12])
  })

  it('month label is formatted correctly', () => {
    const memories = ref<Memory[]>([makeMemory('1', '2025-03-15T10:00:00Z')])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].label).toBe('March 2025')
  })

  it('anchorId is shared across months in the same year', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-03-01T10:00:00Z'),
      makeMemory('2', '2025-01-01T10:00:00Z'),
    ])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value[0].anchorId).toBe('anchor-2025')
    expect(monthGroups.value[1].anchorId).toBe('anchor-2025')
  })
})

describe('useTimeline · monthCounts integration', () => {
  it('group.totalCount reads from monthCounts when provided', () => {
    const memories = ref<Memory[]>([
      makeMemory('a', '2026-04-01T10:00:00Z'),
      makeMemory('b', '2026-04-15T10:00:00Z'),
    ])
    const monthCounts = ref<Record<string, number>>({ '2026-04': 47 })
    const { monthGroups } = useTimeline(memories, monthCounts)

    const aprilGroup = monthGroups.value.find(
      (g) => g.year === 2026 && g.month === 4,
    )
    expect(aprilGroup?.totalCount).toBe(47)
    expect(aprilGroup?.memories.length).toBe(2)
    expect(aprilGroup?.hasMore).toBe(true) // 47 > 24 = MONTH_CAP
  })

  it('falls back to bucket length when monthCounts is empty', () => {
    const memories = ref<Memory[]>([
      makeMemory('a', '2026-04-01T10:00:00Z'),
      makeMemory('b', '2026-04-15T10:00:00Z'),
    ])
    const monthCounts = ref<Record<string, number>>({})
    const { monthGroups } = useTimeline(memories, monthCounts)

    const aprilGroup = monthGroups.value.find(
      (g) => g.year === 2026 && g.month === 4,
    )
    expect(aprilGroup?.totalCount).toBe(2)
  })

  it('month with 25 memories displays 24, sets hasMore, and exposes true totalCount=25', () => {
    const memories = ref<Memory[]>(
      Array.from({ length: 25 }, (_, i) =>
        makeMemory(
          `m${i}`,
          `2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
        ),
      ),
    )
    const monthCounts = ref<Record<string, number>>({ '2026-04': 25 })
    const { monthGroups } = useTimeline(memories, monthCounts)

    const aprilGroup = monthGroups.value.find((g) => g.month === 4)
    expect(aprilGroup?.memories.length).toBe(24)
    expect(aprilGroup?.totalCount).toBe(25)
    expect(aprilGroup?.hasMore).toBe(true)
  })
})

describe('useTimeline — detached memories (former member)', () => {
  it('includes detached memories (owner_user_id = null) in month groups', () => {
    const memories = ref<Memory[]>([
      makeMemory('1', '2025-05-01T10:00:00Z', {
        owner_user_id: null,
        former_owner_name: 'Sarah Kim',
      }),
      makeMemory('2', '2025-05-10T10:00:00Z'),
    ])
    const { monthGroups } = useTimeline(memories)
    expect(monthGroups.value).toHaveLength(1)
    expect(monthGroups.value[0].memories).toHaveLength(2)
  })

  it('detached memory has owner_user_id null and former_owner_name set', () => {
    const m = makeMemory('1', '2025-05-01T10:00:00Z', {
      owner_user_id: null,
      former_owner_name: 'Sarah Kim',
    })
    expect(m.owner_user_id).toBeNull()
    expect(m.former_owner_name).toBe('Sarah Kim')
  })

  it('normal memory has owner_user_id set and former_owner_name null', () => {
    const m = makeMemory('1', '2025-05-01T10:00:00Z')
    expect(m.owner_user_id).toBe('user-1')
    expect(m.former_owner_name).toBeNull()
  })
})
