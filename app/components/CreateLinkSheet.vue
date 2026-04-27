<template>
  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
      @click="$emit('close')"
    />
  </Transition>

  <!-- Sheet -->
  <Transition name="slide-up">
    <div
      v-if="open"
      class="fixed inset-x-0 bottom-0 z-[60] bg-card border-t border-border rounded-t-[24px] shadow-2xl max-h-[85vh] flex flex-col"
    >
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1 flex-shrink-0">
        <div class="w-10 h-1 rounded-full bg-border" />
      </div>

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <h2 class="text-base font-bold text-foreground">{{ t('viewerLink.createLink') }}</h2>
        <button
          type="button"
          @click="$emit('close')"
          :aria-label="t('viewerLink.close')"
          class="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Main mode tabs: Full | Custom -->
      <div class="flex gap-1 mx-5 mb-3 p-1 bg-secondary rounded-[12px] flex-shrink-0">
        <button
          v-for="mode in mainModes"
          :key="mode.value"
          type="button"
          @click="selectedMainMode = mode.value"
          class="flex-1 h-8 rounded-[10px] text-xs font-semibold transition-all"
          :class="selectedMainMode === mode.value
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'"
        >
          {{ mode.label }}
        </button>
      </div>

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto px-5 pb-4">

        <!-- CUSTOM mode -->
        <div v-if="selectedMainMode === 'custom'">

          <!-- Years loading -->
          <div v-if="yearsLoading" class="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <div class="w-3.5 h-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            {{ t('viewerLink.loading') }}
          </div>

          <!-- Year tabs -->
          <div
            v-else-if="availableYears.length > 0"
            class="flex gap-1.5 mb-2 overflow-x-auto pb-0.5 -mx-5 px-5 scrollbar-none"
          >
            <button
              v-for="year in availableYears"
              :key="year"
              type="button"
              @click="setFilterYear(year)"
              class="flex-shrink-0 h-7 px-3 rounded-full text-[11px] font-semibold transition-all"
              :class="selectedFilterYear === year
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:text-foreground'"
            >{{ year }}</button>
          </div>

          <!-- Month pills (client-side, from loaded memories) -->
          <div
            v-if="memoryMonths.length > 1"
            class="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 -mx-5 px-5 scrollbar-none"
          >
            <button
              type="button"
              @click="setFilterMonth(null)"
              class="flex-shrink-0 h-6 px-2.5 rounded-full text-[11px] font-medium transition-all"
              :class="!selectedFilterMonth
                ? 'bg-primary/15 text-primary font-semibold'
                : 'bg-secondary text-muted-foreground hover:text-foreground'"
            >{{ t('viewerLink.allMonths') }}</button>
            <button
              v-for="month in memoryMonths"
              :key="month"
              type="button"
              @click="setFilterMonth(month)"
              class="flex-shrink-0 h-6 px-2.5 rounded-full text-[11px] font-medium transition-all"
              :class="selectedFilterMonth === month
                ? 'bg-primary/15 text-primary font-semibold'
                : 'bg-secondary text-muted-foreground hover:text-foreground'"
            >{{ monthName(month) }}</button>
          </div>

          <!-- Sub-mode toggle: Date range / Pick memories -->
          <div class="flex gap-0.5 mb-3 p-0.5 bg-secondary rounded-[10px]">
            <button
              v-for="sub in subModes"
              :key="sub.value"
              type="button"
              @click="customSubMode = sub.value"
              class="flex-1 h-7 rounded-[8px] text-[11px] font-semibold transition-all"
              :class="customSubMode === sub.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'"
            >{{ sub.label }}</button>
          </div>

          <!-- Date range inputs (date_range sub-mode) -->
          <div v-if="customSubMode === 'date_range'" class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('viewerLink.dateFrom') }}</label>
              <input
                v-model="dateFrom"
                type="date"
                :min="dateMin"
                :max="dateTo || dateMax"
                class="w-full h-9 px-3 rounded-[10px] bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('viewerLink.dateTo') }}</label>
              <input
                v-model="dateTo"
                type="date"
                :min="dateFrom || dateMin"
                :max="dateMax"
                class="w-full h-9 px-3 rounded-[10px] bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <!-- Actions bar -->
          <div class="flex items-center justify-between mb-2 min-h-[24px]">
            <!-- Left: selection controls (pick mode) or range count (date range mode) -->
            <div class="flex items-center gap-2">
              <template v-if="customSubMode === 'selection'">
                <span
                  v-if="selectedMemoryIds.size > 0"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary"
                >
                  {{ t('viewerLink.selectedCount', { count: selectedMemoryIds.size }) }}
                </span>
                <button
                  v-if="filteredMemories.length > 0 && selectedMemoryIds.size < filteredMemories.length"
                  type="button"
                  @click="selectAllVisible"
                  class="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >{{ t('viewerLink.selectAll') }}</button>
                <button
                  v-if="selectedMemoryIds.size > 0"
                  type="button"
                  @click="selectedMemoryIds = new Set()"
                  class="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >{{ t('viewerLink.clearAll') }}</button>
              </template>
              <template v-else>
                <span v-if="!memoriesLoading && filteredMemories.length > 0" class="text-[11px] text-muted-foreground">
                  {{ t('viewerLink.memoriesInRange', { count: filteredMemories.length }) }}
                </span>
              </template>
            </div>
            <!-- Right: loading indicator -->
            <div v-if="memoriesLoading" class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div class="w-3 h-3 border-[1.5px] border-muted-foreground border-t-transparent rounded-full animate-spin" />
              {{ t('viewerLink.loading') }}
            </div>
          </div>

          <!-- 5-column memory grid -->
          <div class="grid grid-cols-5 gap-1">
            <button
              v-for="memory in filteredMemories"
              :key="memory.id"
              type="button"
              :disabled="customSubMode === 'date_range'"
              @click="customSubMode === 'selection' && toggleMemory(memory.id)"
              :aria-label="memory.memory_date"
              :aria-pressed="customSubMode === 'selection' ? selectedMemoryIds.has(memory.id) : undefined"
              class="relative aspect-square rounded-[6px] overflow-hidden bg-secondary group"
              :class="[
                customSubMode === 'selection' ? 'cursor-pointer' : 'cursor-default',
                customSubMode === 'selection' && selectedMemoryIds.has(memory.id)
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-card'
                  : '',
                customSubMode === 'date_range' ? 'opacity-75' : '',
              ]"
            >
              <!-- Photo -->
              <img
                v-if="memory.mediaType === 'image' && (memory.thumbnailUrl || memory.signedUrl)"
                :src="memory.thumbnailUrl || memory.signedUrl || undefined"
                :alt="memory.memory_date"
                class="w-full h-full object-cover"
                loading="lazy"
              />

              <!-- Video: thumbnail img → video element → dark fallback -->
              <template v-else-if="memory.mediaType === 'video'">
                <img
                  v-if="memory.thumbnailUrl"
                  :src="memory.thumbnailUrl"
                  :alt="memory.memory_date"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <video
                  v-else-if="memory.signedUrl"
                  :src="memory.signedUrl"
                  preload="metadata"
                  muted
                  playsinline
                  class="w-full h-full object-cover pointer-events-none"
                />
                <div v-else class="w-full h-full bg-muted" />
                <!-- Play icon overlay -->
                <div class="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div class="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                    <svg class="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              </template>

              <!-- Quick note -->
              <div
                v-else-if="memory.note"
                class="w-full h-full flex flex-col items-center justify-center p-1.5 bg-amber-50 dark:bg-amber-950/30"
              >
                <svg class="w-3 h-3 text-amber-500 mb-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                <p class="text-[7px] leading-tight text-amber-900 dark:text-amber-100 text-center line-clamp-3 italic">{{ memory.note }}</p>
              </div>

              <!-- Fallback placeholder -->
              <div v-else class="w-full h-full flex items-center justify-center text-muted-foreground/40">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5z"/>
                </svg>
              </div>

              <!-- Date badge at bottom (gradient overlay) -->
              <div
                v-if="memory.mediaType !== null || !memory.note"
                class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/65 to-transparent pt-4 pb-0.5 px-1"
              >
                <p class="text-[8px] font-medium text-white leading-tight text-center truncate">
                  {{ formatTileDate(memory.memory_date) }}
                </p>
              </div>

              <!-- Date badge for notes (no gradient, use text instead) -->
              <div
                v-if="memory.note && memory.mediaType === null"
                class="absolute bottom-0.5 inset-x-0 flex justify-center"
              >
                <p class="text-[7px] font-medium text-amber-600 dark:text-amber-400 leading-tight">
                  {{ formatTileDate(memory.memory_date) }}
                </p>
              </div>

              <!-- Selected checkmark (pick mode only) -->
              <div
                v-if="customSubMode === 'selection' && selectedMemoryIds.has(memory.id)"
                class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-sm"
              >
                <svg class="w-2.5 h-2.5 text-primary-foreground" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </button>
          </div>

          <!-- Empty state -->
          <div
            v-if="!memoriesLoading && !yearsLoading && filteredMemories.length === 0"
            class="py-8 text-center"
          >
            <p class="text-sm text-muted-foreground">{{ t('viewerLink.emptyState') }}</p>
          </div>
        </div>

        <!-- Label field -->
        <div class="mt-4 mb-2">
          <input
            v-model="label"
            type="text"
            :placeholder="t('viewerLink.labelPlaceholder')"
            class="w-full h-10 px-3 rounded-[10px] bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <!-- Fixed bottom: Create button -->
      <div class="flex-shrink-0 px-5 pb-8 pt-2 border-t border-border">
        <p v-if="createError" class="text-xs text-destructive mb-2">{{ createError }}</p>
        <button
          type="button"
          @click="handleCreate"
          :disabled="!isValid || creating"
          class="w-full bg-primary text-primary-foreground rounded-[12px] py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ creating ? t('viewerLink.loading') : t('viewerLink.createLink') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()

