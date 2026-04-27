<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
      @click="$emit('close')"
    />
  </Transition>

  <Transition name="slide-up">
    <div
      v-if="open"
      class="fixed inset-x-0 bottom-0 z-[60] bg-card border-t border-border rounded-t-[24px] shadow-2xl max-h-[90vh] flex flex-col"
    >
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1 flex-shrink-0">
        <div class="w-10 h-1 rounded-full bg-border" />
      </div>

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <h2 class="text-base font-bold text-foreground">
          {{ t("viewerLink.createLink") }}
        </h2>
        <button
          type="button"
          @click="$emit('close')"
          :aria-label="t('viewerLink.close')"
          class="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mode tabs: Full | Custom -->
      <div
        class="flex gap-1 mx-5 mb-3 p-1 bg-secondary rounded-[12px] flex-shrink-0"
      >
        <button
          v-for="mode in mainModes"
          :key="mode.value"
          type="button"
          @click="selectedMode = mode.value"
          class="flex-1 h-8 rounded-[10px] text-xs font-semibold transition-all"
          :class="
            selectedMode === mode.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          "
        >
          {{ mode.label }}
        </button>
      </div>

      <!-- Selection status bar (Custom mode only, fixed above scroll) -->
      <div
        v-if="selectedMode === 'custom'"
        class="flex-shrink-0 flex items-center justify-between px-5 pb-2.5 border-b border-border/40"
      >
        <div class="flex items-center gap-3 min-h-[20px]">
          <span
            v-if="selectedMemoryIds.size > 0"
            class="text-sm font-semibold text-foreground"
          >
            {{
              t("viewerLink.selectedCount", { count: selectedMemoryIds.size })
            }}
          </span>
          <span v-else class="text-xs text-muted-foreground">{{
            t("viewerLink.tapToSelect")
          }}</span>
          <button
            v-if="selectedMemoryIds.size > 0"
            type="button"
            @click="selectedMemoryIds = new Set()"
            class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {{ t("viewerLink.clearAll") }}
          </button>
        </div>
        <div
          v-if="yearsLoading || isAnyYearLoading"
          class="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <div
            class="w-3 h-3 border-[1.5px] border-muted-foreground border-t-transparent rounded-full animate-spin"
          />
          {{ t("viewerLink.loading") }}
        </div>
      </div>

      <!-- Scrollable body -->
      <div class="scroll-styled flex-1 overflow-y-auto overscroll-contain pb-4">
        <!-- FULL mode -->
        <div v-if="selectedMode === 'full'" class="px-5 py-4">
          <p class="text-sm text-muted-foreground leading-relaxed">
            {{ t("viewerLink.fullModeDescription") }}
          </p>
        </div>

        <!-- CUSTOM mode: timeline-style grouped picker -->
        <template v-else>
          <div v-if="yearsLoading" class="flex justify-center py-10">
            <div
              class="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"
            />
          </div>

          <div v-else>
            <div v-for="group in yearGroups" :key="group.year">
              <!-- Year header (sticky) -->
              <div
                class="sticky top-0 bg-card z-10 flex items-center justify-between px-5 pt-3 pb-2 border-b border-border/20 cursor-pointer select-none hover:bg-secondary/60 transition-colors"
                @click="toggleYearCollapsed(group.year)"
              >
                <div class="flex items-center gap-2.5">
                  <!-- Year selection checkbox (stop propagation so click selects, not collapses) -->
                  <button
                    type="button"
                    :disabled="!group.loaded"
                    @click.stop="group.loaded && toggleYear(group.year)"
                    class="w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                    :class="yearCheckboxClass(group.year)"
                  >
                    <svg
                      v-if="isYearFullySelected(group.year)"
                      class="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    <div
                      v-else-if="isYearPartiallySelected(group.year)"
                      class="w-2 h-px bg-primary rounded-full"
                    />
                  </button>
                  <span class="text-sm font-bold text-foreground">{{
                    group.year
                  }}</span>
                  <span
                    v-if="group.loaded && group.memories.length > 0"
                    class="text-[11px] text-muted-foreground"
                  >
                    {{
                      t("viewerLink.memoriesCount", {
                        count: group.memories.length,
                      })
                    }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <div
                    v-if="group.loading"
                    class="w-3.5 h-3.5 border-[1.5px] border-muted-foreground border-t-transparent rounded-full animate-spin"
                  />
                  <!-- Collapse chevron -->
                  <svg
                    class="w-4 h-4 text-muted-foreground transition-transform duration-200"
                    :class="
                      collapsedYears.has(group.year) ? '-rotate-90' : 'rotate-0'
                    "
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <!-- Year content (collapsible) -->
              <div v-if="!collapsedYears.has(group.year)">
                <!-- Month groups -->
                <div v-if="group.loaded" class="px-5">
                  <div
                    v-for="mg in getMonthGroups(group)"
                    :key="mg.month"
                    class="mt-4 mb-2"
                  >
                    <!-- Month header (clickable to collapse) -->
                    <div
                      class="flex items-center justify-between mb-2 px-2 -mx-2 py-1.5 rounded-lg cursor-pointer select-none bg-secondary/40 hover:bg-secondary/70 transition-colors border border-border/15"
                      @click="toggleMonthCollapsed(group.year, mg.month)"
                    >
                      <div class="flex items-center gap-1.5">
                        <!-- Month selection checkbox -->
                        <button
                          type="button"
                          @click.stop="toggleMonth(group.year, mg.month)"
                          class="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-all"
                          :class="monthCheckboxClass(group.year, mg.month)"
                        >
                          <svg
                            v-if="
                              isMonthSelected(group.year, mg.month) === 'full'
                            "
                            class="w-2.5 h-2.5 text-white"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            viewBox="0 0 24 24"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                          <div
                            v-else-if="
                              isMonthSelected(group.year, mg.month) ===
                              'partial'
                            "
                            class="w-1.5 h-px bg-primary rounded-full"
                          />
                        </button>
                        <span
                          class="text-xs font-semibold text-foreground/70"
                          >{{ monthName(mg.month) }}</span
                        >
                        <span
                          class="text-[10px] text-muted-foreground tabular-nums"
                          >{{ t('viewerLink.memoriesCount', { count: mg.memories.length }) }}</span
                        >
                      </div>
                      <!-- Month collapse chevron -->
                      <svg
                        class="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200"
                        :class="
                          collapsedMonths.has(`${group.year}-${mg.month}`)
                            ? '-rotate-90'
                            : 'rotate-0'
                        "
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    <!-- Month grid (collapsible) -->
                    <div
                      v-if="!collapsedMonths.has(`${group.year}-${mg.month}`)"
                      class="grid grid-cols-5 gap-1"
                    >
                      <button
                        v-for="memory in mg.memories"
                        :key="memory.id"
                        type="button"
                        @click="toggleMemory(memory.id)"
                        class="relative aspect-square rounded-[6px] overflow-hidden bg-secondary cursor-pointer transition-transform active:scale-95"
                        :class="
                          selectedMemoryIds.has(memory.id)
                            ? 'ring-2 ring-primary ring-offset-1 ring-offset-card'
                            : ''
                        "
                      >
                        <!-- Image -->
                        <img
                          v-if="
                            memory.mediaType === 'image' &&
                            (memory.thumbnailUrl || memory.signedUrl)
                          "
                          :src="
                            memory.thumbnailUrl || memory.signedUrl || undefined
                          "
                          :alt="memory.memory_date"
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />

                        <!-- Video -->
                        <template v-else-if="memory.mediaType === 'video'">
                          <img
                            v-if="memory.thumbnailUrl"
                            :src="memory.thumbnailUrl"
                            class="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <video
                            v-else-if="memory.signedUrl"
                            :src="memory.signedUrl"
                            preload="metadata"
                            muted
                            playsinline
                            class="w-full h-full object-cover pointer-events-none"
                          />
                          <div v-else class="w-full h-full bg-muted" />
                          <div
                            class="absolute inset-0 flex items-center justify-center bg-black/20"
                          >
                            <div
                              class="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center"
                            >
                              <svg
                                class="w-2.5 h-2.5 text-white ml-px"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        </template>

                        <!-- Quick note -->
                        <div
                          v-else-if="memory.note"
                          class="w-full h-full flex flex-col items-center justify-center p-1 bg-amber-50 dark:bg-amber-950/30"
                        >
                          <svg
                            class="w-2.5 h-2.5 text-amber-500 mb-0.5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          <p
                            class="text-[6px] leading-tight text-amber-900 dark:text-amber-100 text-center line-clamp-3 italic"
                          >
                            {{ memory.note }}
                          </p>
                        </div>

                        <!-- Fallback -->
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center text-muted-foreground/30"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5z"
                            />
                          </svg>
                        </div>

                        <!-- Date overlay (images/videos) -->
                        <div
                          v-if="memory.mediaType !== null"
                          class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent pt-4 pb-0.5 px-0.5"
                        >
                          <p
                            class="text-[7px] font-medium text-white text-center leading-tight truncate"
                          >
                            {{ formatTileDate(memory.memory_date) }}
                          </p>
                        </div>
                        <!-- Date label (notes) -->
                        <div
                          v-else-if="memory.note"
                          class="absolute bottom-0.5 inset-x-0 flex justify-center"
                        >
                          <p
                            class="text-[7px] text-amber-600 dark:text-amber-400 font-medium leading-tight"
                          >
                            {{ formatTileDate(memory.memory_date) }}
                          </p>
                        </div>

                        <!-- Selected checkmark -->
                        <div
                          v-if="selectedMemoryIds.has(memory.id)"
                          class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-sm"
                        >
                          <svg
                            class="w-2.5 h-2.5 text-primary-foreground"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            viewBox="0 0 24 24"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Truncation warning with load-all button -->
                <div
                  v-if="group.loaded && group.truncated"
                  class="mx-5 mt-3 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40"
                >
                  <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div class="flex-1">
                    <p class="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                      {{ t('viewerLink.truncatedWarning', { count: group.memories.length }) }}
                    </p>
                    <button
                      type="button"
                      :disabled="group.loading"
                      @click="loadYearComplete(group.year)"
                      class="mt-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 transition-colors disabled:opacity-50"
                    >
                      {{ group.loading ? t('viewerLink.loading') : t('viewerLink.loadAll') }}
                    </button>
                  </div>
                </div>

                <!-- Year loading skeleton -->
                <div
                  v-else-if="group.loading"
                  class="px-5 mt-3 mb-4 grid grid-cols-5 gap-1"
                >
                  <div
                    v-for="i in 15"
                    :key="i"
                    class="aspect-square rounded-[6px] bg-secondary animate-pulse"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Label input -->
        <div class="px-5 mt-4 mb-1">
          <input
            v-model="label"
            type="text"
            :placeholder="t('viewerLink.labelPlaceholder')"
            class="w-full h-10 px-3 rounded-[10px] bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <!-- Create button -->
      <div class="flex-shrink-0 px-5 pb-8 pt-2 border-t border-border">
        <p v-if="createError" class="text-xs text-destructive mb-2">
          {{ createError }}
        </p>
        <button
          type="button"
          @click="handleCreate"
          :disabled="!isValid || creating"
          class="w-full bg-primary text-primary-foreground rounded-[12px] py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ creating ? t("viewerLink.loading") : t("viewerLink.createLink") }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t, locale } = useI18n();

interface MemoryItem {
  id: string;
  memory_date: string;
  signedUrl: string | null;
  thumbnailUrl: string | null;
  mediaType: "image" | "video" | null;
  note: string | null;
}

interface YearGroup {
  year: number;
  memories: MemoryItem[];
  loading: boolean;
  loaded: boolean;
  truncated: boolean;
}

interface MonthGroup {
  month: number;
  memories: MemoryItem[];
}

const props = defineProps<{ open: boolean; circleId: string }>();
const emit = defineEmits<{ close: []; created: [] }>();

// --- State ---
const selectedMode = ref<"full" | "custom">("full");
const selectedMemoryIds = ref(new Set<string>());
const label = ref("");
const creating = ref(false);
const createError = ref<string | null>(null);
const yearsLoading = ref(false);
const yearGroups = ref<YearGroup[]>([]);
const collapsedYears = ref(new Set<number>());
const collapsedMonths = ref(new Set<string>());

// --- Computed ---
const mainModes = computed(() => [
  { value: "full" as const, label: t("viewerLink.modeFull") },
  { value: "custom" as const, label: t("viewerLink.modeCustom") },
]);

const isAnyYearLoading = computed(() =>
  yearGroups.value.some((g) => g.loading),
);

const isValid = computed(() => {
  if (selectedMode.value === "full") return true;
  return selectedMemoryIds.value.size > 0;
});

// O(N) single pass — recomputed only when selectedMemoryIds or yearGroups change
const selectionStats = computed(() => {
  const byYear = new Map<number, { sel: number; total: number }>();
  const byYM = new Map<string, { sel: number; total: number }>();
  for (const g of yearGroups.value) {
    if (!g.loaded) continue;
    let ySel = 0;
    for (const m of g.memories) {
      const mo = getMonth(m.memory_date);
      const k = `${g.year}-${mo}`;
      if (!byYM.has(k)) byYM.set(k, { sel: 0, total: 0 });
      const ms = byYM.get(k)!;
      ms.total++;
      if (selectedMemoryIds.value.has(m.id)) {
        ms.sel++;
        ySel++;
      }
    }
    byYear.set(g.year, { sel: ySel, total: g.memories.length });
  }
  return { byYear, byYM };
});

// --- Robust date helpers ---
// memory_date can be "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss..." — always extract YYYY-MM-DD
function getMonth(dateStr: string): number {
  return parseInt(dateStr.substring(5, 7), 10);
}

function getMonthGroups(group: YearGroup): MonthGroup[] {
  const byMonth = new Map<number, MemoryItem[]>();
  for (const m of group.memories) {
    const month = getMonth(m.memory_date);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(m);
  }
  return [...byMonth.entries()]
    .map(([month, memories]) => ({ month, memories }))
    .sort((a, b) => b.month - a.month);
}

function monthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString(locale.value, {
    month: "long",
  });
}

