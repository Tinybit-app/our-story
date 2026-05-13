<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
      @click="$emit('close')"
    />
  </Transition>

  <Transition name="slide-up">
    <div
      v-if="open"
      class="pb-safe fixed inset-x-0 bottom-0 z-[60] flex max-h-[90vh] flex-col rounded-t-[24px] border-t border-border bg-card shadow-2xl"
    >
      <!-- Handle -->
      <div class="flex flex-shrink-0 justify-center pb-1 pt-3">
        <div class="h-1 w-10 rounded-full bg-border" />
      </div>

      <!-- Header -->
      <div class="flex flex-shrink-0 items-center justify-between px-5 py-3">
        <h2 class="text-base font-bold text-foreground">
          {{
            isEditMode ? t('viewerLink.editLink') : t('viewerLink.createLink')
          }}
        </h2>
        <button
          type="button"
          @click="$emit('close')"
          :aria-label="t('viewerLink.close')"
          class="p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mode tabs: Full | Custom (hidden in edit mode — always custom) -->
      <div
        v-if="!isEditMode"
        class="mx-5 mb-3 flex flex-shrink-0 gap-1 rounded-[12px] bg-secondary p-1"
      >
        <button
          v-for="mode in mainModes"
          :key="mode.value"
          type="button"
          class="flex-1 rounded-[10px] py-2 text-xs font-semibold transition-all"
          :class="
            selectedMode === mode.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="selectedMode = mode.value"
        >
          {{ mode.label }}
        </button>
      </div>

      <!-- Selection status bar (Custom mode only) -->
      <div
        v-if="selectedMode === 'custom'"
        class="flex flex-shrink-0 items-center justify-between border-b border-border/40 px-5 pb-2.5"
      >
        <div class="flex min-h-[20px] items-center gap-3">
          <span
            v-if="picker.selectedMemoryIds.value.size > 0"
            class="text-sm font-semibold text-foreground"
          >
            {{
              t('viewerLink.selectedCount', {
                count: picker.selectedMemoryIds.value.size,
              })
            }}
          </span>
          <span v-else class="text-xs text-muted-foreground">{{
            t('viewerLink.tapToSelect')
          }}</span>
          <button
            v-if="picker.selectedMemoryIds.value.size > 0"
            type="button"
            @click="picker.clearSelection()"
            class="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {{ t('viewerLink.clearAll') }}
          </button>
        </div>
        <div
          v-if="picker.yearsLoading.value || picker.isAnyYearLoading.value"
          class="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <div
            class="h-3 w-3 animate-spin rounded-full border-[1.5px] border-muted-foreground border-t-transparent"
          />
          {{ t('viewerLink.loading') }}
        </div>
      </div>

      <!-- Scrollable body -->
      <div class="scroll-styled flex-1 overflow-y-auto overscroll-contain pb-4">
        <!-- FULL mode -->
        <div v-if="selectedMode === 'full'" class="px-5 py-4">
          <template
            v-if="
              !picker.yearsLoading.value && picker.yearGroups.value.length === 0
            "
          >
            <div class="py-8 text-center">
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
              <p class="mb-1 text-sm font-semibold text-foreground">
                {{ t('viewerLink.noMemoriesTitle') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('viewerLink.noMemoriesBody') }}
              </p>
            </div>
          </template>
          <p v-else class="text-sm leading-relaxed text-muted-foreground">
            {{ t('viewerLink.fullModeDescription') }}
          </p>
        </div>

        <!-- CUSTOM mode: memory picker -->
        <MemoryPicker v-else />

        <!-- Label input -->
        <div class="mb-1 mt-4 px-5">
          <input
            v-model="label"
            type="text"
            :placeholder="t('viewerLink.labelPlaceholder')"
            class="h-10 w-full rounded-[10px] border border-border bg-secondary px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <!-- Create button -->
      <div class="flex-shrink-0 border-t border-border px-5 pb-8 pt-2">
        <p v-if="createError" class="mb-2 text-xs text-destructive">
          {{ createError }}
        </p>
        <button
          type="button"
          @click="handleCreate"
          :disabled="!isValid || creating"
          class="w-full rounded-[12px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {{
            creating
              ? t('viewerLink.loading')
              : isEditMode
                ? t('viewerLink.saveChanges')
                : t('viewerLink.createLink')
          }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { MEMORY_PICKER_KEY } from '~/composables/useMemoryPicker'

const { t } = useI18n()

export interface EditLinkData {
  id: string
  memoryIds: string[]
  label: string
}

const props = defineProps<{
  open: boolean
  circleId: string
  editLink?: EditLinkData | null
}>()
const emit = defineEmits<{ close: []; created: [] }>()

const isEditMode = computed(() => !!props.editLink)

// ── Memory picker (provided to MemoryPicker child) ─────────
const circleIdRef = computed(() => props.circleId)
const picker = useMemoryPicker(circleIdRef)
provide(MEMORY_PICKER_KEY, picker)

// ── Local state ────────────────────────────────────────────
const selectedMode = ref<'full' | 'custom'>('full')
const label = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)

const mainModes = computed(() => [
  { value: 'full' as const, label: t('viewerLink.modeFull') },
  { value: 'custom' as const, label: t('viewerLink.modeCustom') },
])

const isValid = computed(() => {
  if (selectedMode.value === 'full') return picker.hasMemories.value
  return picker.selectedMemoryIds.value.size > 0
})

// ── Body scroll lock ───────────────────────────────────────
watch(
  () => props.open,
  (val) => {
    document.body.style.overflow = val ? 'hidden' : ''
  },
)
onUnmounted(() => {
  document.body.style.overflow = ''
})

// ── Open/close watcher ─────────────────────────────────────
watch(
  () => props.open,
  async (val) => {
    if (!val) {
      selectedMode.value = 'full'
      label.value = ''
      createError.value = null
      picker.reset()
      return
    }
    // Edit mode: pre-populate and go straight to custom picker
    if (props.editLink) {
      selectedMode.value = 'custom'
      picker.setSelection(props.editLink.memoryIds)
      label.value = props.editLink.label
    }
    await picker.loadYears()
    if (selectedMode.value === 'custom') await picker.loadAllMemories()
  },
)

watch(selectedMode, async (val) => {
  if (val === 'custom' && picker.yearGroups.value.length > 0) {
    await picker.loadAllMemories()
  }
})

// ── Submit ─────────────────────────────────────────────────
async function handleCreate() {
  if (!isValid.value || creating.value) return
  creating.value = true
  createError.value = null
  try {
    if (isEditMode.value && props.editLink) {
      await $fetch(
        `/api/circles/${props.circleId}/viewer-links/${props.editLink.id}`,
        {
          method: 'PATCH',
          body: {
            memoryIds: [...picker.selectedMemoryIds.value],
            label: label.value || undefined,
          },
        },
      )
    } else {
      await $fetch(`/api/circles/${props.circleId}/viewer-links`, {
        method: 'POST',
        body: {
          mode: selectedMode.value === 'full' ? 'full' : 'selection',
          label: label.value || undefined,
          memoryIds:
            selectedMode.value === 'custom'
              ? [...picker.selectedMemoryIds.value]
              : undefined,
        },
      })
    }
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
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
