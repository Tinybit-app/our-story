<template>
  <div class="min-h-screen bg-background">

    <!-- Header -->
    <header class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 h-14 flex items-center gap-3">
        <button
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
          @click="router.back()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          {{ t('common.back') }}
        </button>

        <p class="flex-1 text-sm font-semibold text-foreground text-center">{{ t('notificationSettings.title') }}</p>

        <!-- spacer to balance the back button -->
        <div class="w-12" />
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5 py-8">
      <div class="max-w-lg space-y-6">

        <!-- Loading -->
        <div v-if="!circles.length" class="flex justify-center py-24">
          <div class="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        </div>

        <template v-else>

          <!-- Circle selector (only when 2+ circles) -->
          <div v-if="circles.length > 1" class="flex flex-wrap gap-2">
            <button
              v-for="c in circles"
              :key="c.id"
              class="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
              :class="selectedCircleId === c.id
                ? 'border-foreground bg-secondary text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30'"
              @click="selectedCircleId = c.id"
            >
              {{ c.name }}
            </button>
          </div>

          <!-- Single circle name (when only 1) -->
          <div v-else>
            <p class="text-sm font-semibold text-foreground">{{ circles[0].name }}</p>
          </div>

          <div class="h-px bg-border" />

          <!-- Push toggle -->
          <label class="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-foreground">{{ t('notificationSettings.pushNotifications') }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">{{ t('notificationSettings.pushNotificationsDesc') }}</p>
            </div>
            <input
              type="checkbox"
              :checked="pushEnabled"
              class="w-5 h-5 rounded border-border accent-primary cursor-pointer"
              @change="togglePush"
            />
          </label>

          <!-- Mute toggle -->
          <label class="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-foreground">{{ t('notificationSettings.muteCircle') }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">{{ t('notificationSettings.muteCircleDesc') }}</p>
            </div>
            <input
              type="checkbox"
              :checked="circleMuted"
              class="w-5 h-5 rounded border-border accent-primary cursor-pointer"
              @change="toggleMute"
            />
          </label>

          <!-- Mute active note -->
          <p v-if="circleMuted" class="text-xs text-muted-foreground/70 -mt-2 pl-0.5">
            {{ t('notificationSettings.muteActiveNote') }}
          </p>

          <div class="h-px bg-border" />

          <!-- Email digest frequency -->
          <div>
            <p class="text-sm font-medium text-foreground">{{ t('notificationSettings.emailDigest') }}</p>
            <p class="text-xs text-muted-foreground mt-0.5 mb-3">{{ t('notificationSettings.emailDigestDesc') }}</p>

            <div class="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                v-for="opt in digestOptions"
                :key="opt.value"
                class="px-4 py-2 text-xs font-medium transition-colors"
                :class="digestFrequency === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground'"
                @click="setDigest(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

// ── Circle list ───────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circles = computed(() => circlesData.value?.circles ?? [])

const selectedCircleId = ref('')

// Auto-select first circle
watch(circles, (list) => {
  if (list.length && !selectedCircleId.value) {
    selectedCircleId.value = list[0].id
  }
}, { immediate: true })

// ── Preferences ───────────────────────────────────────────
const pushEnabled = ref(true)
const circleMuted = ref(false)
const digestFrequency = ref<'weekly' | 'monthly' | 'off'>('monthly')

const digestOptions = computed(() => [
  { value: 'weekly' as const, label: t('notificationSettings.digestWeekly') },
  { value: 'monthly' as const, label: t('notificationSettings.digestMonthly') },
  { value: 'off' as const, label: t('notificationSettings.digestOff') },
])

async function loadPrefs() {
  if (!selectedCircleId.value || !user.value) return

  const { data } = await supabase
    .from('notificationpreference')
    .select('push_enabled, circle_muted, email_digest_frequency')
    .eq('user_id', user.value.id)
    .eq('circle_id', selectedCircleId.value)
    .maybeSingle()

  if (data) {
    pushEnabled.value = data.push_enabled
    circleMuted.value = data.circle_muted
    digestFrequency.value = (data.email_digest_frequency as 'weekly' | 'monthly' | 'off') ?? 'monthly'
  } else {
    // No row yet — show defaults
    pushEnabled.value = true
    circleMuted.value = false
    digestFrequency.value = 'monthly'
  }
}

watch(selectedCircleId, () => { loadPrefs() }, { immediate: true })

async function savePref(fields: Record<string, any>) {
  if (!selectedCircleId.value || !user.value) return

  await $fetch('/api/notification-preferences', {
    method: 'PATCH',
    body: { circleId: selectedCircleId.value, ...fields },
  })
}

function togglePush() {
  pushEnabled.value = !pushEnabled.value
  savePref({ push_enabled: pushEnabled.value })
}

function toggleMute() {
  circleMuted.value = !circleMuted.value
  savePref({ circle_muted: circleMuted.value })
}

function setDigest(value: 'weekly' | 'monthly' | 'off') {
  digestFrequency.value = value
  savePref({ email_digest_frequency: value })
}
</script>
