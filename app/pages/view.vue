<template>
  <div class="min-h-screen bg-background">
    <!-- Missing token: redirect handled in onMounted -->
    <template v-if="!token">
      <div class="flex min-h-screen items-center justify-center px-6">
        <p class="text-sm text-muted-foreground">
          {{ t('viewerLink.redirecting') }}
        </p>
      </div>
    </template>

    <!-- Error states -->
    <template v-else-if="errorType">
      <div
        class="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <div class="w-full max-w-sm">
          <p
            class="mb-8 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground"
          >
            Our Story
          </p>
          <template v-if="errorType === 'expired'">
            <!-- Clock icon -->
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="mx-auto mb-6 text-muted-foreground/60"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h1
              class="mb-3 font-serif text-[28px] italic leading-tight text-foreground sm:text-[32px]"
            >
              {{ t('viewerLink.viewerExpiredTitle') }}
            </h1>
            <p class="mb-8 text-sm text-muted-foreground">
              {{ t('viewerLink.viewerExpiredBody') }}
            </p>
            <button
              type="button"
              @click="sendReminder"
              class="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              {{ t('viewerLink.viewerExpiredCta') }}
            </button>
          </template>
          <template v-else>
            <!-- Alert triangle icon -->
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="mx-auto mb-6 text-muted-foreground/60"
            >
              <path
                d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h1
              class="mb-3 font-serif text-[28px] italic leading-tight text-foreground sm:text-[32px]"
            >
              {{ t('viewerLink.viewerInvalidTitle') }}
            </h1>
            <p class="mb-8 text-sm text-muted-foreground">
              {{ t('viewerLink.viewerInvalidBody') }}
            </p>
          </template>
          <NuxtLink
            to="/login"
            class="mt-6 block text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {{ t('viewerLink.viewerSignIn') }}
          </NuxtLink>
        </div>
      </div>
    </template>

    <!-- First-open splash -->
    <template v-else-if="showSplash && timeline">
      <div
        class="relative flex min-h-screen flex-col items-center justify-end px-6 pb-16"
      >
        <!-- Full-bleed background: most recent memory or gradient -->
        <div
          class="absolute inset-0 bg-gradient-to-b from-stone-800 to-stone-900"
        >
          <img
            v-if="timeline.memories[0]?.signedUrl"
            :src="timeline.memories[0].signedUrl"
            alt=""
            class="h-full w-full object-cover opacity-45"
          />
        </div>
        <!-- Overlay content -->
        <div class="relative z-10 w-full max-w-sm text-center">
          <p
            class="mb-6 text-[10px] font-bold uppercase tracking-[.2em] text-white/70"
          >
            Our Story
          </p>
          <h1
            class="mb-3 font-serif text-[36px] italic leading-[1.05] text-white sm:text-[44px]"
          >
            {{ timeline.ownerFirstName || t('common.someone') }}
            {{ t('viewerLink.viewerSplashTitle') }}
          </h1>
          <p class="mb-10 font-serif text-sm italic text-white/70">
            {{ t('viewerLink.viewerSplashSubtitle') }}
          </p>
          <button
            type="button"
            @click="dismissSplash"
            class="rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 transition-opacity hover:opacity-90"
          >
            {{ t('viewerLink.viewerSplashCta') }}
          </button>
        </div>
      </div>
    </template>

    <!-- Timeline view -->
    <template v-else-if="timeline">
      <ViewerSpreadHeader
        :circle-name="timeline.circleName"
        :owner-label="ownerLabel"
        :link-label="timeline.linkLabel || null"
        :memory-count="timeline.memories.length"
        :mode="timeline.mode === 'full' ? 'full' : 'selection'"
      />

      <main class="mx-auto max-w-[1280px] px-4 py-6 sm:px-5">
        <!-- Guest-name affordance — small button to set/change name -->
        <div v-if="guestName" class="mb-4 flex justify-end">
          <button
            type="button"
            @click="editGuestName"
            class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            :title="t('viewerLink.viewerChangeNameTooltip')"
          >
            <span class="max-w-[120px] truncate">{{ guestName }}</span>
            <svg
              class="h-2.5 w-2.5 flex-shrink-0 opacity-50"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>

        <!-- Empty state -->
        <div
          v-if="timeline.memories.length === 0"
          class="py-20 text-center"
        >
          <p class="mb-1 text-sm font-semibold text-foreground">
            {{ t('viewerLink.emptyState') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('viewerLink.emptyStateBody') }}
          </p>
        </div>

        <!-- Mosaic body -->
        <TimelineMosaic
          v-else
          :month-groups="monthGroups"
          :loading="false"
          :has-next-page="false"
          :circle-type="null"
          :circle-id="null"
          viewer-mode
          @open-memory="onOpenMemory"
        />
      </main>

      <!-- Modal — viewer-mode -->
      <MemoryShell
        :memories="adaptedMemories"
        :start-index="selectedIndex"
        :origin-rect="selectedRect"
        :tilt="selectedTilt"
        viewer-mode
        :viewer-token="token"
        :guest-name="guestName || undefined"
        @close="selectedIndex = null"
      />
    </template>

    <!-- Loading -->
    <template v-else>
      <div class="flex min-h-screen items-center justify-center">
        <p class="text-sm text-muted-foreground">
          {{ t('viewerLink.loading') }}
        </p>
      </div>
    </template>

    <!-- Guest name prompt (shown on first reaction) -->
    <Transition name="slide-up">
      <div
        v-if="showNamePrompt"
        class="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showNamePrompt = false"
        />
        <div
          class="relative w-full max-w-sm rounded-[20px] border border-border bg-card p-6 shadow-2xl"
        >
          <h2 class="mb-1 text-base font-bold text-foreground">
            {{ t('viewerLink.viewerNamePromptTitle') }}
          </h2>
          <p class="mb-5 text-sm text-muted-foreground">
            {{ t('viewerLink.viewerNamePromptSubtitle') }}
          </p>
          <input
            v-model="guestName"
            type="text"
            :placeholder="t('viewerLink.viewerNamePromptPlaceholder')"
            class="mb-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            @keydown.enter="confirmGuestName"
          />
          <button
            type="button"
            @click="confirmGuestName"
            :disabled="!guestName.trim()"
            class="w-full rounded-[12px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {{ t('viewerLink.viewerSaveName') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from 'vue'
