<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header
      class="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border"
    >
      <div class="max-w-[1280px] mx-auto px-5 py-3.5 flex items-center gap-3">
        <!-- Circle name / member count -->
        <div class="flex-1 min-w-0">
          <p
            class="text-[9px] font-bold tracking-[0.18em] text-accent uppercase leading-none mb-1.5 select-none"
          >
            Our Story
          </p>
          <div class="flex items-center gap-1.5 min-w-0">
            <!-- Circle name — clickable when user has multiple circles -->
            <button
              class="text-sm font-semibold text-foreground leading-none truncate flex items-center gap-1 hover:opacity-70 transition-opacity"
              @click="circleSwitcherOpen = true"
            >
              {{ circle?.name ?? "…" }}
              <svg
                class="w-3 h-3 text-muted-foreground flex-shrink-0"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <!-- Circle settings shortcut (owner only) -->
            <NuxtLink
              v-if="circle?.role === 'owner'"
              to="/circle-settings"
              class="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors rounded flex-shrink-0"
              :title="t('nav.circleSettings')"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </NuxtLink>
            <template v-if="circle?.memberCount">
              <span class="text-border text-xs leading-none flex-shrink-0"
                >/</span
              >
              <NuxtLink
                to="/members"
                class="group inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors leading-none flex-shrink-0 whitespace-nowrap"
              >
                {{ t('nav.members', circle.memberCount) }}
                <svg
                  class="w-2.5 h-2.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </NuxtLink>
            </template>
          </div>
        </div>

        <!-- Year pill -->
        <button
          v-if="currentYear"
          class="flex-shrink-0 flex items-center gap-1 h-7 px-3 rounded-full border border-border text-[11px] font-semibold text-foreground hover:bg-secondary transition-colors"
          @click="openJump"
        >
          {{ currentYear }}
          <svg
            class="w-3 h-3 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <!-- Add memory -->
        <button
          v-if="circleId"
          class="flex-shrink-0 flex items-center gap-1.5 h-7 pl-2.5 pr-3 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 active:scale-95 transition-all"
          @click="uploadRef?.open()"
        >
          <svg
            class="w-3.5 h-3.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>{{ t('nav.addMemory') }}</span>
        </button>

        <!-- Language toggle -->
        <LocalePicker class="flex-shrink-0" />

        <!-- Avatar + dropdown -->
        <div ref="menuRef" class="relative flex-shrink-0">
          <button
            class="w-8 h-8 rounded-full overflow-hidden ring-2 ring-border hover:ring-ring transition-all flex items-center justify-center bg-secondary"
            @click="menuOpen = !menuOpen"
          >
            <img
              v-if="userAvatarUrl"
              :src="userAvatarUrl"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-[10px] font-bold text-foreground">{{
              userInitials
            }}</span>
          </button>

          <!-- Dropdown -->
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="menuOpen"
              class="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-[14px] shadow-xl overflow-hidden origin-top-right"
            >
              <!-- User identity -->
              <div class="px-4 py-3 border-b border-border">
                <p class="text-sm font-semibold text-foreground truncate">
                  {{ userDisplayName }}
                </p>
                <p class="text-xs text-muted-foreground truncate mt-0.5">
                  {{ authUser?.email }}
                </p>
              </div>

              <!-- Actions -->
              <div class="py-1">
                <NuxtLink
                  to="/settings/account"
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors text-left"
                  @click="menuOpen = false"
                >
                  <svg
                    class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  {{ t('nav.profileSettings') }}
                </NuxtLink>

                <button
                  v-if="canInvite"
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors text-left"
                  @click="menuOpen = false; inviteOpen = true"
                >
                  <svg
                    class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  {{ t('nav.inviteMember') }}
                </button>

                <!-- Theme toggle -->
                <button
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors text-left"
                  @click="toggleTheme"
                >
                  <svg
                    v-if="isDark"
                    class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path
                      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                    />
                  </svg>
                  <svg
                    v-else
                    class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  {{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}
                </button>

                <div class="h-px bg-border mx-3" />
                <button
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors text-left"
                  @click="doLogout"
                >
                  <svg
                    class="w-3.5 h-3.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {{ t('nav.logOut') }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Feed -->
    <main class="max-w-[1280px] mx-auto px-5 py-6">
      <!-- Timeline -->
      <TimelinePolaroid
        ref="timelinePolaroidRef"
        :month-groups="monthGroups"
        :loading="loading"
        :has-next-page="!!nextCursor"
        :circle-type="circle?.circle_type ?? null"
        @load-more="fetchTimeline(nextCursor ?? undefined)"
        @year-change="onYearChange"
        @open-memory="onOpenMemory"
        @reaction-update="onReactionUpdate"
      />
    </main>

    <!-- Jump modal -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="jumpOpen"
        class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20"
      >
        <div
          class="absolute inset-0 bg-black/45 backdrop-blur-sm"
          @click="jumpOpen = false"
        />
        <div
          class="relative bg-card border border-border rounded-2xl p-5 w-full max-w-lg shadow-2xl"
          @click.stop
        >
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-foreground">{{ t('nav.jumpTo') }}</h2>
            <button
              class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground"
              @click="jumpOpen = false"
            >
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            v-for="info in yearInfos"
            :key="info.year"
            class="mb-4 last:mb-0"
          >
            <div
              class="grid gap-1.5"
              style="grid-template-columns: 44px repeat(12, 1fr)"
            >
              <button
                class="text-xs font-bold text-foreground hover:text-accent transition-colors text-left py-1"
                @click="jumpToYear(info.year)"
              >
                {{ info.year }}
              </button>
              <button
                v-for="m in 12"
                :key="m"
                class="h-7 rounded text-[10px] font-medium transition-colors"
                :class="
                  info.months.includes(m)
                    ? 'bg-secondary text-muted-foreground hover:bg-accent hover:text-background cursor-pointer'
                    : 'bg-transparent text-transparent cursor-default pointer-events-none'
                "
                :disabled="!info.months.includes(m)"
                @click="jumpToMonth(info.year, m)"
              >
                {{ info.months.includes(m) ? monthAbbr(m) : "" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Invite member dialog -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="inviteOpen"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="closeInvite"
        />

        <!-- Sheet -->
        <div
          class="relative w-full max-w-sm bg-card border border-border rounded-[20px] p-6 shadow-2xl"
        >
          <h2 class="font-display text-lg font-bold text-foreground mb-1">
            {{ t('nav.inviteSomeone') }}
          </h2>
          <p class="text-xs text-muted-foreground mb-5">
            {{ t('nav.inviteDesc', { circle: circle?.name ?? 'your circle' }) }}
          </p>

          <form @submit.prevent="sendInvite">
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="their@email.com"
              required
              :disabled="inviteSending"
              class="w-full bg-background border border-border rounded-[10px] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-3 disabled:opacity-50"
            />

            <p v-if="inviteError" class="text-xs text-destructive mb-3">
              {{ inviteError }}
            </p>
            <p
              v-if="inviteSentTo"
              class="text-xs text-green-600 dark:text-green-400 mb-3"
            >
              {{ t('nav.inviteSentTo', { email: inviteSentTo }) }}
            </p>

            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 py-3 rounded-[10px] text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
                @click="closeInvite"
              >
                {{ t('nav.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="inviteSending || !inviteEmail"
                class="flex-1 py-3 rounded-[10px] text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {{ inviteSending ? t('nav.sending') : t('nav.sendInvite') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Upload memory (headless) -->
    <UploadMemory
      v-if="circleId"
      ref="uploadRef"
      :circle-id="circleId"
      :circle-type="circle?.circle_type ?? null"
      :children="children"
      :members="members"
      hide-trigger
      @uploaded="onUploaded"
    />

    <!-- Circle switcher -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="circleSwitcherOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="circleSwitcherOpen = false" />
        <div class="relative w-full max-w-sm bg-card border border-border rounded-[20px] shadow-2xl overflow-hidden">

          <!-- Header -->
          <div class="px-5 pt-5 pb-3 border-b border-border">
            <p class="text-xs font-bold tracking-widest uppercase text-muted-foreground">{{ t('nav.yourCircles') }}</p>
          </div>

          <!-- Circle list -->
          <ul class="px-3 py-2">
            <li v-for="c in allCircles" :key="c.id">
              <button
                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left"
                :class="c.id === circleId ? 'bg-secondary' : 'hover:bg-secondary/60'"
                @click="switchCircle(c.id)"
              >
                <div class="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center flex-shrink-0 text-xs font-bold text-foreground">
                  {{ c.name?.[0]?.toUpperCase() ?? '?' }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">{{ c.name }}</p>
                  <p class="text-[11px] text-muted-foreground">{{ roleLabel(c.role) }}</p>
                </div>
                <svg v-if="c.id === circleId" class="w-4 h-4 text-foreground flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            </li>
          </ul>

          <!-- Create new circle -->
          <div class="px-3 pb-3 pt-1 border-t border-border mt-1">
            <button
              class="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary/60 transition-colors text-left"
              @click="startNewCircle"
            >
              <div class="w-8 h-8 rounded-lg border border-dashed border-border flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
              <p class="text-sm font-medium text-foreground">{{ t('nav.createNewCircle') }}</p>
            </button>
          </div>

        </div>
      </div>
    </Transition>

    <!-- Memory detail modal -->
    <MemoryModal
      :memories="memoriesFlat"
      :start-index="selectedMemoryIndex"
      :origin-rect="selectedRect"
      :tilt="selectedTilt"
      :children="children"
      :members="members"
      @close="selectedMemoryIndex = null"
      @update="onMemoryUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import type { Memory } from "~/composables/useTimeline";

// ── i18n ───────────────────────────────────────────────────
const { t, locale, setLocale } = useI18n()

// Locale-aware month abbreviation using Intl (auto-adapts to zh-CN)
function monthAbbr(month: number): string {
  return new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(new Date(2000, month - 1, 1))
}

// ── Memory modal ───────────────────────────────────────────
const selectedMemoryIndex = ref<number | null>(null);
const selectedRect = ref<DOMRect | null>(null);
const selectedTilt = ref(0);

function onOpenMemory({
  memory,
  tilt,
  rect,
}: {
  memory: Memory;
  tilt: number;
  rect: DOMRect;
}) {
  selectedMemoryIndex.value = memoriesFlat.value.findIndex(
    (m) => m.id === memory.id,
  );
  selectedRect.value = rect;
  selectedTilt.value = tilt;
}

function onMemoryUpdate(patch: Pick<Memory, "id"> & Partial<Memory>) {
  const i = memoriesFlat.value.findIndex((m) => m.id === patch.id);
  if (i !== -1)
    memoriesFlat.value[i] = { ...memoriesFlat.value[i], ...patch } as Memory;
}

function onReactionUpdate({
  memoryId,
  reactions,
}: {
  memoryId: string;
  reactions: any[];
}) {
  const i = memoriesFlat.value.findIndex((m) => m.id === memoryId);
  if (i !== -1)
    memoriesFlat.value[i] = {
      ...memoriesFlat.value[i],
      memoryreaction: reactions,
    } as Memory;
}

const supabase = useSupabaseClient();
const authUser = useSupabaseUser();
const router = useRouter();

// ── User identity ──────────────────────────────────────────
const { data: profile } = await useFetch<{
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  locale: string | null;
}>("/api/profile");

// Apply saved locale from DB profile
if (profile.value?.locale) {
  setLocale(profile.value.locale as 'en' | 'zh-CN')
}

const userAvatarUrl = computed(() => profile.value?.avatarUrl ?? null);

const userDisplayName = computed(() => {
  const parts = [profile.value?.firstName, profile.value?.lastName].filter(
    Boolean,
  );
  return parts.length
    ? parts.join(" ")
    : (authUser.value?.email?.split("@")[0] ?? "You");
});

const userInitials = computed(() => {
  const first = profile.value?.firstName?.[0] ?? "";
  const last = profile.value?.lastName?.[0] ?? "";
  return (
    (first + last).toUpperCase() ||
    userDisplayName.value.slice(0, 2).toUpperCase()
  );
});

// ── Dropdown ───────────────────────────────────────────────
const menuOpen = ref(false);
const menuRef = ref<HTMLElement>();
const uploadRef = ref<{ open: () => void; isOpen: ComputedRef<boolean> }>();
onClickOutside(menuRef, () => {
  menuOpen.value = false;
});

// ── Theme ──────────────────────────────────────────────────
const colorMode = useColorMode();
const prefersDark = usePreferredDark();
const isDark = computed(() =>
  colorMode.preference === "system"
    ? prefersDark.value
    : colorMode.preference === "dark",
);
function toggleTheme() {
  colorMode.preference = isDark.value ? "light" : "dark";
  menuOpen.value = false;
}

// ── Auth ───────────────────────────────────────────────────
async function doLogout() {
  const { clear } = useUserState();
  await supabase.auth.signOut();
  clear();
  router.replace("/login");
}

// ── Data ───────────────────────────────────────────────────
const route = useRoute();
const { data: circlesData } = await useFetch<{ circles: any[] }>(
  "/api/circles",
);
const allCircles = computed(() => circlesData.value?.circles ?? []);

// Active circle: prefer ?circle=<id> URL param, fallback to first
const circle = computed(() => {
  const paramId = route.query.circle as string | undefined;
  if (paramId) {
    const found = allCircles.value.find((c: any) => c.id === paramId);
    if (found) return found;
  }
  return allCircles.value[0] ?? null;
});
const circleId = computed<string | null>(() => circle.value?.id ?? null);

interface ChildProfile { id: string; name: string; date_of_birth: string }
interface CircleMember { userId: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }

const memoriesFlat = ref<Memory[]>([]);
const nextCursor = ref<string | null>(null);
const children = ref<ChildProfile[]>([]);
const members = ref<CircleMember[]>([]);
const loading = ref(false);


async function fetchTimeline(cursor?: string) {
  if (loading.value || !circleId.value) return;
  loading.value = true;
  try {
    const data = await $fetch<{
      memories: Memory[];
      nextCursor: string | null;
      children: ChildProfile[];
      members: CircleMember[];
    }>("/api/timeline", {
      query: { circleId: circleId.value, ...(cursor ? { cursor } : {}) },
    });
    memoriesFlat.value = cursor
      ? [...memoriesFlat.value, ...data.memories]
      : data.memories;
    nextCursor.value = data.nextCursor;
    if (!cursor) {
      children.value = data.children ?? [];
      members.value = data.members ?? [];
    }
  } catch (err) {
    console.error("[timeline] fetch error:", err);
  } finally {
    loading.value = false;
  }
}

function onUploaded() {
  memoriesFlat.value = [];
  nextCursor.value = null;
  fetchTimeline();
}

onMounted(() => fetchTimeline());

const { monthGroups, yearInfos } = useTimeline(memoriesFlat);

// ── Year badge ─────────────────────────────────────────────
const currentYear = ref<number | null>(null);
const timelinePolaroidRef = ref<{ scrollToYear: (y: number) => void }>();

function onYearChange(year: number) {
  currentYear.value = year;
}

watch(
  monthGroups,
  (groups) => {
    if (groups.length && !currentYear.value) {
      currentYear.value = groups[0]?.year ?? null;
    }
  },
  { immediate: true },
);

// ── Jump modal ─────────────────────────────────────────────
const jumpOpen = ref(false);

function openJump() {
  jumpOpen.value = true;
  menuOpen.value = false;
}

function jumpToYear(year: number) {
  jumpOpen.value = false;
  nextTick(() => timelinePolaroidRef.value?.scrollToYear(year));
}

function jumpToMonth(year: number, month: number) {
  jumpOpen.value = false;
  // Wait for the modal leave transition (100ms) to complete before scrolling
  setTimeout(() => {
    const el = document.getElementById(`month-${year}-${month}`);
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 120,
        behavior: "smooth",
      });
  }, 120);
}

// ── Circle switcher ────────────────────────────────────────
const circleSwitcherOpen = ref(false);

function roleLabel(role: string): string {
  if (role === "owner") return t("members.roleOwner");
  if (role === "admin") return t("members.roleAdmin");
  return t("members.roleMember");
}

function switchCircle(id: string) {
  circleSwitcherOpen.value = false;
  memoriesFlat.value = [];
  nextCursor.value = null;
  // Only put ?circle= in the URL when it's not the default first circle,
  // so single-circle users see a clean /timeline URL.
  const isDefault = allCircles.value[0]?.id === id;
  router.push({ query: isDefault ? {} : { circle: id } });
}

function startNewCircle() {
  circleSwitcherOpen.value = false;
  router.push("/onboarding");
}

// Reload timeline when the active circle changes
watch(circleId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    memoriesFlat.value = [];
    nextCursor.value = null;
    currentYear.value = null;
    fetchTimeline();
  }
});

// ── Invite ─────────────────────────────────────────────────
const canInvite = computed(() => {
  const role = circle.value?.role;
  return role === "owner" || role === "admin";
});

const inviteOpen = ref(false);
const inviteEmail = ref("");
const inviteSending = ref(false);
const inviteError = ref("");
const inviteSentTo = ref("");

function closeInvite() {
  inviteOpen.value = false;
  inviteEmail.value = "";
  inviteError.value = "";
  inviteSentTo.value = "";
}

async function sendInvite() {
  if (!circleId.value || !inviteEmail.value) return;
  inviteSending.value = true;
  inviteError.value = "";
  inviteSentTo.value = "";
  try {
    await $fetch("/api/circles/invite", {
      method: "POST",
      body: { circleId: circleId.value, email: inviteEmail.value },
    });
    inviteSentTo.value = inviteEmail.value;
    inviteEmail.value = "";
  } catch (err: any) {
    const msg = err?.data?.message ?? "";
    if (msg.includes("already been sent"))
      inviteError.value = t('nav.inviteAlreadySent')
    else if (msg.includes("Max 10"))
      inviteError.value = t('nav.inviteMaxPending')
    else inviteError.value = t('nav.inviteFailed')
  } finally {
    inviteSending.value = false;
  }
}
</script>
