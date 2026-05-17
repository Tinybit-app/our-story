<template>
  <div ref="rootEl">
    <!-- Empty state -->
    <div
      v-if="monthGroups.length === 0 && !loading"
      class="flex flex-col items-center justify-center py-32 text-center"
    >
      <div
        class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary"
      >
        <svg
          class="h-6 w-6 text-muted-foreground"
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
      <p class="mb-2 font-hanken text-base font-bold text-foreground">
        {{ t('timeline.emptyTitle') }}
      </p>
      <p
        class="max-w-xs font-hanken text-sm leading-relaxed text-muted-foreground"
      >
        {{ t('timeline.emptyDesc') }}
      </p>
    </div>

    <!-- First-load spinner -->
    <div
      v-else-if="loading && monthGroups.length === 0"
      class="flex justify-center py-32"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
        />
        <p class="font-hanken text-xs text-muted-foreground">
          {{ t('timeline.loading') }}
        </p>
      </div>
    </div>

    <!-- Timeline -->
    <div v-else>
      <template v-for="yearSection in yearSections" :key="yearSection.year">
        <!-- Year ribbon -->
        <div
          :id="`anchor-${yearSection.year}`"
          :data-year="yearSection.year"
          class="year-ribbon"
        >
          <span class="yr">
            {{ yearSection.year }}
            <em v-if="suffixFor(yearSection.year)">{{ suffixFor(yearSection.year) }}</em>
          </span>
          <span class="tally">{{ yearTally(yearSection) }}</span>
        </div>

        <!-- Month rows -->
        <div
          v-for="group in yearSection.months"
          :key="group.label"
          :id="`month-${group.year}-${group.month}`"
          class="month-section"
        >
          <div class="month-row">
            <span class="mn">{{ monthName(group) }}</span>
            <span class="my">{{ group.year }}</span>
            <span class="mc">{{ t('timeline.memories', group.totalCount).toUpperCase() }}</span>
          </div>
          <div class="grid">
            <MosaicCell
              v-for="memory in group.memories"
              :key="memory.id"
              :memory="memory"
              :class="cellClass(memory.id, memory)"
              @open="(p) => $emit('openMemory', p)"
            />
          </div>
          <NuxtLink
            v-if="group.hasMore"
            :to="monthLink(group)"
            class="see-all"
          >
            {{ t('timeline.seeAllInMonth', { count: group.totalCount, label: monthLabel(group) }) }}
            <svg class="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>
      </template>

      <!-- Load-more sentinel + spinner -->
      <div ref="loadMoreEl" class="py-8">
        <div v-if="loading && monthGroups.length > 0" class="flex justify-center">
          <div
            class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import type { Memory, MonthGroup } from '~/composables/useTimeline'
import { mosaicVariant } from '~/composables/useTimeline'
import MosaicCell from '~/components/MosaicCell.vue'

const { t, locale } = useI18n()

const props = defineProps<{
  monthGroups: MonthGroup[]
  loading: boolean
  hasNextPage: boolean
  circleType: string | null
  circleId: string | null
}>()

const emit = defineEmits<{
  loadMore: []
  yearChange: [year: number]
  openMemory: [
    payload: { memory: Memory; rect: DOMRect | null; tilt: number },
  ]
  reactionUpdate: [{ memoryId: string; reactions: unknown[] }]
}>()

const rootEl = ref<HTMLElement>()
const loadMoreEl = ref<HTMLElement>()

// Group month-groups by year for ribbon rendering
interface YearSection {
  year: number
  months: MonthGroup[]
}
const yearSections = computed<YearSection[]>(() => {
  const byYear = new Map<number, MonthGroup[]>()
  for (const g of props.monthGroups) {
    if (!byYear.has(g.year)) byYear.set(g.year, [])
    byYear.get(g.year)!.push(g)
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({ year, months }))
})

const yearTally = (s: YearSection): string => {
  const total = s.months.reduce((sum, g) => sum + g.totalCount, 0)
  return t('timeline.memories', total).toUpperCase()
}

