<template>
  <article class="bg-card rounded-[16px] overflow-hidden border border-border">

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
        <span class="text-muted-foreground text-sm">No image</span>
      </div>

      <!-- Video play indicator -->
      <div
        v-if="firstMedia?.media_type === 'video'"
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div class="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
          <svg class="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      <!-- Multiple media badge -->
      <div v-if="mediaCount > 1" class="absolute top-2.5 right-2.5">
        <div class="bg-black/40 rounded-md px-1.5 py-0.5 flex items-center gap-1">
          <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z" />
          </svg>
          <span class="text-white text-[10px] font-medium">{{ mediaCount }}</span>
        </div>
      </div>

      <!-- Milestone badge -->
      <div v-if="memory.milestone_label" class="absolute bottom-3 left-3">
        <span class="bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-2.5 py-1 rounded-full border border-border/50">
          {{ memory.milestone_label }}
        </span>
      </div>
    </div>

    <!-- Info strip -->
    <div class="px-4 py-3">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2 min-w-0">
          <!-- Avatar -->
          <div class="w-5 h-5 rounded-full bg-secondary overflow-hidden flex-shrink-0">
            <img
              v-if="memory.user?.avatar_url"
              :src="memory.user.avatar_url"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="text-[9px] font-bold text-muted-foreground">{{ initials }}</span>
            </div>
          </div>
          <span class="text-xs font-medium text-foreground truncate">{{ ownerName }}</span>
        </div>
        <span class="text-xs text-muted-foreground flex-shrink-0 ml-3">{{ formattedDate }}</span>
      </div>

      <p v-if="memory.note" class="text-sm text-foreground/80 leading-snug line-clamp-2">
        {{ memory.note }}
      </p>
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
  return new Date(props.memory.memory_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})
</script>
