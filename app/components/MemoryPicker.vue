<template>
  <!-- Loading -->
  <div v-if="picker.yearsLoading.value" class="flex justify-center py-10">
    <div
      class="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
    />
  </div>

  <!-- Empty state -->
  <div v-else-if="picker.yearGroups.value.length === 0" class="px-5 py-12 text-center">
    <div
      class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary"
    >
      <svg
        class="h-6 w-6 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        viewBox="0 0 24 24"
      >
        <path
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5z"
        />
      </svg>
    </div>
    <p class="mb-1 text-sm font-semibold text-foreground">{{ t('viewerLink.noMemoriesTitle') }}</p>
    <p class="text-xs text-muted-foreground">{{ t('viewerLink.noMemoriesBody') }}</p>
  </div>

  <!-- Year groups -->
  <div v-else>
    <div v-for="group in picker.yearGroups.value" :key="group.year">
      <!-- Year header (sticky) -->
      <div
        class="sticky top-0 z-10 flex cursor-pointer select-none items-center justify-between border-b border-border/20 bg-card px-5 pb-2 pt-3 transition-colors hover:bg-secondary/60"
        @click="picker.toggleYearCollapsed(group.year)"
      >
        <div class="flex items-center gap-2.5">
          <!-- Year selection checkbox -->
          <button
            type="button"
            :disabled="!group.loaded"
            @click.stop="group.loaded && picker.toggleYear(group.year)"
            class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all disabled:opacity-40"
            :class="picker.yearCheckboxClass(group.year)"
          >
            <svg
              v-if="picker.isYearFullySelected(group.year)"
              class="h-3 w-3 text-white"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              viewBox="0 0 24 24"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            <div
              v-else-if="picker.isYearPartiallySelected(group.year)"
              class="h-px w-2 rounded-full bg-primary"
            />
          </button>
          <span class="text-sm font-bold text-foreground">{{ group.year }}</span>
          <span
            v-if="group.loaded && group.memories.length > 0"
            class="text-[11px] text-muted-foreground"
          >
            {{ t('viewerLink.memoriesCount', { count: group.memories.length }) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <div
            v-if="group.loading"
            class="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-muted-foreground border-t-transparent"
          />
          <svg
            class="h-4 w-4 text-muted-foreground transition-transform duration-200"
            :class="picker.collapsedYears.value.has(group.year) ? '-rotate-90' : 'rotate-0'"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <!-- Year content (collapsible) -->
      <div v-if="!picker.collapsedYears.value.has(group.year)">
        <!-- Month groups -->
        <div v-if="group.loaded" class="px-5">
          <div v-for="mg in picker.getMonthGroups(group)" :key="mg.month" class="mb-2 mt-4">
            <!-- Month header -->
            <div
              class="-mx-2 mb-2 flex cursor-pointer select-none items-center justify-between rounded-lg border border-border/15 bg-secondary/40 px-2 py-1.5 transition-colors hover:bg-secondary/70"
              @click="picker.toggleMonthCollapsed(group.year, mg.month)"
            >
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  @click.stop="picker.toggleMonth(group.year, mg.month)"
                  class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-all"
                  :class="picker.monthCheckboxClass(group.year, mg.month)"
                >
                  <svg
                    v-if="picker.isMonthSelected(group.year, mg.month) === 'full'"
                    class="h-2.5 w-2.5 text-white"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    viewBox="0 0 24 24"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <div
                    v-else-if="picker.isMonthSelected(group.year, mg.month) === 'partial'"
                    class="h-px w-1.5 rounded-full bg-primary"
                  />
                </button>
                <span class="text-xs font-semibold text-foreground/70">{{
                  picker.monthName(mg.month)
                }}</span>
                <span class="text-[10px] tabular-nums text-muted-foreground">
                  {{ t('viewerLink.memoriesCount', { count: mg.memories.length }) }}
                </span>
              </div>
              <svg
                class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200"
                :class="
                  picker.collapsedMonths.value.has(`${group.year}-${mg.month}`)
                    ? '-rotate-90'
                    : 'rotate-0'
                "
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <!-- Month grid (collapsible) -->
            <div
              v-if="!picker.collapsedMonths.value.has(`${group.year}-${mg.month}`)"
              class="grid grid-cols-5 gap-1"
            >
              <button
                v-for="memory in mg.memories"
                :key="memory.id"
                type="button"
                @click="picker.toggleMemory(memory.id)"
                class="relative aspect-square cursor-pointer overflow-hidden rounded-[6px] bg-secondary transition-transform active:scale-95"
                :class="
                  picker.selectedMemoryIds.value.has(memory.id)
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-card'
                    : ''
                "
              >
                <!-- Image -->
                <img
                  v-if="memory.mediaType === 'image' && (memory.thumbnailUrl || memory.signedUrl)"
                  :src="memory.thumbnailUrl || memory.signedUrl || undefined"
                  :alt="memory.memory_date"
                  class="h-full w-full object-cover"
                  loading="lazy"
                />

                <!-- Video -->
                <template v-else-if="memory.mediaType === 'video'">
                  <img
                    v-if="memory.thumbnailUrl"
                    :src="memory.thumbnailUrl"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <video
                    v-else-if="memory.signedUrl"
                    :src="memory.signedUrl"
                    preload="metadata"
                    muted
                    playsinline
                    class="pointer-events-none h-full w-full object-cover"
                  />
                  <div v-else class="h-full w-full bg-muted" />
                  <div class="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div class="flex h-5 w-5 items-center justify-center rounded-full bg-black/50">
                      <svg
                        class="ml-px h-2.5 w-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </template>

                <!-- Quick note -->
                <div
                  v-else-if="memory.note"
                  class="flex h-full w-full flex-col items-center justify-center bg-amber-50 p-1 dark:bg-amber-950/30"
                >
                  <svg
                    class="mb-0.5 h-2.5 w-2.5 flex-shrink-0 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <p
                    class="line-clamp-3 text-center text-[6px] italic leading-tight text-amber-900 dark:text-amber-100"
                  >
                    {{ memory.note }}
                  </p>
                </div>

                <!-- Fallback -->
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center text-muted-foreground/30"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5z"
                    />
                  </svg>
                </div>

                <!-- Date overlay (images/videos) -->
                <div
                  v-if="memory.mediaType !== null"
                  class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-0.5 pb-0.5 pt-4"
                >
                  <p class="truncate text-center text-[7px] font-medium leading-tight text-white">
                    {{ picker.formatTileDate(memory.memory_date) }}
                  </p>
                </div>
                <!-- Date label (notes) -->
                <div
                  v-else-if="memory.note"
                  class="absolute inset-x-0 bottom-0.5 flex justify-center"
                >
                  <p
                    class="text-[7px] font-medium leading-tight text-amber-600 dark:text-amber-400"
                  >
                    {{ picker.formatTileDate(memory.memory_date) }}
                  </p>
                </div>

                <!-- Selected checkmark -->
                <div
                  v-if="picker.selectedMemoryIds.value.has(memory.id)"
                  class="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-sm"
                >
                  <svg
                    class="h-2.5 w-2.5 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    viewBox="0 0 24 24"
                  >
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
          class="mx-5 mb-2 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/30"
        >
          <svg
            class="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
              {{ t('viewerLink.truncatedWarning', { count: group.memories.length }) }}
            </p>
            <button
              type="button"
              :disabled="group.loading"
              @click="picker.loadYearComplete(group.year)"
              class="mt-1.5 text-[11px] font-semibold text-amber-700 underline underline-offset-2 transition-colors hover:text-amber-900 disabled:opacity-50 dark:text-amber-300 dark:hover:text-amber-100"
            >
              {{ group.loading ? t('viewerLink.loading') : t('viewerLink.loadAll') }}
            </button>
          </div>
        </div>

        <!-- Year loading skeleton -->
        <div v-else-if="group.loading" class="mb-4 mt-3 grid grid-cols-5 gap-1 px-5">
          <div
            v-for="i in 15"
            :key="i"
            class="aspect-square animate-pulse rounded-[6px] bg-secondary"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MEMORY_PICKER_KEY } from '~/composables/useMemoryPicker'

const { t } = useI18n()
const picker = inject(MEMORY_PICKER_KEY)!
</script>