function formatTileDate(dateStr: string): string {
  const d = dateStr.substring(0, 10);
  return new Date(d + "T12:00:00").toLocaleDateString(locale.value, {
    month: "short",
    day: "numeric",
  });
}

// --- Selection state ---
function isYearFullySelected(year: number): boolean {
  const s = selectionStats.value.byYear.get(year);
  return s !== undefined && s.total > 0 && s.sel === s.total;
}

function isYearPartiallySelected(year: number): boolean {
  const s = selectionStats.value.byYear.get(year);
  return s !== undefined && s.sel > 0 && s.sel < s.total;
}

function isMonthSelected(
  year: number,
  month: number,
): "full" | "partial" | "none" {
  const s = selectionStats.value.byYM.get(`${year}-${month}`);
  if (!s || s.sel === 0) return "none";
  return s.sel === s.total ? "full" : "partial";
}

function yearCheckboxClass(year: number): string {
  if (isYearFullySelected(year)) return "bg-primary border-primary";
  if (isYearPartiallySelected(year)) return "border-primary bg-primary/10";
  return "border-border";
}

function monthCheckboxClass(year: number, month: number): string {
  const state = isMonthSelected(year, month);
  if (state === "full") return "bg-primary border-primary";
  if (state === "partial") return "border-primary bg-primary/10";
  return "border-border/60";
}

