<template>
  <article
    ref="articleEl"
    class="quick-note-card relative bg-card cursor-pointer select-none flex-shrink-0"
    :style="{
      width: '210px',
      transform: isHovered
        ? 'rotate(0deg) scale(1.04) translateY(-3px)'
        : `rotate(${tilt}deg)`,
      zIndex: isHovered ? 10 : 1,
      boxShadow: isHovered
        ? '0 14px 44px rgba(44,36,32,.22)'
        : '0 4px 16px rgba(44,36,32,.14), 0 1px 3px rgba(44,36,32,.08)',
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="onCardClick"
  >
    <!-- Pin -->
    <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#d64040] dark:bg-[#e05454] shadow-[0_2px_6px_rgba(214,64,64,.4)] opacity-85 z-10" />

    <div class="px-4 pt-3 pb-4">
      <!-- Note type indicator — pencil icon + italic label, clearly separate from milestone stamp -->
      <div class="flex items-center gap-2 mb-2.5">
        <span class="text-[10px] italic text-muted-foreground/70 flex-shrink-0"
          >Quick note</span
        >
        <div class="flex-1 h-px bg-border" />
      </div>

      <!-- Milestone stamp (if present) -->
      <div
        v-if="memory.milestone_label"
        class="inline-flex items-center gap-1 px-2 py-[3px] rounded-sm mb-2"
        style="
          background: hsl(var(--accent) / 0.88);
          border: 1px solid hsl(var(--accent) / 0.55);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
        "
      >
        <span
          class="text-[9px] font-bold text-white/90 tracking-[.18em] uppercase leading-none"
        >
          ✦ {{ memory.milestone_label }}
        </span>
      </div>

      <!-- Note text -->
      <p
        class="text-[12.5px] leading-[1.65] line-clamp-5 text-foreground mb-3"
        :class="memory.milestone_label ? '' : 'mt-0.5'"
      >
        {{ memory.note }}
      </p>

      <!-- Postcard divider -->
      <div class="h-px bg-border mb-2.5" />

      <!-- Footer row 1: date · author + picker trigger -->
      <div class="flex items-center justify-between gap-2" @click.stop>
        <div class="flex items-center gap-1 min-w-0">
          <span class="text-[10px] text-muted-foreground whitespace-nowrap">{{
            formattedDate
          }}</span>
          <template v-if="authorName">
            <span class="text-[10px] text-muted-foreground">·</span>
            <span
              class="text-[10px] truncate"
              :class="
                isFormerMember
                  ? 'text-muted-foreground/40'
                  : 'text-muted-foreground'
              "
              >{{ authorName }}</span
            >
          </template>
        </div>

        <!-- Picker trigger — always right-aligned in the meta row -->
        <div class="relative flex-shrink-0">
          <button
            class="w-5 h-5 rounded-full bg-secondary border border-border text-[11px] text-muted-foreground hover:bg-border transition-colors flex items-center justify-center leading-none"
            @click.stop="pickerOpen = !pickerOpen"
          >
            +
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
              class="absolute bottom-full mb-1.5 right-0 z-20 bg-card border border-border rounded-xl shadow-xl px-2 py-1.5 grid gap-0.5"
              style="grid-template-columns: repeat(6, 1fr)"
              @click.stop
            >
              <button
                v-for="e in PRESET_EMOJIS"
                :key="e"
                class="text-base w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                :class="reactionGroups[e]?.mine ? 'bg-accent/15' : ''"
                @click.stop="
                  toggleReaction(e);
                  pickerOpen = false;
                "
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
        class="flex flex-wrap gap-1 mt-1.5"
        @click.stop
      >
        <button
          v-for="(group, emoji) in reactionGroups"
          :key="emoji"
          class="inline-flex items-center gap-0.5 px-1.5 py-[3px] rounded-full text-[10px] border transition-all duration-150"
          :class="
            group.mine
              ? 'bg-accent/15 border-accent/40 text-foreground font-semibold'
              : 'bg-secondary border-border text-muted-foreground hover:border-foreground/30'
          "
          @click.stop="toggleReaction(emoji as string)"
        >
          <span>{{ emoji }}</span>
          <span class="text-[9px]">{{ group.count }}</span>
        </button>
      </div>

      <!-- Child age pills -->
      <div v-if="childAges.length" class="flex flex-wrap gap-[3px] mt-2">
        <span
          v-for="child in childAges"
          :key="child.name"
          class="inline-flex items-center gap-[3px] px-[6px] py-[2px] rounded-full text-[9px] leading-none font-medium"
          style="
            background: hsl(var(--accent) / 0.14);
            color: hsl(var(--accent));
          "
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="opacity: 0.8; flex-shrink: 0"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 14s1 2 3.5 2 3.5-2 3.5-2" />
            <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
          </svg>
          <span>{{ child.name }}</span>
          <span style="opacity: 0.5">·</span>
          <span style="opacity: 0.85">{{ child.age }}</span>
        </span>
      </div>

      <!-- Tagged member avatars -->
      <div
        v-if="taggedMembers.length"
        class="flex items-center gap-[5px] mt-[5px]"
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
            class="w-[18px] h-[18px] rounded-full overflow-hidden bg-secondary border-[1.5px] border-card flex items-center justify-center text-[7px] font-bold text-foreground flex-shrink-0"
            :style="{
              marginLeft: i === 0 ? '0' : '-5px',
              zIndex: taggedMembersVisible.length - i,
            }"
            :title="mm.user?.first_name ?? ''"
          >
            <img
              v-if="mm.user?.avatar_url"
              :src="mm.user.avatar_url"
              class="w-full h-full object-cover"
            />
            <span v-else>{{
              (
                (mm.user?.first_name?.[0] ?? "") +
                (mm.user?.last_name?.[0] ?? "")
              ).toUpperCase() || "?"
            }}</span>
          </div>
          <span
            v-if="taggedMembersOverflow > 0"
            class="text-[9px] text-muted-foreground ml-1"
            >+{{ taggedMembersOverflow }}</span
          >
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Memory } from "~/composables/useTimeline";
import { computeBabyAge } from "~/composables/useBabyAge";

