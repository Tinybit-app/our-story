<template>
  <div class="min-h-screen bg-background">

    <!-- Missing token: redirect handled in onMounted -->
    <template v-if="!token">
      <div class="min-h-screen flex items-center justify-center px-6">
        <p class="text-sm text-muted-foreground">{{ t('viewerLink.redirecting') }}</p>
      </div>
    </template>

    <!-- Error states -->
    <template v-else-if="errorType">
      <div class="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div class="w-full max-w-sm">
          <p class="text-xs font-bold tracking-widest text-foreground uppercase mb-8">Our Story</p>
          <div class="w-14 h-14 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
            <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <template v-if="errorType === 'expired'">
            <h1 class="text-xl font-bold text-foreground mb-2">{{ t('viewerLink.viewerExpiredTitle') }}</h1>
            <p class="text-sm text-muted-foreground mb-8">{{ t('viewerLink.viewerExpiredBody') }}</p>
            <button
              type="button"
              @click="sendReminder"
              class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {{ t('viewerLink.viewerExpiredCta') }}
            </button>
          </template>
          <template v-else>
            <h1 class="text-xl font-bold text-foreground mb-2">{{ t('viewerLink.viewerInvalidTitle') }}</h1>
            <p class="text-sm text-muted-foreground mb-8">{{ t('viewerLink.viewerInvalidBody') }}</p>
          </template>
          <NuxtLink
            to="/login"
            class="block mt-4 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {{ t('viewerLink.viewerSignIn') }}
          </NuxtLink>
        </div>
      </div>
    </template>

    <!-- First-open splash -->
    <template v-else-if="showSplash && timeline">
      <div class="min-h-screen relative flex flex-col items-center justify-end pb-16 px-6">
        <!-- Full-bleed background: most recent memory or gradient -->
        <div class="absolute inset-0 bg-gradient-to-b from-stone-800 to-stone-900">
          <img
            v-if="timeline.memories[0]?.signedUrl"
            :src="timeline.memories[0].signedUrl"
            alt=""
            class="w-full h-full object-cover opacity-50"
          />
        </div>
        <!-- Overlay content -->
        <div class="relative z-10 w-full max-w-sm text-center">
          <p class="text-white/70 text-xs font-bold tracking-widest uppercase mb-6">Our Story</p>
          <h1 class="text-2xl font-bold text-white leading-snug mb-3">
            {{ timeline.ownerFirstName || t('common.someone') }} {{ t('viewerLink.viewerSplashTitle') }}
          </h1>
          <p class="text-white/70 text-sm mb-10">{{ t('viewerLink.viewerSplashSubtitle') }}</p>
          <button
            type="button"
            @click="dismissSplash"
            class="w-full bg-white text-stone-900 rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {{ t('viewerLink.viewerSplashCta') }}
          </button>
        </div>
      </div>
    </template>

    <!-- Timeline view -->
    <template v-else-if="timeline">
      <div class="max-w-[1280px] mx-auto">
        <!-- Minimal header -->
        <header class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase leading-none mb-0.5">Our Story</p>
              <p class="text-sm font-semibold text-foreground">
                {{ timeline.circleName }}
                <span v-if="timeline.linkLabel && timeline.mode !== 'full'" class="font-normal text-muted-foreground"> · {{ timeline.linkLabel }}</span>
              </p>
            </div>
            <NuxtLink
              to="/login"
              class="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5"
            >
              {{ t('viewerLink.viewerJoinCta').replace(' →', '') }}
            </NuxtLink>
          </div>
        </header>

        <main class="px-4 py-6">
          <!-- Mode banner -->
          <p v-if="modeBanner" class="text-xs text-muted-foreground mt-1 mb-4">{{ modeBanner }}</p>

          <!-- Empty state -->
          <div v-if="timeline.memories.length === 0" class="text-center py-20">
            <p class="text-sm font-semibold text-foreground mb-1">{{ t('viewerLink.emptyState') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('viewerLink.emptyStateBody') }}</p>
          </div>

          <!-- Memory list (large text for viewer accessibility) -->
          <div v-else class="flex flex-col gap-6">
            <article
              v-for="(memory, index) in timeline.memories"
              :key="memory.id"
              :ref="(el) => observeMemory(el, index)"
              class="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <video
                v-if="memory.signedUrl && memory.mediaType === 'video'"
                :src="memory.signedUrl"
                class="w-full aspect-[4/3] object-cover"
                controls
                playsinline
                preload="metadata"
              />
              <img
                v-else-if="memory.signedUrl"
                :src="memory.signedUrl"
                :alt="memory.note ?? t('card.photoAlt')"
                class="w-full aspect-[4/3] object-cover"
              />
              <div class="px-4 py-4">
                <p class="text-xs text-muted-foreground mb-1">
                  {{ formatDate(memory.memory_date) }}
                </p>
                <p v-if="memory.note" class="text-base text-foreground leading-relaxed">
                  {{ memory.note }}
                </p>
                <!-- Reaction button -->
                <div class="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    @click="reactToMemory(memory.id)"
                    :disabled="reactedIds.has(memory.id)"
                    class="flex items-center gap-1.5 transition-all active:scale-95"
                    :class="reactedIds.has(memory.id)
                      ? 'text-rose-500 cursor-default'
                      : 'text-muted-foreground hover:text-rose-500 hover:scale-110'"
                    :aria-label="reactedIds.has(memory.id) ? t('viewerLink.viewerReactSent') : t('viewerLink.viewerReact')"
                  >
                    <svg class="w-5 h-5 transition-all" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                      :fill="reactedIds.has(memory.id) ? 'currentColor' : 'none'">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span class="text-xs font-medium">
                      {{ reactedIds.has(memory.id) ? t('viewerLink.viewerReactSent') : t('viewerLink.viewerReact') }}
                    </span>
                  </button>
                  <Transition name="fade">
                    <span v-if="justReactedId === memory.id" class="text-xs text-rose-500 font-medium">
                      {{ t('viewerLink.viewerReactionConfirm') }}
                    </span>
                  </Transition>
                </div>
              </div>
            </article>

            <!-- Referral CTA — shown after 3+ memories scrolled -->
            <Transition name="fade">
              <div
                v-if="showReferral"
                class="rounded-2xl border border-border bg-secondary/50 px-5 py-6 text-center"
              >
                <p class="text-sm font-semibold text-foreground mb-1">{{ t('viewerLink.referralHeadline') }}</p>
                <button type="button" @click="shareApp" class="text-sm text-accent hover:underline">
                  {{ t('viewerLink.referralBody') }}
                </button>
                <button type="button" @click="referralDismissed = true" class="block mx-auto mt-2 text-xs text-muted-foreground hover:text-foreground">
                  {{ t('viewerLink.cancel') }}
                </button>
              </div>
            </Transition>
          </div>

          <!-- Join CTA -->
          <div class="mt-10 text-center">
            <NuxtLink
              to="/login"
              class="inline-block bg-primary text-primary-foreground rounded-[12px] px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {{ t('viewerLink.viewerJoinCta') }}
            </NuxtLink>
          </div>
        </main>
      </div>
    </template>

    <!-- Loading -->
    <template v-else>
      <div class="min-h-screen flex items-center justify-center">
        <p class="text-sm text-muted-foreground">{{ t('viewerLink.loading') }}</p>
      </div>
    </template>

    <!-- Guest name prompt (shown on first reaction) -->
    <Transition name="slide-up">
      <div
        v-if="showNamePrompt"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showNamePrompt = false" />
        <div class="relative w-full max-w-sm bg-card border border-border rounded-[20px] p-6 shadow-2xl">
          <h2 class="text-base font-bold text-foreground mb-1">{{ t('viewerLink.viewerNamePromptTitle') }}</h2>
          <p class="text-sm text-muted-foreground mb-5">{{ t('viewerLink.viewerNamePromptSubtitle') }}</p>
          <input
            v-model="guestName"
            type="text"
            :placeholder="t('viewerLink.viewerNamePromptPlaceholder')"
            class="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
            @keydown.enter="confirmReaction"
          />
          <button
            type="button"
            @click="confirmReaction"
            :disabled="!guestName.trim()"
            class="w-full bg-primary text-primary-foreground rounded-[12px] py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {{ t('viewerLink.viewerNamePromptCta') }}
          </button>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const token = computed(() => route.query.token as string | undefined)