const currentYear = new Date().getFullYear()
const suffixFor = (year: number): string | null => {
  if (year === currentYear) return t('timeline.thisYearSuffix')
  if (year === currentYear - 1) return t('timeline.lastYearSuffix')
  return null
}

const monthName = (g: MonthGroup): string => {
  return new Intl.DateTimeFormat(locale.value, { month: 'long' })
    .format(new Date(g.year, g.month - 1, 1))
    .toUpperCase()
}

const monthLabel = (g: MonthGroup): string => {
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' })
    .format(new Date(g.year, g.month - 1, 1))
}

const monthLink = (g: MonthGroup): string => {
  const base = `/timeline/${g.year}/${g.month}`
  return props.circleId ? `${base}?circle=${props.circleId}` : base
}

// Span class — .note cells never span; photo cells use the deterministic hash
const cellClass = (id: string, memory: Memory): string => {
  if (memory.memorymedia.length === 0 && memory.note) return ''
  const v = mosaicVariant(id)
  if (v === 'wide') return 'wide'
  if (v === 'tall') return 'tall'
  return ''
}

// IntersectionObserver — emit yearChange for the most-visible ribbon
const yearRibbonObservers: Array<() => void> = []
watch(
  yearSections,
  (sections) => {
    yearRibbonObservers.forEach((stop) => stop())
    yearRibbonObservers.length = 0
    void requestAnimationFrame(() => {
      for (const s of sections) {
        const el = document.getElementById(`anchor-${s.year}`)
        if (!el) continue
        const { stop } = useIntersectionObserver(
          el,
          ([entry]) => {
            if (entry?.isIntersecting) emit('yearChange', s.year)
          },
          { threshold: 0.4 },
        )
        yearRibbonObservers.push(stop)
      }
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  yearRibbonObservers.forEach((stop) => stop())
  yearRibbonObservers.length = 0
})

// Load-more sentinel
useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting && props.hasNextPage && !props.loading) {
    emit('loadMore')
  }
})

// Public ref API
defineExpose({
  scrollToYear(year: number) {
    const el = document.getElementById(`anchor-${year}`)
    if (!el) return
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 80,
      behavior: 'smooth',
    })
  },
})
</script>

<style scoped>
/* ─── Year ribbon ───────────────────────────────────────────── */
.year-ribbon {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 0 0 14px;
  margin: 28px 0 22px;
  border-bottom: 1px solid hsl(var(--foreground) / 0.16);
}
.year-ribbon:first-child {
  margin-top: 0;
}
.year-ribbon .yr {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: hsl(var(--foreground));
}
.year-ribbon .yr em {
  font-family: 'Instrument Serif', serif;
  font-style: italic;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
  margin-left: 4px;
}
.year-ribbon .tally {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: hsl(var(--foreground-faint));
  text-transform: uppercase;
}

/* ─── Month row ──────────────────────────────────────────────── */
.month-section {
  margin-bottom: 22px;
}
.month-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 8px;
}
.month-row .mn {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: hsl(var(--foreground));
  text-transform: uppercase;
}
.month-row .my {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 500;
  font-size: 11px;
  color: hsl(var(--foreground-faint));
}
.month-row .mc {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 400;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: hsl(var(--foreground-faint));
}

/* ─── Photo grid ─────────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.grid > :deep(.mosaic-cell) {
  aspect-ratio: 1 / 1;
}
.grid > :deep(.wide) {
  grid-column: span 2;
  aspect-ratio: 2 / 1;
}
.grid > :deep(.tall) {
  grid-row: span 2;
  aspect-ratio: 1 / 2;
}

.see-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding: 9px 14px;
  border-radius: 999px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: hsl(var(--foreground) / 0.86);
  text-decoration: none;
  transition: background 200ms, border-color 200ms, color 200ms;
}
.see-all:hover {
  background: hsl(var(--foreground));
  color: hsl(var(--background));
  border-color: hsl(var(--foreground));
}
.see-all .arrow {
  transition: transform 200ms ease;
}
.see-all:hover .arrow {
  transform: translateX(2px);
}
</style>
