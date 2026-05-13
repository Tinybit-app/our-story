<template>
  <div
    v-if="shouldShow"
    class="mx-5 mb-4 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
  >
    <div class="mt-0.5 flex-shrink-0">
      <svg
        class="h-5 w-5 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        viewBox="0 0 24 24"
      >
        <path d="M12 16V4m0 12l-4-4m4 4l4-4M4 18v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium leading-snug text-foreground">
        {{ t('install.promptTitle') }}
      </p>
      <p v-if="!showIosInstructions" class="mt-0.5 text-xs text-muted-foreground">
        {{ t('install.promptBody') }}
      </p>
      <p v-else class="mt-0.5 text-xs text-muted-foreground">
        {{ t('install.iosInstructions') }}
      </p>
      <div class="mt-3 flex items-center gap-2">
        <button
          v-if="!showIosInstructions"
          class="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          @click="install"
        >
          {{ isIos ? t('install.showHow') : t('install.install') }}
        </button>
        <button
          class="rounded-lg px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          @click="snooze"
        >
          {{ t('install.later') }}
        </button>
      </div>
    </div>
    <button
      class="flex-shrink-0 p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
      @click="snooze"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

const SNOOZE_KEY = 'install_prompt_snoozed_at'
const DISMISSED_KEY = 'install_prompt_dismissed'
const VISIT_COUNT_KEY = 'app_visit_count'
const SNOOZE_DAYS = 14
const MIN_VISITS_BEFORE_PROMPT = 3

const dismissed = ref(false)
const showIosInstructions = ref(false)
const visitCount = ref(0)
const deferredPrompt = ref<any>(null)

const isIos = computed(() => {
  if (!import.meta.client) return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
})

const isStandalone = computed(() => {
  if (!import.meta.client) return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
})

onMounted(() => {
  if (!import.meta.client) return

  // Increment visit count on each mount
  const current = Number(localStorage.getItem(VISIT_COUNT_KEY) ?? '0')
  visitCount.value = current + 1
  localStorage.setItem(VISIT_COUNT_KEY, String(visitCount.value))

  // Capture the Android install prompt event
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e
  })

  // If app gets installed, mark as dismissed
  window.addEventListener('appinstalled', () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    dismissed.value = true
  })
})

const shouldShow = computed(() => {
  if (!import.meta.client) return false
  if (dismissed.value) return false
  if (isStandalone.value) return false
  if (localStorage.getItem(DISMISSED_KEY) === 'true') return false
  if (visitCount.value < MIN_VISITS_BEFORE_PROMPT) return false

  const snoozedAt = localStorage.getItem(SNOOZE_KEY)
  if (snoozedAt) {
    const elapsed = Date.now() - Number(snoozedAt)
    if (elapsed < SNOOZE_DAYS * 24 * 60 * 60 * 1000) return false
  }

  // Show if Android prompt is available, OR if iOS (manual instructions)
  return !!deferredPrompt.value || isIos.value
})

async function install() {
  if (isIos.value) {
    showIosInstructions.value = true
    return
  }

  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  if (outcome === 'accepted') {
    localStorage.setItem(DISMISSED_KEY, 'true')
  }
  deferredPrompt.value = null
  dismissed.value = true
}

function snooze() {
  localStorage.setItem(SNOOZE_KEY, String(Date.now()))
  dismissed.value = true
}
</script>