// ── Session-level splash tracking ──────────────────────────────────────────────
const SESSION_KEY = "viewer_splash_seen"
const showSplash = ref(false)

// ── State ──────────────────────────────────────────────────────────────────────
interface ViewerTimeline {
  circleName: string
  ownerFirstName: string | null
  linkLabel: string
  mode: 'full' | 'date_range' | 'selection'
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
const errorType = ref<"expired" | "invalid" | null>(null)

// ── Guest reaction ─────────────────────────────────────────────────────────────
const showNamePrompt = ref(false)
const guestName = ref("")
const pendingReactionMemoryId = ref<string | null>(null)
const reactedIds = ref(new Set<string>())
const justReactedId = ref<string | null>(null)

// ── Referral ───────────────────────────────────────────────────────────────────
const memoriesSeenCount = ref(0)
const referralDismissed = ref(false)
const showReferral = computed(() => memoriesSeenCount.value >= 3 && !referralDismissed.value)

// ── Mode banner ────────────────────────────────────────────────────────────────
const modeBanner = computed(() => {
  if (!timeline.value) return null
  const { mode, selectionDateRange, memories } = timeline.value
  if (mode === 'date_range' && selectionDateRange) {
    const fmt = (d: string) => new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(d))
    return t('viewerLink.dateRangeBanner', { from: fmt(selectionDateRange.from), to: fmt(selectionDateRange.to) })
  }
  if (mode === 'selection' && selectionDateRange) {
    const fmt = (d: string) => new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(d))
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

function observeMemory(el: Element | ComponentPublicInstance | null, index: number) {
  if (!(el instanceof Element) || index < 2) return  // only observe 3rd memory (index 2)
  if (observer) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        memoriesSeenCount.value = Math.max(memoriesSeenCount.value, 3)
        observer?.disconnect()
        observer = null
      }
    },
    { threshold: 0.5 }
  )
  observer.observe(el)
}

