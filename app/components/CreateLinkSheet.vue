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
      <div class="flex items-center justify-between px-5 py-4 flex-shrink-0">
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

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto px-5 pb-4">

        <!-- Mode selector -->
        <div class="flex gap-1 mb-5 p-1 bg-secondary rounded-[12px]">
          <button
            v-for="mode in modes"
            :key="mode.value"
            type="button"
            @click="selectedMode = mode.value"
            class="flex-1 h-8 rounded-[10px] text-xs font-semibold transition-all"
            :class="selectedMode === mode.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'"
          >
            {{ mode.label }}
          </button>
        </div>

        <!-- Date range section -->
        <div v-if="selectedMode === 'date_range'" class="mb-5">
          <!-- Year quick-select chips -->
          <div class="flex gap-2 flex-wrap mb-4 min-h-[28px] items-center">
            <div v-if="yearsLoading" class="flex items-center gap-2 text-xs text-muted-foreground">
              <div class="w-3.5 h-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              {{ t('viewerLink.loading') }}
            </div>
            <template v-else>
              <button
                v-for="year in availableYears"
                :key="year"
                type="button"
                @click="selectYear(year)"
                class="h-7 px-3 rounded-full text-xs font-semibold transition-all border"
                :class="isYearSelected(year)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-muted-foreground border-transparent hover:border-border hover:text-foreground'"
              >
                {{ year }}
              </button>
            </template>
          </div>

          <!-- Custom date inputs -->
          <div class="grid grid-cols-2 gap-3">
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
        </div>

        <!-- Memory picker grid -->
        <div v-if="selectedMode === 'selection'" class="mb-5">

          <!-- Year tabs -->
          <div v-if="availableYears.length > 1" class="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 -mx-5 px-5 scrollbar-none">
            <button
              v-for="year in availableYears"
              :key="year"
              type="button"
              @click="setFilterYear(year)"
              class="flex-shrink-0 h-6 px-3 rounded-full text-[11px] font-semibold transition-all"
              :class="selectedFilterYear === year
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:text-foreground'"
            >{{ year }}</button>
          </div>

          <!-- Month pills -->
          <div v-if="memoryMonths.length > 1" class="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 -mx-5 px-5 scrollbar-none">
            <button
              type="button"
              @click="selectedFilterMonth = null"
              class="flex-shrink-0 h-6 px-2.5 rounded-full text-[11px] font-medium transition-all"
              :class="!selectedFilterMonth
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:text-foreground'"
            >All</button>
            <button
              v-for="month in memoryMonths"
              :key="month"
              type="button"
              @click="selectedFilterMonth = month"
              class="flex-shrink-0 h-6 px-2.5 rounded-full text-[11px] font-medium transition-all"
              :class="selectedFilterMonth === month
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:text-foreground'"
            >{{ monthName(month) }}</button>
          </div>

          <!-- Selection count + loading -->
          <div class="flex items-center justify-between mb-2 min-h-[24px]">
            <span v-if="selectedMemoryIds.size > 0" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
              {{ t('viewerLink.selectedCount', { count: selectedMemoryIds.size }) }}
            </span>
            <span v-else />
            <div v-if="memoriesLoading" class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div class="w-3 h-3 border-[1.5px] border-muted-foreground border-t-transparent rounded-full animate-spin" />
              {{ t('viewerLink.loading') }}
            </div>
          </div>

          <!-- 5-column compact grid -->
          <div class="grid grid-cols-5 gap-1">
            <button
              v-for="memory in filteredMemories"
              :key="memory.id"
              type="button"
              @click="toggleMemory(memory.id)"
              :aria-label="memory.memory_date"
              :aria-pressed="selectedMemoryIds.has(memory.id)"
              class="relative aspect-square rounded-[6px] overflow-hidden bg-secondary transition-all"
              :class="selectedMemoryIds.has(memory.id) ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : ''"
            >
              <!-- Photo -->
              <img
                v-if="memory.signedUrl && memory.mediaType === 'image'"
                :src="memory.signedUrl"
                :alt="memory.memory_date"
                class="w-full h-full object-cover"
              />
              <!-- Video -->
              <div
                v-else-if="memory.mediaType === 'video'"
                class="w-full h-full flex items-center justify-center bg-foreground/10 text-foreground"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <!-- Quick note -->
              <div
                v-else-if="memory.note"
                class="w-full h-full flex items-center justify-center p-1.5 bg-accent/10"
              >
                <p class="text-[8px] leading-tight text-foreground text-center line-clamp-3 italic">{{ memory.note }}</p>
              </div>
              <!-- Fallback -->
              <div v-else class="w-full h-full flex items-center justify-center text-muted-foreground/40">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5z"/>
                </svg>
              </div>

              <!-- Selected tick -->
              <div
                v-if="selectedMemoryIds.has(memory.id)"
                class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
              >
                <svg class="w-2.5 h-2.5 text-primary-foreground" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </button>
          </div>

          <!-- Empty state -->
          <div v-if="!memoriesLoading && filteredMemories.length === 0" class="py-8 text-center">
            <p class="text-sm text-muted-foreground">{{ t('viewerLink.emptyState') }}</p>
          </div>
        </div>

        <!-- Label field -->
        <div class="mb-4">
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

