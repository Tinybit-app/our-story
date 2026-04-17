<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 py-3.5 flex items-center gap-3">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
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
          <p class="text-xs text-muted-foreground">Loading memories…</p>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="memories.length === 0" class="text-center py-32">
        <p class="text-sm text-muted-foreground">No memories found for {{ monthLabel }}.</p>
      </div>

      <!-- Polaroid grid (uncapped) -->
      <div v-else>
        <p class="text-xs text-muted-foreground mb-6">
          {{ memories.length }} {{ memories.length === 1 ? 'memory' : 'memories' }}
        </p>
        <div class="flex flex-wrap gap-5">
          <PolaroidCard
            v-for="(memory, i) in memories"
            :key="memory.id"
            :memory="memory"
            :index="i"
          />
        </div>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'

const route = useRoute()
const year = Number(route.params.year)
const month = Number(route.params.month)

// Redirect to home if route params are invalid
if (!year || !month || month < 1 || month > 12 || year < 2000 || year > 2100) {
  await navigateTo('/')
}

const monthLabel = computed(() =>
  new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circleId = computed<string | null>(() => circlesData.value?.circles?.[0]?.id ?? null)

const memories = ref<Memory[]>([])
const loading = ref(false)

onMounted(async () => {
  if (!circleId.value) return
  loading.value = true
  try {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`
    const data = await $fetch<{ memories: Memory[]; nextCursor: null }>('/api/timeline', {
      query: { circleId: circleId.value, yearMonth },
    })
    memories.value = data.memories
  } catch (err) {
    console.error('[month-page] fetch error:', err)
  } finally {
    loading.value = false
  }
})
</script>
