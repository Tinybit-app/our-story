<template>
  <!-- Wrapper width: mobile fills the column up to ~320px, desktop sizes by
       the article's natural 210px width. Matches PolaroidCard's pattern so
       both kinds of cards center cleanly on phone. -->
  <div
    class="relative w-full max-w-[320px] flex-shrink-0 sm:inline-block sm:w-auto sm:max-w-none"
    :style="{ zIndex: isHovered ? 10 : 1 }"
  >
    <!-- Stack silhouettes when media_count > 1 (stacked postcards) -->
    <div
      v-if="(memory.media_count ?? 1) > 1"
      class="pointer-events-none absolute inset-0 -z-10 -translate-y-1 translate-x-1 rotate-1 border border-border/40 bg-card shadow-md"
      aria-hidden="true"
    />
    <div
      v-if="(memory.media_count ?? 1) > 2"
      class="pointer-events-none absolute inset-0 -z-20 -translate-y-2 translate-x-2 rotate-2 border border-border/30 bg-card shadow-md"
      aria-hidden="true"
    />

    <article
      ref="articleEl"
      class="quick-note-card relative w-full cursor-pointer select-none bg-card sm:w-[210px]"
      :style="{
        transform: isHovered
          ? 'rotate(0deg) scale(1.04) translateY(-3px)'
          : `rotate(${tilt}deg)`,
        boxShadow: isHovered
          ? '0 14px 44px rgba(44,36,32,.22)'
          : '0 4px 16px rgba(44,36,32,.14), 0 1px 3px rgba(44,36,32,.08)',
      }"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      @click="onCardClick"
    >
      <!-- Pin -->
      <div
        class="absolute -top-2 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-[#d64040] opacity-85 shadow-[0_2px_6px_rgba(214,64,64,.4)] dark:bg-[#e05454]"
      />

      <div class="px-4 pb-4 pt-3">
        <!-- Note type indicator — pencil icon + italic label, clearly separate from milestone stamp -->
        <div class="mb-2.5 flex items-center gap-2">
          <span
            class="flex-shrink-0 text-[10px] italic text-muted-foreground/70"
            >Quick note</span
          >
          <div class="h-px flex-1 bg-border" />
        </div>

        <!-- Milestone stamp (if present) -->
        <div
          v-if="memory.milestone_label"
          class="mb-2 inline-flex items-center gap-1 rounded-sm px-2 py-[3px]"
          style="
            background: hsl(var(--accent) / 0.88);
            border: 1px solid hsl(var(--accent) / 0.55);
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
          "
        >
          <span
            class="text-[9px] font-bold uppercase leading-none tracking-[.18em] text-white/90"
          >
            ✦ {{ memory.milestone_label }}
          </span>
        </div>

        <!-- Note text: prefer cover_text_content (multi-item) over note (legacy) -->
        <p
          class="mb-3 line-clamp-5 text-[12.5px] leading-[1.65] text-foreground"
          :class="memory.milestone_label ? '' : 'mt-0.5'"
        >
          {{ memory.cover_text_content ?? memory.note }}
        </p>

        <!-- Count badge — shown when multi-item memory -->
        <div v-if="(memory.media_count ?? 1) > 1" class="mb-1 flex justify-end">
          <span
            class="bg-foreground/8 pointer-events-none inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
          >
            ⊕{{ memory.media_count }}
          </span>
        </div>

        <!-- Postcard divider -->
        <div class="mb-2.5 h-px bg-border" />

        <!-- Footer row 1: date · author + picker trigger -->
        <div class="flex items-center justify-between gap-2" @click.stop>
          <div class="flex min-w-0 items-center gap-1">
            <span class="whitespace-nowrap text-[10px] text-muted-foreground">{{
              formattedDate
            }}</span>
            <template v-if="authorName">
              <span class="text-[10px] text-muted-foreground">·</span>
              <span
                class="truncate text-[10px]"
                :class="
                  isFormerMember
                    ? 'text-muted-foreground/40'
                    : 'text-muted-foreground'
                "
                >{{ authorName }}</span
              >
            </template>
          </div>

          <!-- Picker trigger. Matches the PolaroidCard treatment: expanded
               with a "React" label when there are no reactions yet, collapsed
               to the smiley-plus icon once chips already explain the affordance. -->
          <div class="relative flex-shrink-0">
            <button
              class="group inline-flex h-6 items-center justify-center gap-1 rounded-full border border-border bg-secondary text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
              :class="hasAnyReaction ? 'w-6' : 'px-2'"
              :title="t('card.addReaction')"
              :aria-label="t('card.addReaction')"
              @click.stop="pickerOpen = !pickerOpen"
            >
              <svg
                class="h-3 w-3 flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="13.5" r="7.5" />
                <circle
                  cx="8"
                  cy="12.5"
                  r="0.6"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="13"
                  cy="12.5"
                  r="0.6"
                  fill="currentColor"
                  stroke="none"
                />
                <path d="M7.8 16s.9 1.4 2.7 1.4 2.7-1.4 2.7-1.4" />
                <path d="M18.5 3.5h4M20.5 1.5v4" />
              </svg>
              <span
                v-if="!hasAnyReaction"
                class="whitespace-nowrap text-[10px] font-medium"
              >
                {{ t('card.react') }}
              </span>
            </button>

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
                class="absolute bottom-full right-0 z-20 mb-1.5 grid gap-0.5 rounded-xl border border-border bg-card px-2 py-1.5 shadow-xl"
                style="grid-template-columns: repeat(6, 1fr)"
                @click.stop
              >
                <button
                  v-for="e in PRESET_EMOJIS"
                  :key="e"
                  class="flex h-7 w-7 items-center justify-center rounded-lg text-base transition-colors hover:bg-secondary"
                  :class="reactionGroups[e]?.mine ? 'bg-accent/15' : ''"
                  @click.stop="(toggleReaction(e), (pickerOpen = false))"
                >
                  {{ e }}
                </button>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Footer row 2: reaction chips — own row, full width, wraps cleanly -->
        <div
          v-if="Object.keys(reactionGroups).length"
          class="mt-1.5 flex flex-wrap gap-1"
          @click.stop
        >
          <button
            v-for="(group, emoji) in reactionGroups"
            :key="emoji"
            class="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-[3px] text-[10px] transition-all duration-150"
            :class="
              group.mine
                ? 'border-accent/40 bg-accent/15 font-semibold text-foreground'
                : 'border-border bg-secondary text-muted-foreground hover:border-foreground/30'
            "
            @click.stop="toggleReaction(emoji as string)"
          >
            <span>{{ emoji }}</span>
            <span class="text-[9px]">{{ group.count }}</span>
          </button>
        </div>

        <!-- Child age pills -->
        <div v-if="childAges.length" class="mt-2 flex flex-wrap gap-[3px]">
          <span
            v-for="child in childAges"
            :key="child.name"
            class="inline-flex items-center gap-[3px] rounded-full px-[6px] py-[2px] text-[9px] font-medium leading-none"
            style="
              background: hsl(var(--accent) / 0.14);
              color: hsl(var(--accent));
            "
          >
            <span style="font-size: 8px; flex-shrink: 0; line-height: 1"
              >👶</span
            >
            <span>{{ child.name }}</span>
            <template v-if="child.age">
              <span style="opacity: 0.5">·</span>
              <span style="opacity: 0.85">{{ child.age }}</span>
            </template>
          </span>
        </div>

        <!-- Tagged member avatars -->
        <div
          v-if="taggedMembers.length"
          class="mt-[5px] flex items-center gap-[5px]"
        >
          <span
            class="text-[9px] leading-none"
            style="
              color: hsl(var(--muted-foreground) / 0.55);
              letter-spacing: 0.04em;
            "
            >with</span
          >
          <div class="flex items-center">
            <div
              v-for="(mm, i) in taggedMembersVisible"
              :key="mm.user_id"
              class="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-card bg-secondary text-[7px] font-bold text-foreground"
              :style="{
                marginLeft: i === 0 ? '0' : '-5px',
                zIndex: taggedMembersVisible.length - i,
              }"
              :title="mm.user?.first_name ?? ''"
            >
              <img
                v-if="mm.user?.avatar_url"
                :src="mm.user.avatar_url"
                class="h-full w-full object-cover"
              />
              <span v-else>{{
                (
                  (mm.user?.first_name?.[0] ?? '') +
                  (mm.user?.last_name?.[0] ?? '')
                ).toUpperCase() || '?'
              }}</span>
            </div>
            <span
              v-if="taggedMembersOverflow > 0"
              class="ml-1 text-[9px] text-muted-foreground"
              >+{{ taggedMembersOverflow }}</span
            >
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'
import { computeBabyAge } from '~/composables/useBabyAge'

