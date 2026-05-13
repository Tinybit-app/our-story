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
            class="mb-8 text-xs font-bold uppercase tracking-widest text-foreground"
          >
            Our Story
          </p>
          <div
            class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary"
          >
            <svg
              class="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              />
            </svg>
          </div>
          <template v-if="errorType === 'expired'">
            <h1 class="mb-2 text-xl font-bold text-foreground">
              {{ t('viewerLink.viewerExpiredTitle') }}
            </h1>
            <p class="mb-8 text-sm text-muted-foreground">
              {{ t('viewerLink.viewerExpiredBody') }}
            </p>
            <button
              type="button"
              @click="sendReminder"
              class="w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {{ t('viewerLink.viewerExpiredCta') }}
            </button>
          </template>
          <template v-else>
            <h1 class="mb-2 text-xl font-bold text-foreground">
              {{ t('viewerLink.viewerInvalidTitle') }}
            </h1>
            <p class="mb-8 text-sm text-muted-foreground">
              {{ t('viewerLink.viewerInvalidBody') }}
            </p>
          </template>
          <NuxtLink
            to="/login"
            class="mt-4 block text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
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
            class="h-full w-full object-cover opacity-50"
          />
        </div>
        <!-- Overlay content -->
        <div class="relative z-10 w-full max-w-sm text-center">
          <p
            class="mb-6 text-xs font-bold uppercase tracking-widest text-white/70"
          >
            Our Story
          </p>
          <h1 class="mb-3 text-2xl font-bold leading-snug text-white">
            {{ timeline.ownerFirstName || t('common.someone') }}
            {{ t('viewerLink.viewerSplashTitle') }}
          </h1>
          <p class="mb-10 text-sm text-white/70">
            {{ t('viewerLink.viewerSplashSubtitle') }}
          </p>
          <button
            type="button"
            @click="dismissSplash"
            class="w-full rounded-[12px] bg-white py-3.5 text-sm font-semibold text-stone-900 transition-opacity hover:opacity-90"
          >
            {{ t('viewerLink.viewerSplashCta') }}
          </button>
        </div>
      </div>
    </template>

    <!-- Timeline view -->
    <template v-else-if="timeline">
      <div class="mx-auto max-w-[1280px]">
        <!-- Minimal header -->
        <header
          class="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p
                class="mb-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-accent"
              >
                Our Story
              </p>
              <p class="truncate text-sm font-semibold text-foreground">
                {{ timeline.circleName }}
                <span
                  v-if="timeline.linkLabel && timeline.mode !== 'full'"
                  class="font-normal text-muted-foreground"
                >
                  · {{ timeline.linkLabel }}</span
                >
              </p>
            </div>
            <div class="flex flex-shrink-0 items-center gap-2">
              <LocalePicker guest />
              <NuxtLink
                to="/login"
                class="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {{ t('viewerLink.viewerJoinCta').replace(' →', '') }}
              </NuxtLink>
            </div>
          </div>
        </header>

        <main class="px-4 py-6">
          <!-- Mode banner + guest name -->
          <div
            v-if="modeBanner || guestName"
            class="mb-4 mt-1 flex items-center justify-between"
          >
            <p v-if="modeBanner" class="text-xs text-muted-foreground">
              {{ modeBanner }}
            </p>
            <button
              v-if="guestName"
              type="button"
              @click="editGuestName"
              class="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
          <div v-if="timeline.memories.length === 0" class="py-20 text-center">
            <p class="mb-1 text-sm font-semibold text-foreground">
              {{ t('viewerLink.emptyState') }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t('viewerLink.emptyStateBody') }}
            </p>
          </div>

          <!-- Memory list (large text for viewer accessibility) -->
          <div v-else class="flex flex-col gap-6">
            <article
              v-for="(memory, index) in timeline.memories"
              :key="memory.id"
              :ref="(el) => observeMemory(el, index)"
              class="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <video
                v-if="memory.signedUrl && memory.mediaType === 'video'"
                :src="memory.signedUrl"
                class="aspect-[4/3] w-full object-cover"
                controls
                playsinline
                preload="metadata"
              />
              <img
                v-else-if="memory.signedUrl"
                :src="memory.signedUrl"
                :alt="memory.note ?? t('card.photoAlt')"
                class="aspect-[4/3] w-full object-cover"
              />
              <div class="px-4 py-4">
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ formatDate(memory.memory_date) }}
                </p>
                <p
                  v-if="memory.note"
                  class="text-base leading-relaxed text-foreground"
                >
                  {{ memory.note }}
                </p>
                <!-- Reaction button -->
                <div class="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    @click="reactToMemory(memory.id)"
                    :disabled="reactedIds.has(memory.id)"
                    class="flex items-center gap-1.5 transition-all active:scale-95"
                    :class="
                      reactedIds.has(memory.id)
                        ? 'cursor-default text-rose-500'
                        : 'text-muted-foreground hover:scale-110 hover:text-rose-500'
                    "
                    :aria-label="
                      reactedIds.has(memory.id)
                        ? t('viewerLink.viewerReactSent')
                        : t('viewerLink.viewerReact')
                    "
                  >
                    <svg
                      class="h-5 w-5 transition-all"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      :fill="
                        reactedIds.has(memory.id) ? 'currentColor' : 'none'
                      "
                    >
                      <path
                        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                      />
                    </svg>
                    <span class="text-xs font-medium">
                      {{
                        reactedIds.has(memory.id)
                          ? t('viewerLink.viewerReactSent')
                          : t('viewerLink.viewerReact')
                      }}
                    </span>
                  </button>
                  <Transition name="fade">
                    <span
                      v-if="justReactedId === memory.id"
                      class="text-xs font-medium text-rose-500"
                    >
                      {{ t('viewerLink.viewerReactionConfirm') }}
                    </span>
                  </Transition>
                </div>
              </div>
            </article>

            <!-- Referral nudge — shown after scrolling past 3 memories -->
            <Transition name="fade">
              <div
                v-if="showReferral"
                class="flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3.5"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold leading-snug text-foreground">
                    {{ t('viewerLink.referralHeadline') }}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {{ t('viewerLink.referralBody') }}
                  </p>
                </div>
                <button
                  type="button"
                  @click="shareApp"
                  :disabled="referralCopied"
                  class="flex-shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95"
                  :class="
                    referralCopied
                      ? 'bg-green-500 text-white'
                      : 'bg-accent text-accent-foreground hover:opacity-90'
                  "
                >
                  {{
                    referralCopied
                      ? t('viewerLink.copied')
                      : t('viewerLink.referralCta')
                  }}
                </button>
              </div>
            </Transition>
          </div>

          <!-- Join CTA -->
          <div class="mt-10 text-center">
            <NuxtLink
              to="/login"
              class="inline-block rounded-[12px] bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {{ t('viewerLink.viewerJoinCta') }}
            </NuxtLink>
          </div>
        </main>
      </div>
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
            @keydown.enter="confirmReaction"
          />
          <button
            type="button"
            @click="confirmReaction"
            :disabled="!guestName.trim()"
            class="w-full rounded-[12px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {{
              pendingReactionMemoryId
                ? t('viewerLink.viewerNamePromptCta')
                : t('viewerLink.viewerSaveName')
            }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

