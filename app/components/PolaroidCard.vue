<template>
  <article
    ref="articleEl"
    class="relative bg-card flex-shrink-0 cursor-pointer select-none
           shadow-[0_4px_16px_rgba(44,36,32,.14),0_1px_3px_rgba(44,36,32,.08)]
           transition-[transform,box-shadow] duration-[250ms] ease-[cubic-bezier(.34,1.56,.64,1)]
           p-[10px] pb-[18px]"
    :class="wide ? 'w-[290px]' : 'w-[210px]'"
    :style="{ transform: isHovered ? 'rotate(0deg) scale(1.05) translateY(-4px)' : `rotate(${tilt}deg)`, zIndex: isHovered ? 10 : 1, boxShadow: isHovered ? '0 14px 44px rgba(44,36,32,.22)' : undefined }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="onCardClick"
  >

    <!-- Pin -->
    <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#d64040] dark:bg-[#e05454] shadow-[0_2px_6px_rgba(214,64,64,.4)] opacity-85 z-10" />

    <!-- Photo area -->
    <div class="relative overflow-hidden bg-border" :class="wide ? 'aspect-[4/3]' : 'aspect-square'">

      <!-- Photo -->
      <img
        v-if="firstMedia && firstMedia.media_type !== 'video' && (firstMedia.thumbnailUrl || firstMedia.url)"
        :src="firstMedia.thumbnailUrl ?? firstMedia.url ?? ''"
        :alt="memory.note ?? 'Memory'"
        class="w-full h-full object-cover block"
        loading="lazy"
      />

      <!-- Video -->
      <template v-else-if="firstMedia?.media_type === 'video' && firstMedia.url">
        <video
          :src="firstMedia.url"
          class="w-full h-full object-cover block"
          muted
          playsinline
          preload="metadata"
        />
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
            <svg class="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </template>

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

      <!-- Milestone stamp — top-left corner of photo -->
      <div
        v-if="memory.milestone_label"
        class="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-sm"
        style="
          background: hsl(var(--accent) / 0.88);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: 1px solid hsl(var(--accent) / 0.6);
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        "
      >
        <span class="text-[9px] font-bold text-white/90 tracking-[.18em] uppercase leading-none drop-shadow-sm truncate max-w-[120px]">✦ {{ memory.milestone_label }}</span>
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
              class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white/80 text-[14px]
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
                       grid gap-0.5"
                style="grid-template-columns: repeat(6, 1fr);"
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
      <!-- Caption text: always 2 lines tall so cards stay the same height -->
      <p
        class="text-[13px] leading-[1.35] line-clamp-2 break-words"
        :class="captionText ? 'text-foreground' : 'text-muted-foreground/40 italic'"
        style="min-height: 2.7em"
      >{{ captionText || 'No note' }}</p>

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

const emit = defineEmits<{
  open: [{ memory: Memory; tilt: number; rect: DOMRect }]
  reactionUpdate: [{ memoryId: string; reactions: any[] }]
}>()

const articleEl = ref<HTMLElement>()

const TILTS = [-1.8, 1.2, -0.6, 2.1, -1.6, 0.4]
const tilt = computed(() => TILTS[props.index % TILTS.length])

function onCardClick() {
  if (!articleEl.value) return
  emit('open', { memory: props.memory, tilt: tilt.value ?? 0, rect: articleEl.value.getBoundingClientRect() })
}
const PRESET_EMOJIS = ['❤️', '😂', '😍', '🥹', '👏', '🔥', '😮', '🥰', '😭', '✨', '🎉', '👍']

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
const supabaseClient = useSupabaseClient()
const currentUserId = ref<string | null>(null)

// Resolve user ID from session (reactive ref can be null on initial render)
supabaseClient.auth.getSession().then(({ data }) => {
  currentUserId.value = data.session?.user?.id ?? null
})

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
    if (r.user_id === currentUserId.value) g.mine = true
  }
  return groups
})

async function toggleReaction(emoji: string) {
  const userId = currentUserId.value ?? (await supabaseClient.auth.getSession()).data.session?.user?.id
  if (!userId) return
  currentUserId.value = userId

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
    emit('reactionUpdate', { memoryId: props.memory.id, reactions })
  } catch (err) {
    console.error('[reactions] failed to toggle reaction:', err)
    // Roll back optimistic update on error
    localReactions.value = [...props.memory.memoryreaction]
  }
}

// Close picker when hovering away from the card
watch(isHovered, (hovered) => {
  if (!hovered) pickerOpen.value = false
})
</script>
