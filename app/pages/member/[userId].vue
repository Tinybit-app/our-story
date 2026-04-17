<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-5xl mx-auto px-5 py-3.5 flex items-center gap-3">
        <button
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 flex-shrink-0"
          @click="router.back()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Back
        </button>

        <div class="flex-1 flex items-center gap-3 min-w-0" v-if="member">
          <div class="w-8 h-8 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0 flex items-center justify-center bg-secondary">
            <img v-if="member.avatarUrl" :src="member.avatarUrl" class="w-full h-full object-cover" />
            <span v-else class="text-[10px] font-bold text-foreground">{{ initials(member) }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-foreground leading-none truncate">{{ displayName(member) }}</p>
            <p class="text-[10px] text-muted-foreground mt-0.5 capitalize">{{ member.role }}</p>
          </div>
        </div>
        <div v-else class="flex-1" />
      </div>
    </header>

    <!-- Feed -->
    <main class="max-w-5xl mx-auto px-5 py-6">

      <!-- Loading -->
      <div v-if="loading && memories.length === 0" class="flex flex-col items-center gap-3 justify-center py-32">
        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p class="text-xs text-muted-foreground">Loading memories…</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!loading && memories.length === 0" class="flex flex-col items-center justify-center py-32 text-center">
        <div class="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-5">
          <svg class="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        </div>
        <p class="text-base font-semibold text-foreground mb-2">No memories yet</p>
        <p class="text-sm text-muted-foreground">{{ member ? displayName(member) : 'This member' }} hasn't shared any memories.</p>
      </div>

      <!-- Grid -->
      <div v-else class="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-0">
        <div v-for="memory in memories" :key="memory.id" class="break-inside-avoid mb-4">
          <MemoryCard :memory="memory" />
        </div>
      </div>

      <!-- Infinite scroll sentinel -->
      <div ref="loadMoreEl" class="h-4 mt-2" />

      <!-- Pagination loading -->
      <div v-if="loading && memories.length > 0" class="flex justify-center py-6">
        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>

    </main>

  </div>
</template>

<script setup lang="ts">
definePageMeta({})

const router = useRouter()
const route = useRoute()
const userId = route.params.userId as string

// ── Circle + member info ───────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circle = computed(() => circlesData.value?.circles?.[0] ?? null)
const circleId = computed<string | null>(() => circle.value?.id ?? null)

const { data: membersData } = await useAsyncData(
  `members-${circleId.value}`,
  () => $fetch<{ members: any[] }>(`/api/circles/${circleId.value!}/members`),
  { immediate: !!circleId.value },
)
const member = computed(() => membersData.value?.members.find((m: any) => m.userId === userId) ?? null)

function displayName(m: any): string {
  const parts = [m.firstName, m.lastName].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Unknown'
}

function initials(m: any): string {
  const first = m.firstName?.[0] ?? ''
  const last = m.lastName?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

// ── Timeline ───────────────────────────────────────────────
const memories = ref<any[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadMoreEl = ref<HTMLElement>()

async function fetchTimeline(cursor?: string) {
  if (loading.value || !circleId.value) return
  loading.value = true
  try {
    const data = await $fetch<{ memories: any[]; nextCursor: string | null }>('/api/timeline', {
      query: { circleId: circleId.value, authorId: userId, ...(cursor ? { cursor } : {}) },
    })
    memories.value = cursor ? [...memories.value, ...data.memories] : data.memories
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[member-timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}

const { stop } = useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && nextCursor.value && !loading.value) {
    fetchTimeline(nextCursor.value)
  }
})

onMounted(() => fetchTimeline())
onUnmounted(() => stop())
</script>
