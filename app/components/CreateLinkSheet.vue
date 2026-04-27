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
          <div class="flex gap-2 flex-wrap mb-4">
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
          </div>

          <!-- Custom date inputs -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('viewerLink.dateFrom') }}</label>
              <input
                v-model="dateFrom"
                type="date"
                class="w-full h-9 px-3 rounded-[10px] bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('viewerLink.dateTo') }}</label>
              <input
                v-model="dateTo"
                type="date"
                class="w-full h-9 px-3 rounded-[10px] bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <!-- Memory picker grid -->
        <div v-if="selectedMode === 'selection'" class="mb-5">
          <!-- Loading state -->
          <div v-if="memoriesLoading" class="py-8 text-center">
            <p class="text-sm text-muted-foreground">{{ t('viewerLink.loading') }}</p>
          </div>

          <template v-else>
            <!-- Selection count badge -->
            <div v-if="selectedMemoryIds.size > 0" class="mb-3">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {{ t('viewerLink.selectedCount', { count: selectedMemoryIds.size }) }}
              </span>
            </div>

            <!-- 3-column grid -->
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="memory in allMemories"
                :key="memory.id"
                type="button"
                @click="toggleMemory(memory.id)"
                :aria-label="memory.memory_date"
                class="relative aspect-square rounded-[10px] overflow-hidden bg-secondary border-2 transition-all"
                :class="selectedMemoryIds.has(memory.id)
                  ? 'border-primary'
                  : 'border-transparent'"
                :aria-pressed="selectedMemoryIds.has(memory.id)"
              >
                <!-- Thumbnail -->
                <img
                  v-if="memory.signedUrl && memory.mediaType === 'image'"
                  :src="memory.signedUrl"
                  :alt="memory.memory_date"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-muted-foreground"
                >
                  <svg v-if="memory.mediaType === 'video'" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75z"/>
                  </svg>
                  <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0z"/>
                  </svg>
                </div>

                <!-- Selected checkmark overlay -->
                <div
                  v-if="selectedMemoryIds.has(memory.id)"
                  class="absolute inset-0 bg-primary/20 flex items-center justify-center"
                >
                  <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <svg class="w-3.5 h-3.5 text-primary-foreground" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                </div>
              </button>
            </div>

            <!-- Empty state for no memories -->
            <div v-if="allMemories.length === 0" class="py-8 text-center">
              <p class="text-sm text-muted-foreground">{{ t('viewerLink.emptyState') }}</p>
            </div>
          </template>
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
const { t } = useI18n()

interface MemoryItem {
  id: string
  memory_date: string
  signedUrl: string | null
  mediaType: 'image' | 'video' | null
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

const modes = computed(() => [
  { value: 'full' as const, label: t('viewerLink.modeFull') },
  { value: 'date_range' as const, label: t('viewerLink.modeDateRange') },
  { value: 'selection' as const, label: t('viewerLink.modeSelection') },
])

const isValid = computed(() => {
  if (selectedMode.value === 'date_range') return !!(dateFrom.value && dateTo.value)
  if (selectedMode.value === 'selection') return selectedMemoryIds.value.size > 0
  return true
})

async function loadYears() {
  if (availableYears.value.length > 0) return
  try {
    const data = await $fetch<{ years: number[] }>('/api/timeline/years', {
      query: { circleId: props.circleId },
    })
    availableYears.value = data.years
  } catch {
    availableYears.value = []
  }
}

function selectYear(year: number) {
  dateFrom.value = `${year}-01-01`
  dateTo.value = `${year}-12-31`
}

function isYearSelected(year: number): boolean {
  return dateFrom.value === `${year}-01-01` && dateTo.value === `${year}-12-31`
}

function toggleMemory(id: string) {
  const s = new Set(selectedMemoryIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedMemoryIds.value = s
}

watch(() => props.open, async (val) => {
  if (!val) return
  if (selectedMode.value === 'selection') await loadMemories()
  if (selectedMode.value === 'date_range') await loadYears()
})

watch(selectedMode, async (val) => {
  if (val === 'selection' && allMemories.value.length === 0) await loadMemories()
  if (val === 'date_range') await loadYears()
})

async function loadMemories() {
  memoriesLoading.value = true
  try {
    const data = await $fetch<{ memories: MemoryItem[] }>(`/api/timeline`, {
      query: { circle: props.circleId },
    })
    allMemories.value = data.memories ?? []
  } catch {
    allMemories.value = []
  } finally {
    memoriesLoading.value = false
  }
}

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
    // Reset state
    selectedMode.value = 'full'
    dateFrom.value = ''
    dateTo.value = ''
    selectedMemoryIds.value = new Set()
    label.value = ''
    createError.value = null
    allMemories.value = []
    availableYears.value = []
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
</style>
