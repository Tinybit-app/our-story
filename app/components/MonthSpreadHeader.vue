<template>
  <header class="month-spread-header">
    <!-- Row 1: page strip -->
    <div class="page-strip">
      <NuxtLink :to="backLink" class="back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {{ t('common.back') }}
      </NuxtLink>
      <div class="brand-stack">
        <div class="brand-kicker">{{ t('nav.ourStory') }}</div>
        <div class="circle-name">{{ circleName ?? '…' }}</div>
      </div>
      <div class="spacer"></div>
      <button
        v-if="showShare"
        type="button"
        class="share-btn"
        :title="justCopied ? t('timeline.shareMonthCopied') : t('timeline.shareMonth')"
        :aria-label="justCopied ? t('timeline.shareMonthCopied') : t('timeline.shareMonth')"
        @click="onShareClick"
      >
        <svg v-if="!justCopied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>

    <!-- Row 2: hero -->
    <div class="hero">
      <div class="kicker-row">
        <span>{{ circleName ?? '' }}</span>
        <span class="yr">{{ year }}</span>
      </div>
      <h1 class="month-title">
        <em>{{ monthName }}</em>
      </h1>
      <div class="meta-row">
        <span>{{ t('timeline.memories', memoryCount) }}</span>
      </div>
    </div>

    <!-- Row 3: sticky pill nav -->
    <div class="pill-bar">
      <div class="pill-bar-inner">
        <NuxtLink
          v-if="prev"
          :to="monthPath(prev.year, prev.month)"
          class="pill"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {{ shortMonthLabel(prev.year, prev.month) }}
        </NuxtLink>
        <span v-else class="pill disabled">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>

        <div class="spacer"></div>
        <div class="current">{{ shortMonthLabel(year, month) }} · {{ year }}</div>
        <div class="spacer"></div>

        <NuxtLink
          v-if="next"
          :to="monthPath(next.year, next.month)"
          class="pill"
        >
          {{ shortMonthLabel(next.year, next.month) }}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </NuxtLink>
        <span v-else class="pill disabled">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const { t, locale } = useI18n()

const props = defineProps<{
  year: number
  month: number
  circleId: string | null
  circleName: string | null
  memoryCount: number
  prev: { year: number; month: number } | null
  next: { year: number; month: number } | null
  showShare?: boolean
}>()

const backLink = computed(() =>
  props.circleId ? `/timeline?circle=${props.circleId}` : '/timeline',
)

const monthName = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(
    new Date(props.year, props.month - 1, 1),
  ),
)

const shortMonthLabel = (y: number, m: number): string =>
  new Intl.DateTimeFormat(locale.value, { month: 'short' })
    .format(new Date(y, m - 1, 1))
    .toUpperCase()

const monthPath = (y: number, m: number): string => {
  const base = `/timeline/${y}/${m}`
  return props.circleId ? `${base}?circle=${props.circleId}` : base
}

const justCopied = ref(false)
async function onShareClick() {
  const path = monthPath(props.year, props.month)
  const url = new URL(path, window.location.origin).toString()
  try {
    await navigator.clipboard.writeText(url)
    justCopied.value = true
    setTimeout(() => (justCopied.value = false), 1600)
  } catch (err) {
    console.error('[MonthSpreadHeader] clipboard write failed:', err)
  }
}
</script>

<style scoped>
.month-spread-header {
  background: hsl(var(--background));
}

/* ─── Page strip ────────────────────────────────────────────── */
.page-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid hsl(var(--border));
  max-width: 1280px;
  margin: 0 auto;
}
.page-strip .back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  transition: color 200ms ease;
}
.page-strip .back:hover {
  color: hsl(var(--foreground));
}
.page-strip .brand-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.page-strip .brand-kicker {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 800;
  font-size: 9px;
  letter-spacing: 0.28em;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
}
.page-strip .circle-name {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 700;
  font-size: 13px;
  color: hsl(var(--foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.page-strip .spacer {
  flex: 1;
}
.page-strip .share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid hsl(var(--border));
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: color 200ms ease, border-color 200ms ease;
}
.page-strip .share-btn:hover {
  color: hsl(var(--foreground));
  border-color: hsl(var(--foreground) / 0.3);
}

/* ─── Hero ──────────────────────────────────────────────────── */
.hero {
  max-width: 1280px;
  margin: 0 auto;
  padding: 36px 20px 24px;
}
@media (min-width: 768px) {
  .hero {
    padding: 56px 32px 36px;
  }
}
.hero .kicker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 9px;
  letter-spacing: 0.22em;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  margin-bottom: 14px;
}
.hero .kicker-row .yr {
  color: hsl(var(--foreground));
}
.hero .month-title {
  font-family: 'Instrument Serif', serif;
  font-weight: 400;
  font-style: italic;
  font-size: clamp(56px, 18vw, 96px);
  line-height: 0.95;
  letter-spacing: -0.025em;
  color: hsl(var(--foreground));
}
.hero .meta-row {
  margin-top: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 10px;
  letter-spacing: 0.16em;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
}

/* ─── Sticky pill bar ───────────────────────────────────────── */
.pill-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.92);
  backdrop-filter: blur(16px);
}
.pill-bar-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  max-width: 1280px;
  margin: 0 auto;
}
.pill-bar-inner .spacer {
  flex: 1;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid hsl(var(--border));
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  transition: color 200ms ease, border-color 200ms ease;
}
.pill:hover {
  color: hsl(var(--foreground));
  border-color: hsl(var(--foreground) / 0.3);
}
.pill.disabled {
  opacity: 0.35;
  pointer-events: none;
}
.pill-bar-inner .current {
  padding: 6px 12px;
  border-radius: 999px;
  background: hsl(var(--secondary));
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: hsl(var(--foreground));
}
</style>
