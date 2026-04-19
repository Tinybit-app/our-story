<template>
  <div class="min-h-screen bg-background">

    <!-- Nav -->
    <header class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
        <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase select-none">Our Story</p>

        <div class="flex items-center gap-2">
          <!-- Theme toggle -->
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            @click="toggleTheme"
          >
            <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>

          <!-- Logged-out: single CTA -->
          <NuxtLink
            v-if="!authUser"
            to="/login"
            class="h-8 px-4 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity flex items-center"
          >
            {{ t('landing.nav.startFree') }}
          </NuxtLink>

          <!-- Logged-in: avatar + dropdown -->
          <div v-else ref="menuRef" class="relative">
          <button
            class="w-8 h-8 rounded-full overflow-hidden ring-2 ring-border hover:ring-ring transition-all flex items-center justify-center bg-secondary"
            @click="menuOpen = !menuOpen"
          >
            <img v-if="avatarUrl" :src="avatarUrl" class="w-full h-full object-cover" />
            <span v-else class="text-[10px] font-bold text-foreground">{{ userInitial }}</span>
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
              class="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-[14px] shadow-xl overflow-hidden origin-top-right"
            >
              <div class="px-4 py-3 border-b border-border">
                <p class="text-xs text-muted-foreground truncate">{{ authUser.email }}</p>
              </div>
              <div class="py-1">
                <NuxtLink
                  to="/timeline"
                  class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                  @click="menuOpen = false"
                >
                  <svg class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  {{ t('landing.nav.goToTimeline') }}
                </NuxtLink>
              </div>
            </div>
          </Transition>
          </div><!-- end avatar dropdown -->
        </div><!-- end right-side controls -->

      </div>
    </header>

    <main>

      <!-- Hero -->
      <section class="max-w-[1280px] mx-auto px-5 pt-20 pb-16 text-center">
        <h1 class="font-display text-4xl sm:text-5xl font-bold leading-tight text-foreground max-w-xl mx-auto mb-5">
          {{ t('landing.hero.headline') }}
        </h1>
        <p class="text-base text-muted-foreground mb-8">
          {{ t('landing.hero.subhead') }}
        </p>
        <NuxtLink
          to="/login"
          class="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {{ t('landing.hero.cta') }}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </NuxtLink>
      </section>

      <!-- Product screenshot -->
      <section class="max-w-[1280px] mx-auto px-5 pb-20">
        <img
          :src="'/timeline-screenshot.png'"
          alt="Our Story timeline — polaroid wall view"
          class="w-full rounded-2xl border border-border shadow-lg"
        />
      </section>

      <!-- How it works -->
      <section class="bg-card border-y border-border py-20">
        <div class="max-w-[1280px] mx-auto px-5">
          <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase mb-8 text-center">
            {{ t('landing.howItWorks.title') }}
          </p>
          <div class="grid sm:grid-cols-3 gap-8">
            <div v-for="(step, i) in howItWorksSteps" :key="i" class="text-center sm:text-left">
              <div class="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground mb-4 mx-auto sm:mx-0">
                {{ i + 1 }}
              </div>
              <h3 class="font-display text-lg font-bold text-foreground mb-2">{{ step.title }}</h3>
              <p class="text-sm text-muted-foreground leading-relaxed">{{ step.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Who uses it -->
      <section class="py-20">
        <div class="max-w-[1280px] mx-auto px-5">
          <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase mb-8 text-center">
            {{ t('landing.whoUsesIt.title') }}
          </p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div
              v-for="type in circleTypes"
              :key="type.key"
              class="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3"
            >
              <div>
                <p class="text-sm font-semibold text-foreground">{{ t(`circleType.${type.key}.label`) }}</p>
                <p class="text-[11px] text-muted-foreground">{{ t(`landing.circleTypes.${type.key}.tagline`) }}</p>
              </div>
              <ul class="flex flex-col gap-1.5">
                <li
                  v-for="bullet in type.bullets"
                  :key="bullet"
                  class="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <svg class="w-3 h-3 text-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {{ bullet }}
                </li>
              </ul>
              <NuxtLink
                :to="`/login?type=${type.key}`"
                class="mt-auto text-[11px] font-semibold text-foreground hover:text-accent transition-colors flex items-center gap-1"
              >
                {{ t('landing.whoUsesIt.startCircle', { type: t(`circleType.${type.key}.label`).toLowerCase() }) }}
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- Privacy proof -->
      <section class="bg-card border-y border-border py-20">
        <div class="max-w-[1280px] mx-auto px-5 text-center">
          <h2 class="font-display text-3xl font-bold text-foreground mb-5">
            {{ t('landing.privacy.title') }}
          </h2>
          <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mb-4">
            <span
              v-for="item in privacyItems"
              :key="item"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <svg class="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {{ item }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground">{{ t('landing.privacy.sub') }}</p>
        </div>
      </section>

      <!-- Pricing summary -->
      <section class="max-w-[1280px] mx-auto px-5 py-16 text-center">
        <p class="text-sm text-muted-foreground">
          {{ t('landing.pricingSummary.text') }}
          <NuxtLink to="/pricing" class="text-foreground font-medium underline underline-offset-2 hover:text-accent transition-colors ml-1">
            {{ t('landing.pricingSummary.link') }} →
          </NuxtLink>
        </p>
      </section>

    </main>

    <!-- Footer -->
    <footer class="border-t border-border">
      <div class="max-w-[1280px] mx-auto px-5 py-6 flex items-center justify-between gap-4 flex-wrap">
        <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase select-none">Our Story</p>
        <div class="flex items-center gap-5">
          <NuxtLink to="/privacy" class="text-xs text-muted-foreground hover:text-foreground transition-colors">{{ t('landing.footer.privacy') }}</NuxtLink>
          <NuxtLink to="/terms" class="text-xs text-muted-foreground hover:text-foreground transition-colors">{{ t('landing.footer.terms') }}</NuxtLink>
          <NuxtLink to="/pricing" class="text-xs text-muted-foreground hover:text-foreground transition-colors">{{ t('landing.footer.pricing') }}</NuxtLink>
        </div>
      </div>
    </footer>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

useSeoMeta({
  title: 'Our Story — Private photo sharing for family and friends',
  description: 'A private space where your circle builds a shared story. No ads. No AI training. Invite-only. Free to start.',
  ogTitle: 'Our Story — Private photo sharing for family and friends',
  ogDescription: 'A private space where your circle builds a shared story. No ads. No AI training. Invite-only.',
  ogType: 'website',
})

const { t } = useI18n()

// Theme
const colorMode = useColorMode()
const prefersDark = usePreferredDark()
const isDark = computed(() =>
  colorMode.preference === 'system' ? prefersDark.value : colorMode.preference === 'dark'
)
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

// Auth state — reactive, updates on client after hydration
const authUser = useSupabaseUser()
const { data: profile } = useAsyncData(
  'landing-profile',
  () => authUser.value ? $fetch<{ firstName: string | null; avatarUrl: string | null }>('/api/profile') : Promise.resolve(null),
  { watch: [authUser] }
)
const avatarUrl = computed(() => profile.value?.avatarUrl ?? null)
const userInitial = computed(() =>
  profile.value?.firstName?.[0]?.toUpperCase() ?? authUser.value?.email?.[0]?.toUpperCase() ?? '?'
)

// Avatar dropdown
const menuOpen = ref(false)
const menuRef = ref<HTMLElement>()
onClickOutside(menuRef, () => { menuOpen.value = false })

const howItWorksSteps = computed(() => [
  { title: t('landing.howItWorks.step1Title'), desc: t('landing.howItWorks.step1Desc') },
  { title: t('landing.howItWorks.step2Title'), desc: t('landing.howItWorks.step2Desc') },
  { title: t('landing.howItWorks.step3Title'), desc: t('landing.howItWorks.step3Desc') },
])

const privacyItems = ['No ads', 'No algorithm', 'No AI training on your memories']

const circleTypes = [
  { key: 'parents',    bullets: ['Baby age stamp on every memory', 'Developmental milestone categories', 'Weekly digest for grandparents', 'Growth chart and vaccination tracker'] },
  { key: 'couple',     bullets: ['Relationship start date & anniversary reminder', '"How we met" pinned memory', 'Couple stats — memories, countries, months documented', 'Private timeline just for the two of you'] },
  { key: 'family',     bullets: ['Person tags — grandma, dad, the kids', '"This day last year" in weekly digest', 'Event grouping — Christmas, Summer holiday', 'Multi-generational, invite-only access'] },
  { key: 'friends',    bullets: ['Trip and event containers', '"Who was there" tags', 'Reaction leaderboard — most-loved photo', 'Memory count milestones to celebrate together'] },
  { key: 'caregiving', bullets: ['Daily mood and energy log', 'Health event types — Doctor visit, Good day, Treatment', 'Care team notes visible only to admins', 'Export as PDF for medical appointments'] },
  { key: 'travel',     bullets: ['Location tag — auto-filled from your photo\'s GPS data', 'Trip itinerary with destinations and dates', 'Map view showing where memories were taken', 'Trip stats — countries, days, km covered'] },
  { key: 'solo',       bullets: ['Reflection prompts on every upload', 'Mood and emotion tags', 'Year-in-review generated automatically', 'Streak tracker — document every day'] },
]
</script>