const { t, locale, setLocale } = useI18n()
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
  }>
}

const timeline = ref<ViewerTimeline | null>(null)
const errorType = ref<'expired' | 'invalid' | null>(null)

// ── Guest reaction ─────────────────────────────────────────────────────────────
const showNamePrompt = ref(false)
const guestName = ref('')
const pendingReactionMemoryId = ref<string | null>(null)
const justReactedId = ref<string | null>(null)

// Persist reacted memory IDs in localStorage so reactions survive page refresh
const REACTED_STORAGE_KEY = 'viewer_reacted_ids'
const reactedIds = ref(loadReactedIds())

function loadReactedIds(): Set<string> {
  if (import.meta.server) return new Set()
  try {
    const stored = localStorage.getItem(REACTED_STORAGE_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveReactedIds() {
  try {
    localStorage.setItem(
      REACTED_STORAGE_KEY,
      JSON.stringify([...reactedIds.value]),
    )
  } catch {
    /* quota exceeded — best effort */
  }
}

// ── Referral ───────────────────────────────────────────────────────────────────
const memoriesSeenCount = ref(0)
const referralDismissed = ref(false)
const referralCopied = ref(false)
const showReferral = computed(
  () => memoriesSeenCount.value >= 3 && !referralDismissed.value,
)

// ── Mode banner ────────────────────────────────────────────────────────────────
const modeBanner = computed(() => {
  if (!timeline.value) return null
  const { mode, selectionDateRange, memories } = timeline.value
  if (mode === 'selection' && selectionDateRange) {
    const fmt = (d: string) =>
      new Intl.DateTimeFormat(locale.value, {
        month: 'short',
        year: 'numeric',
      }).format(new Date(d))
    return t('viewerLink.selectionBanner', {
      count: memories.length,
      from: fmt(selectionDateRange.from),
      to: fmt(selectionDateRange.to),
    })
  }
  return null
})

// ── IntersectionObserver for referral trigger ──────────────────────────────────
let observer: IntersectionObserver | null = null

function observeMemory(
  el: Element | ComponentPublicInstance | null,
  index: number,
) {
  if (!(el instanceof Element) || index < 2) return // only observe 3rd memory (index 2)
  if (observer) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        memoriesSeenCount.value = Math.max(memoriesSeenCount.value, 3)
        observer?.disconnect()
        observer = null
      }
    },
    { threshold: 0.5 },
  )
  observer.observe(el)
}

