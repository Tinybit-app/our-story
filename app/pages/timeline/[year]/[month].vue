<template>
  <div class="min-h-screen bg-background">
    <MonthSpreadHeader
      :year="year"
      :month="month"
      :circle-id="circleId"
      :circle-name="circleName"
      :memory-count="totalCount"
      :prev="adjacency.prev"
      :next="adjacency.next"
      :show-share="true"
    />

    <main class="mx-auto max-w-[1280px] px-5 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-32">
        <div class="flex flex-col items-center gap-3">
          <div
            class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
          <p class="text-xs text-muted-foreground">
            {{ t('timeline.loading') }}
          </p>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="memories.length === 0" class="py-32 text-center">
        <p class="text-sm text-muted-foreground">
          {{ t('timeline.noMemoriesFor', { month: monthLabel }) }}
        </p>
      </div>

      <!-- Mosaic grid -->
      <div v-else>
        <p class="mb-6 text-xs text-muted-foreground">
          {{ t('timeline.memories', totalCount) }}
        </p>
        <div class="grid grid-cols-3 gap-[3px] md:grid-cols-4">
          <MosaicCell
            v-for="memory in memories"
            :key="memory.id"
            :memory="memory"
            :class="cellClass(memory)"
            @open="onOpenMemory"
          />
        </div>

        <!-- Load-more sentinel + spinner (infinite scroll) -->
        <div ref="loadMoreEl" class="py-8">
          <div v-if="loadingMore" class="flex justify-center">
            <div
              class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
            />
          </div>
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
import { mosaicVariant } from '~/composables/useTimeline'
const { t, locale } = useI18n()

function cellClass(memory: Memory): string {
  // Note cells never span — they always render as a 1x1 square.
  if (memory.memorymedia.length === 0 && memory.note) return ''
  const v = mosaicVariant(memory.id)
  if (v === 'wide') return 'wide'
  if (v === 'tall') return 'tall'
  return ''
}

const route = useRoute()
const year = Number(route.params.year)
const month = Number(route.params.month)

// Redirect to home if route params are invalid
if (!year || !month || month < 1 || month > 12 || year < 2000 || year > 2100) {
  await navigateTo('/timeline')
}

const monthLabel = computed(() =>
  new Date(year, month - 1).toLocaleDateString(locale.value, {
    month: 'long',
    year: 'numeric',
  }),
)


const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
// Prefer ?circle=<id> so this month-overflow page stays on the same circle
// the user was viewing on the main timeline. The "See more" link below
// passes it; direct-URL visits fall back to the first circle.
const circleId = computed<string | null>(() => {
  const all = circlesData.value?.circles ?? []
  const paramId = route.query.circle as string | undefined
  if (paramId && all.some((c: any) => c.id === paramId)) return paramId
  return all[0]?.id ?? null
})

// Active circle's display name (used in the spread header kicker row).
const circleName = computed(() => {
  const all = circlesData.value?.circles ?? []
  return all.find((c: any) => c.id === circleId.value)?.name ?? null
})

// Prev/next adjacency from /api/timeline/months-with-data
const adjacency = ref<{
  prev: { year: number; month: number } | null
  next: { year: number; month: number } | null
}>({ prev: null, next: null })

async function fetchAdjacency() {
  if (!circleId.value) return
  try {
    const data = await $fetch<{
      prev: { year: number; month: number } | null
      next: { year: number; month: number } | null
    }>('/api/timeline/months-with-data', {
      query: { circleId: circleId.value, year, month },
    })
    adjacency.value = data
  } catch (err) {
    console.error('[month-page] adjacency fetch error:', err)
  }
}

interface ChildProfile {
  id: string
  name: string
  date_of_birth: string
}
interface CircleMember {
  userId: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

const memories = ref<Memory[]>([])
const children = ref<ChildProfile[]>([])
const members = ref<CircleMember[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const nextCursor = ref<string | null>(null)
const totalCount = ref(0)
const loadMoreEl = ref<HTMLElement>()

// ── Modals ─────────────────────────────────────────────────
const selectedIndex = ref<number | null>(null)
const selectedRect = ref<DOMRect | null>(null)
const selectedTilt = ref(0)

function onOpenMemory({
  memory,
  tilt,
  rect,
}: {
  memory: Memory
  tilt: number
  rect: DOMRect | null
}) {
  selectedRect.value = rect
  selectedTilt.value = tilt
  selectedIndex.value = memories.value.findIndex((m) => m.id === memory.id)
}

function onMemoryUpdate(patch: Pick<Memory, 'id'> & Partial<Memory>) {
  const i = memories.value.findIndex((m) => m.id === patch.id)
  if (i !== -1) memories.value[i] = { ...memories.value[i], ...patch } as Memory
}


async function fetchPage(cursor?: string) {
  if (!circleId.value) return
  const isFirst = !cursor
  if (isFirst) loading.value = true
  else loadingMore.value = true
  try {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`
    const query: Record<string, string> = {
      circleId: circleId.value,
      yearMonth,
    }
    if (cursor) query.cursor = cursor
    const data = await $fetch<{
      memories: Memory[]
      nextCursor: string | null
      totalCount: number
      children: ChildProfile[]
      members: CircleMember[]
    }>('/api/timeline', { query })
    if (isFirst) {
      memories.value = data.memories
      totalCount.value = data.totalCount
      children.value = data.children ?? []
      members.value = data.members ?? []
    } else {
      memories.value = [...memories.value, ...data.memories]
    }
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[month-page] fetch error:', err)
  } finally {
    if (isFirst) loading.value = false
    else loadingMore.value = false
  }
}

// Load-more sentinel
useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && nextCursor.value && !loadingMore.value && !loading.value) {
    fetchPage(nextCursor.value)
  }
})

onMounted(() => {
  fetchPage()
  fetchAdjacency()
})
</script>

<style scoped>
/* .wide and .tall cell shapes are owned by MosaicCell.vue */
</style>
