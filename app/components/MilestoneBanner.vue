<template>
  <div
    v-if="shouldShow && milestone"
    class="mx-5 mb-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 flex items-start gap-3"
  >
    <div class="flex-shrink-0 mt-0.5">
      <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-foreground leading-snug">
        {{ headline }}
      </p>
      <div class="flex items-center gap-2 mt-3">
        <button
          class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          @click="onAdd"
        >
          {{ milestone.phase === 'T+3' ? t('milestoneBanner.addNow') : t('milestoneBanner.addMemory') }}
        </button>
        <button
          v-if="milestone.phase === 'T+3'"
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          @click="onDismiss"
        >
          {{ t('milestoneBanner.dismiss') }}
        </button>
      </div>
    </div>
    <button
      class="flex-shrink-0 p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      @click="onDismiss"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Milestone {
  scopeType: 'child' | 'couple' | 'trip'
  name: string
  milestoneKey: string
  phase: 'T-3' | 'T0' | 'T+3'
  daysUntil: number
  milestoneLabelSuggestion: string
}

const props = defineProps<{
  milestone: Milestone | null
  enabled: boolean
}>()

const emit = defineEmits<{
  add: [labelSuggestion: string]
}>()

const { t } = useI18n()
const dismissed = ref(false)

const dismissKey = computed(() =>
  props.milestone ? `milestone-banner-dismissed-${props.milestone.milestoneKey}` : null
)

watch(() => props.milestone?.milestoneKey, (key) => {
  if (!key) { dismissed.value = false; return }
  dismissed.value = import.meta.client && localStorage.getItem(`milestone-banner-dismissed-${key}`) === 'true'
}, { immediate: true })

const shouldShow = computed(() =>
  import.meta.client && props.enabled && props.milestone !== null && !dismissed.value
)

const headline = computed(() => {
  if (!props.milestone) return ''
  const m = props.milestone
  const key = `milestoneBanner.${m.scopeType}${m.phase}`
  if (m.scopeType === 'child') {
    return t(key, { name: m.name, label: m.milestoneLabelSuggestion, days: Math.abs(m.daysUntil) })
  }
  return t(key, { years: m.milestoneLabelSuggestion.replace(/\D/g, ''), days: Math.abs(m.daysUntil) })
})

function onAdd() {
  if (!props.milestone) return
  emit('add', props.milestone.milestoneLabelSuggestion)
}

function onDismiss() {
  dismissed.value = true
  if (dismissKey.value) localStorage.setItem(dismissKey.value, 'true')
}
</script>
