<template>
  <article
    class="relative bg-card flex-shrink-0 cursor-pointer select-none
           shadow-[0_4px_16px_rgba(44,36,32,.14),0_1px_3px_rgba(44,36,32,.08)]
           transition-[transform,box-shadow] duration-[250ms] ease-[cubic-bezier(.34,1.56,.64,1)]
           p-[10px] pb-[18px]"
    :style="articleStyle"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >

    <!-- Pin -->
    <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#d64040] dark:bg-[#e05454] shadow-[0_2px_6px_rgba(214,64,64,.4)] opacity-85 z-10" />

    <!-- Photo area -->
    <div class="overflow-hidden bg-border" :style="{ aspectRatio: photoAspectRatio }">

      <!-- Photo / video -->
      <img
        v-if="firstMedia?.thumbnailUrl || firstMedia?.url"
        :src="firstMedia.thumbnailUrl ?? firstMedia.url ?? ''"
        :alt="memory.note ?? 'Memory'"
        class="w-full h-full object-cover block"
        loading="lazy"
      />

      <!-- Note-only: lined paper look -->
      <div
        v-else-if="memory.note"
        class="w-full h-full flex items-center justify-center p-3"
        style="background-color: color-mix(in srgb, var(--accent) 12%, var(--card)); background-image: repeating-linear-gradient(transparent, transparent 23px, color-mix(in srgb, var(--border) 80%, transparent) 24px);"
      >
        <p class="font-['Caveat'] text-[15px] text-foreground leading-6 line-clamp-4 text-center">
          {{ memory.note }}
        </p>
      </div>

      <!-- Placeholder -->
      <div v-else class="w-full h-full flex items-center justify-center bg-secondary">
        <svg class="w-8 h-8 text-muted-foreground/30" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>

    </div>

    <!-- Caption -->
    <div class="pt-3 px-1 text-center">
      <!-- Milestone badge -->
      <p v-if="memory.milestone_label" class="font-['Caveat'] text-[14px] font-semibold text-accent leading-tight mb-0.5">
        ✦ {{ memory.milestone_label }}
      </p>

      <!-- Caption text (note or placeholder text) -->
      <p
        class="font-['Caveat'] text-[15px] text-foreground leading-[1.35] overflow-hidden"
        style="-webkit-line-clamp:2; display:-webkit-box; -webkit-box-orient:vertical;"
      >
        {{ captionText }}
      </p>

      <!-- Date · Author -->
      <p class="text-[10px] text-muted-foreground mt-[5px]">{{ formattedDateAndAuthor }}</p>
    </div>

  </article>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'

const props = defineProps<{
  memory: Memory
  index: number
  size?: 'sm' | 'md' | 'lg' | 'tall'
}>()

const WIDTHS  = { sm: '170px', md: '210px', lg: '290px', tall: '190px' } as const
const ASPECTS = { sm: '1/1',   md: '1/1',   lg: '4/3',   tall: '3/4'  } as const

const photoAspectRatio = computed(() => ASPECTS[props.size ?? 'md'])

const articleStyle = computed(() => ({
  width: WIDTHS[props.size ?? 'md'],
  transform: isHovered.value
    ? 'rotate(0deg) scale(1.05) translateY(-4px)'
    : `rotate(${TILTS[props.index % TILTS.length]}deg)`,
  zIndex: isHovered.value ? 10 : 1,
  boxShadow: isHovered.value ? '0 14px 44px rgba(44,36,32,.22)' : undefined,
}))

const TILTS = [-1.8, 1.2, -0.6, 2.1, -1.6, 0.4]

const isHovered = ref(false)
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)

const captionText = computed(() => {
  if (memory.note) return memory.note
  return ''
})

// Use memory shorthand — suppress TS lint about unused prop destructure
const memory = computed(() => props.memory)

const formattedDateAndAuthor = computed(() => {
  const d = new Date(props.memory.memory_date)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const u = props.memory.user
  const firstName = u?.first_name ?? ''
  return firstName ? `${dateStr} · ${firstName}` : dateStr
})
</script>
