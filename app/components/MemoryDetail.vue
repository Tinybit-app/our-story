<template>
  <div class="flex h-full flex-col" @click="pickerOpen = false">
    <!-- Caption section: tab bar + independent scroll panels -->
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- Tab bar -->
      <div class="flex flex-shrink-0 border-b border-border px-3">
        <button
          class="tab-btn border-b-2 px-3 py-2.5 text-[11px] font-semibold tracking-[.06em] transition-colors"
          :class="
            activeTab === 'caption'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="activeTab = 'caption'"
        >
          {{ t('modal.tabCaption') }}
        </button>
        <button
          class="tab-btn border-b-2 px-3 py-2.5 text-[11px] font-semibold tracking-[.06em] transition-colors"
          :class="
            activeTab === 'comments'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="activeTab = 'comments'"
        >
          {{ t('modal.tabComments') }}
          <span
            v-if="comments.length > 0"
            class="ml-1 font-normal opacity-50"
            >{{ comments.length }}</span
          >
        </button>
      </div>

      <!-- Caption tab -->
      <div
        v-show="activeTab === 'caption'"
        class="scroll-styled min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3"
      >
        <!-- View mode -->
        <template v-if="!editing">
          <div class="group/meta flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div
                v-if="memory.milestone_label"
                class="group/milestone mb-1.5 flex items-center gap-1.5"
              >
                <p
                  class="text-[10px] font-bold uppercase leading-none tracking-[.2em] text-accent"
                >
                  ✦ {{ memory.milestone_label }}
                </p>
                <button
                  class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-accent/60 transition-all hover:bg-accent/10 hover:text-accent"
                  :title="t('milestone.shareTitle')"
                  @click="emit('open-share-card')"
                >
                  <svg
                    width="10"
                    height="10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>
              </div>
              <p
                v-if="memory.note"
                class="mb-2 overflow-auto break-all text-[15px] leading-relaxed text-foreground"
              >
                {{ memory.note }}
              </p>
              <p
                v-else
                class="mb-2 text-[13px] italic text-muted-foreground/50"
              >
                {{ isOwner ? t('modal.noNoteOwner') : t('modal.noNote') }}
              </p>
            </div>
            <button
              v-if="isOwner"
              class="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              :title="t('modal.editNote')"
              @click="editing = true"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                />
                <path
                  d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                />
              </svg>
            </button>
          </div>
          <p class="mb-1 text-[12px]">
            <span class="text-muted-foreground">{{ formattedDate }}</span>
            <template v-if="authorName">
              <span class="text-muted-foreground"> · </span>
              <span
                :class="
                  isFormerMember
                    ? 'text-muted-foreground/40'
                    : 'text-muted-foreground'
                "
                >{{ authorName }}</span
              >
            </template>
          </p>
          <div v-if="childAges.length" class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="child in childAges"
              :key="child.name"
              class="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-medium leading-none"
              style="
                background: hsl(var(--accent) / 0.13);
                color: hsl(var(--accent));
              "
            >
              <span style="font-size: 10px; flex-shrink: 0; line-height: 1"
                >👶</span
              >
              <span>{{ child.name }}</span>
              <template v-if="child.age">
                <span style="opacity: 0.45">·</span>
                <span style="opacity: 0.85">{{ child.age }}</span>
              </template>
            </span>
          </div>
          <div
            v-if="memory.memory_members?.length"
            class="mt-2 flex flex-wrap items-center gap-2"
          >
            <span
              class="text-[10px] font-semibold uppercase tracking-[.08em]"
              style="color: hsl(var(--muted-foreground) / 0.55)"
              >with</span
            >
            <div
              v-for="mm in memory.memory_members"
              :key="mm.user_id"
              class="flex items-center gap-1"
            >
              <div
                class="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[8px] font-bold text-foreground"
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
              <span class="text-[11px] text-muted-foreground">{{
                mm.user?.first_name ?? t('common.someone')
              }}</span>
            </div>
          </div>
          <div class="mb-3" />
        </template>

        <!-- Edit mode placeholder — filled in Task 5 -->
        <div v-else>
          <p class="p-4 text-sm text-muted-foreground">Edit mode coming in Task 5.</p>
        </div>

        <!-- Reactions -->
        <div class="px-4 pb-4">
          <div class="flex flex-wrap items-center gap-1.5">
            <div
              v-for="(group, emoji) in reactionGroups"
              :key="emoji"
              class="group/rxn relative"
            >
              <button
                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition-all duration-150"
                :class="
                  group.mine
                    ? 'border-accent/25 bg-accent/15 font-medium text-foreground'
                    : 'border-transparent bg-secondary text-muted-foreground hover:border-border'
                "
                @click.stop="toggleReaction(emoji as string)"
              >
                {{ emoji }}<span class="text-[11px]">{{ group.count }}</span>
              </button>
              <div
                class="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[10px] text-background opacity-0 shadow-md transition-opacity duration-150 group-hover/rxn:opacity-100"
              >
                {{ reactionTooltip(group.names) }}
                <div
                  class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground"
                />
              </div>
            </div>
            <div class="relative">
              <!-- Add-reaction trigger. Expands to a labelled button when the
                   memory has no reactions yet (clear first-time affordance);
                   collapses to just the smiley-plus icon once chips above it
                   already teach what the button does. -->
              <button
                class="group inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-secondary/30 text-muted-foreground transition-all hover:border-accent/50 hover:bg-secondary hover:text-foreground"
                :class="hasAnyReaction ? 'w-8 px-0' : 'px-3'"
                :title="t('modal.addReaction')"
                :aria-label="t('modal.addReaction')"
                @click.stop="pickerOpen = !pickerOpen"
              >
                <!-- Smiley face with a "+" in the corner — the standard
                     add-reaction glyph across modern social apps. -->
                <svg
                  class="h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="10.5" cy="13.5" r="7.5" />
                  <circle cx="8" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
                  <circle cx="13" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
                  <path d="M7.8 16s.9 1.4 2.7 1.4 2.7-1.4 2.7-1.4" />
                  <path d="M18.5 3.5h4M20.5 1.5v4" />
                </svg>
                <span
                  v-if="!hasAnyReaction"
                  class="whitespace-nowrap text-[12px] font-medium"
                >
                  {{ t('modal.addReaction') }}
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
                  class="absolute bottom-full left-0 z-30 mb-1.5 grid gap-0.5 rounded-xl border border-border bg-card px-2 py-1.5 shadow-xl"
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
        </div>
      </div>

      <!-- Comments tab -->
      <div
        v-show="activeTab === 'comments'"
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div class="flex-shrink-0 border-b border-border px-3 py-3">
          <div class="flex items-center gap-2">
            <div
              class="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[10px] font-bold text-foreground"
            >
              <img
                v-if="props.selfAvatarUrl"
                :src="props.selfAvatarUrl"
                class="h-full w-full object-cover"
              />
              <span v-else>{{ props.selfInitials }}</span>
            </div>
            <div
              class="flex flex-1 items-end gap-2 rounded-2xl bg-secondary px-3 py-2"
            >
              <textarea
                ref="textareaEl"
                v-model="commentDraft"
                :placeholder="t('modal.addComment')"
                rows="1"
                class="flex-1 resize-none bg-transparent text-base leading-snug text-foreground outline-none placeholder:text-muted-foreground"
                style="max-height: 80px; overflow-y: auto"
                @keydown.enter.exact.prevent="submitComment"
                @input="autoResize"
              />
              <button
                :disabled="!commentDraft.trim() || submitting"
                class="flex-shrink-0 pb-0.5 text-[12px] font-semibold text-accent transition-colors disabled:text-muted-foreground"
                @click="submitComment"
              >
                {{ submitting ? '…' : t('modal.post') }}
              </button>
            </div>
          </div>
        </div>
        <div
          class="scroll-styled min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3"
        >
          <div v-if="comments.length > 0" class="space-y-3">
            <div
              v-for="c in visibleComments"
              :key="c.id"
              class="group/comment flex gap-2.5"
            >
              <div
                class="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[10px] font-bold text-foreground"
              >
                <img
                  v-if="c.user?.avatar_url"
                  :src="c.user.avatar_url"
                  class="h-full w-full object-cover"
                />
                <span v-else>{{ commentInitials(c.user) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <template v-if="editingCommentId !== c.id">
                  <div class="relative">
                    <div
                      class="rounded-2xl rounded-tl-sm bg-secondary px-3 py-2"
                    >
                      <span
                        class="mr-1.5 text-[11px] font-semibold text-foreground"
                        >{{ commentDisplayName(c.user) }}</span
                      >
                      <span class="text-[13px] leading-snug text-foreground">{{
                        c.body
                      }}</span>
                    </div>
                    <div
                      v-if="c.user_id === props.currentUserId"
                      class="absolute -right-1.5 -top-1.5 flex gap-0.5 opacity-0 transition-all group-hover/comment:opacity-100"
                    >
                      <button
                        class="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-accent/40 hover:text-accent"
                        :title="t('modal.editComment')"
                        @click.stop="startEditingComment(c)"
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                        >
                          <path
                            d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                          />
                          <path
                            d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                          />
                        </svg>
                      </button>
                      <button
                        class="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive/40 hover:text-destructive"
                        :title="t('modal.deleteComment')"
                        @click.stop="requestDeleteComment(c.id)"
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path
                            d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                          />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <!-- Timestamp + edited label -->
                  <p class="ml-3 mt-0.5 text-[10px] text-muted-foreground">
                    {{ timeAgo(c.created_at) }}
                    <span v-if="c.updated_at" class="ml-1 opacity-60"
                      >· {{ t('modal.edited') }}</span
                    >
                  </p>
                  <!-- Inline delete confirmation -->
                  <div
                    v-if="confirmDeleteId === c.id"
                    class="ml-3 mt-1 flex items-center gap-2"
                  >
                    <span class="text-[11px] text-muted-foreground">{{
                      t('modal.confirmDelete')
                    }}</span>
                    <button
                      class="text-[11px] font-semibold text-destructive transition-opacity hover:opacity-80"
                      @click="deleteComment(c.id)"
                    >
                      {{ t('modal.delete') }}
                    </button>
                    <button
                      class="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      @click="cancelDeleteComment"
                    >
                      {{ t('modal.cancel') }}
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div class="rounded-2xl rounded-tl-sm bg-secondary px-3 py-2">
                    <span
                      class="mb-1 mr-1.5 block text-[11px] font-semibold text-foreground"
                      >{{ commentDisplayName(c.user) }}</span
                    >
                    <textarea
                      ref="commentEditEl"
                      v-model="commentEditDraft"
                      rows="2"
                      maxlength="2000"
                      class="w-full resize-none bg-transparent text-base leading-snug text-foreground outline-none"
                      style="max-height: 120px; overflow-y: auto"
                      @keydown.enter.exact.prevent="saveCommentEdit(c.id)"
                      @keydown.escape="cancelCommentEdit"
                    />
                  </div>
                  <div class="ml-3 mt-1 flex items-center gap-2">
                    <span class="text-[10px] text-muted-foreground"
                      >{{ commentEditDraft.length }} / 2000</span
                    >
                    <button
                      class="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      @click="cancelCommentEdit"
                    >
                      {{ t('modal.cancel') }}
                    </button>
                    <button
                      :disabled="!commentEditDraft.trim() || savingComment"
                      class="text-[11px] font-semibold text-accent transition-colors disabled:text-muted-foreground"
                      @click="saveCommentEdit(c.id)"
                    >
                      {{ savingComment ? t('modal.saving') : t('modal.save') }}
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <p v-else class="py-6 text-center text-[12px] text-muted-foreground">
            {{ t('modal.noComments') }}
          </p>
          <button
            v-if="!allCommentsVisible && hiddenCommentCount > 0"
            class="mt-3 w-full text-left text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            @click="allCommentsVisible = true"
          >
            {{ t('modal.viewOlderComments', hiddenCommentCount) }} ↓
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { computeBabyAge } from '~/composables/useBabyAge'
import { useAnalytics } from '~/composables/useAnalytics'
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from '~/types/memory'

interface ChildProfile {
  id: string
  name: string
  date_of_birth: string
}
interface CircleMember {
  userId: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

const props = defineProps<{
  memory: Memory
  children: ChildProfile[]
  members: CircleMember[]
  currentUserId: string | null
  selfAvatarUrl: string | null
  selfInitials: string
  slides: Slide[]
  currentSlideIdx: number
}>()

const emit = defineEmits<{
  update: [Pick<Memory, 'id'> & Partial<Memory>]
  'slides-update': [
    { slides: Slide[]; currentSlideIdx?: number; coverMediaId?: string | null },
  ]
  'open-share-card': []
}>()

const { t, locale } = useI18n()

const activeTab = ref<'caption' | 'comments'>('caption')
const editing = ref(false)

const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)

const formattedDate = computed(() =>
  new Date(props.memory.memory_date).toLocaleDateString(locale.value, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
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

const isFormerMember = computed(() => props.memory.owner_user_id === null)
const authorName = computed(() => {
  if (props.memory.user?.first_name) return props.memory.user.first_name
  if (isFormerMember.value && props.memory.former_owner_name)
    return props.memory.former_owner_name
  return null
})

const isOwner = computed(
  () =>
    !!props.currentUserId && props.memory.owner_user_id === props.currentUserId,
)

const { track } = useAnalytics()

// ── Reactions ──────────────────────────────────────────────
const PRESET_EMOJIS = [
  '❤️', '😂', '😍', '🥹', '👏', '🔥', '😮', '🥰', '😭', '✨', '🎉', '👍',
]

const pickerOpen = ref(false)

type Reaction = {
  id: string
  emoji: string
  user_id: string | null
  guest_name: string | null
  user: { first_name: string | null; last_name: string | null } | null
}
const supabaseClient = useSupabaseClient()

// Initialized from prop — :key on this component resets it per-memory
const localReactions = ref<Reaction[]>([
  ...(props.memory.memoryreaction ?? []),
] as Reaction[])

const reactionGroups = computed(() => {
  const groups: Record<
    string,
    { count: number; mine: boolean; names: string[] }
  > = {}
  for (const r of localReactions.value) {
    if (!r.emoji) continue
    if (!groups[r.emoji]) groups[r.emoji] = { count: 0, mine: false, names: [] }
    const g = groups[r.emoji]!
    g.count++
    if (r.user_id === props.currentUserId) {
      g.mine = true
      g.names.unshift(t('common.you'))
    } else if (!r.user_id) g.names.push(r.guest_name ?? t('common.someone'))
    else g.names.push(r.user?.first_name ?? t('common.someone'))
  }
  return groups
})

const hasAnyReaction = computed(
  () => Object.keys(reactionGroups.value).length > 0,
)

function reactionTooltip(names: string[]): string {
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

async function toggleReaction(emoji: string) {
  const userId =
    props.currentUserId ??
    (await supabaseClient.auth.getSession()).data.session?.user?.id
  if (!userId) return
  const existing = localReactions.value.find(
    (r) => r.emoji === emoji && r.user_id === userId,
  )
  if (existing)
    localReactions.value = localReactions.value.filter((r) => r !== existing)
  else
    localReactions.value = [
      ...localReactions.value,
      {
        id: 'optimistic',
        emoji,
        user_id: userId,
        guest_name: null,
        user: null,
      },
    ]

  const memoryId = props.memory.id
  const wasAdding = !existing
  try {
    const { reactions } = await $fetch<{ reactions: any[] }>(
      `/api/memories/${memoryId}/reactions`,
      { method: 'POST', body: { emoji } },
    )
    localReactions.value = reactions
    emit('update', { id: memoryId, memoryreaction: reactions })
    if (wasAdding) {
      track('reaction_added', {
        circle_id: props.memory.circle_id,
        memory_id: memoryId,
        emoji,
      })
    }
  } catch (err) {
    console.error('[MemoryDetail] reaction error:', err)
    localReactions.value = [
      ...(props.memory.memoryreaction ?? []),
    ] as Reaction[]
  }
}

// ── Comments ───────────────────────────────────────────────
type Comment = {
  id: string
  body: string
  created_at: string
  updated_at: string | null
  user_id: string
  user: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}
const comments = ref<Comment[]>([])
const commentDraft = ref('')
const allCommentsVisible = ref(false)
const COMMENT_LIMIT = 5
const sortedComments = computed(() => [...comments.value].reverse())
const visibleComments = computed(() =>
  allCommentsVisible.value
    ? sortedComments.value
    : sortedComments.value.slice(0, COMMENT_LIMIT),
)
const hiddenCommentCount = computed(() =>
  Math.max(0, comments.value.length - COMMENT_LIMIT),
)
const submitting = ref(false)
const textareaEl = ref<HTMLTextAreaElement>()

async function loadComments() {
  try {
    const { comments: fetched } = await $fetch<{ comments: Comment[] }>(
      `/api/memories/${props.memory.id}/comments`,
    )
    comments.value = fetched
  } catch (err) {
    console.error('[MemoryDetail] failed to load comments:', err)
  }
}

async function submitComment() {
  const body = commentDraft.value.trim()
  if (!body || submitting.value) return
  submitting.value = true
  try {
    const { comments: updated } = await $fetch<{ comments: Comment[] }>(
      `/api/memories/${props.memory.id}/comments`,
      { method: 'POST', body: { body } },
    )
    comments.value = updated
    commentDraft.value = ''
    if (textareaEl.value) textareaEl.value.style.height = 'auto'
    track('comment_added', {
      circle_id: props.memory.circle_id,
      memory_id: props.memory.id,
    })
  } catch (err) {
    console.error('[MemoryDetail] failed to post comment:', err)
  } finally {
    submitting.value = false
  }
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function commentDisplayName(user: Comment['user']): string {
  if (!user) return t('common.someone')
  const parts = [user.first_name, user.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : t('common.someone')
}

function commentInitials(user: Comment['user']): string {
  return (
    (
      (user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '')
    ).toUpperCase() || '?'
  )
}

// ── Comment editing & delete confirmation ──────────────────
const editingCommentId = ref<string | null>(null)
const commentEditDraft = ref('')
const savingComment = ref(false)
const commentEditEl = ref<HTMLTextAreaElement>()
const confirmDeleteId = ref<string | null>(null)

function startEditingComment(c: Comment) {
  editingCommentId.value = c.id
  commentEditDraft.value = c.body
  nextTick(() => commentEditEl.value?.focus())
}

function cancelCommentEdit() {
  editingCommentId.value = null
  commentEditDraft.value = ''
}

async function saveCommentEdit(commentId: string) {
  const body = commentEditDraft.value.trim()
  if (!body || savingComment.value) return
  savingComment.value = true
  try {
    await $fetch(`/api/memories/${props.memory.id}/comments/${commentId}`, {
      method: 'PATCH',
      body: { body },
    })
    const idx = comments.value.findIndex((c) => c.id === commentId)
    if (idx !== -1)
      comments.value[idx] = {
        ...comments.value[idx]!,
        body,
        updated_at: new Date().toISOString(),
      }
    editingCommentId.value = null
    commentEditDraft.value = ''
  } catch (err) {
    console.error('[MemoryDetail] failed to update comment:', err)
  } finally {
    savingComment.value = false
  }
}

function requestDeleteComment(commentId: string) {
  confirmDeleteId.value = commentId
}

function cancelDeleteComment() {
  confirmDeleteId.value = null
}

async function deleteComment(commentId: string) {
  try {
    await $fetch(`/api/memories/${props.memory.id}/comments/${commentId}`, {
      method: 'DELETE',
    })
    comments.value = comments.value.filter((c) => c.id !== commentId)
  } catch (err) {
    console.error('[MemoryDetail] failed to delete comment:', err)
  } finally {
    confirmDeleteId.value = null
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('common.justNow')
  if (mins < 60) return t('common.minsAgo', { n: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('common.hoursAgo', { n: hrs })
  const days = Math.floor(hrs / 24)
  if (days < 7) return t('common.daysAgo', { n: days })
  return new Date(iso).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
  })
}

onMounted(() => loadComments())

async function canClose(): Promise<boolean> {
  return true
}
defineExpose({ canClose })
</script>
