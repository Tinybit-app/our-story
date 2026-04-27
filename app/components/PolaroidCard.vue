<template>
  <article
    ref="articleEl"
    class="polaroid-card relative bg-card flex-shrink-0 cursor-pointer select-none shadow-[0_4px_16px_rgba(44,36,32,.14),0_1px_3px_rgba(44,36,32,.08)] p-[8px] pb-[15px]"
    :class="wide ? 'w-[290px]' : 'w-[210px]'"
    :style="{
      transform: isHovered
        ? 'rotate(0deg) scale(1.05) translateY(-4px)'
        : `rotate(${tilt}deg)`,
      zIndex: isHovered ? 10 : 1,
      boxShadow: isHovered ? '0 14px 44px rgba(44,36,32,.22)' : undefined,
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="onCardClick"
  >
    <!-- Pin -->
    <div
      class="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#d64040] dark:bg-[#e05454] shadow-[0_2px_6px_rgba(214,64,64,.4)] opacity-85 z-10"
    />

    <!-- Photo area -->
    <div
      class="relative overflow-hidden bg-border"
      :class="wide ? 'aspect-[4/3]' : 'aspect-square'"
    >
      <!-- Photo -->
      <template
        v-if="
          firstMedia &&
          firstMedia.media_type !== 'video' &&
          (firstMedia.thumbnailUrl || firstMedia.url)
        "
      >
        <!-- Shimmer skeleton shown until image loads -->
        <div
          v-if="!imgLoaded"
          class="absolute inset-0 skeleton-shimmer"
        />
        <img
          :src="firstMedia.thumbnailUrl ?? firstMedia.url ?? ''"
          :alt="memory.note ?? t('card.photoAlt')"
          class="w-full h-full object-cover block transition-opacity duration-300"
          :class="imgLoaded ? 'opacity-100' : 'opacity-0'"
          loading="lazy"
          @load="imgLoaded = true"
        />
      </template>

      <!-- Video -->
      <template
        v-else-if="firstMedia?.media_type === 'video' && firstMedia.url"
      >
        <div
          v-if="!videoLoaded"
          class="absolute inset-0 skeleton-shimmer"
        />
        <video
          :src="firstMedia.url"
          class="w-full h-full object-cover block transition-opacity duration-300"
          :class="videoLoaded ? 'opacity-100' : 'opacity-0'"
          muted
          playsinline
          preload="metadata"
          @loadedmetadata="videoLoaded = true"
        />
        <div
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            class="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm"
          >
            <svg
              class="w-4 h-4 text-white ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </template>

      <!-- Note-only: serif quote card -->
      <div
        v-else-if="memory.note"
        class="w-full h-full relative flex flex-col justify-center px-4 pt-6 pb-3"
        style="background-color: color-mix(in srgb, var(--accent) 8%, var(--card));"
      >
        <!-- Decorative opening quote mark -->
        <span
          class="absolute top-0 left-2.5 leading-none select-none pointer-events-none"
          style="
            font-size: 56px;
            font-family: Georgia, 'Times New Roman', serif;
            color: hsl(var(--accent) / 0.22);
            line-height: 1;
          "
          aria-hidden="true"
        >&ldquo;</span>

        <p
          class="line-clamp-5 text-left"
          style="
            font-size: 12px;
            line-height: 1.6;
            font-family: Georgia, 'Times New Roman', serif;
            font-style: italic;
            color: hsl(var(--foreground));
          "
        >
          {{ memory.note }}
        </p>
      </div>

      <!-- Placeholder -->
      <div
        v-else
        class="w-full h-full flex items-center justify-center bg-secondary"
      >
        <svg
          class="w-8 h-8 text-muted-foreground/30"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
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
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
        "
      >
        <span
          class="text-[9px] font-bold text-white/90 tracking-[.18em] uppercase leading-none drop-shadow-sm truncate max-w-[120px]"
          >✦ {{ memory.milestone_label }}</span
        >
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
          style="
            background: linear-gradient(
              to top,
              rgba(0, 0, 0, 0.45) 0%,
              transparent 100%
            );
          "
          @click.stop
        >
          <!-- Existing reactions -->
          <button
            v-for="(group, emoji) in reactionGroups"
            :key="emoji"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-all duration-150"
            :class="
              group.mine
                ? 'bg-white/30 text-white font-semibold'
                : 'bg-white/15 text-white/90 hover:bg-white/25'
            "
            @click.stop="toggleReaction(emoji as string)"
          >
            <span>{{ emoji }}</span>
            <span class="text-[10px]">{{ group.count }}</span>
          </button>

          <!-- Picker trigger -->
          <div class="relative ml-auto">
            <button
              class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white/80 text-[14px] hover:bg-white/30 transition-colors"
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
      </Transition>
    </div>

    <!-- Caption -->
    <div class="pt-3 px-1 text-center">
      <!-- Caption text: always 2 lines tall so cards stay the same height -->
      <p
        class="text-[13px] leading-[1.35] line-clamp-2 break-words"
        :class="
          captionText ? 'text-foreground' : 'text-muted-foreground/40 italic'
        "
        style="min-height: 2em"
      >
        {{ captionText || t('card.noNote') }}
      </p>

      <!-- Date · Author (former member name shown greyed out) -->
      <p class="text-[11px] mt-[5px]">
        <span class="text-muted-foreground">{{ formattedDate }}</span>
        <template v-if="authorName">
          <span class="text-muted-foreground"> · </span>
          <span :class="isFormerMember ? 'text-muted-foreground/40' : 'text-muted-foreground'">{{ authorName }}</span>
        </template>
      </p>

      <!-- Child age pills -->
      <div v-if="childAges.length" class="flex flex-wrap justify-center gap-[3px] mt-[6px]">
        <span
          v-for="child in childAges"
          :key="child.name"
          class="inline-flex items-center gap-[3px] px-[6px] py-[2px] rounded-full text-[9px] leading-none font-medium"
          style="background: hsl(var(--accent) / 0.14); color: hsl(var(--accent));"
        >
          <span style="font-size:8px;flex-shrink:0;line-height:1">👶</span>
          <span>{{ child.name }}</span>
          <template v-if="child.age">
            <span style="opacity:0.5">·</span>
            <span style="opacity:0.85">{{ child.age }}</span>
          </template>
        </span>
      </div>

      <!-- Tagged member row: "with [avatars]" -->
      <div v-if="taggedMembers.length" class="flex items-center justify-center gap-[5px] mt-[5px]">
        <span class="text-[9px] leading-none" style="color: hsl(var(--muted-foreground) / 0.55); letter-spacing: .04em;">with</span>
        <div class="flex items-center">
          <div
            v-for="(mm, i) in taggedMembersVisible"
            :key="mm.user_id"
            class="w-[18px] h-[18px] rounded-full overflow-hidden bg-secondary border-[1.5px] border-card flex items-center justify-center text-[7px] font-bold text-foreground flex-shrink-0"
            :style="{ marginLeft: i === 0 ? '0' : '-5px', zIndex: taggedMembersVisible.length - i }"
            :title="mm.user?.first_name ?? ''"
          >
            <img v-if="mm.user?.avatar_url" :src="mm.user.avatar_url" class="w-full h-full object-cover" />
            <span v-else>{{ ((mm.user?.first_name?.[0] ?? '') + (mm.user?.last_name?.[0] ?? '')).toUpperCase() || '?' }}</span>
          </div>
          <span v-if="taggedMembersOverflow > 0" class="text-[9px] text-muted-foreground ml-1">+{{ taggedMembersOverflow }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Memory } from "~/composables/useTimeline";
