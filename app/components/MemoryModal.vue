<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <!-- Backdrop -->
      <div
        ref="backdropEl"
        class="absolute inset-0 cursor-pointer"
        style="
          background: rgba(0, 0, 0, 0);
          transition:
            background 300ms ease,
            backdrop-filter 300ms ease;
        "
        @click="close"
      />

      <!-- Prev arrow -->
      <button
        v-if="hasPrev"
        class="absolute left-3 sm:left-6 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-sm"
        style="top: 50%; transform: translateY(-50%)"
        @click.stop="navigate('prev')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <!-- Next arrow -->
      <button
        v-if="hasNext"
        class="absolute right-3 sm:right-6 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-sm"
        style="top: 50%; transform: translateY(-50%)"
        @click.stop="navigate('next')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <!-- Polaroid: flex-col, photo on top, caption below -->
      <div
        ref="polaroidEl"
        class="relative z-10 bg-card will-change-transform flex flex-col"
        style="
          width: 100%;
          max-width: 680px;
          max-height: 90vh;
          padding: 12px 12px 0;
          opacity: 0;
        "
        @click.stop
      >
        <!-- Pin -->
        <div
          class="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#d64040] dark:bg-[#e05454] shadow-[0_2px_8px_rgba(214,64,64,.5)] opacity-90 z-20"
        />

        <!-- Close -->
        <button
          class="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-foreground text-background hover:opacity-80 transition-opacity"
          @click="close"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- Photo: full width, aspect-ratio drives card height -->
        <div class="relative overflow-hidden bg-border flex-shrink-0 aspect-[4/3]">
          <img
            v-if="firstMedia"
            :src="firstMedia.url ?? firstMedia.thumbnailUrl ?? ''"
            :alt="memory?.note ?? 'Memory'"
            class="absolute inset-0 w-full h-full object-cover block"
          />
          <div
            v-else-if="memory?.note"
            class="absolute inset-0 w-full h-full flex items-center justify-center p-6"
            style="
              background-color: color-mix(in srgb, var(--accent) 12%, var(--card));
              background-image: repeating-linear-gradient(
                transparent, transparent 23px,
                color-mix(in srgb, var(--border) 80%, transparent) 24px
              );
            "
          >
            <p class="text-[15px] text-foreground leading-7 text-center">{{ memory.note }}</p>
          </div>
          <div v-else class="absolute inset-0 w-full h-full flex items-center justify-center bg-secondary">
            <svg class="w-12 h-12 text-muted-foreground/30" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        </div>

        <!-- Caption section: fills remaining height budget -->
        <div class="flex-1 flex flex-col min-h-0">

          <!-- 1. Metadata + reactions — compact, never scrolls -->
          <div class="flex-shrink-0 pt-3 px-1.5 pb-3">

            <!-- View mode -->
            <template v-if="!editing">
              <div class="flex items-start justify-between gap-2 group/meta">
                <div class="flex-1 min-w-0">
                  <p v-if="memory?.milestone_label" class="text-[10px] font-bold text-accent tracking-[.2em] uppercase mb-1.5">✦ {{ memory.milestone_label }}</p>
                  <p v-if="memory?.note" class="text-[15px] text-foreground leading-relaxed mb-2">{{ memory.note }}</p>
                </div>
                <button
                  v-if="isOwner"
                  class="flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover/meta:opacity-100"
                  title="Edit note"
                  @click="startEditing"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
              <p class="text-[12px] text-muted-foreground mb-3">{{ formattedDateAndAuthor }}</p>
            </template>

            <!-- Edit mode -->
            <template v-else>
              <div class="mb-2">
                <div class="flex items-baseline justify-between mb-1">
                  <label class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em]">Milestone</label>
                  <span class="text-[10px]" :class="editMilestone.length >= 40 ? 'text-destructive' : 'text-muted-foreground'">{{ editMilestone.length }} / 40</span>
                </div>
                <input
                  v-model="editMilestone"
                  type="text"
                  placeholder="e.g. First steps"
                  maxlength="40"
                  class="w-full bg-secondary rounded-lg px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-accent/40 mb-3"
                />
                <div class="flex items-baseline justify-between mb-1">
                  <label class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em]">Note</label>
                  <span class="text-[10px]" :class="editNote.length >= 500 ? 'text-destructive' : 'text-muted-foreground'">{{ editNote.length }} / 500</span>
                </div>
                <textarea
                  ref="editTextareaEl"
                  v-model="editNote"
                  placeholder="Add a note…"
                  rows="3"
                  maxlength="500"
                  class="w-full bg-secondary rounded-lg px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-accent/40 leading-relaxed"
                  style="max-height: 120px; overflow-y: auto"
                />
                <div class="flex items-center justify-end mt-1.5">
                  <div class="flex items-center gap-2">
                    <button
                      class="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                      @click="cancelEditing"
                    >Cancel</button>
                    <button
                      :disabled="saving"
                      class="text-[12px] font-semibold text-accent disabled:text-muted-foreground transition-colors"
                      @click="saveEdit"
                    >{{ saving ? "Saving…" : "Save" }}</button>
                  </div>
                </div>
              </div>
              <p class="text-[12px] text-muted-foreground mb-3">{{ formattedDateAndAuthor }}</p>
            </template>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                v-for="(group, emoji) in reactionGroups"
                :key="emoji"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all duration-150"
                :class="group.mine ? 'bg-accent/15 border-accent/25 text-foreground font-medium' : 'bg-secondary border-transparent text-muted-foreground hover:border-border'"
                @click="toggleReaction(emoji as string)"
              >{{ emoji }}<span class="text-[11px]">{{ group.count }}</span></button>
              <div class="relative">
                <button
                  class="w-6 h-6 rounded-full border border-border text-muted-foreground text-[13px] flex items-center justify-center hover:bg-secondary transition-colors"
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
                    class="absolute bottom-full mb-1.5 left-0 z-30 bg-card border border-border rounded-xl shadow-xl px-2 py-1.5 grid gap-0.5"
                    style="grid-template-columns: repeat(6, 1fr)"
                    @click.stop
                  >
                    <button
                      v-for="e in PRESET_EMOJIS" :key="e"
                      class="text-base w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                      :class="reactionGroups[e]?.mine ? 'bg-accent/15' : ''"
                      @click.stop="toggleReaction(e); pickerOpen = false;"
                    >{{ e }}</button>
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- 2. Comment input — always visible -->
          <div class="flex-shrink-0 px-1.5 py-3 border-t border-border">
            <div class="flex gap-2 items-center">
              <div class="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                <img v-if="selfAvatarUrl" :src="selfAvatarUrl" class="w-full h-full object-cover" />
                <span v-else>{{ selfInitials }}</span>
              </div>
              <div class="flex-1 flex items-end gap-2 bg-secondary rounded-2xl px-3 py-2">
                <textarea
                  ref="textareaEl"
                  v-model="commentDraft"
                  placeholder="Add a comment…"
                  rows="1"
                  class="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground resize-none outline-none leading-snug"
                  style="max-height: 80px; overflow-y: auto"
                  @keydown.enter.exact.prevent="submitComment"
                  @input="autoResize"
                />
                <button
                  :disabled="!commentDraft.trim() || submitting"
                  class="flex-shrink-0 text-[12px] font-semibold text-accent disabled:text-muted-foreground transition-colors pb-0.5"
                  @click="submitComment"
                >{{ submitting ? "…" : "Post" }}</button>
              </div>
            </div>
          </div>

          <!-- 3. Comment thread — newest first, scrollable -->
          <div class="caption-scroll flex-1 min-h-0 overflow-y-auto px-1.5 pt-3 pb-4">
            <div v-if="comments.length > 0" class="space-y-3">
              <div v-for="c in visibleComments" :key="c.id" class="flex gap-2.5">
                <div class="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                  <img v-if="c.user?.avatar_url" :src="c.user.avatar_url" class="w-full h-full object-cover" />
                  <span v-else>{{ commentInitials(c.user) }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="bg-secondary rounded-2xl rounded-tl-sm px-3 py-2">
                    <span class="text-[11px] font-semibold text-foreground mr-1.5">{{ commentDisplayName(c.user) }}</span>
                    <span class="text-[13px] text-foreground leading-snug">{{ c.body }}</span>
                  </div>
                  <p class="text-[10px] text-muted-foreground mt-0.5 ml-3">{{ timeAgo(c.created_at) }}</p>
                </div>
              </div>
            </div>
            <button
              v-if="!allCommentsVisible && hiddenCommentCount > 0"
              class="mt-3 w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors text-left"
              @click="allCommentsVisible = true"
            >View {{ hiddenCommentCount }} older {{ hiddenCommentCount === 1 ? 'comment' : 'comments' }} ↓</button>
          </div>

        </div>
        <!-- /caption section -->
      </div>
      <!-- /polaroid -->
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Memory } from "~/composables/useTimeline";