// --- Toggle actions ---
function toggleYear(year: number) {
  const group = yearGroups.value.find((g) => g.year === year);
  if (!group?.loaded) return;
  const s = new Set(selectedMemoryIds.value);
  if (isYearFullySelected(year)) {
    group.memories.forEach((m) => s.delete(m.id));
  } else {
    group.memories.forEach((m) => s.add(m.id));
  }
  selectedMemoryIds.value = s;
}

function toggleMonth(year: number, month: number) {
  const group = yearGroups.value.find((g) => g.year === year);
  if (!group?.loaded) return;
  const monthMems = group.memories.filter(
    (m) => getMonth(m.memory_date) === month,
  );
  const state = isMonthSelected(year, month);
  const s = new Set(selectedMemoryIds.value);
  if (state === "full") {
    monthMems.forEach((m) => s.delete(m.id));
  } else {
    monthMems.forEach((m) => s.add(m.id));
  }
  selectedMemoryIds.value = s;
}

function toggleMemory(id: string) {
  const s = new Set(selectedMemoryIds.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  selectedMemoryIds.value = s;
}

function toggleYearCollapsed(year: number) {
  const s = new Set(collapsedYears.value);
  if (s.has(year)) s.delete(year);
  else s.add(year);
  collapsedYears.value = s;
}

function autoCollapseMonths(group: YearGroup) {
  const months = getMonthGroups(group);
  if (months.length <= 1) return;
  // Collapse all except the most recent month (first in descending order)
  const s = new Set(collapsedMonths.value);
  for (let i = 1; i < months.length; i++) {
    s.add(`${group.year}-${months[i]!.month}`);
  }
  collapsedMonths.value = s;
}

function toggleMonthCollapsed(year: number, month: number) {
  const key = `${year}-${month}`;
  const s = new Set(collapsedMonths.value);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  collapsedMonths.value = s;
}

// --- API ---
function mapMemory(m: any): MemoryItem {
  const media = m.memorymedia?.[0] ?? null;
  return {
    id: m.id,
    memory_date: m.memory_date,
    signedUrl: media?.url ?? null,
    thumbnailUrl: media?.thumbnailUrl ?? null,
    mediaType: media
      ? media.media_type === "video"
        ? "video"
        : "image"
      : null,
    note: m.note ?? null,
  };
}

async function loadYears() {
  yearsLoading.value = true;
  try {
    const data = await $fetch<{ years: number[] }>("/api/timeline/years", {
      query: { circleId: props.circleId },
    });
    yearGroups.value = data.years.map((year) => ({
      year,
      memories: [],
      loading: false,
      loaded: false,
      truncated: false,
    }));
  } catch {
    yearGroups.value = [];
  } finally {
    yearsLoading.value = false;
  }
}

async function loadYearMemories(year: number) {
  const group = yearGroups.value.find((g) => g.year === year);
  if (!group || group.loaded || group.loading) return;
  group.loading = true;
  try {
    const data = await $fetch<{ memories: any[]; truncated?: boolean }>(
      "/api/timeline",
      { query: { circleId: props.circleId, year, limit: 1000 } },
    );
    group.memories = (data.memories ?? []).map(mapMemory);
    group.truncated = data.truncated === true;
    group.loaded = true;
    // Auto-collapse all months except the most recent one
    autoCollapseMonths(group);
  } catch {
    group.memories = [];
    group.loaded = true;
  } finally {
    group.loading = false;
  }
}

async function loadAllMemories() {
  await Promise.all(yearGroups.value.map((g) => loadYearMemories(g.year)));
}

// Load a single month completely using cursor-based pagination (no limit)
async function loadMonthComplete(
  year: number,
  month: number,
): Promise<MemoryItem[]> {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const all: MemoryItem[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  while (hasMore) {
    const query: Record<string, string> = {
      circleId: props.circleId,
      yearMonth: ym,
    };
    if (cursor) query.cursor = cursor;
    const res: { memories: any[]; nextCursor: string | null } =
      await $fetch("/api/timeline", { query });
    all.push(...(res.memories ?? []).map(mapMemory));
    cursor = res.nextCursor ?? null;
    hasMore = cursor !== null;
  }
  return all;
}

// Re-fetch a truncated year month-by-month to get ALL memories
async function loadYearComplete(year: number) {
  const group = yearGroups.value.find((g) => g.year === year);
  if (!group) return;
  group.loading = true;
  try {
    // Load all 12 months in parallel; empty months return [] immediately
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => loadMonthComplete(year, i + 1)),
    );
    group.memories = results.flat();
    group.truncated = false;
    group.loaded = true;
    autoCollapseMonths(group);
  } catch {
    // Keep existing data on failure
  } finally {
    group.loading = false;
  }
}

