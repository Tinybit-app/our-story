<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-5">
        <button
          class="-ml-1 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          @click="router.back()"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {{ t('common.back') }}
        </button>

        <p class="flex-1 text-center text-sm font-semibold text-foreground">
          {{ t('notificationSettings.title') }}
        </p>

        <!-- spacer to balance the back button -->
        <div class="w-12" />
      </div>
    </header>

    <main class="mx-auto max-w-[1280px] px-5 py-8">
      <div class="max-w-lg space-y-6">
        <!-- Loading -->
        <div v-if="!circles.length" class="flex justify-center py-24">
          <div
            class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent"
          />
        </div>

        <template v-else>
          <!-- Circle selector (only when 2+ circles) -->
          <div v-if="circles.length > 1" class="flex flex-wrap gap-2">
            <button
              v-for="c in circles"
              :key="c.id"
              class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              :class="
                selectedCircleId === c.id
                  ? 'border-foreground bg-secondary text-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/30'
              "
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

          <!-- Loading prefs -->
          <div v-if="!prefsLoaded" class="flex justify-center py-8">
            <div
              class="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent"
            />
          </div>

          <template v-else>
            <!-- Push toggle -->
            <label class="flex cursor-pointer items-center justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ t('notificationSettings.pushNotifications') }}
                </p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {{ t('notificationSettings.pushNotificationsDesc') }}
                </p>
              </div>
              <input
                type="checkbox"
                :checked="pushEnabled"
                class="h-5 w-5 cursor-pointer rounded border-border accent-primary"
                @change="togglePush"
              />
            </label>

            <!-- Mute toggle -->
            <label class="flex cursor-pointer items-center justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ t('notificationSettings.muteCircle') }}
                </p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {{ t('notificationSettings.muteCircleDesc') }}
                </p>
              </div>
              <input
                type="checkbox"
                :checked="circleMuted"
                class="h-5 w-5 cursor-pointer rounded border-border accent-primary"
                @change="toggleMute"
              />
            </label>

            <!-- Mute active note -->
            <p v-if="circleMuted" class="-mt-2 pl-0.5 text-xs text-muted-foreground/70">
              {{ t('notificationSettings.muteActiveNote') }}
            </p>

            <!-- Milestone reminders toggle -->
            <label class="flex cursor-pointer items-center justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ t('notificationSettings.milestoneNudges') }}
                </p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {{ t('notificationSettings.milestoneNudgesDesc') }}
                </p>
              </div>
              <input
                type="checkbox"
                :checked="milestoneNudgesEnabled"
                class="h-5 w-5 cursor-pointer rounded border-border accent-primary"
                @change="toggleMilestoneNudges"
              />
            </label>

            <div class="h-px bg-border" />

            <!-- Email digest frequency -->
            <div>
              <p class="text-sm font-medium text-foreground">
                {{ t('notificationSettings.emailDigest') }}
              </p>
              <p class="mb-3 mt-0.5 text-xs text-muted-foreground">
                {{ t('notificationSettings.emailDigestDesc') }}
              </p>

              <div class="inline-flex overflow-hidden rounded-lg border border-border">
                <button
                  v-for="opt in digestOptions"
                  :key="opt.value"
                  class="px-4 py-2 text-xs font-medium transition-colors"
                  :class="
                    digestFrequency === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  "
                  @click="setDigest(opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </template>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()

// ── Circle list ───────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circles = computed(() => circlesData.value?.circles ?? [])

const selectedCircleId = ref('')

// Auto-select first circle
watch(
  circles,
  (list) => {
    if (list.length && !selectedCircleId.value) {
      selectedCircleId.value = list[0].id
    }
  },
  { immediate: true },
)

// ── Preferences ───────────────────────────────────────────
const pushEnabled = ref(true)
const circleMuted = ref(false)
const digestFrequency = ref<'weekly' | 'monthly' | 'off'>('monthly')
const milestoneNudgesEnabled = ref(true)
const prefsLoaded = ref(false)

const digestOptions = computed(() => [
  { value: 'weekly' as const, label: t('notificationSettings.digestWeekly') },
  { value: 'monthly' as const, label: t('notificationSettings.digestMonthly') },
  { value: 'off' as const, label: t('notificationSettings.digestOff') },
])

async function loadPrefs() {
  if (!selectedCircleId.value) return
  prefsLoaded.value = false

  try {
    const data = await $fetch<{
      push_enabled: boolean
      circle_muted: boolean
      email_digest_frequency: string
      milestone_nudges_enabled: boolean
    }>('/api/notification-preferences', {
      query: { circleId: selectedCircleId.value },
    })
    pushEnabled.value = data.push_enabled
    circleMuted.value = data.circle_muted
    digestFrequency.value = data.email_digest_frequency as 'weekly' | 'monthly' | 'off'
    milestoneNudgesEnabled.value = data.milestone_nudges_enabled
  } catch {
    pushEnabled.value = true
    circleMuted.value = false
    digestFrequency.value = 'monthly'
    milestoneNudgesEnabled.value = true
  }
  prefsLoaded.value = true
}

watch(
  selectedCircleId,
  () => {
    loadPrefs()
  },
  { immediate: true },
)

async function savePref(fields: Record<string, any>) {
  if (!selectedCircleId.value) return

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

function toggleMilestoneNudges() {
  milestoneNudgesEnabled.value = !milestoneNudgesEnabled.value
  savePref({ milestone_nudges_enabled: milestoneNudgesEnabled.value })
}
</script>