const selectedMode = ref<'full' | 'date_range' | 'selection'>('full')
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

// today as YYYY-MM-DD in local time — caps the upper bound at "not future"
const today = new Date().toLocaleDateString('en-CA')

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

// Distinct months present in the currently-loaded year's memories
const memoryMonths = computed(() => {
  const months = new Set<number>()
  allMemories.value.forEach((m) => months.add(new Date(m.memory_date).getUTCMonth() + 1))
  return [...months].sort((a, b) => a - b)
})

// Memories filtered by the active month pill (year filter is server-side)
const filteredMemories = computed(() =>
  selectedFilterMonth.value === null
    ? allMemories.value
    : allMemories.value.filter(
        (m) => new Date(m.memory_date).getUTCMonth() + 1 === selectedFilterMonth.value
      )
)

function monthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString(locale.value, { month: 'short' })
}

const modes = computed(() => [
  { value: 'full' as const, label: t('viewerLink.modeFull') },
  { value: 'date_range' as const, label: t('viewerLink.modeDateRange') },
  { value: 'selection' as const, label: t('viewerLink.modeSelection') },
])

const isValid = computed(() => {
  if (selectedMode.value === 'date_range')
    return !!(dateFrom.value && dateTo.value && dateFrom.value <= dateTo.value)
  if (selectedMode.value === 'selection') return selectedMemoryIds.value.size > 0
  return true
})

async function loadYears() {
  if (availableYears.value.length > 0) return
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
    const data = await $fetch<{ memories: any[] }>(`/api/timeline`, {
      query: {
        circleId: props.circleId,
        ...(selectedFilterYear.value ? { year: selectedFilterYear.value } : {}),
      },
    })
    allMemories.value = (data.memories ?? []).map((m) => {
      const media = m.memorymedia?.[0] ?? null
      return {
        id: m.id,
        memory_date: m.memory_date,
        signedUrl: media?.thumbnailUrl ?? media?.url ?? null,
        mediaType: media ? (media.media_type === 'video' ? 'video' : 'image') : null,
        note: m.note ?? null,
      } satisfies MemoryItem
    })
  } catch {
    allMemories.value = []
  } finally {
    memoriesLoading.value = false
  }
}

function selectYear(year: number) {
  dateFrom.value = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  dateTo.value = yearEnd > dateMax.value ? dateMax.value : yearEnd
}

function isYearSelected(year: number): boolean {
  return dateFrom.value === `${year}-01-01` && dateTo.value === `${year}-12-31`
}

async function setFilterYear(year: number) {
  if (selectedFilterYear.value === year) return
  selectedFilterYear.value = year
  selectedFilterMonth.value = null
  await loadMemories()
}

function toggleMemory(id: string) {
  const s = new Set(selectedMemoryIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedMemoryIds.value = s
}

watch(() => props.open, async (val) => {
  if (!val) {
    selectedMode.value = 'full'
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
  if (selectedMode.value === 'selection') {
    selectedFilterYear.value = availableYears.value[0] ?? null
    await loadMemories()
  }
})

watch(selectedMode, async (val) => {
  if (val === 'selection') {
    if (availableYears.value.length === 0) await loadYears()
    if (selectedFilterYear.value === null) {
      selectedFilterYear.value = availableYears.value[0] ?? null
    }
    if (allMemories.value.length === 0) await loadMemories()
  }
})

async function handleCreate() {
  if (!isValid.value || creating.value) return
  creating.value = true
  createError.value = null
  try {
    await $fetch(`/api/circles/${props.circleId}/viewer-links`, {
      method: 'POST',
      body: {
        mode: selectedMode.value,
        label: label.value || undefined,
        memoryIds: selectedMode.value === 'selection' ? [...selectedMemoryIds.value] : undefined,
        dateFrom: selectedMode.value === 'date_range' ? dateFrom.value : undefined,
        dateTo: selectedMode.value === 'date_range' ? dateTo.value : undefined,
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
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.scrollbar-none { scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
</style>
