<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime"
      multiple
      class="hidden"
      @change="onFilesSelected"
    />

    <button
      v-if="!hideTrigger"
      class="flex items-center gap-2 bg-primary text-primary-foreground rounded-[12px] px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
      @click="fileInput?.click()"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {{ t("nav.addMemory") }}
    </button>

    <Teleport to="body">
      <div
        v-if="items.length > 0"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50"
          @click="!isUploading && cancel()"
        />

        <!-- Sheet -->
        <div
          class="relative bg-background w-full sm:max-w-lg sm:rounded-[20px] rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh]"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0"
          >
            <div>
              <h2 class="text-sm font-semibold text-foreground">
                {{
                  items.length === 1
                    ? t("upload.addMemory")
                    : t("upload.addMemories", items.length)
                }}
              </h2>
              <button
                class="text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                :disabled="isUploading"
                @click="fileInput?.click()"
              >
                {{ t("upload.addMore") }}
              </button>
            </div>
            <button
              class="w-7 h-7 rounded-full bg-secondary hover:bg-border transition-colors flex items-center justify-center disabled:opacity-40"
              :disabled="isUploading"
              @click="cancel"
            >
              <svg
                class="w-3.5 h-3.5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Batch people picker (members + children combined) -->
          <div
            v-if="
              items.length > 1 &&
              (props.members?.length || props.children?.length)
            "
            class="px-5 py-2.5 border-b border-border flex-shrink-0"
          >
            <div class="flex items-center justify-between mb-1.5">
              <p
                class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em]"
              >
                {{ t("upload.tagPeople") }}
              </p>
              <button
                type="button"
                class="text-[10px] font-medium text-accent hover:opacity-70 transition-opacity"
                @click="applyGroupPeople"
              >
                {{ t("upload.applyToAll") }}
              </button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <!-- Member chips -->
              <button
                v-for="member in props.members"
                :key="member.userId"
                type="button"
                class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border"
                :class="
                  groupMemberIds.includes(member.userId)
                    ? 'bg-accent/15 border-accent/40 text-foreground'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                "
                @click="toggleGroupMember(member.userId)"
              >
                <span
                  class="w-4 h-4 rounded-full overflow-hidden bg-border flex-shrink-0 flex items-center justify-center text-[7px] font-bold"
                >
                  <img
                    v-if="member.avatarUrl"
                    :src="member.avatarUrl"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ memberInitials(member) }}</span>
                </span>
                {{ member.firstName ?? member.userId.slice(0, 6) }}
              </button>
              <!-- Child chips -->
              <button
                v-for="child in props.children"
                :key="child.id"
                type="button"
                class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border"
                :class="
                  groupChildIds.includes(child.id)
                    ? 'bg-accent/15 border-accent/40 text-foreground'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                "
                @click="toggleGroupChild(child.id)"
              >
                {{ child.name }}
              </button>
            </div>
          </div>

          <!-- Group date (batch only) -->
          <div
            v-if="items.length > 1"
            class="px-5 py-3 border-b border-border flex-shrink-0 flex items-center gap-2"
          >
            <input
              v-model="groupDate"
              type="date"
              class="flex-1 bg-card border border-border rounded-[10px] px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              class="flex-shrink-0 bg-secondary hover:bg-border transition-colors text-foreground text-xs font-medium px-3 py-1.5 rounded-[10px]"
              @click="applyGroupDate"
            >
              {{ t("upload.applyToAll") }}
            </button>
          </div>

          <!-- Scrollable content -->
          <div class="overflow-y-auto flex-1 px-5 py-4">
            <!-- Single item -->
            <template v-if="items.length === 1">
              <div
                class="w-full rounded-[14px] overflow-hidden bg-secondary mb-4 relative"
                style="aspect-ratio: 4/5"
              >
                <img
                  v-if="!firstItem.isVideo"
                  :src="firstItem.previewUrl"
                  class="w-full h-full object-cover"
                />
                <video
                  v-else
                  :src="firstItem.previewUrl"
                  class="w-full h-full object-cover"
                  muted
                  playsinline
                />
                <div
                  v-if="firstItem.isVideo"
                  class="absolute bottom-2 left-2 bg-black/50 rounded px-1.5 py-0.5"
                >
                  <span
                    class="text-white text-[9px] font-semibold tracking-wide"
                    >VIDEO</span
                  >
                </div>
                <div
                  v-if="firstItem.uploading"
                  class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2"
                >
                  <p class="text-white text-lg font-bold">
                    {{ firstItem.progress }}%
                  </p>
                  <div
                    class="w-24 bg-white/30 rounded-full h-1 overflow-hidden"
                  >
                    <div
                      class="bg-white h-1 rounded-full transition-all duration-150"
                      :style="{ width: `${firstItem.progress}%` }"
                    />
                  </div>
                </div>
                <div
                  v-if="firstItem.done"
                  class="absolute inset-0 bg-black/30 flex items-center justify-center"
                >
                  <div
                    class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center"
                  >
                    <svg
                      class="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- Date + people picker: immediately below the image so they're always visible -->
              <div class="flex items-center justify-between mb-3">
                <label class="text-sm text-muted-foreground">{{
                  t("upload.whenWas")
                }}</label>
                <input
                  v-model="firstItem.date"
                  type="date"
                  class="bg-card border border-border rounded-[10px] px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <!-- Combined people picker: members + children -->
              <div
                v-if="props.members?.length || props.children?.length"
                class="mb-3"
              >
                <p
                  class="text-[10px] font-semibold uppercase tracking-[.12em] mb-1.5"
                  :class="
                    props.circleType === 'parents'
                      ? 'text-accent'
                      : 'text-muted-foreground'
                  "
                >
                  {{ t("upload.whoIsIn") }}
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <!-- Member chips -->
                  <button
                    v-for="member in props.members"
                    :key="member.userId"
                    type="button"
                    class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border"
                    :class="
                      firstItem.selectedMemberIds.includes(member.userId)
                        ? 'bg-accent/15 border-accent/40 text-foreground'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    "
                    @click="toggleMember(firstItem, member.userId)"
                  >
                    <span
                      class="w-4 h-4 rounded-full overflow-hidden bg-border flex-shrink-0 flex items-center justify-center text-[7px] font-bold"
                    >
                      <img
                        v-if="member.avatarUrl"
                        :src="member.avatarUrl"
                        class="w-full h-full object-cover"
                      />
                      <span v-else>{{ memberInitials(member) }}</span>
                    </span>
                    {{ member.firstName ?? member.userId.slice(0, 6) }}
                  </button>
                  <!-- Child chips -->
                  <button
                    v-for="child in props.children"
                    :key="child.id"
                    type="button"
                    class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border"
                    :class="
                      firstItem.selectedChildIds.includes(child.id)
                        ? 'bg-accent/15 border-accent/40 text-foreground'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    "
                    @click="toggleChild(firstItem, child.id)"
                  >
                    {{ child.name }}
                  </button>
                </div>
              </div>

              <div class="mb-3">
                <div class="flex items-baseline justify-between mb-1">
                  <label class="text-xs text-muted-foreground">{{
                    t("upload.note")
                  }}</label>
                  <span
                    class="text-[11px]"
                    :class="
                      firstItem.note.length >= 500
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    "
                    >{{ firstItem.note.length }} / 500</span
                  >
                </div>
                <textarea
                  v-model="firstItem.note"
                  :placeholder="t('upload.notePlaceholder')"
                  rows="2"
                  maxlength="500"
                  class="w-full bg-card border border-border rounded-[12px] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div class="mb-3">
                <div class="flex items-baseline justify-between mb-1">
                  <label class="text-xs text-muted-foreground">{{
                    t("upload.milestone")
                  }}</label>
                  <span
                    class="text-[11px]"
                    :class="
                      firstItem.milestoneLabel.length >= 40
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    "
                    >{{ firstItem.milestoneLabel.length }} / 40</span
                  >
                </div>
                <input
                  v-model="firstItem.milestoneLabel"
                  type="text"
                  :placeholder="typeConfig.milestonePlaceholder"
                  maxlength="40"
                  class="w-full bg-card border border-border rounded-[12px] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <!-- Milestone chips — quick-pick suggestions -->
                <div
                  v-if="
                    typeConfig.milestoneChips.length > 0 &&
                    !firstItem.milestoneLabel
                  "
                  class="flex flex-wrap gap-1.5 mt-2"
                >
                  <button
                    v-for="chip in typeConfig.milestoneChips"
                    :key="chip"
                    type="button"
                    class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary hover:bg-border text-muted-foreground hover:text-foreground transition-colors border border-border"
                    @click="firstItem.milestoneLabel = chip"
                  >
                    {{ chip }}
                  </button>
                </div>
              </div>

              <p
                v-if="firstItem.error"
                class="mt-1 text-sm text-destructive text-center"
              >
                {{ firstItem.error }}
              </p>
            </template>

            <!-- Batch grid -->
            <div v-else class="grid grid-cols-2 gap-3">
              <div
                v-for="item in items"
                :key="item.id"
                class="bg-card border border-border rounded-[14px] overflow-hidden"
              >
                <!-- Thumbnail -->
                <div class="relative bg-secondary" style="aspect-ratio: 1">
                  <img
                    v-if="!item.isVideo"
                    :src="item.previewUrl"
                    class="w-full h-full object-cover"
                  />
                  <video
                    v-else
                    :src="item.previewUrl"
                    class="w-full h-full object-cover"
                    muted
                    playsinline
                  />

                  <!-- Video badge -->
                  <div
                    v-if="item.isVideo"
                    class="absolute bottom-1.5 left-1.5 bg-black/50 rounded px-1.5 py-0.5"
                  >
                    <span
                      class="text-white text-[9px] font-semibold tracking-wide"
                      >VIDEO</span
                    >
                  </div>

                  <!-- Uploading overlay -->
                  <div
                    v-if="item.uploading"
                    class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1.5"
                  >
                    <p class="text-white text-sm font-bold">
                      {{ item.progress }}%
                    </p>
                    <div
                      class="w-14 bg-white/30 rounded-full h-0.5 overflow-hidden"
                    >
                      <div
                        class="bg-white h-0.5 rounded-full transition-all duration-150"
                        :style="{ width: `${item.progress}%` }"
                      />
                    </div>
                  </div>

                  <!-- Done overlay -->
                  <div
                    v-else-if="item.done"
                    class="absolute inset-0 bg-black/30 flex items-center justify-center"
                  >
                    <div
                      class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
                    >
                      <svg
                        class="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                  </div>

                  <!-- Remove button -->
                  <button
                    v-else-if="!item.uploading"
                    class="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                    @click="removeItem(item.id)"
                  >
                    <svg
                      class="w-2.5 h-2.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <!-- Date + note + milestone + error -->
                <div class="px-3 py-2 space-y-1.5">
                  <input
                    v-model="item.date"
                    type="date"
                    class="w-full bg-transparent text-xs text-foreground focus:outline-none"
                  />
                  <textarea
                    v-model="item.note"
                    :placeholder="t('upload.noteShort')"
                    rows="1"
                    maxlength="500"
                    class="w-full bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-snug"
                    style="max-height: 48px; overflow-y: auto"
                  />
                  <input
                    v-model="item.milestoneLabel"
                    type="text"
                    :placeholder="typeConfig.milestoneShort"
                    maxlength="40"
                    class="w-full bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <!-- Per-item people picker -->
                  <div
                    v-if="props.members?.length || props.children?.length"
                    class="flex flex-wrap gap-1 pt-0.5"
                  >
                    <button
                      v-for="member in props.members"
                      :key="member.userId"
                      type="button"
                      class="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] font-bold overflow-hidden transition-all border"
                      :class="
                        item.selectedMemberIds.includes(member.userId)
                          ? 'ring-2 ring-accent ring-offset-1 ring-offset-card border-accent bg-border'
                          : 'border-border bg-border opacity-50 hover:opacity-80'
                      "
                      :title="member.firstName ?? member.userId"
                      @click="toggleMember(item, member.userId)"
                    >
                      <img
                        v-if="member.avatarUrl"
                        :src="member.avatarUrl"
                        class="w-full h-full object-cover"
                      />
                      <span v-else class="text-foreground">{{
                        memberInitials(member)
                      }}</span>
                    </button>
                    <button
                      v-for="child in props.children"
                      :key="child.id"
                      type="button"
                      class="px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-colors border"
                      :class="
                        item.selectedChildIds.includes(child.id)
                          ? 'bg-accent/15 border-accent/40 text-foreground'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground opacity-50 hover:opacity-80'
                      "
                      @click="toggleChild(item, child.id)"
                    >
                      {{ child.name }}
                    </button>
                  </div>
                  <p
                    v-if="item.error"
                    class="text-[11px] text-destructive leading-tight"
                  >
                    {{ item.error }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Global error -->
          <p
            v-if="globalError"
            class="px-5 pb-1 text-sm text-destructive text-center flex-shrink-0"
          >
            {{ globalError }}
          </p>

          <!-- Footer -->
          <div
            class="px-5 py-4 border-t border-border flex gap-2.5 flex-shrink-0"
          >
            <button
              class="flex-1 border border-border bg-card rounded-[12px] py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
              :disabled="isUploading"
              @click="cancel"
            >
              {{ t("upload.cancel") }}
            </button>
            <button
              class="flex-1 bg-primary text-primary-foreground rounded-[12px] py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
              :disabled="isUploading || allDone"
              @click="uploadAll"
            >
              <span v-if="isUploading">{{
                t("upload.uploading", { done: doneCount, total: items.length })
              }}</span>
              <span v-else-if="allDone">{{ t("upload.allUploaded") }}</span>
              <span v-else>{{
                items.length === 1
                  ? t("upload.upload")
                  : t("upload.uploadN", items.length)
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import exifr from "exifr";
const { t } = useI18n();

interface ChildProfile {
  id: string;
  name: string;
  date_of_birth: string;
}
interface CircleMember {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
  date: string;
  note: string;
  milestoneLabel: string;
  selectedChildIds: string[];
  selectedMemberIds: string[];
  uploading: boolean;
  progress: number;
  done: boolean;
  error: string;
}

const props = defineProps<{
  circleId: string;
  circleType?: string | null;
  hideTrigger?: boolean;
  children?: ChildProfile[];
  members?: CircleMember[];
}>();
const typeConfig = computed(() => useCircleTypeConfig(props.circleType));

const isOpen = computed(() => items.value.length > 0);
defineExpose({ open: () => fileInput.value?.click(), isOpen });
const emit = defineEmits<{ uploaded: [] }>();

const supabase = useSupabaseClient();
const config = useRuntimeConfig();

const fileInput = ref<HTMLInputElement>();
const items = ref<UploadItem[]>([]);
const groupDate = ref(today());
const groupChildIds = ref<string[]>([]);
const groupMemberIds = ref<string[]>([]);
const globalError = ref("");

function memberInitials(member: CircleMember): string {
  return (
    (
      (member.firstName?.[0] ?? "") + (member.lastName?.[0] ?? "")
    ).toUpperCase() || "?"
  );
}

function toggleChild(item: UploadItem, childId: string) {
  const idx = item.selectedChildIds.indexOf(childId);
  item.selectedChildIds =
    idx === -1
      ? [...item.selectedChildIds, childId]
      : item.selectedChildIds.filter((id) => id !== childId);
}

function toggleGroupChild(childId: string) {
  const idx = groupChildIds.value.indexOf(childId);
  groupChildIds.value =
    idx === -1
      ? [...groupChildIds.value, childId]
      : groupChildIds.value.filter((id) => id !== childId);
}

function toggleMember(item: UploadItem, userId: string) {
  const idx = item.selectedMemberIds.indexOf(userId);
  item.selectedMemberIds =
    idx === -1
      ? [...item.selectedMemberIds, userId]
      : item.selectedMemberIds.filter((id) => id !== userId);
}

function toggleGroupMember(userId: string) {
  const idx = groupMemberIds.value.indexOf(userId);
  groupMemberIds.value =
    idx === -1
      ? [...groupMemberIds.value, userId]
      : groupMemberIds.value.filter((id) => id !== userId);
}

const isUploading = computed(() => items.value.some((i) => i.uploading));
const allDone = computed(
  () => items.value.length > 0 && items.value.every((i) => i.done),
);
const doneCount = computed(() => items.value.filter((i) => i.done).length);
// Safe – only accessed inside v-if="items.length === 1" in the template
const firstItem = computed(() => items.value[0] as UploadItem);

const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function today(): string {
  return dateFromTimestamp(Date.now());
}

function dateFromTimestamp(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function extractExifDate(file: File): Promise<string> {
  // 1. Try EXIF — reliable for JPEGs and HEICs from a camera
  try {
    const exif = await exifr.parse(file);
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime;
    if (raw) {
      const d = raw instanceof Date ? raw : new Date(String(raw));
      if (!isNaN(d.getTime())) return dateFromTimestamp(d.getTime());
    }
  } catch {}

  // 2. Fall back to file.lastModified — usually correct for photos saved from a camera roll
  if (file.lastModified) return dateFromTimestamp(file.lastModified);

  // 3. Last resort: today
  return today();
}

async function onFilesSelected(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  if (!files.length) return;
  globalError.value = "";

  const newItems: UploadItem[] = [];
  for (const file of files) {
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (file.size > maxSize) {
      globalError.value = isVideo
        ? t("upload.errorVideoSize")
        : t("upload.errorPhotoSize");
      continue;
    }
    const date = isVideo ? today() : await extractExifDate(file);
    newItems.push({
      id: Math.random().toString(36).slice(2),
      file,
      previewUrl: URL.createObjectURL(file),
      isVideo,
      date,
      note: "",
      milestoneLabel: "",
      selectedChildIds: [],
      selectedMemberIds: [],
      uploading: false,
      progress: 0,
      done: false,
      error: "",
    });
  }

  items.value = [...items.value, ...newItems];
  if (fileInput.value) fileInput.value.value = "";
}

function applyGroupDate() {
  if (!groupDate.value) return;
  items.value.forEach((item) => {
    item.date = groupDate.value;
  });
}

function applyGroupPeople() {
  items.value.forEach((item) => {
    item.selectedChildIds = [...groupChildIds.value];
    item.selectedMemberIds = [...groupMemberIds.value];
  });
}

function removeItem(id: string) {
  const item = items.value.find((i) => i.id === id);
  if (item) URL.revokeObjectURL(item.previewUrl);
  items.value = items.value.filter((i) => i.id !== id);
}

async function uploadItem(item: UploadItem): Promise<void> {
  item.uploading = true;
  item.progress = 0;
  item.error = "";

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    item.error = t("upload.errorSession");
    item.uploading = false;
    return;
  }

  const formData = new FormData();
  formData.append("file", item.file);
  formData.append("circleId", props.circleId);
  formData.append("note", item.note);
  if (item.milestoneLabel.trim())
    formData.append("milestoneLabel", item.milestoneLabel.trim());
  formData.append("memoryDate", `${item.date}T00:00:00Z`);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${config.public.supabaseUrl}/functions/v1/upload-media`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        item.progress = Math.round((e.loaded / e.total) * 100);
    };

    xhr.onload = async () => {
      item.uploading = false;
      const result = JSON.parse(xhr.responseText);
      if (xhr.status === 200) {
        item.done = true;
        // Tag children and members in parallel (fire-and-forget errors so upload still completes)
        if (result.memoryId) {
          await Promise.allSettled([
            item.selectedChildIds.length > 0
              ? $fetch(`/api/memories/${result.memoryId}/children`, {
                  method: "POST",
                  body: { childIds: item.selectedChildIds },
                }).catch((err) =>
                  console.error("[upload] failed to tag children:", err),
                )
              : Promise.resolve(),
            item.selectedMemberIds.length > 0
              ? $fetch(`/api/memories/${result.memoryId}/members`, {
                  method: "POST",
                  body: { userIds: item.selectedMemberIds },
                }).catch((err) =>
                  console.error("[upload] failed to tag members:", err),
                )
              : Promise.resolve(),
          ]);
        }
      } else {
        item.error =
          result.error === "storage_full"
            ? t("upload.errorStorageFull")
            : result.error === "file_too_large"
              ? item.isVideo
                ? t("upload.errorVideoTooLarge")
                : t("upload.errorPhotoTooLarge")
              : t("upload.errorFailed");
      }
      resolve();
    };

    xhr.onerror = () => {
      item.uploading = false;
      item.error = t("upload.errorFailed");
      resolve();
    };

    xhr.send(formData);
  });
}

async function uploadAll() {
  globalError.value = "";
  const pending = items.value.filter((i) => !i.done && !i.uploading);
  for (const item of pending) {
    await uploadItem(item);
  }
}

// Auto-close with a brief checkmark moment after all uploads succeed
watch(allDone, (done) => {
  if (!done) return;
  emit("uploaded");
  setTimeout(() => cancel(), 1000);
});

function cancel() {
  items.value.forEach((i) => URL.revokeObjectURL(i.previewUrl));
  items.value = [];
  groupDate.value = today();
  groupChildIds.value = [];
  groupMemberIds.value = [];
  globalError.value = "";
  if (fileInput.value) fileInput.value.value = "";
}
</script>