import { computeBabyAge } from "~/composables/useBabyAge";
const { t, locale } = useI18n()

const props = defineProps<{
  memory: Memory;
  index: number;
  wide?: boolean;
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
const imgLoaded = ref(false);
const videoLoaded = ref(false);
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null);

// Reset load state when the media source changes (e.g. switching circles)
watch(firstMedia, () => {
  imgLoaded.value = false;
  videoLoaded.value = false;
});
const memory = computed(() => props.memory);

const captionText = computed(() => memory.value.note ?? "");

const formattedDate = computed(() => {
  return new Date(props.memory.memory_date).toLocaleDateString(locale.value, {
    month: "short",
    day: "numeric",
  });
});

const childAges = computed(() =>
  (props.memory.memory_children ?? [])
    .map((mc) => ({ name: mc.childprofile.name, age: computeBabyAge(mc.childprofile.date_of_birth, props.memory.memory_date) }))
);

const MAX_AVATARS = 4;
const taggedMembers = computed(() => props.memory.memory_members ?? []);
const taggedMembersVisible = computed(() => taggedMembers.value.slice(0, MAX_AVATARS));
const taggedMembersOverflow = computed(() => Math.max(0, taggedMembers.value.length - MAX_AVATARS));

// owner_user_id is null for detached (former member) memories
const isFormerMember = computed(() => props.memory.owner_user_id === null);

const authorName = computed(() => {
  if (props.memory.user?.first_name) return props.memory.user.first_name;
  if (isFormerMember.value && props.memory.former_owner_name) return props.memory.former_owner_name;
  return null;
});

// ── Reactions ──────────────────────────────────────────────
const supabaseClient = useSupabaseClient();
const currentUserId = ref<string | null>(null);

// Resolve user ID from session (reactive ref can be null on initial render)
supabaseClient.auth.getSession().then(({ data }) => {
  currentUserId.value = data.session?.user?.id ?? null;
});

// Local reactive copy so optimistic updates feel instant
const localReactions = ref([...props.memory.memoryreaction]);

watch(
  () => props.memory.memoryreaction,
  (r) => {
    localReactions.value = [...r];
  },
);

// Group by emoji: { '❤️': { count: 3, mine: true }, ... }
const reactionGroups = computed(() => {
  const groups: Record<string, { count: number; mine: boolean }> = {};
  for (const r of localReactions.value) {
    if (!r.emoji) continue;
    const key = r.emoji;
    if (!groups[key]) groups[key] = { count: 0, mine: false };
    const g = groups[key]!;
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

  // Optimistic update
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
    // Roll back optimistic update on error
    localReactions.value = [...props.memory.memoryreaction];
  }
}

// Close picker when hovering away from the card
watch(isHovered, (hovered) => {
  if (!hovered) pickerOpen.value = false;
});
</script>

<style scoped>
.polaroid-card {
  transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
