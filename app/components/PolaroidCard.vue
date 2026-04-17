<template>
  <article
    class="relative bg-white dark:bg-zinc-800 rounded-sm cursor-pointer select-none
           shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)]
           hover:-translate-y-1 transition-all duration-200 w-44 flex-shrink-0 p-2.5 pb-8"
    :style="{ transform: `rotate(${tilt}deg)`, zIndex: isHovered ? 10 : 1 }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Photo area -->
    <div class="aspect-[4/3] bg-zinc-100 dark:bg-zinc-700 overflow-hidden rounded-[2px]">

      <!-- Photo / video -->
      <img
        v-if="firstMedia?.thumbnailUrl || firstMedia?.url"
        :src="firstMedia.thumbnailUrl ?? firstMedia.url ?? ''"
        :alt="memory.note ?? 'Memory'"
        class="w-full h-full object-cover"
        loading="lazy"
      />

      <!-- Note-only: lined paper look -->
      <div
        v-else-if="memory.note"
        class="w-full h-full flex items-center justify-center p-3 bg-amber-50 dark:bg-zinc-700"
        style="background-image: repeating-linear-gradient(transparent, transparent 23px, #e5e0d8 24px);"
      >
        <p class="text-sm text-zinc-700 dark:text-zinc-200 leading-6 line-clamp-4 font-['Caveat'] text-center">
          {{ memory.note }}
        </p>
      </div>

      <!-- Placeholder -->
      <div v-else class="w-full h-full flex items-center justify-center">
        <svg class="w-8 h-8 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>

    </div>

    <!-- Caption strip -->
    <div class="mt-2 min-h-[40px]">
      <!-- Milestone badge -->
      <p v-if="memory.milestone_label" class="font-['Caveat'] text-[13px] font-semibold text-amber-700 dark:text-amber-400 leading-tight mb-0.5">
        ✦ {{ memory.milestone_label }}
      </p>

      <!-- Note caption (for photo cards — truncated) -->
      <p v-if="memory.note && firstMedia" class="font-['Caveat'] text-[13px] text-zinc-600 dark:text-zinc-300 leading-tight line-clamp-2">
        {{ memory.note }}
      </p>
    </div>

    <!-- Author + date pin -->
    <div class="absolute bottom-2 left-2.5 right-2.5 flex items-center gap-1.5">
      <div class="w-4 h-4 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-600 flex-shrink-0">
        <img v-if="memory.user?.avatar_url" :src="memory.user.avatar_url" class="w-full h-full object-cover" />
        <span v-else class="w-full h-full flex items-center justify-center text-[7px] font-bold text-zinc-500">{{ initials }}</span>
      </div>
      <span class="text-[10px] text-zinc-400 dark:text-zinc-500 font-['Caveat'] truncate">{{ formattedDate }}</span>
    </div>

  </article>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Memory } from '~/composables/useTimeline'

const props = defineProps<{
  memory: Memory
  index: number
}>()

// Deterministic tilts — 12-element cycle, no randomness, SSR-safe
const TILTS = [-2.5, 1.2, -0.8, 2.1, -1.6, 0.4, -2.0, 1.8, -0.5, 2.4, -1.2, 0.9]
const tilt = computed(() => TILTS[props.index % TILTS.length])

const isHovered = ref(false)
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)

const initials = computed(() => {
  const u = props.memory.user
  if (!u) return '?'
  return [u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
})

const formattedDate = computed(() => {
  const d = new Date(props.memory.memory_date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})
</script>
