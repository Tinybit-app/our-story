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
      class="fixed inset-x-0 bottom-0 z-[60] bg-card border-t border-border rounded-t-[24px] shadow-2xl max-h-[90vh] flex flex-col pb-safe"
    >
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1 flex-shrink-0">
        <div class="w-10 h-1 rounded-full bg-border" />
      </div>

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <h2 class="text-base font-bold text-foreground">
          {{ isEditMode ? t("viewerLink.editLink") : t("viewerLink.createLink") }}
        </h2>
        <button
          type="button"
          @click="$emit('close')"
          :aria-label="t('viewerLink.close')"
          class="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mode tabs: Full | Custom (hidden in edit mode — always custom) -->
      <div
        v-if="!isEditMode"
        class="flex gap-1 mx-5 mb-3 p-1 bg-secondary rounded-[12px] flex-shrink-0"
      >
        <button
          v-for="mode in mainModes"
          :key="mode.value"
          type="button"
          class="flex-1 py-2 rounded-[10px] text-xs font-semibold transition-all"
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
        class="flex-shrink-0 flex items-center justify-between px-5 pb-2.5 border-b border-border/40"
      >
        <div class="flex items-center gap-3 min-h-[20px]">
          <span v-if="picker.selectedMemoryIds.value.size > 0" class="text-sm font-semibold text-foreground">
            {{ t("viewerLink.selectedCount", { count: picker.selectedMemoryIds.value.size }) }}
          </span>
          <span v-else class="text-xs text-muted-foreground">{{ t("viewerLink.tapToSelect") }}</span>
          <button
            v-if="picker.selectedMemoryIds.value.size > 0"
            type="button"
            @click="picker.clearSelection()"
            class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {{ t("viewerLink.clearAll") }}
          </button>
        </div>
        <div
          v-if="picker.yearsLoading.value || picker.isAnyYearLoading.value"
          class="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <div class="w-3 h-3 border-[1.5px] border-muted-foreground border-t-transparent rounded-full animate-spin" />
          {{ t("viewerLink.loading") }}
        </div>
      </div>

      <!-- Scrollable body -->
      <div class="scroll-styled flex-1 overflow-y-auto overscroll-contain pb-4">
        <!-- FULL mode -->
        <div v-if="selectedMode === 'full'" class="px-5 py-4">
          <template v-if="!picker.yearsLoading.value && picker.yearGroups.value.length === 0">
            <div class="py-8 text-center">
              <div class="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-4">
                <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5z"/>
                </svg>
              </div>
              <p class="text-sm font-semibold text-foreground mb-1">{{ t('viewerLink.noMemoriesTitle') }}</p>
              <p class="text-xs text-muted-foreground">{{ t('viewerLink.noMemoriesBody') }}</p>
            </div>
          </template>
          <p v-else class="text-sm text-muted-foreground leading-relaxed">
            {{ t("viewerLink.fullModeDescription") }}
          </p>
        </div>

        <!-- CUSTOM mode: memory picker -->
        <MemoryPicker v-else />

        <!-- Label input -->
        <div class="px-5 mt-4 mb-1">
          <input
            v-model="label"
            type="text"
            :placeholder="t('viewerLink.labelPlaceholder')"
            class="w-full h-10 px-3 rounded-[10px] bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <!-- Create button -->
      <div class="flex-shrink-0 px-5 pb-8 pt-2 border-t border-border">
        <p v-if="createError" class="text-xs text-destructive mb-2">
          {{ createError }}
        </p>
        <button
          type="button"
          @click="handleCreate"
          :disabled="!isValid || creating"
          class="w-full bg-primary text-primary-foreground rounded-[12px] py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ creating ? t("viewerLink.loading") : isEditMode ? t("viewerLink.saveChanges") : t("viewerLink.createLink") }}
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
const selectedMode = ref<"full" | "custom">("full")
const label = ref("")
const creating = ref(false)
const createError = ref<string | null>(null)

const mainModes = computed(() => [
  { value: "full" as const, label: t("viewerLink.modeFull") },
  { value: "custom" as const, label: t("viewerLink.modeCustom") },
])

const isValid = computed(() => {
  if (selectedMode.value === "full") return picker.hasMemories.value
  return picker.selectedMemoryIds.value.size > 0
})

// ── Body scroll lock ───────────────────────────────────────
watch(
  () => props.open,
  (val) => {
    document.body.style.overflow = val ? "hidden" : ""
  },
)
onUnmounted(() => {
  document.body.style.overflow = ""
})

// ── Open/close watcher ─────────────────────────────────────
watch(
  () => props.open,
  async (val) => {
    if (!val) {
      selectedMode.value = "full"
      label.value = ""
      createError.value = null
      picker.reset()
      return
    }
    // Edit mode: pre-populate and go straight to custom picker
    if (props.editLink) {
      selectedMode.value = "custom"
      picker.setSelection(props.editLink.memoryIds)
      label.value = props.editLink.label
    }
    await picker.loadYears()
    if (selectedMode.value === "custom") await picker.loadAllMemories()
  },
)

watch(selectedMode, async (val) => {
  if (val === "custom" && picker.yearGroups.value.length > 0) {
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
          method: "PATCH",
          body: {
            memoryIds: [...picker.selectedMemoryIds.value],
            label: label.value || undefined,
          },
        },
      )
    } else {
      await $fetch(`/api/circles/${props.circleId}/viewer-links`, {
        method: "POST",
        body: {
          mode: selectedMode.value === "full" ? "full" : "selection",
          label: label.value || undefined,
          memoryIds:
            selectedMode.value === "custom"
              ? [...picker.selectedMemoryIds.value]
              : undefined,
        },
      })
    }
    emit("created")
    emit("close")
  } catch {
    createError.value = t("viewerLink.createErrorGeneric")
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
