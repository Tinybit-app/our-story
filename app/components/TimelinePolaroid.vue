<template>
  <div ref="rootEl">
    <!-- Empty state -->
    <div
      v-if="monthGroups.length === 0 && !loading"
      class="flex flex-col items-center justify-center py-32 text-center"
    >
      <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
        <svg
          class="h-7 w-7 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path
            d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
          />
          <circle cx="12" cy="13" r="3" />
        </svg>
      </div>
      <p class="mb-2 text-base font-semibold text-foreground">{{ typeConfig.emptyTitle }}</p>
      <p class="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {{ typeConfig.emptyDesc }}
      </p>
    </div>

    <!-- Loading skeleton (first load) -->
    <div v-else-if="loading && monthGroups.length === 0" class="flex justify-center py-32">
      <div class="flex flex-col items-center gap-3">
        <div
          class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <p class="text-xs text-muted-foreground">{{ t('timeline.loading') }}</p>
      </div>
    </div>

    <!-- Timeline -->
    <div v-else>
      <template v-for="yearSection in yearSections" :key="yearSection.year">
        <!-- Year anchor — IntersectionObserver target -->
        <div
          :id="`anchor-${yearSection.year}`"
          :data-year="yearSection.year"
          class="mb-10 flex items-center"
          :class="yearSections.indexOf(yearSection) === 0 ? 'mt-0' : 'mt-16'"
        >
          <!-- Amber tape label -->
          <span
            class="relative z-[1] flex-shrink-0 select-none font-['Caveat'] text-[28px] font-semibold"
            style="
              background: hsl(var(--accent));
              color: hsl(var(--background));
              padding: 4px 20px 6px;
              transform: rotate(-1deg);
              box-shadow: 2px 3px 8px rgba(44, 36, 32, 0.18);
              line-height: 1.2;
            "
            >{{ yearSection.year }}</span
          >
          <!-- Line to the right -->
          <div class="h-[2px] flex-1 bg-border" />
          <!-- Summary -->
          <span class="whitespace-nowrap px-[14px] text-[11px] text-muted-foreground">
            {{ yearSummary(yearSection) }}
          </span>
        </div>

        <!-- Month sections within this year -->
        <div
          v-for="group in yearSection.months"
          :key="group.label"
          :id="`month-${group.year}-${group.month}`"
          class="mb-14 mt-12 first:mt-0"
        >
          <!-- Month divider: two lines with uppercase month label between -->
          <div class="mb-8 flex items-center gap-4">
            <div class="h-px flex-1 bg-border" />
            <span class="text-[11px] font-semibold uppercase tracking-[.16em] text-muted-foreground"
              >{{ group.label }} &middot; {{ t('timeline.memories', group.totalCount) }}</span
            >
            <div class="h-px flex-1 bg-border" />
          </div>

          <!-- Polaroid grid: stacks centered on mobile (each card reads like
               a memory-book page), wraps as the casual pinned-photo wall on
               sm+ where the staggered widths from isWideMemory create rhythm. -->
          <div
            class="flex flex-col items-center gap-6 sm:flex-row sm:flex-wrap sm:items-start"
          >
            <template v-for="(memory, i) in group.memories" :key="memory.id">
              <!-- Text-only quick notes get the postcard card -->
              <QuickNoteCard
                v-if="!memory.memorymedia.length && memory.note"
                :memory="memory"
                :index="i"
                @open="$emit('openMemory', $event)"
                @reaction-update="$emit('reactionUpdate', $event)"
              />
              <!-- Photo / video memories get the polaroid -->
              <PolaroidCard
                v-else
                :memory="memory"
                :index="i"
                :wide="isWideMemory(memory.id)"
                @open="$emit('openMemory', $event)"
                @reaction-update="$emit('reactionUpdate', $event)"
              />
            </template>

            <!-- See more card -->
            <NuxtLink
              v-if="group.hasMore"
              :to="
                props.circleId
                  ? `/timeline/${group.year}/${group.month}?circle=${props.circleId}`
                  : `/timeline/${group.year}/${group.month}`
              "
              class="flex flex-shrink-0 flex-col items-center justify-center gap-1 self-center rounded-[4px] border-2 border-dashed border-muted-foreground/40 px-3 text-center text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              style="
                width: 160px;
                height: 160px;
                background: var(--border);
                transform: rotate(0.5deg);
              "
            >
              <span class="leading-snug"
                >+{{ group.totalCount - group.memories.length }} {{ t('timeline.more') }}</span
              >
              <span class="leading-snug">{{ t('timeline.open') }} {{ group.label }} →</span>
            </NuxtLink>
          </div>
        </div>
      </template>

      <!-- Infinite scroll sentinel -->
      <div ref="loadMoreEl" :class="'mt-2 h-4'" />

      <!-- Pagination loading -->
      <div v-if="loading && monthGroups.length > 0" class="flex justify-center py-6">
        <div
          class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonthGroup } from '~/composables/useTimeline'
const { t } = useI18n()

const props = defineProps<{
  monthGroups: MonthGroup[]
  loading: boolean
  hasNextPage: boolean
  circleType?: string | null
  // Forwarded to the "See more" link so the month-overflow page renders the
  // same circle the user was just viewing.
  circleId?: string | null
}>()

const typeConfig = computed(() => useCircleTypeConfig(props.circleType, t))

import type { Memory } from '~/composables/useTimeline'

const emit = defineEmits<{
  loadMore: []
  yearChange: [year: number]
  openMemory: [{ memory: Memory; tilt: number; rect: DOMRect }]
  reactionUpdate: [{ memoryId: string; reactions: any[] }]
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

// Returns true ~30% of the time based on a stable hash of the memory id.
// Deterministic so the layout never shifts on re-render.
function isWideMemory(id: string): boolean {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 10 < 3
}

function yearSummary(yearSection: { year: number; months: MonthGroup[] }): string {
  const totalMemories = yearSection.months.reduce((sum, g) => sum + g.totalCount, 0)
  const monthCount = yearSection.months.length
  return `${t('timeline.memories', totalMemories)} · ${t('timeline.months', monthCount)}`
}

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
    { rootMargin: '-10% 0px -85% 0px', threshold: 0 },
  )
  ;(rootEl.value ?? document)
    .querySelectorAll('[data-year]')
    .forEach((el) => yearObserver!.observe(el))
}

// Re-run observer when new year sections appear
watch(
  () => props.monthGroups.length,
  async () => {
    await nextTick()
    setupYearObserver()
  },
)

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
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - 120,
    behavior: 'smooth',
  })
}

defineExpose({ scrollToYear })
</script>
