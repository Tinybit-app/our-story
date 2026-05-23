<template>
  <div class="min-h-screen bg-background">
    <!-- Page strip header -->
    <header class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-[640px] items-center gap-3 px-5">
        <button
          class="-ml-1 flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          @click="router.back()"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {{ t('common.back') }}
        </button>
        <span class="flex-1 text-center">
          <span class="text-[9px] font-bold uppercase tracking-[.18em] text-accent">Our Story</span>
          <span class="mx-1 text-muted-foreground">·</span>
          <span class="text-[12px] font-medium text-foreground">{{ t('notificationSettings.title') }}</span>
        </span>
        <div class="w-12" />
      </div>
    </header>

    <main class="mx-auto max-w-[640px] px-5 py-8">
      <!-- Loading circles -->
      <div v-if="!circles.length" class="flex justify-center py-24">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>

      <template v-else>
        <!-- Italic display title -->
        <div class="mb-8 px-[4px]">
          <h1 class="font-serif text-[32px] italic leading-[1.05] text-foreground sm:text-[34px]">
            {{ t('notificationSettings.displayTitle') }}
          </h1>
          <p class="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">
            {{ t('notificationSettings.displaySubtitle') }}
          </p>
        </div>

        <!-- Scope indicator -->
        <div class="mb-6 flex items-end justify-between gap-3 px-[4px]">
          <div>
            <p class="mb-1 select-none text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
              {{ t('notificationSettings.scopeLabel') }}
            </p>
            <p class="text-base font-semibold text-foreground">
              {{ selectedCircle?.name ?? '—' }}
            </p>
          </div>
          <NuxtLink
            v-if="circles.length > 1"
            :to="selectedCircleId ? `/timeline?circle=${selectedCircleId}` : '/timeline'"
            class="flex-shrink-0 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ t('notificationSettings.switchCircle') }}
          </NuxtLink>
        </div>

        <!-- Loading prefs -->
        <div v-if="!prefsLoaded" class="flex justify-center py-8">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>

        <template v-else>
          <!-- PUSH section -->
          <SettingsSection :label="t('notificationSettings.sectionPush')">
            <!-- Push notifications -->
            <SettingsRow>
              {{ t('notificationSettings.pushNotifications') }}
              <template #hint>{{ t('notificationSettings.pushNotificationsDesc') }}</template>
              <template #control>
                <SettingsToggle :model-value="pushEnabled" @update:model-value="togglePush" />
              </template>
            </SettingsRow>

            <!-- Mute this circle -->
            <SettingsRow>
              {{ t('notificationSettings.muteCircle') }}
              <template #hint>
                {{ circleMuted ? t('notificationSettings.muteActiveNote') : t('notificationSettings.muteCircleDesc') }}
              </template>
              <template #control>
                <SettingsToggle :model-value="circleMuted" @update:model-value="toggleMute" />
              </template>
            </SettingsRow>

            <!-- Milestone reminders -->
            <SettingsRow>
              {{ t('notificationSettings.milestoneNudges') }}
              <template #hint>{{ t('notificationSettings.milestoneNudgesDesc') }}</template>
              <template #control>
                <SettingsToggle :model-value="milestoneNudgesEnabled" @update:model-value="toggleMilestoneNudges" />
              </template>
            </SettingsRow>
          </SettingsSection>

          <!-- EMAIL section -->
          <SettingsSection :label="t('notificationSettings.sectionEmail')">
            <!-- Email digest frequency -->
            <SettingsRow>
              {{ t('notificationSettings.emailDigest') }}
              <template #hint>{{ t('notificationSettings.emailDigestDesc') }}</template>
              <template #control>
                <div class="inline-flex overflow-hidden rounded-lg border border-border">
                  <button
                    v-for="opt in digestOptions"
                    :key="opt.value"
                    class="px-3 py-1.5 text-[11px] font-medium transition-colors"
                    :class="
                      digestFrequency === opt.value
                        ? 'bg-foreground text-background'
                        : 'bg-card text-muted-foreground hover:text-foreground'
                    "
                    @click="setDigest(opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </template>
            </SettingsRow>
          </SettingsSection>

          <!-- PER-CIRCLE section (multi-circle users) -->
          <SettingsSection v-if="circles.length > 1" :label="t('notificationSettings.sectionPerCircle')">
            <SettingsRow
              v-for="circle in circles"
              :key="circle.id"
              :to="`/notification-settings?circle=${circle.id}`"
            >
              {{ circle.name }}
            </SettingsRow>
          </SettingsSection>
        </template>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

// ── Circle list ───────────────────────────────────────────
const { data: circlesData } = await useFetch<{ circles: any[] }>('/api/circles')
const circles = computed(() => circlesData.value?.circles ?? [])

const selectedCircleId = ref('')
const route = useRoute()
const router = useRouter()

// This page edits notification prefs for one circle at a time — the one
// passed in as ?circle=<id> from the caller (timeline header / dropdown).
// Switching circles is done via the timeline, not in-page, so we just bind
// once on first load and never mutate selectedCircleId again afterwards.
watch(
  circles,
  (list) => {
    if (list.length && !selectedCircleId.value) {
      const paramId = route.query.circle as string | undefined
      const matched = paramId
        ? list.find((c: any) => c.id === paramId)
        : undefined
      selectedCircleId.value = matched?.id ?? list[0].id
    }
  },
  { immediate: true },
)

const selectedCircle = computed(() =>
  circles.value.find((c: any) => c.id === selectedCircleId.value) ?? null,
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
    digestFrequency.value = data.email_digest_frequency as
      | 'weekly'
      | 'monthly'
      | 'off'
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
