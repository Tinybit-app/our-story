<template>
  <div class="min-h-screen bg-background">

    <!-- Nav -->
    <header class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
      <div class="max-w-[1280px] mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase select-none">Our Story</p>
        </NuxtLink>
        <NuxtLink
          to="/login"
          class="h-8 px-4 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity flex items-center"
        >
          {{ t('pricing.nav.startFree') }}
        </NuxtLink>
      </div>
    </header>

    <main class="max-w-[1280px] mx-auto px-5 py-16">

      <!-- Headline -->
      <div class="text-center mb-12">
        <h1 class="font-display text-4xl font-bold text-foreground mb-3">{{ t('pricing.headline') }}</h1>
        <p class="text-base text-muted-foreground">{{ t('pricing.subhead') }}</p>
      </div>

      <!-- Tier cards -->
      <div class="grid sm:grid-cols-3 gap-4 mb-6">

        <!-- Free -->
        <div class="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
          <div>
            <p class="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">{{ t('pricing.tiers.free.name') }}</p>
            <div class="flex items-baseline gap-1 mb-0.5">
              <span class="font-display text-3xl font-bold text-foreground">{{ t('pricing.tiers.free.price') }}</span>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.free.priceSub') }}</p>
          </div>
          <div class="flex flex-col gap-2">
            <p class="text-xs font-semibold text-foreground">{{ t('pricing.tiers.free.storage') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.free.circles') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.free.members') }}</p>
          </div>
          <ul class="flex flex-col gap-2 flex-1">
            <li v-for="feat in freeFeatures" :key="feat" class="flex items-center gap-2 text-xs text-muted-foreground">
              <svg class="w-3.5 h-3.5 text-accent flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {{ feat }}
            </li>
          </ul>
          <NuxtLink
            to="/login"
            class="w-full py-3 rounded-[12px] text-sm font-semibold border border-border text-foreground hover:bg-secondary transition-colors text-center"
          >
            {{ t('pricing.tiers.free.cta') }} →
          </NuxtLink>
        </div>

        <!-- Plus -->
        <div class="bg-card border-2 border-foreground rounded-2xl p-6 flex flex-col gap-5 relative">
          <div>
            <p class="text-xs font-bold tracking-widest uppercase text-foreground mb-2">{{ t('pricing.tiers.plus.name') }}</p>
            <div class="flex items-baseline gap-1 mb-0.5">
              <span class="font-display text-3xl font-bold text-foreground">{{ t('pricing.tiers.plus.price') }}</span>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.plus.priceSub') }}</p>
          </div>
          <div class="flex flex-col gap-2">
            <p class="text-xs font-semibold text-foreground">{{ t('pricing.tiers.plus.storage') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.plus.circles') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.plus.members') }}</p>
          </div>
          <ul class="flex flex-col gap-2 flex-1">
            <li v-for="feat in plusFeatures" :key="feat" class="flex items-center gap-2 text-xs text-muted-foreground">
              <svg class="w-3.5 h-3.5 text-accent flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {{ feat }}
            </li>
          </ul>
          <NuxtLink
            to="/login"
            class="w-full py-3 rounded-[12px] text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-center"
          >
            {{ t('pricing.tiers.plus.cta') }} →
          </NuxtLink>
        </div>

        <!-- Pro (coming soon) -->
        <div class="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5 opacity-60">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <p class="text-xs font-bold tracking-widest uppercase text-muted-foreground">{{ t('pricing.tiers.pro.name') }}</p>
              <span class="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">{{ t('pricing.tiers.pro.badge') }}</span>
            </div>
            <div class="flex items-baseline gap-1 mb-0.5">
              <span class="font-display text-3xl font-bold text-foreground">{{ t('pricing.tiers.pro.price') }}</span>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.pro.priceSub') }}</p>
          </div>
          <div class="flex flex-col gap-2">
            <p class="text-xs font-semibold text-foreground">{{ t('pricing.tiers.pro.storage') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.pro.circles') }}</p>
            <p class="text-xs text-muted-foreground">{{ t('pricing.tiers.pro.members') }}</p>
          </div>
          <ul class="flex flex-col gap-2 flex-1">
            <li v-for="feat in proFeatures" :key="feat" class="flex items-center gap-2 text-xs text-muted-foreground">
              <svg class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {{ feat }}
            </li>
          </ul>
          <button
            type="button"
            disabled
            class="w-full py-3 rounded-[12px] text-sm font-semibold border border-border text-muted-foreground cursor-default text-center"
          >
            {{ t('pricing.tiers.pro.cta') }}
          </button>
        </div>

      </div>

      <!-- Albums footnote -->
      <p class="text-xs text-muted-foreground text-center mb-16">{{ t('pricing.features.albumsFootnote') }}</p>

      <!-- FAQ -->
      <div class="max-w-xl mx-auto">
        <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase mb-8 text-center">{{ t('pricing.faq.title') }}</p>
        <div class="flex flex-col gap-6">
          <div v-for="item in faqItems" :key="item.q">
            <p class="text-sm font-semibold text-foreground mb-1.5">{{ item.q }}</p>
            <p class="text-sm text-muted-foreground leading-relaxed">{{ item.a }}</p>
          </div>
        </div>
      </div>

    </main>

    <!-- Footer -->
    <footer class="border-t border-border mt-16">
      <div class="max-w-[1280px] mx-auto px-5 py-6 flex items-center justify-between gap-4 flex-wrap">
        <p class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase select-none">Our Story</p>
        <div class="flex items-center gap-5">
          <a href="#" class="text-xs text-muted-foreground hover:text-foreground transition-colors">{{ t('pricing.footer.privacy') }}</a>
          <a href="#" class="text-xs text-muted-foreground hover:text-foreground transition-colors">{{ t('pricing.footer.terms') }}</a>
          <NuxtLink to="/" class="text-xs text-muted-foreground hover:text-foreground transition-colors">{{ t('pricing.footer.home') }}</NuxtLink>
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
  ogDescription: 'Simple, honest pricing. Free plan includes unlimited memories, milestones, and reactions.',
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
