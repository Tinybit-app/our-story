<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
      <div class="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Our Story</p>
          <p class="text-sm font-semibold text-foreground leading-tight">{{ family?.name ?? '…' }}</p>
        </div>
        <UploadMemory
          v-if="familyId"
          :family-id="familyId"
          @uploaded="onUploaded"
        />
      </div>
    </header>

    <!-- Feed -->
    <main class="max-w-md mx-auto px-4 py-4">

      <!-- Initial loading -->
      <div v-if="loading && memories.length === 0" class="flex justify-center py-20">
        <div class="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>

      <!-- Empty state -->
      <div v-else-if="!loading && memories.length === 0" class="text-center py-20">
        <p class="text-sm font-medium text-foreground mb-1">No memories yet</p>
        <p class="text-xs text-muted-foreground">Add your first memory using the button above.</p>
      </div>

      <!-- Cards -->
      <div v-else class="space-y-4">
        <MemoryCard
          v-for="memory in memories"
          :key="memory.id"
          :memory="memory"
        />
      </div>

      <!-- Infinite scroll sentinel -->
      <div ref="loadMoreEl" class="h-4 mt-4" />

      <!-- Pagination loading -->
      <div v-if="loading && memories.length > 0" class="flex justify-center py-6">
        <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
const { data: familiesData } = await useFetch<{ families: any[] }>('/api/families')

const family = computed(() => familiesData.value?.families?.[0] ?? null)
const familyId = computed<string | null>(() => family.value?.id ?? null)

const memories = ref<any[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadMoreEl = ref<HTMLElement>()

async function fetchTimeline(cursor?: string) {
  if (loading.value || !familyId.value) return
  loading.value = true
  try {
    const data = await $fetch<{ memories: any[]; nextCursor: string | null }>('/api/timeline', {
      query: { familyId: familyId.value, ...(cursor ? { cursor } : {}) },
    })
    memories.value = cursor ? [...memories.value, ...data.memories] : data.memories
    nextCursor.value = data.nextCursor
  } catch (err) {
    console.error('[timeline] fetch error:', err)
  } finally {
    loading.value = false
  }
}

function onUploaded() {
  fetchTimeline() // reload from top
}

const { stop } = useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && nextCursor.value && !loading.value) {
    fetchTimeline(nextCursor.value)
  }
})

onMounted(() => fetchTimeline())
onUnmounted(() => stop())
</script>
