<template>
  <div class="min-h-screen bg-background">
    <!-- Nav -->
    <header
      class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div
        class="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-3.5"
      >
        <p
          class="select-none text-[9px] font-bold uppercase tracking-[0.18em] text-accent"
        >
          Our Story
        </p>

        <div class="flex items-center gap-2">
          <!-- Theme toggle -->
          <button
            :aria-label="
              isDark ? 'Switch to light mode' : 'Switch to dark mode'
            "
            class="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            @click="toggleTheme"
          >
            <svg
              v-if="isDark"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="5" />
              <path
                d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              />
            </svg>
            <svg
              v-else
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>

          <!-- Logged-out: single CTA -->
          <NuxtLink
            v-if="!authUser"
            to="/login"
            class="flex h-8 items-center rounded-full bg-primary px-4 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {{ t('landing.nav.startFree') }}
          </NuxtLink>

          <!-- Logged-in: avatar + dropdown -->
          <div v-else ref="menuRef" class="relative">
            <button
              class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary ring-2 ring-border transition-all hover:ring-ring"
              @click="menuOpen = !menuOpen"
            >
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                class="h-full w-full object-cover"
              />
              <span v-else class="text-[10px] font-bold text-foreground">{{
                userInitial
              }}</span>
            </button>

            <Transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="opacity-0 scale-95 -translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="menuOpen"
                class="absolute right-0 top-full mt-2 w-48 origin-top-right overflow-hidden rounded-[14px] border border-border bg-card shadow-xl"
              >
                <div class="border-b border-border px-4 py-3">
                  <p class="truncate text-xs text-muted-foreground">
                    {{ authUser.email }}
                  </p>
                </div>
                <div class="py-1">
                  <NuxtLink
                    to="/timeline"
                    class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary"
                    @click="menuOpen = false"
                  >
                    <svg
                      class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    {{ t('landing.nav.goToTimeline') }}
                  </NuxtLink>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </header>

    <main>
      <!-- Hero -->
      <section
        class="hero-section relative mx-auto max-w-[1280px] overflow-hidden px-5 pb-16 pt-20 text-center"
      >
        <!-- Warm amber bloom -->
        <div class="hero-glow" aria-hidden="true" />
        <!-- Grain texture over the bloom -->
        <div class="hero-grain" aria-hidden="true" />

        <h1
          data-reveal
          class="relative z-10 mx-auto mb-5 max-w-xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl"
        >
          {{ t('landing.hero.headline') }}
        </h1>
        <p
          data-reveal="d1"
          class="relative z-10 mb-8 text-base text-muted-foreground"
        >
          {{ t('landing.hero.subhead') }}
        </p>
        <NuxtLink
          data-reveal="d2"
          to="/login"
          class="hero-cta relative z-10 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {{ t('landing.hero.cta') }}
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </section>

      <!-- Product screenshot -->
      <section class="mx-auto max-w-[1280px] px-5 pb-20">
        <div data-reveal class="screenshot-wrapper">
          <img
            :src="'/timeline-screenshot.png'"
            alt="Our Story timeline — polaroid wall view"
            class="float-screenshot w-full rounded-2xl border border-border"
          />
        </div>
      </section>

      <!-- Feature highlights -->
      <section class="mx-auto max-w-[1280px] px-5 pb-20">
        <p
          data-reveal
          class="mb-8 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-accent"
        >
          {{ t('landing.features.title') }}
        </p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="(feat, i) in featureHighlights"
            :key="feat.title"
            :data-reveal="`d${i + 1}`"
            class="feature-card flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
          >
            <div
              class="feature-icon flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10"
              v-html="feat.icon"
            />
            <div>
              <p class="mb-1.5 text-sm font-semibold text-foreground">
                {{ feat.title }}
              </p>
              <p class="text-xs leading-relaxed text-muted-foreground">
                {{ feat.desc }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- How it works -->
      <section class="border-y border-border bg-card py-20">
        <div class="mx-auto max-w-[1280px] px-5">
          <p
            data-reveal
            class="mb-12 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-accent"
          >
            {{ t('landing.howItWorks.title') }}
          </p>
          <div class="grid gap-10 sm:grid-cols-3 sm:gap-8">
            <div
              v-for="(step, i) in howItWorksSteps"
              :key="i"
              :data-reveal="`d${i + 1}`"
              class="step-item text-center sm:text-left"
            >
              <!-- Large faded background numeral -->
              <span class="step-bg-numeral" aria-hidden="true"
                >0{{ i + 1 }}</span
              >
              <h2
                class="relative z-10 mb-2 font-display text-lg font-bold text-foreground"
              >
                {{ step.title }}
              </h2>
              <p
                class="relative z-10 text-sm leading-relaxed text-muted-foreground"
              >
                {{ step.desc }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Who uses it -->
      <section class="py-20">
        <div class="mx-auto max-w-[1280px] px-5">
          <p
            data-reveal
            class="mb-8 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-accent"
          >
            {{ t('landing.whoUsesIt.title') }}
          </p>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div
              v-for="(type, i) in circleTypes"
              :key="type.key"
              :data-reveal="`d${(i % 4) + 1}`"
              class="circle-card flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
            >
              <div>
                <p class="text-sm font-semibold text-foreground">
                  {{ t(`circleType.${type.key}.label`) }}
                </p>
                <p class="text-[11px] text-muted-foreground">
                  {{ t(`landing.circleTypes.${type.key}.tagline`) }}
                </p>
              </div>
              <ul class="flex flex-col gap-1.5">
                <li
                  v-for="bullet in type.bullets"
                  :key="bullet"
                  class="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <svg
                    class="mt-0.5 h-3 w-3 flex-shrink-0 text-accent"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {{ bullet }}
                </li>
              </ul>
              <NuxtLink
                :to="`/login?type=${type.key}`"
                class="mt-auto flex items-center gap-1 text-[11px] font-semibold text-foreground transition-colors hover:text-accent"
              >
                {{
                  t('landing.whoUsesIt.startCircle', {
                    type: t(`circleType.${type.key}.label`).toLowerCase(),
                  })
                }}
                <svg
                  class="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- Privacy proof -->
      <section class="border-y border-border bg-card py-20">
        <div data-reveal class="mx-auto max-w-[1280px] px-5 text-center">
          <h2 class="mb-7 font-display text-3xl font-bold text-foreground">
            {{ t('landing.privacy.title') }}
          </h2>
          <div class="mb-5 flex flex-wrap items-center justify-center gap-3">
            <span v-for="item in privacyItems" :key="item" class="privacy-pill">
              <svg
                class="h-3.5 w-3.5 flex-shrink-0 text-accent"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ item }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t('landing.privacy.sub') }}
          </p>
        </div>
      </section>

      <!-- Vision -->
      <section class="py-24">
        <div
          data-reveal
          class="vision-card mx-auto flex max-w-[640px] flex-col items-center gap-6 px-8 py-12 text-center"
        >
          <div class="vision-quote-mark" aria-hidden="true">"</div>
          <blockquote
            class="font-display text-2xl font-bold leading-snug text-foreground sm:text-[1.85rem]"
          >
            {{ t('landing.vision.quote') }}
          </blockquote>
          <p class="max-w-xs text-sm leading-loose text-muted-foreground">
            {{ t('landing.vision.body') }}
          </p>
        </div>
      </section>

      <!-- Pricing summary -->
      <section class="mx-auto max-w-[1280px] px-5 py-12 text-center">
        <p class="text-sm text-muted-foreground">
          {{ t('landing.pricingSummary.text') }}
          <NuxtLink
            to="/pricing"
            class="ml-1 font-medium text-foreground underline underline-offset-2 transition-colors hover:text-accent"
          >
            {{ t('landing.pricingSummary.link') }} →
          </NuxtLink>
        </p>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-border">
      <div
        class="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-6"
      >
        <p
          class="select-none text-[9px] font-bold uppercase tracking-[0.18em] text-accent"
        >
          Our Story
        </p>
        <div class="flex items-center gap-5">
          <NuxtLink
            to="/privacy"
            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >{{ t('landing.footer.privacy') }}</NuxtLink
          >
          <NuxtLink
            to="/terms"
            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >{{ t('landing.footer.terms') }}</NuxtLink
          >
          <NuxtLink
            to="/pricing"
            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >{{ t('landing.footer.pricing') }}</NuxtLink
          >
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

