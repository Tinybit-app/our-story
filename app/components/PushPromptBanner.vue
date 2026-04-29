<template>
  <div
    v-if="shouldShow"
    class="mx-5 mb-4 rounded-xl border border-border bg-card px-4 py-3 flex items-start gap-3"
  >
    <div class="flex-shrink-0 mt-0.5">
      <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-foreground leading-snug">
        {{ t('push.promptTitle') }}
      </p>
      <p class="text-xs text-muted-foreground mt-0.5">
        {{ t('push.promptBody') }}
      </p>
      <div class="flex items-center gap-2 mt-3">
        <button
          class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          @click="enable"
        >
          {{ t('push.enable') }}
        </button>
        <button
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          @click="snooze"
        >
          {{ t('push.later') }}
        </button>
      </div>
    </div>
    <button
      class="flex-shrink-0 p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      @click="snooze"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { isSupported, permissionState, requestPermission } = usePushNotifications()

const dismissed = ref(false)

const SNOOZE_KEY = 'push_prompt_snoozed_at'
const DENIED_KEY = 'push_prompt_denied'
const SNOOZE_DAYS = 7

const VISITED_KEY = 'has_visited_timeline'

// Mark this visit — banner won't show until the *next* visit
onMounted(() => {
  if (import.meta.client) localStorage.setItem(VISITED_KEY, 'true')
})

const shouldShow = computed(() => {
  if (!import.meta.client) return false
  if (!isSupported.value) return false
  if (dismissed.value) return false
  if (permissionState.value === 'granted') return false
  if (localStorage.getItem(DENIED_KEY) === 'true') return false

  // Don't prompt on first-ever visit — let the user experience the app first
  if (!localStorage.getItem(VISITED_KEY)) return false

  const snoozedAt = localStorage.getItem(SNOOZE_KEY)
  if (snoozedAt) {
    const elapsed = Date.now() - Number(snoozedAt)
    if (elapsed < SNOOZE_DAYS * 24 * 60 * 60 * 1000) return false
  }

  return true
})

async function enable() {
  const granted = await requestPermission()
  if (!granted && Notification.permission === 'denied') {
    localStorage.setItem(DENIED_KEY, 'true')
  }
  dismissed.value = true
}

function snooze() {
  localStorage.setItem(SNOOZE_KEY, String(Date.now()))
  dismissed.value = true
}
</script>
