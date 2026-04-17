<template>
  <div ref="rootEl">

    <!-- Empty state -->
    <div v-if="monthGroups.length === 0 && !loading" class="flex flex-col items-center justify-center py-32 text-center">
      <div class="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-5">
        <svg class="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
      </div>
      <p class="text-base font-semibold text-foreground mb-2">Your story starts here</p>
      <p class="text-sm text-muted-foreground leading-relaxed max-w-xs">
        Add your first photo or video to start building your shared timeline.
      </p>
    </div>

    <!-- Loading skeleton (first load) -->
    <div v-else-if="loading && monthGroups.length === 0" class="flex justify-center py-32">
      <div class="flex flex-col items-center gap-3">
        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p class="text-xs text-muted-foreground">Loading memories…</p>
      </div>
    </div>

    <!-- Timeline -->
    <div v-else>
      <template v-for="yearSection in yearSections" :key="yearSection.year">

        <!-- Year anchor — IntersectionObserver target -->
        <div
          :id="`anchor-${yearSection.year}`"
          :data-year="yearSection.year"
          class="relative flex items-center gap-4 mb-8 mt-2"
        >
          <div class="h-px flex-1 bg-border" />
          <span class="font-['Caveat'] text-3xl font-semibold text-muted-foreground/60 select-none px-2">
            {{ yearSection.year }}
          </span>
          <div class="h-px flex-1 bg-border" />
        </div>

        <!-- Month sections within this year -->
        <div
          v-for="group in yearSection.months"
          :key="group.label"
          class="mb-12"
        >
          <!-- Month header -->
          <div class="flex items-baseline gap-3 mb-4">
            <h2 class="font-['Caveat'] text-xl font-semibold text-foreground">{{ group.label }}</h2>
            <span class="text-xs text-muted-foreground">{{ group.memories.length }}{{ group.hasMore ? '+' : '' }} memories</span>
          </div>

          <!-- Polaroid grid -->
          <div class="flex flex-wrap gap-5">
            <PolaroidCard
              v-for="(memory, i) in group.memories"
              :key="memory.id"
              :memory="memory"
              :index="i"
            />

            <!-- See more card -->
            <NuxtLink
              v-if="group.hasMore"
              :to="`/timeline/${group.year}/${group.month}`"
              class="w-44 flex-shrink-0 aspect-[3/4] flex flex-col items-center justify-center
                     border-2 border-dashed border-border rounded-sm hover:border-primary
                     hover:bg-secondary transition-colors gap-2 text-center px-3"
            >
              <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span class="font-['Caveat'] text-sm text-muted-foreground leading-snug">
                See all in<br />{{ group.label }}
              </span>
            </NuxtLink>

          </div>
        </div>

      </template>

      <!-- Infinite scroll sentinel -->
      <div ref="loadMoreEl" class="h-4 mt-2" />

      <!-- Pagination loading -->
      <div v-if="loading && monthGroups.length > 0" class="flex justify-center py-6">
        <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { MonthGroup } from '~/composables/useTimeline'

const props = defineProps<{
  monthGroups: MonthGroup[]
  loading: boolean
  hasNextPage: boolean
}>()

const emit = defineEmits<{
  loadMore: []
  yearChange: [year: number]
}>()

// Group month groups by year for rendering
const yearSections = computed(() => {
  const map = new Map<number, MonthGroup[]>()
  for (const group of props.monthGroups) {
    if (!map.has(group.year)) map.set(group.year, [])
    map.get(group.year)!.push(group)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({ year, months }))
})

// Root element for scoped observers
const rootEl = ref<HTMLElement>()

// Infinite scroll
const loadMoreEl = ref<HTMLElement>()
const { stop: stopLoadMore } = useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && props.hasNextPage && !props.loading) {
    emit('loadMore')
  }
})

// Year badge tracking via IntersectionObserver
let yearObserver: IntersectionObserver | null = null

function setupYearObserver() {
  yearObserver?.disconnect()
  yearObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const year = Number((entry.target as HTMLElement).dataset.year)
          if (year) emit('yearChange', year)
        }
      }
    },
    { rootMargin: '-10% 0px -85% 0px', threshold: 0 }
  )
  ;(rootEl.value ?? document).querySelectorAll('[data-year]').forEach((el) => yearObserver!.observe(el))
}

// Re-run observer when new year sections appear
watch(() => props.monthGroups.length, async () => {
  await nextTick()
  setupYearObserver()
})

onMounted(async () => {
  await nextTick()
  setupYearObserver()
})

onUnmounted(() => {
  stopLoadMore()
  yearObserver?.disconnect()
})

// Exposed for jump modal — scroll to year section
function scrollToYear(year: number) {
  const el = document.getElementById(`anchor-${year}`)
  if (!el) return
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' })
}

defineExpose({ scrollToYear })
</script>