useSeoMeta({
  title: 'Our Story — Private photo sharing for family and friends',
  description:
    'A private space where your circle builds a shared story. No ads. No AI training. Invite-only. Free to start.',
  ogTitle: 'Our Story — Private photo sharing for family and friends',
  ogDescription:
    'A private space where your circle builds a shared story. No ads. No AI training. Invite-only.',
  ogType: 'website',
})

const { t } = useI18n()

// Theme
const colorMode = useColorMode()
const prefersDark = usePreferredDark()
const isDark = computed(() =>
  colorMode.preference === 'system'
    ? prefersDark.value
    : colorMode.preference === 'dark',
)
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

// Auth state — reactive, updates on client after hydration
const authUser = useSupabaseUser()
const { data: profile } = useAsyncData(
  'landing-profile',
  () =>
    authUser.value
      ? $fetch<{ firstName: string | null; avatarUrl: string | null }>(
          '/api/profile',
        )
      : Promise.resolve(null),
  { watch: [authUser] },
)
const avatarUrl = computed(() => profile.value?.avatarUrl ?? null)
const userInitial = computed(
  () =>
    profile.value?.firstName?.[0]?.toUpperCase() ??
    authUser.value?.email?.[0]?.toUpperCase() ??
    '?',
)

// Avatar dropdown
const menuOpen = ref(false)
const menuRef = ref<HTMLElement>()
onClickOutside(menuRef, () => {
  menuOpen.value = false
})

