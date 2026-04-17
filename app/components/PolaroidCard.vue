<template>
  <article
    class="relative bg-card flex-shrink-0 cursor-pointer select-none
           shadow-[0_4px_16px_rgba(44,36,32,.14),0_1px_3px_rgba(44,36,32,.08)]
           transition-[transform,box-shadow] duration-[250ms] ease-[cubic-bezier(.34,1.56,.64,1)]
           p-[10px] pb-[18px]"
    :class="wide ? 'w-[290px]' : 'w-[210px]'"
    :style="{ transform: isHovered ? 'rotate(0deg) scale(1.05) translateY(-4px)' : `rotate(${tilt}deg)`, zIndex: isHovered ? 10 : 1, boxShadow: isHovered ? '0 14px 44px rgba(44,36,32,.22)' : undefined }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >

    <!-- Pin -->
    <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#d64040] dark:bg-[#e05454] shadow-[0_2px_6px_rgba(214,64,64,.4)] opacity-85 z-10" />

    <!-- Photo area -->
    <div class="relative overflow-hidden bg-border" :class="wide ? 'aspect-[4/3]' : 'aspect-square'">

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
        <p class="text-[13px] text-foreground leading-6 line-clamp-4 text-center">
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

      <!-- Reaction overlay — appears on hover at bottom of photo -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="isHovered"
          class="absolute bottom-0 inset-x-0 px-2 py-1.5 flex items-center gap-1 flex-wrap"
          style="background: linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%);"
          @click.stop
        >
          <!-- Existing reactions -->
          <button
            v-for="(group, emoji) in reactionGroups"
            :key="emoji"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-all duration-150"
            :class="group.mine
              ? 'bg-white/30 text-white font-semibold'
              : 'bg-white/15 text-white/90 hover:bg-white/25'"
            @click.stop="toggleReaction(emoji as string)"
          >
            <span>{{ emoji }}</span>
            <span class="text-[10px]">{{ group.count }}</span>
          </button>

          <!-- Picker trigger -->
          <div class="relative ml-auto">
            <button
              class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/15 text-white/80 text-[11px]
                     hover:bg-white/30 transition-colors"
              @click.stop="pickerOpen = !pickerOpen"
            >+</button>

            <Transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="opacity-0 scale-90 translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-90 translate-y-1"
            >
              <div
                v-if="pickerOpen"
                class="absolute bottom-full mb-1.5 right-0 z-20
                       bg-card border border-border rounded-xl shadow-xl px-2 py-1.5
                       flex gap-1"
                @click.stop
              >
                <button
                  v-for="e in PRESET_EMOJIS"
                  :key="e"
                  class="text-base w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                  :class="reactionGroups[e]?.mine ? 'bg-accent/15' : ''"
                  @click.stop="toggleReaction(e); pickerOpen = false"
                >{{ e }}</button>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>

    </div>

    <!-- Caption -->
    <div class="pt-3 px-1 text-center">
      <!-- Milestone badge -->
      <p v-if="memory.milestone_label" class="text-[11px] font-semibold text-accent leading-tight mb-0.5 tracking-wide uppercase">
        ✦ {{ memory.milestone_label }}
      </p>

      <!-- Caption text -->
      <p
        class="text-[13px] text-foreground leading-[1.35] overflow-hidden"
        style="-webkit-line-clamp:2; display:-webkit-box; -webkit-box-orient:vertical;"
      >
        {{ captionText }}
      </p>

      <!-- Date · Author -->
      <p class="text-[11px] text-muted-foreground mt-[5px]">{{ formattedDateAndAuthor }}</p>
    </div>

  </article>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'

const props = defineProps<{
  memory: Memory
  index: number
  wide?: boolean
}>()

const TILTS = [-1.8, 1.2, -0.6, 2.1, -1.6, 0.4]
const tilt = computed(() => TILTS[props.index % TILTS.length])
const PRESET_EMOJIS = ['❤️', '😂', '😍', '🥹', '👏']

const isHovered = ref(false)
const pickerOpen = ref(false)
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)
const memory = computed(() => props.memory)

const captionText = computed(() => memory.value.note ?? '')

const formattedDateAndAuthor = computed(() => {
  const d = new Date(props.memory.memory_date)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const u = props.memory.user
  const firstName = u?.first_name ?? ''
  return firstName ? `${dateStr} · ${firstName}` : dateStr
})

// ── Reactions ──────────────────────────────────────────────
const currentUser = useSupabaseUser()

// Local reactive copy so optimistic updates feel instant
const localReactions = ref([...props.memory.memoryreaction])

watch(() => props.memory.memoryreaction, (r) => { localReactions.value = [...r] })

// Group by emoji: { '❤️': { count: 3, mine: true }, ... }
const reactionGroups = computed(() => {
  const groups: Record<string, { count: number; mine: boolean }> = {}
  for (const r of localReactions.value) {
    if (!r.emoji) continue
    const key = r.emoji
    if (!groups[key]) groups[key] = { count: 0, mine: false }
    const g = groups[key]!
    g.count++
    if (r.user_id === currentUser.value?.id) g.mine = true
  }
  return groups
})

async function toggleReaction(emoji: string) {
  const userId = currentUser.value?.id
  if (!userId) return

  const existing = localReactions.value.find(r => r.emoji === emoji && r.user_id === userId)

  // Optimistic update
  if (existing) {
    localReactions.value = localReactions.value.filter(r => r !== existing)
  } else {
    localReactions.value = [...localReactions.value, { id: 'optimistic', emoji, user_id: userId }]
  }

  try {
    const { reactions } = await $fetch<{ reactions: any[] }>(
      `/api/memories/${props.memory.id}/reactions`,
      { method: 'POST', body: { emoji } }
    )
    localReactions.value = reactions
  } catch {
    // Roll back optimistic update on error
    localReactions.value = [...props.memory.memoryreaction]
  }
}

// Close picker when hovering away from the card
watch(isHovered, (hovered) => {
  if (!hovered) pickerOpen.value = false
})
</script>
