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
      class="flex items-center gap-2 rounded-[12px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      @click="fileInput?.click()"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {{ t('nav.addMemory') }}
    </button>

    <Teleport to="body">
      <div
        v-if="items.length > 0"
        class="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50"
          @click="!isUploading && cancel()"
        />

        <!-- Sheet -->
        <div
          class="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-background shadow-2xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-[20px]"
        >
          <!-- Header -->
          <div
            class="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4"
          >
            <div>
              <h2 class="text-sm font-semibold text-foreground">
                {{
                  totalCount === 1
                    ? t('upload.addMemory')
                    : t('upload.addMemories', { n: totalCount })
                }}
              </h2>
              <p
                v-if="totalCount > 0"
                class="mt-0.5 text-[11px] text-muted-foreground"
              >
                <template v-for="(part, idx) in breakdownParts" :key="part.key">
                  <span v-if="idx > 0" class="text-border"> · </span>
                  <span>{{ part.label }}</span>
                </template>
              </p>
              <button
                class="mt-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                :disabled="isUploading"
                @click="fileInput?.click()"
              >
                {{ t('upload.addMore') }}
              </button>
            </div>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-border disabled:opacity-40"
              :disabled="isUploading"
              @click="cancel"
            >
              <svg
                class="h-3.5 w-3.5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Post as one / separately toggle (only when 2+ items) -->
          <div
            v-if="items.length >= 2"
            class="mx-4 mb-1 mt-3 flex flex-shrink-0 gap-1 rounded-[12px] bg-secondary p-1"
          >
            <button
              type="button"
              class="flex-1 rounded-[10px] py-2 text-xs font-semibold transition-colors"
              :class="
                !groupAsOne
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="groupAsOne = false"
            >
              {{ t('upload.postSeparately') }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-[10px] py-2 text-xs font-semibold transition-colors"
              :class="
                groupAsOne
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="groupAsOne = true"
            >
              {{ t('upload.postAsOne') }}
            </button>
          </div>

          <!-- Batch people picker — shown when NOT groupAsOne (separate mode) -->
          <div
            v-if="
              items.length > 1 &&
              !groupAsOne &&
              (props.members?.length || props.children?.length)
            "
            class="flex-shrink-0 border-b border-border px-5 py-2.5"
          >
            <div class="mb-1.5 flex items-center justify-between">
              <p
                class="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
              >
                {{ t('upload.tagPeople') }}
              </p>
              <button
                type="button"
                class="text-[10px] font-medium text-accent transition-opacity hover:opacity-70"
                @click="applyGroupPeople"
              >
                {{ t('upload.applyToAll') }}
              </button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <!-- Member chips -->
              <button
                v-for="member in props.members"
                :key="member.userId"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-medium transition-colors"
                :class="
                  groupMemberIds.includes(member.userId)
                    ? 'border-accent/40 bg-accent/15 text-foreground'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                "
                @click="toggleGroupMember(member.userId)"
              >
                <span
                  class="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-border text-[7px] font-bold"
                >
                  <img
                    v-if="member.avatarUrl"
                    :src="member.avatarUrl"
                    class="h-full w-full object-cover"
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
                class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                :class="
                  groupChildIds.includes(child.id)
                    ? 'border-accent/40 bg-accent/15 text-foreground'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                "
                @click="toggleGroupChild(child.id)"
              >
                {{ child.name }}
              </button>
            </div>
          </div>

          <!-- Group date (batch only, separate mode) -->
          <div
            v-if="items.length > 1 && !groupAsOne"
            class="flex flex-shrink-0 items-center gap-2 border-b border-border px-5 py-3"
          >
            <input
              v-model="groupDate"
              type="date"
              class="flex-1 rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              class="flex-shrink-0 rounded-[10px] bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border"
              @click="applyGroupDate"
            >
              {{ t('upload.applyToAll') }}
            </button>
          </div>

          <!-- Scrollable content -->
          <div class="scroll-styled flex-1 overflow-y-auto px-5 py-4">
            <!-- Single item -->
            <template v-if="items.length === 1">
              <div
                class="relative mb-4 w-full overflow-hidden rounded-[14px] bg-secondary"
                style="aspect-ratio: 4/5"
              >
                <img
                  v-if="!firstItem.isVideo"
                  :src="firstItem.previewUrl"
                  class="h-full w-full object-cover"
                />
                <video
                  v-else
                  :src="firstItem.previewUrl"
                  class="h-full w-full object-cover"
                  muted
                  playsinline
                />
                <div
                  v-if="firstItem.isVideo"
                  class="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5"
                >
                  <span
                    class="text-[9px] font-semibold tracking-wide text-white"
                    >VIDEO</span
                  >
                </div>
                <div
                  v-if="firstItem.uploading"
                  class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50"
                >
                  <p class="text-lg font-bold text-white">
                    {{ firstItem.progress }}%
                  </p>
                  <div
                    class="h-1 w-24 overflow-hidden rounded-full bg-white/30"
                  >
                    <div
                      class="h-1 rounded-full bg-white transition-all duration-150"
                      :style="{ width: `${firstItem.progress}%` }"
                    />
                  </div>
                </div>
                <div
                  v-if="firstItem.done"
                  class="absolute inset-0 flex items-center justify-center bg-black/30"
                >
                  <div
                    class="flex h-12 w-12 items-center justify-center rounded-full bg-white/20"
                  >
                    <svg
                      class="h-6 w-6 text-white"
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
              <div class="mb-3 flex items-center justify-between">
                <label class="text-sm text-muted-foreground">{{
                  t('upload.whenWas')
                }}</label>
                <input
                  v-model="firstItem.date"
                  type="date"
                  class="rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <!-- Combined people picker: members + children -->
              <div
                v-if="props.members?.length || props.children?.length"
                class="mb-3"
              >
                <p
                  class="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em]"
                  :class="
                    props.circleType === 'parents'
                      ? 'text-accent'
                      : 'text-muted-foreground'
                  "
                >
                  {{ t('upload.whoIsIn') }}
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <!-- Member chips -->
                  <button
                    v-for="member in props.members"
                    :key="member.userId"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-medium transition-colors"
                    :class="
                      firstItem.selectedMemberIds.includes(member.userId)
                        ? 'border-accent/40 bg-accent/15 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    "
                    @click="toggleMember(firstItem, member.userId)"
                  >
                    <span
                      class="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-border text-[7px] font-bold"
                    >
                      <img
                        v-if="member.avatarUrl"
                        :src="member.avatarUrl"
                        class="h-full w-full object-cover"
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
                    class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                    :class="
                      firstItem.selectedChildIds.includes(child.id)
                        ? 'border-accent/40 bg-accent/15 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    "
                    @click="toggleChild(firstItem, child.id)"
                  >
                    {{ child.name }}
                  </button>
                </div>
              </div>

              <div class="mb-3">
                <div class="mb-1 flex items-baseline justify-between">
                  <label class="text-xs text-muted-foreground">{{
                    t('upload.note')
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
                  class="w-full resize-none rounded-[12px] border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div class="mb-3">
                <div class="mb-1 flex items-baseline justify-between">
                  <label class="text-xs text-muted-foreground">{{
                    t('upload.milestone')
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
                  class="w-full rounded-[12px] border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <!-- Milestone chips — quick-pick suggestions -->
                <div
                  v-if="
                    typeConfig.milestoneChips.length > 0 &&
                    !firstItem.milestoneLabel
                  "
                  class="mt-2 flex flex-wrap gap-1.5"
                >
                  <button
                    v-for="chip in typeConfig.milestoneChips"
                    :key="chip"
                    type="button"
                    class="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                    @click="firstItem.milestoneLabel = chip"
                  >
                    {{ chip }}
                  </button>
                </div>
              </div>

              <p
                v-if="firstItem.error"
                class="mt-1 text-center text-sm text-destructive"
              >
                {{ firstItem.error }}
              </p>
            </template>

            <!-- Batch grid — "Post separately" mode -->
            <template v-else-if="!groupAsOne">
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="item in items"
                  :key="item.id"
                  class="overflow-hidden rounded-[14px] border border-border bg-card"
                >
                  <!-- Thumbnail -->
                  <div class="relative bg-secondary" style="aspect-ratio: 1">
                    <img
                      v-if="!item.isVideo"
                      :src="item.previewUrl"
                      class="h-full w-full object-cover"
                    />
                    <video
                      v-else
                      :src="item.previewUrl"
                      class="h-full w-full object-cover"
                      muted
                      playsinline
                    />

                    <!-- Video badge -->
                    <div
                      v-if="item.isVideo"
                      class="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5"
                    >
                      <span
                        class="text-[9px] font-semibold tracking-wide text-white"
                        >VIDEO</span
                      >
                    </div>

                    <!-- Uploading overlay -->
                    <div
                      v-if="item.uploading"
                      class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50"
                    >
                      <p class="text-sm font-bold text-white">
                        {{ item.progress }}%
                      </p>
                      <div
                        class="h-0.5 w-14 overflow-hidden rounded-full bg-white/30"
                      >
                        <div
                          class="h-0.5 rounded-full bg-white transition-all duration-150"
                          :style="{ width: `${item.progress}%` }"
                        />
                      </div>
                    </div>

                    <!-- Done overlay -->
                    <div
                      v-else-if="item.done"
                      class="absolute inset-0 flex items-center justify-center bg-black/30"
                    >
                      <div
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
                      >
                        <svg
                          class="h-5 w-5 text-white"
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
                      class="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70"
                      @click="removeItem(item.id)"
                    >
                      <svg
                        class="h-2.5 w-2.5 text-white"
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
                  <div class="space-y-1 px-3 py-1.5">
                    <input
                      v-model="item.date"
                      type="date"
                      class="w-full bg-transparent text-sm text-foreground focus:outline-none"
                    />
                    <textarea
                      v-model="item.note"
                      :placeholder="t('upload.noteShort')"
                      rows="1"
                      maxlength="500"
                      class="w-full resize-none bg-transparent text-sm leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none"
                      style="max-height: 40px; overflow-y: auto"
                    />
                    <input
                      v-model="item.milestoneLabel"
                      type="text"
                      :placeholder="typeConfig.milestoneShort"
                      maxlength="40"
                      class="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
                        class="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border text-[7px] font-bold transition-all"
                        :class="
                          item.selectedMemberIds.includes(member.userId)
                            ? 'border-accent bg-border ring-2 ring-accent ring-offset-1 ring-offset-card'
                            : 'border-border bg-border opacity-50 hover:opacity-80'
                        "
                        :title="member.firstName ?? member.userId"
                        @click="toggleMember(item, member.userId)"
                      >
                        <img
                          v-if="member.avatarUrl"
                          :src="member.avatarUrl"
                          class="h-full w-full object-cover"
                        />
                        <span v-else class="text-foreground">{{
                          memberInitials(member)
                        }}</span>
                      </button>
                      <button
                        v-for="child in props.children"
                        :key="child.id"
                        type="button"
                        class="rounded-full border px-1.5 py-0.5 text-[9px] font-medium transition-colors"
                        :class="
                          item.selectedChildIds.includes(child.id)
                            ? 'border-accent/40 bg-accent/15 text-foreground'
                            : 'border-border bg-secondary text-muted-foreground opacity-50 hover:text-foreground hover:opacity-80'
                        "
                        @click="toggleChild(item, child.id)"
                      >
                        {{ child.name }}
                      </button>
                    </div>
                    <p
                      v-if="item.error"
                      class="text-[11px] leading-tight text-destructive"
                    >
                      {{ item.error }}
                    </p>
                  </div>
                </div>
              </div>
            </template>

            <!-- "Post as one memory" mode -->
            <template v-else>
              <!-- Shared date -->
              <div class="mb-3 flex items-center justify-between">
                <label class="text-sm text-muted-foreground">{{
                  t('upload.whenWas')
                }}</label>
                <input
                  v-model="groupDate"
                  type="date"
                  class="rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <!-- Shared people picker -->
              <div
                v-if="props.members?.length || props.children?.length"
                class="mb-3"
              >
                <p
                  class="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
                >
                  {{ t('upload.whoIsIn') }}
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="member in props.members"
                    :key="member.userId"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-medium transition-colors"
                    :class="
                      groupMemberIds.includes(member.userId)
                        ? 'border-accent/40 bg-accent/15 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    "
                    @click="toggleGroupMember(member.userId)"
                  >
                    <span
                      class="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-border text-[7px] font-bold"
                    >
                      <img
                        v-if="member.avatarUrl"
                        :src="member.avatarUrl"
                        class="h-full w-full object-cover"
                      />
                      <span v-else>{{ memberInitials(member) }}</span>
                    </span>
                    {{ member.firstName ?? member.userId.slice(0, 6) }}
                  </button>
                  <button
                    v-for="child in props.children"
                    :key="child.id"
                    type="button"
                    class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                    :class="
                      groupChildIds.includes(child.id)
                        ? 'border-accent/40 bg-accent/15 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    "
                    @click="toggleGroupChild(child.id)"
                  >
                    {{ child.name }}
                  </button>
                </div>
              </div>

              <!-- Shared note -->
              <div class="mb-3">
                <div class="mb-1 flex items-baseline justify-between">
                  <label class="text-xs text-muted-foreground">{{
                    t('upload.note')
                  }}</label>
                  <span
                    class="text-[11px]"
                    :class="
                      groupNote.length >= 500
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    "
                    >{{ groupNote.length }} / 500</span
                  >
                </div>
                <textarea
                  v-model="groupNote"
                  :placeholder="t('upload.notePlaceholder')"
                  rows="2"
                  maxlength="500"
                  class="w-full resize-none rounded-[12px] border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <!-- Shared milestone -->
              <div class="mb-4">
                <div class="mb-1 flex items-baseline justify-between">
                  <label class="text-xs text-muted-foreground">{{
                    t('upload.milestone')
                  }}</label>
                  <span
                    class="text-[11px]"
                    :class="
                      groupMilestoneLabel.length >= 40
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    "
                    >{{ groupMilestoneLabel.length }} / 40</span
                  >
                </div>
                <input
                  v-model="groupMilestoneLabel"
                  type="text"
                  :placeholder="typeConfig.milestonePlaceholder"
                  maxlength="40"
                  class="w-full rounded-[12px] border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <!-- Photo/video grid with cover selector -->
              <div class="mb-4 grid grid-cols-2 gap-3">
                <div
                  v-for="item in items"
                  :key="item.id"
                  class="relative overflow-hidden rounded-[12px] bg-secondary"
                  style="aspect-ratio: 1"
                >
                  <img
                    v-if="!item.isVideo"
                    :src="item.previewUrl"
                    class="h-full w-full object-cover"
                  />
                  <video
                    v-else
                    :src="item.previewUrl"
                    class="h-full w-full object-cover"
                    muted
                    playsinline
                  />

                  <!-- Video badge -->
                  <div
                    v-if="item.isVideo"
                    class="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5"
                  >
                    <span
                      class="text-[9px] font-semibold tracking-wide text-white"
                      >VIDEO</span
                    >
                  </div>

                  <!-- Uploading overlay -->
                  <div
                    v-if="item.uploading"
                    class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50"
                  >
                    <p class="text-sm font-bold text-white">
                      {{ item.progress }}%
                    </p>
                    <div
                      class="h-0.5 w-14 overflow-hidden rounded-full bg-white/30"
                    >
                      <div
                        class="h-0.5 rounded-full bg-white transition-all duration-150"
                        :style="{ width: `${item.progress}%` }"
                      />
                    </div>
                  </div>

                  <!-- Cover indicator / set-as-cover button -->
                  <template v-else-if="!item.done">
                    <div
                      v-if="effectiveCoverTempId === item.tempId"
                      class="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground"
                    >
                      {{ t('upload.coverLabel') }}
                    </div>
                    <button
                      v-else
                      type="button"
                      class="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white transition-colors hover:bg-black/70"
                      @click="coverItemTempId = item.tempId"
                    >
                      {{ t('upload.setAsCover') }}
                    </button>
                  </template>

                  <!-- Done overlay -->
                  <div
                    v-if="item.done"
                    class="absolute inset-0 flex items-center justify-center bg-black/30"
                  >
                    <div
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
                    >
                      <svg
                        class="h-5 w-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                  </div>

                  <!-- Error badge -->
                  <div
                    v-if="item.error"
                    class="absolute bottom-1.5 left-1.5 right-1.5 rounded bg-destructive/90 px-1.5 py-0.5"
                  >
                    <p class="text-[9px] leading-tight text-white">
                      {{ item.error }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Text slides list -->
              <div v-if="textSlides.length > 0" class="mb-3 space-y-2">
                <div
                  v-for="slide in textSlides"
                  :key="slide.tempId"
                  class="flex items-start gap-2 rounded-[12px] border border-border bg-card px-3 py-2.5"
                >
                  <p class="flex-1 text-sm leading-snug text-foreground">
                    {{ slide.textContent }}
                  </p>
                  <button
                    type="button"
                    class="mt-0.5 flex-shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                    @click="removeTextSlide(slide.tempId)"
                  >
                    {{ t('upload.removeTextSlide') }}
                  </button>
                </div>
              </div>

              <!-- Add text slide -->
              <div v-if="!showAddTextDialog">
                <button
                  type="button"
                  class="w-full rounded-[12px] border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  @click="showAddTextDialog = true"
                >
                  + {{ t('upload.addTextSlide') }}
                </button>
              </div>
              <div
                v-else
                class="rounded-[12px] border border-border bg-card p-3"
              >
                <textarea
                  v-model="newTextContent"
                  :placeholder="t('upload.notePlaceholder')"
                  rows="3"
                  maxlength="500"
                  class="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autofocus
                />
                <div class="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    @click="cancelAddTextSlide"
                  >
                    {{ t('upload.cancel') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-[8px] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    :disabled="!newTextContent.trim()"
                    @click="confirmAddTextSlide"
                  >
                    {{ t('upload.addTextSlide') }}
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- Global error -->
          <p
            v-if="globalError"
            class="flex-shrink-0 px-5 pb-1 text-center text-sm text-destructive"
          >
            {{ globalError }}
          </p>

          <!-- Footer -->
          <div
            class="flex flex-shrink-0 gap-2.5 border-t border-border px-5 py-4"
          >
            <button
              class="flex-1 rounded-[12px] border border-border bg-card py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
              :disabled="isUploading"
              @click="cancel"
            >
              {{ t('upload.cancel') }}
            </button>
            <button
              class="flex-1 rounded-[12px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              :disabled="isUploading || allDone"
              @click="uploadAll"
            >
              <span v-if="isUploading">{{
                t('upload.uploading', { done: doneCount, total: items.length })
              }}</span>
              <span v-else-if="allDone">{{ t('upload.allUploaded') }}</span>
              <span v-else>{{
                items.length === 1
                  ? t('upload.upload')
                  : t('upload.uploadN', items.length)
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Milestone share card — shown after a single upload with a milestone label -->
    <MilestoneShareModal
      v-if="pendingShareCard"
      :photo-url="pendingShareCard.photoUrl"
      :milestone-label="pendingShareCard.milestoneLabel"
      :memory-date="pendingShareCard.memoryDate"
      :child-ages="pendingShareCard.childAges"
      @close="onShareCardClose"
    />
  </div>
</template>

<script setup lang="ts">
import exifr from 'exifr'
import { computeBabyAge } from '~/composables/useBabyAge'
import { useAnalytics, classifyMilestone } from '~/composables/useAnalytics'
import { resizeImage } from '~/utils/resizeImage'
const { t } = useI18n()

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

interface UploadItem {
  id: string
  tempId: string
  file: File
  previewUrl: string
  isVideo: boolean
  date: string
  note: string
  milestoneLabel: string
  selectedChildIds: string[]
  selectedMemberIds: string[]
  uploading: boolean
  progress: number
  done: boolean
  error: string
}

const props = defineProps<{
  circleId: string
  circleType?: string | null
  hideTrigger?: boolean
  children?: ChildProfile[]
  members?: CircleMember[]
  prefillMilestoneLabel?: string
}>()
const typeConfig = computed(() => useCircleTypeConfig(props.circleType, t))

const isOpen = computed(() => items.value.length > 0)
defineExpose({ open: () => fileInput.value?.click(), isOpen })
const emit = defineEmits<{ uploaded: [] }>()

const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const { track } = useAnalytics()

interface ShareCardData {
  photoUrl: string
  milestoneLabel: string
  memoryDate: string
  childAges: Array<{ name: string; age: string }>
}

const fileInput = ref<HTMLInputElement>()
const items = ref<UploadItem[]>([])
const groupDate = ref(today())
const groupChildIds = ref<string[]>([])
const groupMemberIds = ref<string[]>([])
const globalError = ref('')
const pendingShareCard = ref<ShareCardData | null>(null)

// "Post as one memory" state
const groupAsOne = ref(false)
const groupNote = ref('')
const groupMilestoneLabel = ref('')
const textSlides = ref<Array<{ tempId: string; textContent: string }>>([])
const coverItemTempId = ref<string | null>(null)
const showAddTextDialog = ref(false)
const newTextContent = ref('')

// Resolve effective cover: the explicitly chosen one, or else the first item
const effectiveCoverTempId = computed(() => {
  if (coverItemTempId.value) return coverItemTempId.value
  return items.value[0]?.tempId ?? null
})

function memberInitials(member: CircleMember): string {
  return (
    (
      (member.firstName?.[0] ?? '') + (member.lastName?.[0] ?? '')
    ).toUpperCase() || '?'
  )
}

function toggleChild(item: UploadItem, childId: string) {
  const idx = item.selectedChildIds.indexOf(childId)
  item.selectedChildIds =
    idx === -1
      ? [...item.selectedChildIds, childId]
      : item.selectedChildIds.filter((id) => id !== childId)
}

function toggleGroupChild(childId: string) {
  const idx = groupChildIds.value.indexOf(childId)
  groupChildIds.value =
    idx === -1
      ? [...groupChildIds.value, childId]
      : groupChildIds.value.filter((id) => id !== childId)
}

function toggleMember(item: UploadItem, userId: string) {
  const idx = item.selectedMemberIds.indexOf(userId)
  item.selectedMemberIds =
    idx === -1
      ? [...item.selectedMemberIds, userId]
      : item.selectedMemberIds.filter((id) => id !== userId)
}

function toggleGroupMember(userId: string) {
  const idx = groupMemberIds.value.indexOf(userId)
  groupMemberIds.value =
    idx === -1
      ? [...groupMemberIds.value, userId]
      : groupMemberIds.value.filter((id) => id !== userId)
}

function removeTextSlide(tempId: string) {
  textSlides.value = textSlides.value.filter((s) => s.tempId !== tempId)
}

function cancelAddTextSlide() {
  showAddTextDialog.value = false
  newTextContent.value = ''
}

function confirmAddTextSlide() {
  if (!newTextContent.value.trim()) return
  if (totalCount.value + 1 > MAX_BATCH_ITEMS) {
    globalError.value = t('upload.errorTooManyItems', { max: MAX_BATCH_ITEMS })
    return
  }
  textSlides.value.push({
    tempId: crypto.randomUUID(),
    textContent: newTextContent.value.trim(),
  })
  newTextContent.value = ''
  showAddTextDialog.value = false
}

const isUploading = computed(() => items.value.some((i) => i.uploading))
const allDone = computed(
  () => items.value.length > 0 && items.value.every((i) => i.done),
)
const doneCount = computed(() => items.value.filter((i) => i.done).length)
// Safe – only accessed inside v-if="items.length === 1" in the template
const firstItem = computed(() => items.value[0] as UploadItem)

const MAX_PHOTO_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_BYTES = 500 * 1024 * 1024
// Matches the server cap in /api/memories/upload-batch.
const MAX_BATCH_ITEMS = 30

const photoCount = computed(() => items.value.filter((i) => !i.isVideo).length)
const videoCount = computed(() => items.value.filter((i) => i.isVideo).length)
const noteCount = computed(() => textSlides.value.length)
const totalCount = computed(
  () => items.value.length + textSlides.value.length,
)

const breakdownParts = computed(() => {
  const parts: Array<{ key: string; label: string }> = []
  if (photoCount.value > 0)
    parts.push({
      key: 'photo',
      label: t('upload.countPhotos', photoCount.value),
    })
  if (videoCount.value > 0)
    parts.push({
      key: 'video',
      label: t('upload.countVideos', videoCount.value),
    })
  if (noteCount.value > 0)
    parts.push({
      key: 'note',
      label: t('upload.countNotes', noteCount.value),
    })
  return parts
})

function today(): string {
  return dateFromTimestamp(Date.now())
}

function dateFromTimestamp(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function extractExifDate(file: File): Promise<string> {
  // 1. Try EXIF — reliable for JPEGs and HEICs from a camera
  try {
    const exif = await exifr.parse(file)
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime
    if (raw) {
      const d = raw instanceof Date ? raw : new Date(String(raw))
      if (!isNaN(d.getTime())) return dateFromTimestamp(d.getTime())
    }
  } catch {}

  // 2. Fall back to file.lastModified — usually correct for photos saved from a camera roll
  if (file.lastModified) return dateFromTimestamp(file.lastModified)

  // 3. Last resort: today
  return today()
}

async function onFilesSelected(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  globalError.value = ''

  if (totalCount.value + files.length > MAX_BATCH_ITEMS) {
    globalError.value = t('upload.errorTooManyItems', { max: MAX_BATCH_ITEMS })
    if (fileInput.value) fileInput.value.value = ''
    return
  }

  const newItems: UploadItem[] = []
  for (const file of files) {
    const isVideo = file.type.startsWith('video/')
    const maxSize = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES
    if (file.size > maxSize) {
      globalError.value = isVideo
        ? t('upload.errorVideoSize')
        : t('upload.errorPhotoSize')
      continue
    }
    const date = isVideo ? today() : await extractExifDate(file)
    newItems.push({
      id: Math.random().toString(36).slice(2),
      tempId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      isVideo,
      date,
      note: '',
      milestoneLabel: props.prefillMilestoneLabel ?? '',
      selectedChildIds: [],
      selectedMemberIds: [],
      uploading: false,
      progress: 0,
      done: false,
      error: '',
    })
  }

  // Prefill group milestone label when first batch of items is added
  if (
    items.value.length === 0 &&
    newItems.length > 0 &&
    props.prefillMilestoneLabel
  ) {
    groupMilestoneLabel.value = props.prefillMilestoneLabel
  }

  items.value = [...items.value, ...newItems]
  if (fileInput.value) fileInput.value.value = ''
}

function applyGroupDate() {
  if (!groupDate.value) return
  items.value.forEach((item) => {
    item.date = groupDate.value
  })
}

function applyGroupPeople() {
  items.value.forEach((item) => {
    item.selectedChildIds = [...groupChildIds.value]
    item.selectedMemberIds = [...groupMemberIds.value]
  })
}

function removeItem(id: string) {
  const item = items.value.find((i) => i.id === id)
  if (item) URL.revokeObjectURL(item.previewUrl)
  items.value = items.value.filter((i) => i.id !== id)
}

async function uploadItem(item: UploadItem): Promise<void> {
  item.uploading = true
  item.progress = 0
  item.error = ''

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    item.error = t('upload.errorSession')
    item.uploading = false
    return
  }

  const formData = new FormData()
  formData.append('file', item.file)
  // Client-side thumbnail. If resize fails or is skipped, the edge function
  // simply stores no thumbnail_path and the read path falls back to the
  // original. Never blocks upload.
  const thumb = await resizeImage(item.file)
  if (thumb) formData.append('thumbnail', thumb, 'thumb.webp')
  formData.append('circleId', props.circleId)
  formData.append('note', item.note)
  if (item.milestoneLabel.trim())
    formData.append('milestoneLabel', item.milestoneLabel.trim())
  formData.append('memoryDate', `${item.date}T00:00:00Z`)

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${config.public.supabaseUrl}/functions/v1/upload-media`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        item.progress = Math.round((e.loaded / e.total) * 100)
    }

    xhr.onload = async () => {
      item.uploading = false
      const result = JSON.parse(xhr.responseText)
      if (xhr.status === 200) {
        item.done = true
        // Tag children and members in parallel (fire-and-forget errors so upload still completes)
        if (result.memoryId) {
          await Promise.allSettled([
            item.selectedChildIds.length > 0
              ? $fetch(`/api/memories/${result.memoryId}/children`, {
                  method: 'POST',
                  body: { childIds: item.selectedChildIds },
                }).catch((err) =>
                  console.error('[upload] failed to tag children:', err),
                )
              : Promise.resolve(),
            item.selectedMemberIds.length > 0
              ? $fetch(`/api/memories/${result.memoryId}/members`, {
                  method: 'POST',
                  body: { userIds: item.selectedMemberIds },
                }).catch((err) =>
                  console.error('[upload] failed to tag members:', err),
                )
              : Promise.resolve(),
          ])

          // Trigger push notification (fire-and-forget)
          $fetch('/api/push/notify', {
            method: 'POST',
            body: { memoryId: result.memoryId },
          }).catch(() => {}) // silent — push failure should never affect upload UX

          track('memory_uploaded', {
            circle_id: props.circleId,
            memory_type: item.isVideo ? 'video' : 'photo',
            visibility: 'circle',
            media_count: 1,
          })
          track('memory_shared_to_circle', {
            circle_id: props.circleId,
            memory_id: result.memoryId,
          })
          if (item.milestoneLabel.trim()) {
            track('milestone_created', {
              circle_id: props.circleId,
              milestone_type: classifyMilestone(item.milestoneLabel),
            })
          }
        }
      } else {
        item.error =
          result.error === 'storage_full'
            ? t('upload.errorStorageFull')
            : result.error === 'file_too_large'
              ? item.isVideo
                ? t('upload.errorVideoTooLarge')
                : t('upload.errorPhotoTooLarge')
              : t('upload.errorFailed')
      }
      resolve()
    }

    xhr.onerror = () => {
      item.uploading = false
      item.error = t('upload.errorFailed')
      resolve()
    }

    xhr.send(formData)
  })
}

async function uploadItemDeferred(
  item: UploadItem,
): Promise<{ memoryId: string; mediaId: string } | null> {
  item.uploading = true
  item.progress = 0
  item.error = ''

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    item.uploading = false
    item.error = t('upload.errorSession')
    return null
  }

  const formData = new FormData()
  formData.append('file', item.file)
  const thumb = await resizeImage(item.file)
  if (thumb) formData.append('thumbnail', thumb, 'thumb.webp')
  formData.append('circleId', props.circleId)
  formData.append('memoryDate', `${groupDate.value}T00:00:00Z`)

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      `${config.public.supabaseUrl}/functions/v1/upload-media?defer=true`,
    )
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        item.progress = Math.round((e.loaded / e.total) * 100)
    }

    xhr.onload = () => {
      item.uploading = false
      const result = JSON.parse(xhr.responseText)
      if (xhr.status === 200 && result.memoryId && result.mediaId) {
        item.done = true
        resolve({ memoryId: result.memoryId, mediaId: result.mediaId })
      } else {
        item.error =
          result.error === 'storage_full'
            ? t('upload.errorStorageFull')
            : result.error === 'file_too_large'
              ? item.isVideo
                ? t('upload.errorVideoTooLarge')
                : t('upload.errorPhotoTooLarge')
              : t('upload.errorFailed')
        resolve(null)
      }
    }

    xhr.onerror = () => {
      item.uploading = false
      item.error = t('upload.errorFailed')
      resolve(null)
    }

    xhr.send(formData)
  })
}

async function uploadAsOneMemory() {
  globalError.value = ''

  // 1. Upload all media files in parallel with defer=true
  const draftResults = await Promise.all(
    items.value.map((item) => uploadItemDeferred(item)),
  )

  // If any upload failed, abort
  if (draftResults.some((r) => !r)) {
    globalError.value = t('upload.errorFailed')
    return
  }

  // 2. Build the items array: drafts (in selection order) + text slides at the end
  const orderedItems: Array<
    | { type: 'draft'; draftMemoryId: string }
    | { type: 'text'; textContent: string }
  > = []
  for (let i = 0; i < items.value.length; i++) {
    orderedItems.push({
      type: 'draft',
      draftMemoryId: draftResults[i]!.memoryId,
    })
  }
  for (const ts of textSlides.value) {
    orderedItems.push({ type: 'text', textContent: ts.textContent })
  }

  // 3. Resolve cover index
  let coverIdx: number | null = null
  if (coverItemTempId.value) {
    const idx = items.value.findIndex(
      (it) => it.tempId === coverItemTempId.value,
    )
    if (idx >= 0) coverIdx = idx
  }

  // 4. Call upload-batch
  try {
    const batchResult = await $fetch<{ memoryId: string }>(
      '/api/memories/upload-batch',
      {
        method: 'POST',
        body: {
          circleId: props.circleId,
          memoryDate: groupDate.value,
          note: groupNote.value || null,
          milestoneLabel: groupMilestoneLabel.value || null,
          childIds: groupChildIds.value,
          memberIds: groupMemberIds.value,
          coverIndex: coverIdx,
          items: orderedItems,
        },
      },
    )

    const mediaTypes = new Set<'photo' | 'video' | 'note'>()
    for (const it of items.value) {
      mediaTypes.add(it.isVideo ? 'video' : 'photo')
    }
    if (textSlides.value.length > 0) mediaTypes.add('note')

    const singleType = mediaTypes.values().next().value as
      | 'photo'
      | 'video'
      | 'note'
      | undefined
    const memoryType: 'photo' | 'video' | 'note' | 'mixed' =
      mediaTypes.size > 1 ? 'mixed' : (singleType ?? 'photo')

    const mediaCount = items.value.length + textSlides.value.length

    track('memory_uploaded', {
      circle_id: props.circleId,
      memory_type: memoryType,
      visibility: 'circle',
      media_count: mediaCount,
    })
    track('memory_shared_to_circle', {
      circle_id: props.circleId,
      memory_id: batchResult.memoryId,
    })
    if (groupMilestoneLabel.value.trim()) {
      track('milestone_created', {
        circle_id: props.circleId,
        milestone_type: classifyMilestone(groupMilestoneLabel.value),
      })
    }

    emit('uploaded')
    cancel()
  } catch (err) {
    globalError.value = t('upload.errorFailed')
  }
}

async function uploadAll() {
  globalError.value = ''

  // "Post as one memory" path
  if (groupAsOne.value && items.value.length >= 2) {
    return uploadAsOneMemory()
  }

  // Default: upload each as a separate memory
  const pending = items.value.filter((i) => !i.done && !i.uploading)
  for (const item of pending) {
    await uploadItem(item)
  }
}

// Auto-close with a brief checkmark moment after all uploads succeed.
// For a single upload with a milestone label, show the share card prompt first.
watch(allDone, (done) => {
  if (!done) return

  // In "post as one" mode, uploadAsOneMemory() calls cancel() directly — don't double-fire
  if (groupAsOne.value) return

  emit('uploaded')

  const item = items.value[0]
  if (items.value.length === 1 && item?.milestoneLabel.trim()) {
    const childAges = item.selectedChildIds
      .map((id) => props.children?.find((c) => c.id === id))
      .filter(Boolean)
      .map((child) => {
        const age = computeBabyAge(
          child!.date_of_birth,
          `${item.date}T00:00:00Z`,
        )
        return age ? { name: child!.name, age } : null
      })
      .filter(Boolean) as Array<{ name: string; age: string }>

    pendingShareCard.value = {
      photoUrl: item.previewUrl,
      milestoneLabel: item.milestoneLabel.trim(),
      memoryDate: `${item.date}T00:00:00Z`,
      childAges,
    }
    // The upload sheet stays open behind the share modal; cancel() is called after share dismissed
  } else {
    setTimeout(() => cancel(), 1000)
  }
})

function onShareCardClose() {
  pendingShareCard.value = null
  cancel()
}

function cancel() {
  items.value.forEach((i) => URL.revokeObjectURL(i.previewUrl))
  items.value = []
  groupDate.value = today()
  groupChildIds.value = []
  groupMemberIds.value = []
  globalError.value = ''
  // Reset "post as one" state
  groupAsOne.value = false
  groupNote.value = ''
  groupMilestoneLabel.value = ''
  textSlides.value = []
  coverItemTempId.value = null
  showAddTextDialog.value = false
  newTextContent.value = ''
  if (fileInput.value) fileInput.value.value = ''
}
</script>