const { locale } = useI18n();

const props = defineProps<{
  memory: Memory;
  index: number;
}>();

const emit = defineEmits<{
  open: [{ memory: Memory; tilt: number; rect: DOMRect }];
  reactionUpdate: [{ memoryId: string; reactions: any[] }];
}>();

const articleEl = ref<HTMLElement>();

const TILTS = [-1.8, 1.2, -0.6, 2.1, -1.6, 0.4];
const tilt = computed(() => TILTS[props.index % TILTS.length]);

function onCardClick() {
  if (!articleEl.value) return;
  emit("open", {
    memory: props.memory,
    tilt: tilt.value ?? 0,
    rect: articleEl.value.getBoundingClientRect(),
  });
}

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

const isHovered = ref(false);
const pickerOpen = ref(false);

const memory = computed(() => props.memory);

const formattedDate = computed(() =>
  new Date(props.memory.memory_date).toLocaleDateString(locale.value, {
    month: "short",
    day: "numeric",
  }),
);

const childAges = computed(
  () =>
    (props.memory.memory_children ?? [])
      .map((mc) => ({
        name: mc.childprofile.name,
        age: computeBabyAge(
          mc.childprofile.date_of_birth,
          props.memory.memory_date,
        ),
      }))
      .filter((c) => c.age !== null) as Array<{ name: string; age: string }>,
);

const MAX_AVATARS = 4;
const taggedMembers = computed(() => props.memory.memory_members ?? []);
const taggedMembersVisible = computed(() =>
  taggedMembers.value.slice(0, MAX_AVATARS),
);
const taggedMembersOverflow = computed(() =>
  Math.max(0, taggedMembers.value.length - MAX_AVATARS),
);

const isFormerMember = computed(() => props.memory.owner_user_id === null);
const authorName = computed(() => {
  if (props.memory.user?.first_name) return props.memory.user.first_name;
  if (isFormerMember.value && props.memory.former_owner_name)
    return props.memory.former_owner_name;
  return null;
});

// ── Reactions ──────────────────────────────────────────────
const supabaseClient = useSupabaseClient();
const currentUserId = ref<string | null>(null);

supabaseClient.auth.getSession().then(({ data }) => {
  currentUserId.value = data.session?.user?.id ?? null;
});

const localReactions = ref([...props.memory.memoryreaction]);

watch(
  () => props.memory.memoryreaction,
  (r) => {
    localReactions.value = [...r];
  },
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
  if (!userId) return;
  currentUserId.value = userId;

  const existing = localReactions.value.find(
    (r) => r.emoji === emoji && r.user_id === userId,
  );

  if (existing) {
    localReactions.value = localReactions.value.filter((r) => r !== existing);
  } else {
    localReactions.value = [
      ...localReactions.value,
      { id: "optimistic", emoji, user_id: userId, user: null },
    ];
  }

  try {
    const { reactions } = await $fetch<{ reactions: any[] }>(
      `/api/memories/${props.memory.id}/reactions`,
      { method: "POST", body: { emoji } },
    );
    localReactions.value = reactions;
    emit("reactionUpdate", { memoryId: props.memory.id, reactions });
  } catch (err) {
    console.error("[reactions] failed to toggle reaction:", err);
    localReactions.value = [...props.memory.memoryreaction];
  }
}

watch(isHovered, (hovered) => {
  if (!hovered) pickerOpen.value = false;
});
</script>

<style scoped>
.quick-note-card {
  transition:
    transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
