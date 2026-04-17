<template>
  <article
    class="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
  >

    <!-- Media -->
    <div class="aspect-[4/5] bg-secondary relative overflow-hidden">
      <img
        v-if="firstMedia?.thumbnailUrl || firstMedia?.url"
        :src="firstMedia.thumbnailUrl ?? firstMedia.url"
        :alt="memory.note ?? 'Memory'"
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <div v-else class="w-full h-full flex items-center justify-center">
        <svg class="w-10 h-10 text-muted-foreground/30" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>

      <!-- Video play button -->
      <div
        v-if="firstMedia?.media_type === 'video'"
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div class="w-14 h-14 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
          <svg class="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      <!-- Multiple media badge -->
      <div v-if="mediaCount > 1" class="absolute top-3 right-3">
        <div class="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5">
          <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="7" y="3" width="14" height="14" rx="2"/>
            <path d="M3 7v11a3 3 0 0 0 3 3h11"/>
          </svg>
          <span class="text-white text-[10px] font-semibold tracking-wide">{{ mediaCount }}</span>
        </div>
      </div>

      <!-- Milestone badge -->
      <div v-if="memory.milestone_label" class="absolute bottom-3 left-3">
        <span class="bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-1 rounded-full border border-border/50 shadow-sm">
          ✦ {{ memory.milestone_label }}
        </span>
      </div>
    </div>

    <!-- Info strip -->
    <div class="px-4 pt-3 pb-3.5">

      <!-- Date -->
      <p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase mb-2">{{ formattedDate }}</p>

      <!-- Note -->
      <p v-if="memory.note" class="text-sm text-foreground/85 leading-snug line-clamp-2 mb-3">
        {{ memory.note }}
      </p>

      <!-- Author -->
      <div class="flex items-center gap-2">
        <div class="w-5 h-5 rounded-full bg-secondary overflow-hidden flex-shrink-0 ring-1 ring-border">
          <img
            v-if="memory.user?.avatar_url"
            :src="memory.user.avatar_url"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-[8px] font-bold text-muted-foreground">{{ initials }}</span>
          </div>
        </div>
        <span class="text-[11px] font-medium text-muted-foreground truncate">{{ ownerName }}</span>
      </div>

    </div>
  </article>
</template>

<script setup lang="ts">
const props = defineProps<{ memory: any }>()

const firstMedia = computed(() => props.memory.memorymedia?.[0] ?? null)
const mediaCount = computed(() => props.memory.memorymedia?.length ?? 0)

const ownerName = computed(() => {
  const u = props.memory.user
  if (!u) return 'Unknown'
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Unknown'
})

const initials = computed(() => {
  const u = props.memory.user
  if (!u) return '?'
  return [u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
})

const formattedDate = computed(() => {
  const d = new Date(props.memory.memory_date)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})
</script>