async function shareApp() {
  const shareData = { title: 'Our Story', url: 'https://ourstory.tinybit.app' }
  if (navigator.share) {
    try {
      await navigator.share(shareData)
      referralDismissed.value = true // only dismiss on successful share
    } catch {
      // User cancelled the share sheet — keep CTA visible
    }
  } else {
    await navigator.clipboard.writeText(shareData.url).catch(() => {})
    referralCopied.value = true
    setTimeout(() => {
      referralDismissed.value = true
    }, 1500)
  }
}

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function sendReminder() {
  const text = encodeURIComponent(t('viewerLink.reminderSmsBody'))
  window.open(`sms:?body=${text}`, '_blank')
}

// ── Reactions ──────────────────────────────────────────────────────────────────
function editGuestName() {
  showNamePrompt.value = true
  pendingReactionMemoryId.value = null
}

async function reactToMemory(memoryId: string) {
  const savedName = useCookie('viewer_guest_name')
  if (!savedName.value) {
    // First reaction — prompt for name
    pendingReactionMemoryId.value = memoryId
    showNamePrompt.value = true
    return
  }
  await submitReaction(memoryId, savedName.value)
}

async function confirmReaction() {
  if (!guestName.value.trim()) return
  const savedName = useCookie('viewer_guest_name', {
    maxAge: 365 * 24 * 60 * 60,
  })
  savedName.value = guestName.value.trim()
  showNamePrompt.value = false
  // If opened from a reaction tap, submit it; if editing name only, just save
  if (pendingReactionMemoryId.value) {
    await submitReaction(pendingReactionMemoryId.value, guestName.value.trim())
    pendingReactionMemoryId.value = null
  }
}

async function submitReaction(memoryId: string, name: string) {
  try {
    await $fetch('/api/reactions/guest', {
      method: 'POST',
      body: {
        viewerToken: token.value,
        memoryId,
        emoji: '❤️',
        guestName: name,
      },
    })
    reactedIds.value = new Set([...reactedIds.value, memoryId])
    saveReactedIds()
    justReactedId.value = memoryId
    setTimeout(() => {
      justReactedId.value = null
    }, 2000)
  } catch {
    // Best-effort — silently swallow errors on the viewer page
  }
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