interface MemoryItem {
  id: string
  memory_date: string
  signedUrl: string | null
  thumbnailUrl: string | null
  mediaType: 'image' | 'video' | null
  note: string | null
}

const props = defineProps<{
  open: boolean
  circleId: string
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

// --- State ---
const selectedMainMode = ref<'full' | 'custom'>('full')
const customSubMode = ref<'date_range' | 'selection'>('date_range')
const dateFrom = ref('')
const dateTo = ref('')
const selectedMemoryIds = ref(new Set<string>())
const label = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)
const memoriesLoading = ref(false)
const allMemories = ref<MemoryItem[]>([])
const availableYears = ref<number[]>([])
const yearsLoading = ref(false)
const selectedFilterYear = ref<number | null>(null)
const selectedFilterMonth = ref<number | null>(null)

// today as YYYY-MM-DD in local time
const today = new Date().toLocaleDateString('en-CA')

// --- Computed ---
const dateMin = computed(() => {
  const earliest = availableYears.value[availableYears.value.length - 1]
  return earliest ? `${earliest}-01-01` : undefined
})

const dateMax = computed(() => {
  const latest = availableYears.value[0]
  if (!latest) return today
  const yearEnd = `${latest}-12-31`
  return yearEnd < today ? yearEnd : today
})

