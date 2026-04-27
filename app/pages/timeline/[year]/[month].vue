<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 py-3.5 flex items-center gap-3">
        <NuxtLink
          to="/timeline"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {{ t('common.back') }}
        </NuxtLink>
        <div class="flex-1 min-w-0">
          <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase leading-none mb-1 select-none">Our Story</p>
          <p class="text-sm font-semibold text-foreground leading-none truncate">{{ monthLabel }}</p>
        </div>
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5 py-6">

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-32">
        <div class="flex flex-col items-center gap-3">
          <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p class="text-xs text-muted-foreground">{{ t('timeline.loading') }}</p>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="memories.length === 0" class="text-center py-32">
        <p class="text-sm text-muted-foreground">{{ t('timeline.noMemoriesFor', { month: monthLabel }) }}</p>
      </div>

      <!-- Polaroid grid -->
      <div v-else>
        <p class="text-xs text-muted-foreground mb-6">
          {{ t('timeline.memories', memories.length) }}
        </p>
        <div class="flex flex-wrap gap-5 items-start">
          <template v-for="(memory, i) in memories" :key="memory.id">
            <QuickNoteCard
              v-if="!memory.memorymedia.length && memory.note"
              :memory="memory"
              :index="i"
              @open="onOpenMemory"
              @reaction-update="onReactionUpdate"
            />
            <PolaroidCard
              v-else
              :memory="memory"
              :index="i"
              :wide="isWideMemory(memory.id)"
              @open="onOpenMemory"
              @reaction-update="onReactionUpdate"
            />
          </template>
        </div>

        <!-- Infinite scroll sentinel + load-more spinner -->
        <div ref="loadMoreEl" class="h-8 mt-4" />
        <div v-if="loadingMore" class="flex justify-center py-4">
          <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        </div>
      </div>

    </main>
    <!-- Unified memory modal (handles photo, video, and quick note) -->
    <MemoryShell
      :memories="memories"
      :start-index="selectedIndex"
      :origin-rect="selectedRect"
      :tilt="selectedTilt"
      :children="children"
      :members="members"
      @close="selectedIndex = null"
      @update="onMemoryUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import type { Memory } from '~/composables/useTimeline'
const { t, locale } = useI18n()

const route = useRoute()
const year = Number(route.params.year)
const month = Number(route.params.month)

// Redirect to home if route params are invalid
if (!year || !month || month < 1 || month > 12 || year < 2000 || year > 2100) {
  await navigateTo('/timeline')
}

const monthLabel = computed(() =>
  new Date(year, month - 1).toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
)

function isWideMemory(id: string): boolean {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 10) < 3
}

const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circleId = computed<string | null>(() => circlesData.value?.circles?.[0]?.id ?? null)

interface ChildProfile { id: string; name: string; date_of_birth: string }
interface CircleMember { userId: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }

const memories = ref<Memory[]>([])
const children = ref<ChildProfile[]>([])
const members = ref<CircleMember[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const nextCursor = ref<string | null>(null)

// ── Modals ─────────────────────────────────────────────────
const selectedIndex = ref<number | null>(null)
const selectedRect = ref<DOMRect | null>(null)
const selectedTilt = ref(0)

function onOpenMemory({ memory, tilt, rect }: { memory: Memory; tilt: number; rect: DOMRect | null }) {
  selectedRect.value = rect
  selectedTilt.value = tilt
  selectedIndex.value = memories.value.findIndex((m) => m.id === memory.id)
}

function onMemoryUpdate(patch: Pick<Memory, 'id'> & Partial<Memory>) {
  const i = memories.value.findIndex((m) => m.id === patch.id)
  if (i !== -1) memories.value[i] = { ...memories.value[i], ...patch } as Memory
}

function onReactionUpdate({ memoryId, reactions }: { memoryId: string; reactions: any[] }) {
  const i = memories.value.findIndex((m) => m.id === memoryId)
  if (i !== -1) memories.value[i] = { ...memories.value[i], memoryreaction: reactions } as Memory
}

async function fetchPage(cursor?: string) {
  if (!circleId.value) return
  const isFirst = !cursor
  if (isFirst) loading.value = true; else loadingMore.value = true
  try {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`
    const query: Record<string, string> = { circleId: circleId.value, yearMonth }
    if (cursor) query.cursor = cursor
    const data = await $fetch<{ memories: Memory[]; nextCursor: string | null; children: ChildProfile[]; members: CircleMember[] }>(
      '/api/timeline',
      { query }
    )
    if (isFirst) {
      memories.value = data.memories
      children.value = data.children ?? []
      members.value = data.members ?? []
    } else {
      memories.value = [...memories.value, ...data.memories]
    }
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[month-page] fetch error:', err)
  } finally {
    if (isFirst) loading.value = false; else loadingMore.value = false
  }
}

// ── Infinite scroll ────────────────────────────────────────
const loadMoreEl = ref<HTMLElement>()
const { stop: stopLoadMore } = useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && nextCursor.value && !loadingMore.value) {
    fetchPage(nextCursor.value)
  }
})

onUnmounted(() => stopLoadMore())

onMounted(() => fetchPage())
</script>