const props = defineProps<{
  memories: Memory[];
  startIndex: number | null;
  originRect: DOMRect | null;
  tilt: number;
}>();

const emit = defineEmits<{ close: []; update: [Pick<Memory, 'id'> & Partial<Memory>] }>();

const PRESET_EMOJIS = [
  "❤️",
  "😂",
  "😍",
  "🥹",
  "👏",
  "🔥",
  "😮",
  "🥰",
  "😭",
  "✨",
  "🎉",
  "👍",
];

const polaroidEl = ref<HTMLElement>();
const backdropEl = ref<HTMLElement>();
const visible = ref(false);
const pickerOpen = ref(false);
const navigating = ref(false);

// ── Current memory ─────────────────────────────────────────
const currentIndex = ref(0);
const memory = computed(() => props.memories[currentIndex.value] ?? null);
const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value < props.memories.length - 1);

const firstMedia = computed(() => memory.value?.memorymedia[0] ?? null);

const formattedDateAndAuthor = computed(() => {
  if (!memory.value) return "";
  const d = new Date(memory.value.memory_date);
  const dateStr = d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const firstName = memory.value.user?.first_name ?? "";
  return firstName ? `${dateStr} · ${firstName}` : dateStr;
});

// ── Reactions ──────────────────────────────────────────────
const supabaseClient = useSupabaseClient();
const currentUserId = ref<string | null>(null);