const { t, locale } = useI18n()

const props = defineProps<{
  memory: Memory
  index: number
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
  emit('open', {
    memory: props.memory,
    tilt: tilt.value ?? 0,
    rect: articleEl.value.getBoundingClientRect(),
  })
}

const PRESET_EMOJIS = [
  '❤️',
  '😂',
  '😍',
  '🥹',
  '👏',
  '🔥',
  '😮',
  '🥰',
  '😭',
  '✨',
  '🎉',
  '👍',
]

const isHovered = ref(false)
const pickerOpen = ref(false)

const memory = computed(() => props.memory)

const formattedDate = computed(() =>
  new Date(props.memory.memory_date).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
  }),
)

const childAges = computed(() =>
  (props.memory.memory_children ?? []).map((mc) => ({
    name: mc.childprofile.name,
    age: computeBabyAge(
      mc.childprofile.date_of_birth,
      props.memory.memory_date,
    ),
  })),
)

const MAX_AVATARS = 4
const taggedMembers = computed(() => props.memory.memory_members ?? [])
const taggedMembersVisible = computed(() =>
  taggedMembers.value.slice(0, MAX_AVATARS),
)
const taggedMembersOverflow = computed(() =>
  Math.max(0, taggedMembers.value.length - MAX_AVATARS),
)