// --- Body scroll lock ---
watch(
  () => props.open,
  (val) => {
    document.body.style.overflow = val ? "hidden" : "";
  },
);
onUnmounted(() => {
  document.body.style.overflow = "";
});

// --- Watchers ---
watch(
  () => props.open,
  async (val) => {
    if (!val) {
      selectedMode.value = "full";
      selectedMemoryIds.value = new Set();
      label.value = "";
      createError.value = null;
      yearGroups.value = [];
      yearsLoading.value = false;
      collapsedYears.value = new Set();
      collapsedMonths.value = new Set();
      return;
    }
    await loadYears();
    if (selectedMode.value === "custom") await loadAllMemories();
  },
);

watch(selectedMode, async (val) => {
  if (val === "custom" && yearGroups.value.length > 0) {
    await loadAllMemories();
  }
});

// --- Submit ---
async function handleCreate() {
  if (!isValid.value || creating.value) return;
  creating.value = true;
  createError.value = null;
  try {
    await $fetch(`/api/circles/${props.circleId}/viewer-links`, {
      method: "POST",
      body: {
        mode: selectedMode.value === "full" ? "full" : "selection",
        label: label.value || undefined,
        memoryIds:
          selectedMode.value === "custom"
            ? [...selectedMemoryIds.value]
            : undefined,
      },
    });
    emit("created");
    emit("close");
  } catch {
    createError.value = t("viewerLink.createErrorGeneric");
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