import type { Memory } from '~/composables/useTimeline'

definePageMeta({ auth: false })

const { t, setLocale } = useI18n()
const route = useRoute()
const router = useRouter()
const token = computed(() => route.query.token as string | undefined)

// ── Session-level splash tracking ──────────────────────────────────────────────
const SESSION_KEY = 'viewer_splash_seen'
const showSplash = ref(false)

// ── State ──────────────────────────────────────────────────────────────────────
interface ViewerTimeline {
  circleName: string
  ownerFirstName: string | null
  ownerLocale: string | null
  linkLabel: string
  mode: 'full' | 'selection'
  selectionDateRange: { from: string; to: string } | null
  memories: Array<{
    id: string
    memory_date: string
    note: string | null
    signedUrl: string | null
    mediaType: 'image' | 'video' | null
    media_count?: number
    cover_text_content?: string | null
  }>
}

const timeline = ref<ViewerTimeline | null>(null)
const errorType = ref<'expired' | 'invalid' | null>(null)

// ── Guest name (used as prop for the in-modal heart reaction) ─────────────────
const showNamePrompt = ref(false)
const guestName = ref('')

// ── Adapter: thin viewer-endpoint memories → Memory-compatible shape ──────────
const adaptedMemories = computed<Memory[]>(() => {
  if (!timeline.value) return []
  return timeline.value.memories.map((m) => ({
    id: m.id,
    circle_id: '',
    owner_user_id: null,
    former_owner_name: null,
    former_owner_user_id: null,
    visibility: 'circle' as const,
    note: m.note,
    memory_date: m.memory_date,
    milestone_label: null,
    created_at: m.memory_date,
    memory_children: [],
    memory_members: [],
    memorymedia: m.signedUrl
      ? [
          {
            id: `view-${m.id}`,
            media_type: m.mediaType === 'video' ? 'video' : 'photo',
            url: m.signedUrl,
            thumbnailUrl: m.signedUrl,
            file_size: 0,
          },
        ]
      : [],
    user: null,
    memoryreaction: [],
    memorycomment: [],
    media_count: m.media_count ?? 1,
    cover_text_content: m.cover_text_content ?? null,
  }))
})

// Reactive copy for the composable's Ref<Memory[]> signature
const adaptedMemoriesRef = ref<Memory[]>([])
watchEffect(() => {
  adaptedMemoriesRef.value = adaptedMemories.value
})

const monthCountsRef = ref<Record<string, number>>({})
const { monthGroups } = useTimeline(adaptedMemoriesRef, monthCountsRef)

// ── Modal state ────────────────────────────────────────────────────────────────
const selectedIndex = ref<number | null>(null)
const selectedRect = ref<DOMRect | null>(null)
const selectedTilt = ref(0)

function onOpenMemory({
  memory,
  tilt,
  rect,
}: {
  memory: Memory
  tilt: number
  rect: DOMRect | null
}) {
  selectedRect.value = rect
  selectedTilt.value = tilt
  selectedIndex.value = adaptedMemories.value.findIndex(
    (m) => m.id === memory.id,
  )
}

// ── Owner label for the spread header ─────────────────────────────────────────
const ownerLabel = computed(() => timeline.value?.ownerFirstName ?? null)

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!token.value) {
    router.replace('/login')
    return
  }

  // Restore saved guest name from cookie
  const savedName = useCookie('viewer_guest_name')
  if (savedName.value) guestName.value = savedName.value

  await loadTimeline()
})

async function loadTimeline() {
  try {
    const data = await $fetch<ViewerTimeline>('/api/viewer/timeline', {
      query: { token: token.value },
    })
    timeline.value = data

    // Guest's explicit choice (viewer_locale) takes priority; fall back to owner's locale.
    // We use a separate cookie because i18n_locale is auto-set by @nuxtjs/i18n's
    // detectBrowserLanguage and is never null — it can't distinguish "guest chose English"
    // from "browser defaulted to English".
    const guestExplicitLocale = useCookie('viewer_locale')
    const targetLocale = guestExplicitLocale.value || data.ownerLocale
    if (targetLocale) {
      await setLocale(targetLocale as any)
    }

    // Show splash unless already seen this session
    const seenThisSession =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(SESSION_KEY) === '1'
        : false
    showSplash.value = !seenThisSession
  } catch (err: any) {
    const msg = err?.data?.message ?? err?.message ?? ''
    errorType.value = msg === 'expired' ? 'expired' : 'invalid'
  }
}

function dismissSplash() {
  showSplash.value = false
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, '1')
  }
}

function sendReminder() {
  const text = encodeURIComponent(t('viewerLink.reminderSmsBody'))
  window.open(`sms:?body=${text}`, '_blank')
}

// ── Guest-name modal handlers ──────────────────────────────────────────────────
function editGuestName() {
  showNamePrompt.value = true
}

function confirmGuestName() {
  if (!guestName.value.trim()) return
  const savedName = useCookie('viewer_guest_name', {
    maxAge: 365 * 24 * 60 * 60,
  })
  savedName.value = guestName.value.trim()
  showNamePrompt.value = false
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>