const memoryMonths = computed(() => {
  const months = new Set<number>()
  allMemories.value.forEach((m) => months.add(new Date(m.memory_date).getUTCMonth() + 1))
  return [...months].sort((a, b) => a - b)
})

const filteredMemories = computed(() =>
  selectedFilterMonth.value === null
    ? allMemories.value
    : allMemories.value.filter(
        (m) => new Date(m.memory_date).getUTCMonth() + 1 === selectedFilterMonth.value
      )
)

const mainModes = computed(() => [
  { value: 'full' as const, label: t('viewerLink.modeFull') },
  { value: 'custom' as const, label: t('viewerLink.modeCustom') },
])

const subModes = computed(() => [
  { value: 'date_range' as const, label: t('viewerLink.submodeDateRange') },
  { value: 'selection' as const, label: t('viewerLink.submodePickMemories') },
])

const isValid = computed(() => {
  if (selectedMainMode.value === 'full') return true
  if (customSubMode.value === 'date_range')
    return !!(dateFrom.value && dateTo.value && dateFrom.value <= dateTo.value)
  return selectedMemoryIds.value.size > 0
})

// --- Helpers ---
function monthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString(locale.value, { month: 'short' })
}

function formatTileDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
  })
}

function applyYearMonthToDateRange(year: number, month: number | null) {
  if (month !== null) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    dateFrom.value = from
    dateTo.value = to > dateMax.value ? dateMax.value : to
  } else {
    dateFrom.value = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    dateTo.value = yearEnd > dateMax.value ? dateMax.value : yearEnd
  }
}

