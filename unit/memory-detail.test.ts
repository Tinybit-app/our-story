// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MemoryDetail from '~/components/MemoryDetail.vue'
import type { Memory } from '~/composables/useTimeline'

vi.stubGlobal('useI18n', () => ({ locale: ref('en'), t: (k: string) => k }))
vi.stubGlobal('useNuxtApp', () => ({ $posthog: null }))
vi.stubGlobal('useSupabaseClient', () => ({
  auth: { getSession: async () => ({ data: { session: null } }) },
}))

function makeMemory(): Memory {
  return {
    id: 'm1',
    circle_id: 'c1',
    owner_user_id: 'u1',
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: 'Hello',
    memory_date: '2026-04-15T10:00:00Z',
    milestone_label: null,
    created_at: '2026-04-15T10:00:00Z',
    memory_children: [],
    memory_members: [],
    memorymedia: [],
    user: { first_name: 'A', last_name: 'B', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
  }
}

describe('MemoryDetail', () => {
  it('mounts with the contract props', () => {
    const wrapper = mount(MemoryDetail, {
      props: {
        memory: makeMemory(),
        children: [],
        members: [],
        currentUserId: 'u1',
        selfAvatarUrl: null,
        selfInitials: '?',
        slides: [],
        currentSlideIdx: 0,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('exposes canClose() returning true when no edit in progress', async () => {
    const wrapper = mount(MemoryDetail, {
      props: {
        memory: makeMemory(),
        children: [],
        members: [],
        currentUserId: 'u1',
        selfAvatarUrl: null,
        selfInitials: '?',
        slides: [],
        currentSlideIdx: 0,
      },
    })
    const result = await (wrapper.vm as any).canClose()
    expect(result).toBe(true)
  })
})
