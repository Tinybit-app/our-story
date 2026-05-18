// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import MemoryViewer from '~/components/MemoryViewer.vue'
import type { Memory } from '~/composables/useTimeline'

vi.stubGlobal('useI18n', () => ({ locale: ref('en'), t: (k: string) => k }))
vi.stubGlobal('useNuxtApp', () => ({ $config: { public: {} } }))
vi.stubGlobal('useSupabaseClient', () => ({
  auth: { getSession: async () => ({ data: { session: null } }) },
}))

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'm1',
    circle_id: 'c1',
    owner_user_id: 'u1',
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle',
    note: null,
    memory_date: '2026-04-15T10:00:00Z',
    milestone_label: null,
    created_at: '2026-04-15T10:00:00Z',
    memory_children: [],
    memory_members: [],
    memorymedia: [],
    user: { first_name: 'A', last_name: 'B', avatar_url: null },
    memoryreaction: [],
    memorycomment: [],
    ...overrides,
  }
}

describe('MemoryViewer', () => {
  it('mounts with a single-item memory', () => {
    const wrapper = mount(MemoryViewer, {
      props: {
        memory: makeMemory(),
        slides: [],
        slidesLoading: false,
        currentSlideIdx: 0,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('mounts with a multi-item memory', () => {
    const wrapper = mount(MemoryViewer, {
      props: {
        memory: makeMemory({ media_count: 3 } as any),
        slides: [
          { id: '1', mediaType: 'photo', url: 'a.jpg', displayOrder: 0 },
          { id: '2', mediaType: 'photo', url: 'b.jpg', displayOrder: 1 },
          { id: '3', mediaType: 'photo', url: 'c.jpg', displayOrder: 2 },
        ],
        slidesLoading: false,
        currentSlideIdx: 0,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