supabaseClient.auth.getSession().then(({ data }) => {
  currentUserId.value = data.session?.user?.id ?? null;
});

// ── Edit note ──────────────────────────────────────────────
const editing = ref(false);
const saving = ref(false);
const editNote = ref("");
const editMilestone = ref("");
const editTextareaEl = ref<HTMLTextAreaElement>();

const isOwner = computed(
  () => !!currentUserId.value && memory.value?.owner_user_id === currentUserId.value,
);

function startEditing() {
  editNote.value = memory.value?.note ?? "";
  editMilestone.value = memory.value?.milestone_label ?? "";
  editing.value = true;
  nextTick(() => editTextareaEl.value?.focus());
}

function cancelEditing() {
  editing.value = false;
}

async function saveEdit() {
  if (saving.value || !memory.value) return;
  saving.value = true;
  try {
    const { memory: updated } = await $fetch<{
      memory: { id: string; note: string | null; milestone_label: string | null; milestone_is_custom: boolean };
    }>(`/api/memories/${memory.value.id}`, {
      method: "PATCH",
      body: {
        note: editNote.value.trim() || null,
        milestone_label: editMilestone.value.trim() || null,
      },
    });
    // Propagate to parent memoriesFlat
    emit("update", {
      id: updated.id,
      note: updated.note,
      milestone_label: updated.milestone_label,
      milestone_is_custom: updated.milestone_is_custom,
    });
    editing.value = false;
  } catch (err) {
    console.error("[MemoryModal] failed to save edit:", err);
  } finally {
    saving.value = false;
  }
}

const localReactions = ref<{ id: string; emoji: string; user_id: string }[]>(
  [],
);

const reactionGroups = computed(() => {
  const groups: Record<string, { count: number; mine: boolean }> = {};
  for (const r of localReactions.value) {
    if (!r.emoji) continue;
    if (!groups[r.emoji]) groups[r.emoji] = { count: 0, mine: false };
    const g = groups[r.emoji]!;
    g.count++;
    if (r.user_id === currentUserId.value) g.mine = true;
  }
  return groups;
});