async function shareApp() {
  referralDismissed.value = true
  const shareData = { title: 'Our Story', url: 'https://ourstory.tinybit.app' }
  if (navigator.share) {
    await navigator.share(shareData).catch(() => {})
  } else {
    await navigator.clipboard.writeText(shareData.url).catch(() => {})
  }
}

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!token.value) {
    router.replace("/login")
    return
  }

  // Restore saved guest name from cookie
  const savedName = useCookie("viewer_guest_name")
  if (savedName.value) guestName.value = savedName.value

  await loadTimeline()
})

async function loadTimeline() {
  try {
    const data = await $fetch<ViewerTimeline>("/api/viewer/timeline", {
      query: { token: token.value },
    })
    timeline.value = data

    // Show splash unless already seen this session
    const seenThisSession = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(SESSION_KEY) === "1"
      : false
    showSplash.value = !seenThisSession
  } catch (err: any) {
    const msg = err?.data?.message ?? err?.message ?? ""
    errorType.value = msg === "expired" ? "expired" : "invalid"
  }
}

function dismissSplash() {
  showSplash.value = false
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, "1")
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function sendReminder() {
  const text = encodeURIComponent(t('viewerLink.reminderSmsBody'))
  window.open(`sms:?body=${text}`, "_blank")
}

// ── Reactions ──────────────────────────────────────────────────────────────────
async function reactToMemory(memoryId: string) {
  const savedName = useCookie("viewer_guest_name")
  if (!savedName.value) {
    // First reaction — prompt for name
    pendingReactionMemoryId.value = memoryId
    showNamePrompt.value = true
    return
  }
  await submitReaction(memoryId, savedName.value)
}

async function confirmReaction() {
  if (!guestName.value.trim() || !pendingReactionMemoryId.value) return
  const savedName = useCookie("viewer_guest_name", { maxAge: 365 * 24 * 60 * 60 })
  savedName.value = guestName.value.trim()
  showNamePrompt.value = false
  await submitReaction(pendingReactionMemoryId.value, guestName.value.trim())
  pendingReactionMemoryId.value = null
}

async function submitReaction(memoryId: string, name: string) {
  try {
    await $fetch("/api/reactions/guest", {
      method: "POST",
      body: { viewerToken: token.value, memoryId, emoji: "❤️", guestName: name },
    })
    reactedIds.value = new Set([...reactedIds.value, memoryId])
    justReactedId.value = memoryId
    setTimeout(() => { justReactedId.value = null }, 2000)
  } catch {
    // Best-effort — silently swallow errors on the viewer page
  }
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
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
