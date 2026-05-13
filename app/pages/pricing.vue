<template>
  <div class="min-h-screen bg-background">
    <!-- Nav -->
    <header class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
      <div class="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-3.5">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <p class="select-none text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
            Our Story
          </p>
        </NuxtLink>
        <NuxtLink
          to="/login"
          class="flex h-8 items-center rounded-full bg-primary px-4 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {{ t('pricing.nav.startFree') }}
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-[1280px] px-5 py-16">
      <!-- Headline -->
      <div class="mb-12 text-center">
        <h1 class="mb-3 font-display text-4xl font-bold text-foreground">
          {{ t('pricing.headline') }}
        </h1>
        <p class="text-base text-muted-foreground">{{ t('pricing.subhead') }}</p>
      </div>

      <!-- Tier cards -->
      <div class="mb-6 grid gap-4 sm:grid-cols-3">
        <!-- Free -->
        <div class="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <p class="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {{ t('pricing.tiers.free.name') }}
            </p>
            <div class="mb-0.5 flex items-baseline gap-1">
              <span class="font-display text-3xl font-bold text-foreground">{{
                t('pricing.tiers.free.price')
              }}</span>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.free.priceSub') }}</p>
          </div>
          <div class="flex flex-col gap-2">
            <p class="text-xs font-semibold text-foreground">
              {{ t('pricing.tiers.free.storage') }}
            </p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.free.circles') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.free.members') }}</p>
          </div>
          <ul class="flex flex-1 flex-col gap-2">
            <li
              v-for="feat in freeFeatures"
              :key="feat"
              class="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <svg
                class="h-3.5 w-3.5 flex-shrink-0 text-accent"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ feat }}
            </li>
          </ul>
          <NuxtLink
            to="/login"
            class="w-full rounded-[12px] border border-border py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            {{ t('pricing.tiers.free.cta') }} →
          </NuxtLink>
        </div>

        <!-- Plus -->
        <div
          class="relative flex flex-col gap-5 rounded-2xl border-2 border-foreground bg-card p-6"
        >
          <div>
            <p class="mb-2 text-xs font-bold uppercase tracking-widest text-foreground">
              {{ t('pricing.tiers.plus.name') }}
            </p>
            <div class="mb-0.5 flex items-baseline gap-1">
              <span class="font-display text-3xl font-bold text-foreground">{{
                t('pricing.tiers.plus.price')
              }}</span>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.plus.priceSub') }}</p>
          </div>
          <div class="flex flex-col gap-2">
            <p class="text-xs font-semibold text-foreground">
              {{ t('pricing.tiers.plus.storage') }}
            </p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.plus.circles') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.plus.members') }}</p>
          </div>
          <ul class="flex flex-1 flex-col gap-2">
            <li
              v-for="feat in plusFeatures"
              :key="feat"
              class="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <svg
                class="h-3.5 w-3.5 flex-shrink-0 text-accent"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ feat }}
            </li>
          </ul>
          <NuxtLink
            to="/login"
            class="w-full rounded-[12px] bg-primary py-3 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {{ t('pricing.tiers.plus.cta') }} →
          </NuxtLink>
        </div>

        <!-- Pro (coming soon) -->
        <div class="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 opacity-60">
          <div>
            <div class="mb-2 flex items-center gap-2">
              <p class="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {{ t('pricing.tiers.pro.name') }}
              </p>
              <span
                class="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                >{{ t('pricing.tiers.pro.badge') }}</span
              >
            </div>
            <div class="mb-0.5 flex items-baseline gap-1">
              <span class="font-display text-3xl font-bold text-foreground">{{
                t('pricing.tiers.pro.price')
              }}</span>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.pro.priceSub') }}</p>
          </div>
          <div class="flex flex-col gap-2">
            <p class="text-xs font-semibold text-foreground">
              {{ t('pricing.tiers.pro.storage') }}
            </p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.pro.circles') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.pro.members') }}</p>
          </div>
          <ul class="flex flex-1 flex-col gap-2">
            <li
              v-for="feat in proFeatures"
              :key="feat"
              class="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <svg
                class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ feat }}
            </li>
          </ul>
          <button
            type="button"
            disabled
            class="w-full cursor-default rounded-[12px] border border-border py-3 text-center text-sm font-semibold text-muted-foreground"
          >
            {{ t('pricing.tiers.pro.cta') }}
          </button>
        </div>
      </div>

      <!-- Albums footnote -->
      <p class="mb-16 text-center text-xs text-muted-foreground">
        {{ t('pricing.features.albumsFootnote') }}
      </p>

      <!-- FAQ -->
      <div class="mx-auto max-w-xl">
        <p class="mb-8 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
          {{ t('pricing.faq.title') }}
        </p>
        <div class="flex flex-col gap-6">
          <div v-for="item in faqItems" :key="item.q">
            <p class="mb-1.5 text-sm font-semibold text-foreground">{{ item.q }}</p>
            <p class="text-sm leading-relaxed text-muted-foreground">{{ item.a }}</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="mt-16 border-t border-border">
      <div
        class="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-6"
      >
        <p class="select-none text-[9px] font-bold uppercase tracking-[0.18em] text-accent">
          Our Story
        </p>
        <div class="flex items-center gap-5">
          <NuxtLink
            to="/privacy"
            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >{{ t('pricing.footer.privacy') }}</NuxtLink
          >
          <NuxtLink
            to="/terms"
            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >{{ t('pricing.footer.terms') }}</NuxtLink
          >
          <NuxtLink
            to="/"
            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >{{ t('pricing.footer.home') }}</NuxtLink
          >
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

useSeoMeta({
  title: 'Pricing — Our Story',
  description: 'Simple, honest pricing. Start free. Upgrade when your story grows.',
  ogTitle: 'Pricing — Our Story',
  ogDescription:
    'Simple, honest pricing. Free plan includes unlimited memories, milestones, and reactions.',
  ogType: 'website',
})

const { t } = useI18n()

const freeFeatures = computed(() => [
  t('pricing.features.basicTimeline'),
  t('pricing.features.albums'),
  t('pricing.features.milestones'),
  t('pricing.features.comments'),
  t('pricing.features.reactions'),
])

const plusFeatures = computed(() => [
  t('pricing.features.search'),
  t('pricing.features.onThisDay'),
  t('pricing.features.notificationPrefs'),
  t('pricing.features.offlineUpload'),
])

const proFeatures = computed(() => [
  t('pricing.features.timeCapsule'),
  t('pricing.features.yearInReview'),
  t('pricing.features.voiceReactions'),
  t('pricing.features.collaborativeMemory'),
])

const faqItems = computed(() => [
  { q: t('pricing.faq.q1'), a: t('pricing.faq.a1') },
  { q: t('pricing.faq.q2'), a: t('pricing.faq.a2') },
  { q: t('pricing.faq.q3'), a: t('pricing.faq.a3') },
  { q: t('pricing.faq.q4'), a: t('pricing.faq.a4') },
  { q: t('pricing.faq.q5'), a: t('pricing.faq.a5') },
  { q: t('pricing.faq.q6'), a: t('pricing.faq.a6') },
])
</script>