async function toggleReaction(emoji: string) {
  const userId =
    currentUserId.value ??
    (await supabaseClient.auth.getSession()).data.session?.user?.id;
  if (!userId || !memory.value) return;
  currentUserId.value = userId;

  const existing = localReactions.value.find(
    (r) => r.emoji === emoji && r.user_id === userId,
  );
  if (existing) {
    localReactions.value = localReactions.value.filter((r) => r !== existing);
  } else {
    localReactions.value = [
      ...localReactions.value,
      { id: "optimistic", emoji, user_id: userId },
    ];
  }

  try {
    const { reactions } = await $fetch<{ reactions: any[] }>(
      `/api/memories/${memory.value.id}/reactions`,
      { method: "POST", body: { emoji } },
    );
    localReactions.value = reactions;
  } catch (err) {
    console.error("[MemoryModal] reaction error:", err);
    localReactions.value = [...(memory.value?.memoryreaction ?? [])];
  }
}

// ── Animation ──────────────────────────────────────────────
async function runEnterAnimation() {
  const el = polaroidEl.value;
  const bd = backdropEl.value;
  if (!el) return;

  const targetRect = el.getBoundingClientRect();

  if (props.originRect) {
    const srcCX = props.originRect.left + props.originRect.width / 2;
    const srcCY = props.originRect.top + props.originRect.height / 2;
    const tgtCX = targetRect.left + targetRect.width / 2;
    const tgtCY = targetRect.top + targetRect.height / 2;
    const dx = srcCX - tgtCX;
    const dy = srcCY - tgtCY;
    const scale = props.originRect.width / targetRect.width;

    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${props.tilt}deg)`;
    el.style.opacity = "0.9";
    el.style.boxShadow = "0 4px 16px rgba(44,36,32,.14)";
    el.getBoundingClientRect();
  } else {
    el.style.transform = "scale(0.9) rotate(-1deg)";
    el.style.opacity = "0";
    el.getBoundingClientRect();
  }

  el.style.transition =
    "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease, box-shadow 420ms ease";
  el.style.transform = "none";
  el.style.opacity = "1";
  el.style.boxShadow =
    "0 28px 80px rgba(44,36,32,.38), 0 6px 20px rgba(44,36,32,.18)";

  if (bd) {
    bd.getBoundingClientRect();
    bd.style.transition = "background 300ms ease, backdrop-filter 300ms ease";
    bd.style.background = "rgba(0,0,0,0.6)";
    bd.style.backdropFilter = "blur(6px)";
  }
}

async function navigate(dir: "prev" | "next") {
  if (navigating.value) return;
  const newIdx =
    dir === "prev" ? currentIndex.value - 1 : currentIndex.value + 1;
  if (newIdx < 0 || newIdx >= props.memories.length) return;

  navigating.value = true;
  pickerOpen.value = false;

  const el = polaroidEl.value;
  if (el) {
    const xOut = dir === "next" ? -50 : 50;
    el.style.transition = "transform 180ms ease-in, opacity 160ms ease-in";
    el.style.transform = `translateX(${xOut}px)`;
    el.style.opacity = "0";
    await new Promise((r) => setTimeout(r, 190));
  }

  // Switch to new memory
  currentIndex.value = newIdx;
  localReactions.value = [...(props.memories[newIdx]?.memoryreaction ?? [])];
  comments.value = [];
  commentDraft.value = "";
  allCommentsVisible.value = false;
  editing.value = false;
  editNote.value = "";
  editMilestone.value = "";

  await nextTick();

  if (el) {
    const xIn = dir === "next" ? 50 : -50;
    el.style.transition = "none";
    el.style.transform = `translateX(${xIn}px)`;
    el.style.opacity = "0";
    el.getBoundingClientRect(); // force reflow
    el.style.transition =
      "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease";
    el.style.transform = "none";
    el.style.opacity = "1";
    await new Promise((r) => setTimeout(r, 290));
  }

  loadComments();
  navigating.value = false;
}

async function close() {
  const el = polaroidEl.value;
  const bd = backdropEl.value;

  if (el) {
    el.style.transition =
      "transform 280ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms ease, box-shadow 220ms ease";
    el.style.transform = "scale(0.88) rotate(-1.5deg)";
    el.style.opacity = "0";
    el.style.boxShadow = "0 4px 8px rgba(44,36,32,.08)";
  }
  if (bd) {
    bd.style.transition = "background 220ms ease, backdrop-filter 220ms ease";
    bd.style.background = "rgba(0,0,0,0)";
    bd.style.backdropFilter = "blur(0px)";
  }

  await new Promise((r) => setTimeout(r, 290));
  visible.value = false;
  pickerOpen.value = false;
  emit("close");
}

// ── Comments ───────────────────────────────────────────────
type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  user: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
};

const comments = ref<Comment[]>([]);
const commentDraft = ref("");
const allCommentsVisible = ref(false);

const COMMENT_LIMIT = 5;
// Newest first
const sortedComments = computed(() => [...comments.value].reverse());
const visibleComments = computed(() =>
  allCommentsVisible.value
    ? sortedComments.value
    : sortedComments.value.slice(0, COMMENT_LIMIT),
);
const hiddenCommentCount = computed(() =>
  Math.max(0, comments.value.length - COMMENT_LIMIT),
);
const submitting = ref(false);
const textareaEl = ref<HTMLTextAreaElement>();

async function loadComments() {
  const mem = memory.value;
  if (!mem) return;
  try {
    const { comments: fetched } = await $fetch<{ comments: Comment[] }>(
      `/api/memories/${mem.id}/comments`,
    );
    // Only update if we're still on the same memory
    if (memory.value?.id === mem.id) {
      comments.value = fetched;
    }
  } catch (err) {
    console.error("[MemoryModal] failed to load comments:", err);
  }
}

async function submitComment() {
  const body = commentDraft.value.trim();
  if (!body || submitting.value || !memory.value) return;
  submitting.value = true;
  try {
    const { comments: updated } = await $fetch<{ comments: Comment[] }>(
      `/api/memories/${memory.value.id}/comments`,
      { method: "POST", body: { body } },
    );
    comments.value = updated;
    commentDraft.value = "";
    if (textareaEl.value) {
      textareaEl.value.style.height = "auto";
    }
  } catch (err) {
    console.error("[MemoryModal] failed to post comment:", err);
  } finally {
    submitting.value = false;
  }
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function commentDisplayName(user: Comment["user"]): string {
  if (!user) return "Someone";
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "Someone";
}

function commentInitials(user: Comment["user"]): string {
  const first = user?.first_name?.[0] ?? "";
  const last = user?.last_name?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Self profile for the comment input avatar
const selfAvatarUrl = ref<string | null>(null);
const selfInitials = ref("?");

supabaseClient.auth.getSession().then(async ({ data }) => {
  const id = data.session?.user?.id;
  if (!id) return;
  try {
    const profile = await $fetch<{
      avatarUrl: string | null;
      firstName: string | null;
      lastName: string | null;
    }>("/api/profile");
    selfAvatarUrl.value = profile.avatarUrl;
    const parts = [profile.firstName, profile.lastName].filter(Boolean);
    selfInitials.value =
      parts
        .map((p) => p![0])
        .join("")
        .toUpperCase() || "?";
  } catch {
    /* non-critical */
  }
});

// ── Open when startIndex is provided ──────────────────────
watch(
  () => props.startIndex,
  async (idx) => {
    if (idx !== null && idx !== undefined) {
      currentIndex.value = idx;
      localReactions.value = [...(props.memories[idx]?.memoryreaction ?? [])];
      comments.value = [];
      commentDraft.value = "";
      allCommentsVisible.value = false;
      editing.value = false;
      editNote.value = "";
      editMilestone.value = "";
      visible.value = true;
      await nextTick();
      await runEnterAnimation();
      loadComments();
    }
  },
);

// ── Keyboard ───────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (!visible.value) return;
  if (e.key === "Escape") close();
  else if (e.key === "ArrowLeft") navigate("prev");
  else if (e.key === "ArrowRight") navigate("next");
}

watch(visible, (v) => {
  document.body.style.overflow = v ? "hidden" : "";
});

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<style scoped>
.caption-scroll {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--accent) / 0.4) hsl(var(--accent) / 0.06);
}

.caption-scroll::-webkit-scrollbar {
  width: 4px;
}

.caption-scroll::-webkit-scrollbar-track {
  background: hsl(var(--accent) / 0.06);
  border-radius: 999px;
}

.caption-scroll::-webkit-scrollbar-thumb {
  background: hsl(var(--accent) / 0.38);
  border-radius: 999px;
  transition: background 200ms ease;
}

.caption-scroll::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--accent) / 0.65);
}
</style>