const isFormerMember = computed(() => props.memory.owner_user_id === null)
const authorName = computed(() => {
  if (props.memory.user?.first_name) return props.memory.user.first_name
  if (isFormerMember.value && props.memory.former_owner_name)
    return props.memory.former_owner_name
  return null
})

// ── Reactions ──────────────────────────────────────────────
const supabaseClient = useSupabaseClient()
const currentUserId = ref<string | null>(null)

supabaseClient.auth.getSession().then(({ data }) => {
  currentUserId.value = data.session?.user?.id ?? null
})

const localReactions = ref([...props.memory.memoryreaction])

watch(
  () => props.memory.memoryreaction,
  (r) => {
    localReactions.value = [...r]
  },
)

const hasAnyReaction = computed(() =>
  localReactions.value.some((r) => !!r.emoji),
)

const reactionGroups = computed(() => {
  const groups: Record<string, { count: number; mine: boolean }> = {}
  for (const r of localReactions.value) {
    if (!r.emoji) continue
    if (!groups[r.emoji]) groups[r.emoji] = { count: 0, mine: false }
    const g = groups[r.emoji]!
    g.count++
    if (r.user_id === currentUserId.value) g.mine = true
  }
  return groups
})

async function toggleReaction(emoji: string) {
  const userId =
    currentUserId.value ??
    (await supabaseClient.auth.getSession()).data.session?.user?.id
  if (!userId) return
  currentUserId.value = userId

  const existing = localReactions.value.find(
    (r) => r.emoji === emoji && r.user_id === userId,
  )

  if (existing) {
    localReactions.value = localReactions.value.filter((r) => r !== existing)
  } else {
    localReactions.value = [
      ...localReactions.value,
      { id: 'optimistic', emoji, user_id: userId, user: null },
    ]
  }

  try {
    const { reactions } = await $fetch<{ reactions: any[] }>(
      `/api/memories/${props.memory.id}/reactions`,
      { method: 'POST', body: { emoji } },
    )
    localReactions.value = reactions
    emit('reactionUpdate', { memoryId: props.memory.id, reactions })
  } catch (err) {
    console.error('[reactions] failed to toggle reaction:', err)
    localReactions.value = [...props.memory.memoryreaction]
  }
}

watch(isHovered, (hovered) => {
  if (!hovered) pickerOpen.value = false
})
</script>

<style scoped>
.quick-note-card {
  transition:
    transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
