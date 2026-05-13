<template>
  <article
    class="cursor-pointer overflow-hidden rounded-2xl bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
  >
    <!-- Media -->
    <div class="relative aspect-[4/5] overflow-hidden bg-secondary">
      <img
        v-if="firstMedia?.thumbnailUrl || firstMedia?.url"
        :src="firstMedia.thumbnailUrl ?? firstMedia.url"
        :alt="memory.note ?? t('card.photoAlt')"
        class="h-full w-full object-cover"
        loading="lazy"
      />
      <div v-else class="flex h-full w-full items-center justify-center">
        <svg
          class="h-10 w-10 text-muted-foreground/30"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>

      <!-- Video play button -->
      <div
        v-if="firstMedia?.media_type === 'video'"
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/20 backdrop-blur-sm"
        >
          <svg
            class="ml-1 h-6 w-6 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      <!-- Multiple media badge -->
      <div v-if="mediaCount > 1" class="absolute right-3 top-3">
        <div
          class="flex items-center gap-1.5 rounded-lg bg-black/40 px-2 py-1 backdrop-blur-sm"
        >
          <svg
            class="h-3 w-3 text-white"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <rect x="7" y="3" width="14" height="14" rx="2" />
            <path d="M3 7v11a3 3 0 0 0 3 3h11" />
          </svg>
          <span class="text-[10px] font-semibold tracking-wide text-white">{{
            mediaCount
          }}</span>
        </div>
      </div>

      <!-- Milestone badge -->
      <div v-if="memory.milestone_label" class="absolute bottom-3 left-3">
        <span
          class="rounded-full border border-border/50 bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm"
        >
          ✦ {{ memory.milestone_label }}
        </span>
      </div>
    </div>

    <!-- Info strip -->
    <div class="px-4 pb-3.5 pt-3">
      <!-- Date -->
      <p
        class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {{ formattedDate }}
      </p>

      <!-- Note -->
      <p
        v-if="memory.note"
        class="mb-3 line-clamp-2 text-sm leading-snug text-foreground/85"
      >
        {{ memory.note }}
      </p>

      <!-- Author -->
      <div class="flex items-center gap-2">
        <div
          class="h-5 w-5 flex-shrink-0 overflow-hidden rounded-full bg-secondary ring-1 ring-border"
        >
          <img
            v-if="memory.user?.avatar_url"
            :src="memory.user.avatar_url"
            class="h-full w-full object-cover"
          />
          <div v-else class="flex h-full w-full items-center justify-center">
            <span class="text-[8px] font-bold text-muted-foreground">{{
              initials
            }}</span>
          </div>
        </div>
        <span class="truncate text-[11px] font-medium text-muted-foreground">{{
          ownerName
        }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
const props = defineProps<{ memory: any }>()
const { t, locale } = useI18n()

const firstMedia = computed(() => props.memory.memorymedia?.[0] ?? null)
const mediaCount = computed(() => props.memory.memorymedia?.length ?? 0)

const ownerName = computed(() => {
  const u = props.memory.user
  if (!u) return t('common.unknown')
  return (
    [u.first_name, u.last_name].filter(Boolean).join(' ') || t('common.unknown')
  )
})

const initials = computed(() => {
  const u = props.memory.user
  if (!u) return '?'
  return (
    [u.first_name?.[0], u.last_name?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || '?'
  )
})

const formattedDate = computed(() => {
  const d = new Date(props.memory.memory_date)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return t('card.today')
  if (diffDays === 1) return t('card.yesterday')
  if (diffDays < 7) return t('card.daysAgo', { n: diffDays })
  return d.toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})
</script>