function selectAllVisible() {
  const s = new Set(selectedMemoryIds.value)
  filteredMemories.value.forEach((m) => s.add(m.id))
  selectedMemoryIds.value = s
}

function toggleMemory(id: string) {
  const s = new Set(selectedMemoryIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedMemoryIds.value = s
}

// --- API ---
async function loadYears() {
  yearsLoading.value = true
  try {
    const data = await $fetch<{ years: number[] }>('/api/timeline/years', {
      query: { circleId: props.circleId },
    })
    availableYears.value = data.years
  } catch {
    availableYears.value = []
  } finally {
    yearsLoading.value = false
  }
}

async function loadMemories() {
  memoriesLoading.value = true
  try {
    const data = await $fetch<{ memories: any[] }>('/api/timeline', {
      query: {
        circleId: props.circleId,
        ...(selectedFilterYear.value ? { year: selectedFilterYear.value } : {}),
      },
    })
    allMemories.value = (data.memories ?? []).map((m): MemoryItem => {
      const media = m.memorymedia?.[0] ?? null
      return {
        id: m.id,
        memory_date: m.memory_date,
        signedUrl: media?.url ?? null,
        thumbnailUrl: media?.thumbnailUrl ?? null,
        mediaType: media ? (media.media_type === 'video' ? 'video' : 'image') : null,
        note: m.note ?? null,
      }
    })
  } catch {
    allMemories.value = []
  } finally {
    memoriesLoading.value = false
  }
}

async function setFilterYear(year: number) {
  if (selectedFilterYear.value === year) return
  selectedFilterYear.value = year
  selectedFilterMonth.value = null
  if (customSubMode.value === 'date_range') {
    applyYearMonthToDateRange(year, null)
  }
  await loadMemories()
}

function setFilterMonth(month: number | null) {
  selectedFilterMonth.value = month
  if (customSubMode.value === 'date_range' && selectedFilterYear.value !== null) {
    applyYearMonthToDateRange(selectedFilterYear.value, month)
  }
}

// --- Watchers ---
watch(() => props.open, async (val) => {
  if (!val) {
    // Reset on close so next open starts fresh
    selectedMainMode.value = 'full'
    customSubMode.value = 'date_range'
    dateFrom.value = ''
    dateTo.value = ''
    selectedMemoryIds.value = new Set()
    label.value = ''
    createError.value = null
    allMemories.value = []
    availableYears.value = []
    yearsLoading.value = false
    selectedFilterYear.value = null
    selectedFilterMonth.value = null
    return
  }
  await loadYears()
})

watch(selectedMainMode, async (val) => {
  if (val === 'custom') {
    if (availableYears.value.length === 0) await loadYears()
    if (selectedFilterYear.value === null) {
      selectedFilterYear.value = availableYears.value[0] ?? null
    }
    if (allMemories.value.length === 0) await loadMemories()
    if (customSubMode.value === 'date_range' && selectedFilterYear.value !== null) {
      applyYearMonthToDateRange(selectedFilterYear.value, selectedFilterMonth.value)
    }
  }
})

watch(customSubMode, (val) => {
  if (val === 'date_range' && selectedFilterYear.value !== null) {
    applyYearMonthToDateRange(selectedFilterYear.value, selectedFilterMonth.value)
  }
})

// --- Submit ---
async function handleCreate() {
  if (!isValid.value || creating.value) return
  creating.value = true
  createError.value = null
  const mode = selectedMainMode.value === 'full' ? 'full' : customSubMode.value
  try {
    await $fetch(`/api/circles/${props.circleId}/viewer-links`, {
      method: 'POST',
      body: {
        mode,
        label: label.value || undefined,
        memoryIds: mode === 'selection' ? [...selectedMemoryIds.value] : undefined,
        dateFrom: mode === 'date_range' ? dateFrom.value : undefined,
        dateTo: mode === 'date_range' ? dateTo.value : undefined,
      },
    })
    emit('created')
    emit('close')
  } catch {
    createError.value = t('viewerLink.createErrorGeneric')
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.scrollbar-none { scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
</style>
