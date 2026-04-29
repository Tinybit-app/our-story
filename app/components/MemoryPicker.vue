<template>
  <!-- Loading -->
  <div v-if="yearsLoading" class="flex justify-center py-10">
    <div class="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
  </div>

  <!-- Empty state -->
  <div v-else-if="yearGroups.length === 0" class="py-12 px-5 text-center">
    <div class="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-4">
      <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5z"/>
      </svg>
    </div>
    <p class="text-sm font-semibold text-foreground mb-1">{{ t('viewerLink.noMemoriesTitle') }}</p>
    <p class="text-xs text-muted-foreground">{{ t('viewerLink.noMemoriesBody') }}</p>
  </div>

  <!-- Year groups -->
  <div v-else>
    <div v-for="group in yearGroups" :key="group.year">
      <!-- Year header (sticky) -->
      <div
        class="sticky top-0 bg-card z-10 flex items-center justify-between px-5 pt-3 pb-2 border-b border-border/20 cursor-pointer select-none hover:bg-secondary/60 transition-colors"
        @click="toggleYearCollapsed(group.year)"
      >
        <div class="flex items-center gap-2.5">
          <!-- Year selection checkbox -->
          <button
            type="button"
            :disabled="!group.loaded"
            @click.stop="group.loaded && toggleYear(group.year)"
            class="w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
            :class="yearCheckboxClass(group.year)"
          >
            <svg v-if="isYearFullySelected(group.year)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
            <div v-else-if="isYearPartiallySelected(group.year)" class="w-2 h-px bg-primary rounded-full" />
          </button>
          <span class="text-sm font-bold text-foreground">{{ group.year }}</span>
          <span v-if="group.loaded && group.memories.length > 0" class="text-[11px] text-muted-foreground">
            {{ t("viewerLink.memoriesCount", { count: group.memories.length }) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <div v-if="group.loading" class="w-3.5 h-3.5 border-[1.5px] border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <!-- Collapse chevron -->
          <svg
            class="w-4 h-4 text-muted-foreground transition-transform duration-200"
            :class="collapsedYears.has(group.year) ? '-rotate-90' : 'rotate-0'"
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <!-- Year content (collapsible) -->
      <div v-if="!collapsedYears.has(group.year)">
        <!-- Month groups -->
        <div v-if="group.loaded" class="px-5">
          <div v-for="mg in getMonthGroups(group)" :key="mg.month" class="mt-4 mb-2">
            <!-- Month header -->
            <div
              class="flex items-center justify-between mb-2 px-2 -mx-2 py-1.5 rounded-lg cursor-pointer select-none bg-secondary/40 hover:bg-secondary/70 transition-colors border border-border/15"
              @click="toggleMonthCollapsed(group.year, mg.month)"
            >
              <div class="flex items-center gap-1.5">
                <!-- Month selection checkbox -->
                <button
                  type="button"
                  @click.stop="toggleMonth(group.year, mg.month)"
                  class="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-all"
                  :class="monthCheckboxClass(group.year, mg.month)"
                >
                  <svg v-if="isMonthSelected(group.year, mg.month) === 'full'" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <div v-else-if="isMonthSelected(group.year, mg.month) === 'partial'" class="w-1.5 h-px bg-primary rounded-full" />
                </button>
                <span class="text-xs font-semibold text-foreground/70">{{ monthName(mg.month) }}</span>
                <span class="text-[10px] text-muted-foreground tabular-nums">
                  {{ t("viewerLink.memoriesCount", { count: mg.memories.length }) }}
                </span>
              </div>
              <!-- Month collapse chevron -->
              <svg
                class="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200"
                :class="collapsedMonths.has(`${group.year}-${mg.month}`) ? '-rotate-90' : 'rotate-0'"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <!-- Month grid (collapsible) -->
            <div v-if="!collapsedMonths.has(`${group.year}-${mg.month}`)" class="grid grid-cols-5 gap-1">
              <button
                v-for="memory in mg.memories"
                :key="memory.id"
                type="button"
                @click="toggleMemory(memory.id)"
                class="relative aspect-square rounded-[6px] overflow-hidden bg-secondary cursor-pointer transition-transform active:scale-95"
                :class="selectedMemoryIds.has(memory.id) ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : ''"
              >
                <!-- Image -->
                <img
                  v-if="memory.mediaType === 'image' && (memory.thumbnailUrl || memory.signedUrl)"
                  :src="memory.thumbnailUrl || memory.signedUrl || undefined"
                  :alt="memory.memory_date"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />

                <!-- Video -->
                <template v-else-if="memory.mediaType === 'video'">
                  <img v-if="memory.thumbnailUrl" :src="memory.thumbnailUrl" class="w-full h-full object-cover" loading="lazy" />
                  <video v-else-if="memory.signedUrl" :src="memory.signedUrl" preload="metadata" muted playsinline class="w-full h-full object-cover pointer-events-none" />
                  <div v-else class="w-full h-full bg-muted" />
                  <div class="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div class="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                      <svg class="w-2.5 h-2.5 text-white ml-px" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </template>

                <!-- Quick note -->
                <div v-else-if="memory.note" class="w-full h-full flex flex-col items-center justify-center p-1 bg-amber-50 dark:bg-amber-950/30">
                  <svg class="w-2.5 h-2.5 text-amber-500 mb-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <p class="text-[6px] leading-tight text-amber-900 dark:text-amber-100 text-center line-clamp-3 italic">{{ memory.note }}</p>
                </div>

                <!-- Fallback -->
                <div v-else class="w-full h-full flex items-center justify-center text-muted-foreground/30">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5z" />
                  </svg>
                </div>

                <!-- Date overlay (images/videos) -->
                <div v-if="memory.mediaType !== null" class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent pt-4 pb-0.5 px-0.5">
                  <p class="text-[7px] font-medium text-white text-center leading-tight truncate">{{ formatTileDate(memory.memory_date) }}</p>
                </div>
                <!-- Date label (notes) -->
                <div v-else-if="memory.note" class="absolute bottom-0.5 inset-x-0 flex justify-center">
                  <p class="text-[7px] text-amber-600 dark:text-amber-400 font-medium leading-tight">{{ formatTileDate(memory.memory_date) }}</p>
                </div>

                <!-- Selected checkmark -->
                <div v-if="selectedMemoryIds.has(memory.id)" class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <svg class="w-2.5 h-2.5 text-primary-foreground" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Truncation warning -->
        <div
          v-if="group.loaded && group.truncated"
          class="mx-5 mt-3 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40"
        >
          <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
              {{ t("viewerLink.truncatedWarning", { count: group.memories.length }) }}
            </p>
            <button
              type="button"
              :disabled="group.loading"
              @click="loadYearComplete(group.year)"
              class="mt-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 transition-colors disabled:opacity-50"
            >
              {{ group.loading ? t("viewerLink.loading") : t("viewerLink.loadAll") }}
            </button>
          </div>
        </div>

        <!-- Year loading skeleton -->
        <div v-else-if="group.loading" class="px-5 mt-3 mb-4 grid grid-cols-5 gap-1">
          <div v-for="i in 15" :key="i" class="aspect-square rounded-[6px] bg-secondary animate-pulse" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { YearGroup } from '~/composables/useMemoryPicker'

const { t } = useI18n()

defineProps<{
  yearGroups: YearGroup[]
  yearsLoading: boolean
  selectedMemoryIds: Set<string>
  collapsedYears: Set<number>
  collapsedMonths: Set<string>
  getMonthGroups: Function
  monthName: Function
  formatTileDate: Function
  isYearFullySelected: Function
  isYearPartiallySelected: Function
  isMonthSelected: Function
  yearCheckboxClass: Function
  monthCheckboxClass: Function
  toggleYear: Function
  toggleMonth: Function
  toggleMemory: Function
  toggleYearCollapsed: Function
  toggleMonthCollapsed: Function
  loadYearComplete: Function
}>()
</script>