// Scroll reveal — fires once per element as it enters the viewport
onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible')
          observer.unobserve(e.target)
        }
      })
    },
    { threshold: 0.08, rootMargin: '0px 0px -48px 0px' },
  )
  document
    .querySelectorAll('[data-reveal]')
    .forEach((el) => observer.observe(el))
})

const howItWorksSteps = computed(() => [
  {
    title: t('landing.howItWorks.step1Title'),
    desc: t('landing.howItWorks.step1Desc'),
  },
  {
    title: t('landing.howItWorks.step2Title'),
    desc: t('landing.howItWorks.step2Desc'),
  },
  {
    title: t('landing.howItWorks.step3Title'),
    desc: t('landing.howItWorks.step3Desc'),
  },
])

const privacyItems = [
  'No ads',
  'No algorithm',
  'No AI training on your memories',
]

const featureHighlights = [
  {
    title: 'Milestones',
    desc: 'Celebrate every first. Preset templates for baby steps, anniversaries, trips, and more — or build your own.',
    icon: '<svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  },
  {
    title: 'Quick notes',
    desc: 'No photo needed. Capture any moment in words. "First word today: dada."',
    icon: '<svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  },
  {
    title: 'On This Day',
    desc: 'A memory from this day last year, delivered every morning. Your story keeps growing.',
    icon: '<svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  },
  {
    title: 'View-only for family',
    desc: "Grandma doesn't need an account. Send a link — she can see every memory and tap a heart.",
    icon: '<svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  },
]

const circleTypes = [
  {
    key: 'parents',
    bullets: [
      'Baby age stamp on every memory',
      'Developmental milestone categories',
      'Weekly digest for grandparents',
      'Growth chart and vaccination tracker',
    ],
  },
  {
    key: 'couple',
    bullets: [
      'Relationship start date & anniversary reminder',
      '"How we met" pinned memory',
      'Couple stats — memories, countries, months documented',
      'Private timeline just for the two of you',
    ],
  },
  {
    key: 'family',
    bullets: [
      'Person tags — grandma, dad, the kids',
      '"This day last year" in weekly digest',
      'Event grouping — Christmas, Summer holiday',
      'Multi-generational, invite-only access',
    ],
  },
  {
    key: 'friends',
    bullets: [
      'Trip and event containers',
      '"Who was there" tags',
      'Reaction leaderboard — most-loved photo',
      'Memory count milestones to celebrate together',
    ],
  },
  {
    key: 'caregiving',
    bullets: [
      'Daily mood and energy log',
      'Health event types — Doctor visit, Good day, Treatment',
      'Care team notes visible only to admins',
      'Export as PDF for medical appointments',
    ],
  },
  {
    key: 'travel',
    bullets: [
      "Location tag — auto-filled from your photo's GPS data",
      'Trip itinerary with destinations and dates',
      'Map view showing where memories were taken',
      'Trip stats — countries, days, km covered',
    ],
  },
  {
    key: 'solo',
    bullets: [
      'Reflection prompts on every upload',
      'Mood and emotion tags',
      'Year-in-review generated automatically',
      'Streak tracker — document every day',
    ],
  },
]
</script>

<style scoped>
/* ── Scroll reveal ─────────────────────────────────────────── */
[data-reveal] {
  opacity: 0;
  transform: translateY(22px);
  transition:
    opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
}
[data-reveal].is-visible {
  opacity: 1;
  transform: none;
}
[data-reveal='d1'] {
  transition-delay: 0.08s;
}
[data-reveal='d2'] {
  transition-delay: 0.18s;
}
[data-reveal='d3'] {
  transition-delay: 0.28s;
}
[data-reveal='d4'] {
  transition-delay: 0.38s;
}

/* ── Hero ──────────────────────────────────────────────────── */
.hero-glow {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 110%;
  max-width: 960px;
  height: 480px;
  background: radial-gradient(
    ellipse at 50% 0%,
    hsl(33 40% 65% / 0.18) 0%,
    hsl(33 40% 65% / 0.06) 40%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

/* Subtle analog grain over the hero bloom */
.hero-grain {
  position: absolute;
  inset: 0;
  opacity: 0.03;
  pointer-events: none;
  z-index: 1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}

/* CTA pulse — fires once after 1.1s */
@keyframes cta-pulse {
  0% {
    box-shadow: 0 0 0 0 hsl(33 40% 65% / 0.55);
  }
  65% {
    box-shadow: 0 0 0 14px hsl(33 40% 65% / 0);
  }
  100% {
    box-shadow: 0 0 0 0 hsl(33 40% 65% / 0);
  }
}
.hero-cta {
  animation: cta-pulse 2s ease-out 1.1s 1;
}

/* ── Screenshot ────────────────────────────────────────────── */
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-9px);
  }
}
.screenshot-wrapper {
  filter: drop-shadow(0 28px 60px hsl(20 16% 14% / 0.14))
    drop-shadow(0 6px 16px hsl(20 16% 14% / 0.08));
}
.float-screenshot {
  animation: float 7s ease-in-out infinite;
  transition: filter 0.3s ease;
}
.float-screenshot:hover {
  animation-play-state: paused;
  filter: brightness(1.02);
}

/* ── Feature cards ─────────────────────────────────────────── */
.feature-card {
  transition:
    transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.28s ease,
    border-color 0.28s ease;
}
.feature-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 52px hsl(33 40% 65% / 0.2);
  border-color: hsl(33 40% 65% / 0.4);
}
.feature-icon {
  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.feature-card:hover .feature-icon {
  transform: scale(1.2) rotate(-4deg);
}

/* ── How it works — faded background numerals ──────────────── */
.step-item {
  overflow: hidden;
}
.step-bg-numeral {
  display: block;
  font-family: 'Caveat', cursive;
  font-size: 6.5rem;
  line-height: 0.85;
  font-weight: 600;
  color: hsl(33 40% 65% / 0.12);
  user-select: none;
  pointer-events: none;
  letter-spacing: -0.04em;
  margin-bottom: 0.5rem;
  margin-left: -0.1em;
}

/* ── Circle type cards ─────────────────────────────────────── */
.circle-card {
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}
.circle-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 36px hsl(20 16% 14% / 0.1);
  border-color: hsl(33 40% 65% / 0.45);
}

/* ── Privacy pills ─────────────────────────────────────────── */
.privacy-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  border: 1px solid hsl(33 40% 65% / 0.3);
  background: hsl(33 40% 65% / 0.07);
  font-size: 0.8125rem;
  color: hsl(var(--foreground));
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}
.privacy-pill:hover {
  background: hsl(33 40% 65% / 0.14);
  border-color: hsl(33 40% 65% / 0.5);
}

/* ── Vision section ────────────────────────────────────────── */
.vision-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 24px;
  position: relative;
  overflow: hidden;
}
.vision-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 0%,
    hsl(33 40% 65% / 0.1) 0%,
    transparent 65%
  );
  pointer-events: none;
}
.vision-quote-mark {
  font-family: 'Caveat', cursive;
  font-size: 7rem;
  line-height: 0.6;
  color: hsl(33 40% 65% / 0.28);
  user-select: none;
  pointer-events: none;
  margin-bottom: -0.5rem;
  letter-spacing: -0.02em;
  position: relative;
  z-index: 1;
}
</style>
