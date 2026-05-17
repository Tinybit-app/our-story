<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header
      class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div class="mx-auto flex max-w-[1280px] items-center gap-3 px-5 py-3.5">
        <NuxtLink
          :to="circleId ? `/timeline?circle=${circleId}` : '/timeline'"
          class="flex flex-shrink-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {{ t('common.back') }}
        </NuxtLink>
        <div class="min-w-0 flex-1">
          <p
            class="mb-1 select-none text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-accent"
          >
            Our Story
          </p>
          <p
            class="truncate text-sm font-semibold leading-none text-foreground"
          >
            {{ monthLabel }}
          </p>
        </div>
      </div>
    </header>

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
          {{ t('timeline.memories', memories.length) }}
        </p>
        <div class="grid grid-cols-3 gap-[3px] md:grid-cols-4">
          <MosaicCell
            v-for="memory in memories"
            :key="memory.id"
            :memory="memory"
            :class="mosaicVariant(memory.id) === 'wide' ? 'wide' : mosaicVariant(memory.id) === 'tall' ? 'tall' : ''"
            @open="onOpenMemory"
          />
        </div>

        <!-- Load more button -->
        <div v-if="nextCursor" class="mt-8 flex justify-center">
          <button
            :disabled="loadingMore"
            class="flex h-9 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            @click="fetchPage(nextCursor!)"
          >
            <div
              v-if="loadingMore"
              class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            {{ t('timeline.loadMore') }}
          </button>
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
import type { Memory } from '~/composables/useTimeline'
import { mosaicVariant } from '~/composables/useTimeline'
const { t, locale } = useI18n()

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

function onReactionUpdate({
  memoryId,
  reactions,
}: {
  memoryId: string
  reactions: any[]
}) {
  const i = memories.value.findIndex((m) => m.id === memoryId)
  if (i !== -1)
    memories.value[i] = {
      ...memories.value[i],
      memoryreaction: reactions,
    } as Memory
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
      children: ChildProfile[]
      members: CircleMember[]
    }>('/api/timeline', { query })
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
    if (isFirst) loading.value = false
    else loadingMore.value = false
  }
}

onMounted(() => fetchPage())
</script>

<style scoped>
/* .wide and .tall cell shapes are owned by MosaicCell.vue */
</style>
