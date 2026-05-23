<template>
  <div class="flex h-full flex-col" @click="pickerOpen = false">
    <!-- Caption section: tab bar + independent scroll panels -->
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- Tab bar -->
      <div v-if="!viewerMode" class="flex flex-shrink-0 border-b border-border px-3">
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
              v-if="isOwner && !viewerMode"
              class="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              :title="t('modal.editNote')"
              @click="startEditing"
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

        <!-- Edit mode -->
        <template v-else>
          <div class="mb-2">
            <label
              class="mb-1 block text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
              >{{ t('modal.date') }}</label
            >
            <input
              v-model="editDate"
              type="date"
              :max="new Date().toLocaleDateString('en-CA')"
              class="mb-3 w-full rounded-lg bg-secondary px-3 py-1.5 text-base text-foreground outline-none focus:ring-1 focus:ring-accent/40"
              :style="{
                colorScheme: $colorMode.value === 'dark' ? 'dark' : 'light',
              }"
            />
            <div class="mb-1 flex items-baseline justify-between">
              <label
                class="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
                >{{ t('modal.milestone') }}</label
              >
              <span
                class="text-[10px]"
                :class="
                  editMilestone.length >= 40
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                "
                >{{ editMilestone.length }} / 40</span
              >
            </div>
            <input
              v-model="editMilestone"
              type="text"
              :placeholder="t('modal.milestonePlaceholder')"
              maxlength="40"
              class="mb-3 w-full rounded-lg bg-secondary px-3 py-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-accent/40"
            />
            <div class="mb-1 flex items-baseline justify-between">
              <label
                class="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
                >{{ t('modal.note') }}</label
              >
              <span
                class="text-[10px]"
                :class="
                  editNote.length >= 500
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                "
                >{{ editNote.length }} / 500</span
              >
            </div>
            <textarea
              ref="editTextareaEl"
              v-model="editNote"
              :placeholder="t('modal.notePlaceholder')"
              rows="3"
              maxlength="500"
              class="w-full resize-none rounded-lg bg-secondary px-3 py-2 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-accent/40"
              style="max-height: 140px; overflow-y: auto"
            />
            <div
              v-if="props.members?.length || props.children?.length"
              class="mt-3"
            >
              <p
                class="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
              >
                {{ t('modal.whoIsIn') }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="member in props.members"
                  :key="member.userId"
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-medium transition-colors"
                  :class="
                    editMemberIds.includes(member.userId)
                      ? 'border-accent/40 bg-accent/15 text-foreground'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                  "
                  @click="toggleEditMember(member.userId)"
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
                  {{ member.firstName ?? t('common.someone') }}
                </button>
                <button
                  v-for="child in props.children"
                  :key="child.id"
                  type="button"
                  class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                  :class="
                    editChildIds.includes(child.id)
                      ? 'border-accent/40 bg-accent/15 text-foreground'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                  "
                  @click="toggleEditChild(child.id)"
                >
                  {{ child.name }}
                </button>
              </div>
            </div>
            <!-- Slides editor (multi-item only) -->
            <div
              v-if="(memory.media_count ?? 1) > 1"
              class="mt-4 border-t border-border pt-4"
            >
              <p
                class="mb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"
              >
                {{ t('modal.slides') }}
              </p>

              <!-- Slide list -->
              <div class="mb-3 space-y-2">
                <div
                  v-for="(slide, idx) in slidesEdit"
                  :key="slide.id"
                  class="flex items-center gap-2 rounded-[10px] bg-secondary p-2"
                >
                  <!-- Thumbnail / preview -->
                  <div
                    class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-border"
                  >
                    <img
                      v-if="slide.mediaType === 'photo'"
                      :src="slide.url ?? undefined"
                      class="h-full w-full object-cover"
                    />
                    <video
                      v-else-if="slide.mediaType === 'video'"
                      :src="slide.url ?? undefined"
                      class="h-full w-full object-cover"
                      muted
                    />
                    <span
                      v-else
                      class="line-clamp-3 p-1 text-center text-[8px] italic text-muted-foreground"
                      >{{ (slide.textContent ?? '').slice(0, 30) }}…</span
                    >
                  </div>
                  <!-- Type label -->
                  <span
                    class="min-w-0 flex-1 text-[11px] text-muted-foreground"
                  >
                    {{
                      slide.mediaType === 'text'
                        ? t('modal.slideTypeText')
                        : slide.mediaType === 'video'
                          ? t('modal.slideTypeVideo')
                          : t('modal.slideTypePhoto')
                    }}
                    <span
                      v-if="slide.id === editCoverMediaId"
                      class="ml-1 text-[9px] uppercase tracking-wider text-accent"
                      >{{ t('modal.cover') }}</span
                    >
                  </span>
                  <!-- Move up -->
                  <button
                    type="button"
                    :disabled="idx === 0"
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                    :aria-label="t('modal.moveUp')"
                    @click="moveSlide(idx, -1)"
                  >
                    <svg
                      class="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <!-- Move down -->
                  <button
                    type="button"
                    :disabled="idx === slidesEdit.length - 1"
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                    :aria-label="t('modal.moveDown')"
                    @click="moveSlide(idx, 1)"
                  >
                    <svg
                      class="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <!-- Set cover (photo/video only) -->
                  <button
                    v-if="
                      slide.mediaType !== 'text' &&
                      slide.id !== editCoverMediaId
                    "
                    type="button"
                    class="flex-shrink-0 px-1 text-[10px] text-accent hover:opacity-70"
                    @click="setCover(slide.id)"
                  >
                    {{ t('modal.setAsCover') }}
                  </button>
                  <!-- Remove -->
                  <button
                    type="button"
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                    :aria-label="t('modal.removeSlide')"
                    @click="removeSlide(slide.id)"
                  >
                    <svg
                      class="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Staged items: each new slide-to-be (photo, video, or text)
                   appears here as a card before Save. Text cards carry an
                   inline editable textarea; media cards carry a thumbnail. -->
              <div v-if="stagedItems.length" class="mb-3 space-y-2">
                <div
                  v-for="s in stagedItems"
                  :key="s.tempId"
                  class="flex items-start gap-2 rounded-[10px] bg-secondary p-2"
                >
                  <!-- Thumbnail (media) or text-slide glyph -->
                  <div
                    class="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-border"
                  >
                    <img
                      v-if="s.kind === 'photo'"
                      :src="s.previewUrl"
                      class="h-full w-full object-cover"
                    />
                    <video
                      v-else-if="s.kind === 'video'"
                      :src="s.previewUrl"
                      class="h-full w-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <svg
                      v-else
                      class="h-4 w-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 7h16M4 12h16M4 17h10" />
                    </svg>
                  </div>

                  <!-- Body: filename (media) or textarea (text) + state line -->
                  <div class="min-w-0 flex-1">
                    <!-- Media: filename -->
                    <p
                      v-if="s.kind !== 'text'"
                      class="truncate text-[11px] text-foreground"
                      :title="s.filename"
                    >
                      {{ s.filename }}
                    </p>
                    <!-- Text, while still editable -->
                    <textarea
                      v-else-if="s.state === 'staged' || s.state === 'failed'"
                      v-model="s.textContent"
                      :placeholder="t('modal.notePlaceholder')"
                      rows="2"
                      maxlength="2000"
                      :disabled="saving"
                      class="w-full resize-none bg-transparent text-[12px] leading-snug text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                    />
                    <!-- Text, once uploading or done — read-only preview -->
                    <p
                      v-else
                      class="line-clamp-3 text-[12px] leading-snug text-foreground"
                    >
                      {{ s.textContent }}
                    </p>

                    <!-- State line (under the body content) -->
                    <p
                      v-if="s.state === 'staged'"
                      class="mt-0.5 text-[10px] italic text-muted-foreground"
                    >
                      {{ t('modal.willBeAdded') }}
                    </p>
                    <div
                      v-else-if="s.state === 'uploading' && s.kind !== 'text'"
                      class="mt-1.5 h-1 overflow-hidden rounded-full bg-border"
                    >
                      <div
                        class="h-full rounded-full bg-accent/80 transition-all duration-200 ease-out"
                        :style="{ width: `${s.progress}%` }"
                      />
                    </div>
                    <p
                      v-else-if="s.state === 'uploading'"
                      class="mt-0.5 text-[10px] italic text-muted-foreground"
                    >
                      {{ t('modal.adding') }}
                    </p>
                    <p
                      v-else-if="s.state === 'done'"
                      class="mt-0.5 text-[10px] font-medium text-accent"
                    >
                      ✓ {{ t('modal.added') }}
                    </p>
                    <p
                      v-else
                      class="mt-0.5 text-[10px] text-destructive"
                      :title="s.error"
                    >
                      {{ t('modal.uploadFailed') }}
                    </p>
                  </div>

                  <!-- State-dependent right cap -->
                  <span
                    v-if="s.state === 'uploading' && s.kind !== 'text'"
                    class="mt-1 flex-shrink-0 tabular-nums text-[10px] font-medium text-muted-foreground"
                  >
                    {{ s.progress }}%
                  </span>
                  <button
                    v-else-if="s.state === 'staged' || s.state === 'failed'"
                    type="button"
                    :disabled="saving"
                    class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
                    :aria-label="t('modal.removeStaged')"
                    @click="removeStagedItem(s.tempId)"
                  >
                    <svg
                      class="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Add buttons: each click just pushes a new staged card to
                   the list above. The actual write happens on Save. -->
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="group flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-[12px] font-medium text-foreground transition-all hover:border-accent/60 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="saving"
                  @click="pickAddMediaFile"
                >
                  <svg
                    class="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-accent"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                    />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {{ t('modal.addMedia') }}
                </button>
                <button
                  type="button"
                  class="group flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-[12px] font-medium text-foreground transition-all hover:border-accent/60 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="saving"
                  @click="addStagedTextSlide"
                >
                  <svg
                    class="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-accent"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 7h16M4 12h16M4 17h10" />
                  </svg>
                  {{ t('modal.addTextSlide') }}
                </button>
                <input
                  ref="addMediaInputEl"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  class="hidden"
                  @change="onAddMediaSelected"
                />
              </div>
            </div>

            <div class="mt-1.5 flex items-center justify-end">
              <div class="flex items-center gap-2">
                <button
                  class="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                  @click="cancelEditing"
                >
                  {{ t('modal.cancel') }}
                </button>
                <button
                  :disabled="saving"
                  class="flex items-center gap-1.5 text-[12px] font-semibold transition-colors disabled:text-muted-foreground"
                  :class="
                    hasUnsavedChanges ? 'text-accent' : 'text-muted-foreground'
                  "
                  :title="
                    hasUnsavedChanges ? t('modal.unsavedChanges') : undefined
                  "
                  @click="saveEdit"
                >
                  <!-- Dirty dot: subtle on-state for the Save action so the
                       user knows something is waiting to commit. -->
                  <span
                    v-if="hasUnsavedChanges && !saving"
                    class="h-1.5 w-1.5 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  {{ saving ? t('modal.saving') : t('modal.save') }}
                </button>
              </div>
            </div>
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
          <div class="mb-3" />
        </template>

        <!-- Reactions (owner / circle-member mode) -->
        <div v-if="!viewerMode" class="px-4 pb-4">
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

        <!-- Viewer mode: single ❤ react -->
        <div v-else class="px-4 pb-4">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/30 px-3 py-1.5 text-[12px] font-medium transition-all hover:border-accent/40 active:scale-95"
            :class="
              viewerReacted
                ? 'cursor-default text-rose-500'
                : 'text-muted-foreground hover:text-rose-500'
            "
            :disabled="viewerReacted || viewerReactPending"
            @click.stop="onViewerReact"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :fill="viewerReacted ? 'currentColor' : 'none'"
            >
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              />
            </svg>
            {{
              viewerReacted
                ? t('viewerLink.viewerReactSent')
                : t('viewerLink.viewerReact')
            }}
          </button>
        </div>
      </div>

      <!-- Comments tab -->
      <div
        v-if="!viewerMode"
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
  <ConfirmDialog
    v-model="discardConfirmOpen"
    :title="t('modal.unsavedChanges')"
    :message="t('modal.discardConfirm')"
    :confirm-label="t('modal.discard')"
    :cancel-label="t('modal.keepEditing')"
    @confirm="settleDiscardConfirm(true)"
    @cancel="settleDiscardConfirm(false)"
  />
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { computeBabyAge } from '~/composables/useBabyAge'
import { useAnalytics, classifyMilestone } from '~/composables/useAnalytics'
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

const props = withDefaults(
  defineProps<{
    memory: Memory
    children: ChildProfile[]
    members: CircleMember[]
    currentUserId: string | null
    selfAvatarUrl: string | null
    selfInitials: string
    slides: Slide[]
    currentSlideIdx: number
    // ── New: viewer-mode plumbing ──
    /** When true: hide owner-only affordances; route single heart-react
     *  through the public guest endpoint. */
    viewerMode?: boolean
    viewerToken?: string
    guestName?: string
  }>(),
  { viewerMode: false, viewerToken: undefined, guestName: undefined },
)

const emit = defineEmits<{
  update: [Pick<Memory, 'id'> & Partial<Memory>]
  'slides-update': [
    { slides: Slide[]; currentSlideIdx?: number; coverMediaId?: string | null },
  ]
  'open-share-card': []
  // After a successful edit, when a milestone was newly added, MemoryShell
  // owns the share card teleport — so we emit the payload it should render.
  'milestone-share-prompt': [
    {
      photoUrl: string
      milestoneLabel: string
      memoryDate: string
      childAges: Array<{ name: string; age: string }>
      onDemand: boolean
    },
  ]
}>()

const { t, locale } = useI18n()

const activeTab = ref<'caption' | 'comments'>('caption')

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

// Initialized from the prop's snapshot, then re-seeded by the
// `watch(() => props.memory.id, ...)` below whenever the user navigates
// to a different memory (MemoryShell reuses this component instance, so
// there's no :key remount to do it automatically).
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

onMounted(() => {
  if (!props.viewerMode) loadComments()
})

// ── Viewer-mode single ❤ react ─────────────────────────────
// When the modal is rendered for a public viewer-link visitor we hide the
// 12-emoji picker and the comments thread entirely. The one affordance we
// keep is a single heart react that POSTs through the public guest endpoint.
const viewerReacted = ref(false)
const viewerReactPending = ref(false)

async function onViewerReact() {
  if (viewerReacted.value || viewerReactPending.value) return
  if (!props.viewerToken) return
  viewerReactPending.value = true
  try {
    await $fetch('/api/reactions/guest', {
      method: 'POST',
      body: {
        viewerToken: props.viewerToken,
        memoryId: props.memory.id,
        emoji: '❤️',
        guestName: props.guestName || undefined,
      },
    })
    viewerReacted.value = true
  } catch (err) {
    console.error('[MemoryDetail] viewer react failed:', err)
  } finally {
    viewerReactPending.value = false
  }
}

// Reset per-memory state when the user navigates between memories.
// MemoryShell reuses this instance across navigation (no :key remount)
// so reactions, comments, inline-edit state, and the viewer's heart-tap
// gate all need to be re-initialized from the new memory's prop snapshot.
watch(
  () => props.memory.id,
  (newId, oldId) => {
    if (newId === oldId) return
    // Reactions — re-seed from the new prop's snapshot.
    localReactions.value = [
      ...(props.memory.memoryreaction ?? []),
    ] as Reaction[]
    pickerOpen.value = false
    // Comments — clear current state, reload for the new memory (skipped
    // in viewer mode since the comments section isn't rendered there).
    editingCommentId.value = null
    commentEditDraft.value = ''
    confirmDeleteId.value = null
    commentDraft.value = ''
    if (!props.viewerMode) {
      comments.value = []
      loadComments()
    }
    // Caption edit state — exiting edit mode triggers the existing
    // `watch(editing, ...)` cleanup which clears slidesEdit, stagedItems,
    // editNote, etc. Navigation already passes the canClose discard guard,
    // so any unsaved-edit confirmation has happened by the time we get here.
    if (editing.value) editing.value = false
    // Viewer heart-tap gate resets so the user can react to the new memory.
    viewerReacted.value = false
  },
)

// Force the caption pane visible when viewer-mode is on — the tab bar is
// hidden, so `activeTab` cannot be flipped manually.
watch(
  () => props.viewerMode,
  (vm) => {
    if (vm) activeTab.value = 'caption'
  },
  { immediate: true },
)

// ── Edit ───────────────────────────────────────────────────
const editing = ref(false)
const saving = ref(false)
const editNote = ref('')
const editMilestone = ref('')
const editDate = ref('')
const editChildIds = ref<string[]>([])
const editMemberIds = ref<string[]>([])
const editTextareaEl = ref<HTMLTextAreaElement>()

// ── Slides edit state ──────────────────────────────────────
const slidesEdit = ref<Slide[]>([])
const addMediaInputEl = ref<HTMLInputElement | null>(null)

// Transactional edit state: cover swaps, reorders, and removes all stay
// local until Save. Cancel reverts everything. Compared against the
// snapshot we took on entering edit mode (originalSlideOrder).
const editCoverMediaId = ref<string | null>(null)
const originalSlideOrder = ref<string[]>([])
const removedSlideIds = ref<Set<string>>(new Set())

interface StagedItem {
  tempId: string
  kind: 'photo' | 'video' | 'text'
  state: 'staged' | 'uploading' | 'done' | 'failed'
  progress: number
  error?: string
  // Media-only:
  file?: File
  filename?: string
  previewUrl?: string
  // Text-only:
  textContent?: string
}
// New slides queued for the next Save. Photo/video stage with thumbnail
// previews; text stages with an inline editable textarea. The actual
// items.post call only fires when the user clicks Save — picking or
// drafting is fully non-destructive.
const stagedItems = ref<StagedItem[]>([])

watch(editing, async (isEditing) => {
  if (isEditing && (props.memory.media_count ?? 1) > 1) {
    try {
      const data = await $fetch<{ slides: Slide[] }>(
        `/api/memories/${props.memory.id}/slides`,
      )
      const sorted = data.slides
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
      slidesEdit.value = sorted
      // Snapshot for diffing on Save. We send a reorder PATCH only if this
      // changes vs. slidesEdit's current order at save time.
      originalSlideOrder.value = sorted.map((s) => s.id)
      editCoverMediaId.value = props.memory.cover_media_id ?? null
      removedSlideIds.value = new Set()
    } catch (err) {
      console.error('[MemoryDetail] failed to load slides for edit:', err)
    }
  } else if (!isEditing) {
    slidesEdit.value = []
    originalSlideOrder.value = []
    editCoverMediaId.value = null
    removedSlideIds.value = new Set()
  }
})

function pickAddMediaFile() {
  addMediaInputEl.value?.click()
}

// XHR upload so we can report real progress (fetch can't observe upload bytes).
// Resolves with the draft memoryId returned by the edge function.
function uploadFileToDraft(
  file: File,
  token: string,
  supabaseUrl: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('circleId', props.memory.circle_id)
    formData.append('memoryDate', props.memory.memory_date)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${supabaseUrl}/functions/v1/upload-media?defer=true`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      // Cap at 95 — the attach call still has to land before we call it done.
      onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)))
    }

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText)
        if (xhr.status === 200 && res.memoryId) resolve(res.memoryId)
        else reject(new Error(res.error ?? `HTTP ${xhr.status}`))
      } catch {
        reject(new Error('invalid response'))
      }
    }
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(formData)
  })
}

function newStagedTempId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

// Picking files just stages them — they show as preview cards until Save.
function onAddMediaSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return
  for (const file of files) {
    stagedItems.value.push({
      tempId: newStagedTempId(),
      kind: file.type.startsWith('video/') ? 'video' : 'photo',
      state: 'staged',
      progress: 0,
      file,
      filename: file.name,
      previewUrl: URL.createObjectURL(file),
    })
  }
  if (input) input.value = ''
}

// Pushes an empty text card into the staged list with an inline editable
// textarea. Clicking the add-text button repeatedly just pushes more cards.
function addStagedTextSlide() {
  stagedItems.value.push({
    tempId: newStagedTempId(),
    kind: 'text',
    state: 'staged',
    progress: 0,
    textContent: '',
  })
}

function removeStagedItem(tempId: string) {
  const idx = stagedItems.value.findIndex((s) => s.tempId === tempId)
  if (idx === -1) return
  const item = stagedItems.value[idx]!
  // Only allow removal in resting states; while uploading, the request is
  // already in flight and racing the user.
  if (item.state !== 'staged' && item.state !== 'failed') return
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  stagedItems.value.splice(idx, 1)
}

function clearStagedItems() {
  for (const s of stagedItems.value) {
    if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
  }
  stagedItems.value = []
}

onUnmounted(clearStagedItems)

// Drives staged items through their commit during Save. Photo/video items
// upload + attach as drafts; text items go straight to items.post. Retries
// any previously-failed items in the same pass.
async function flushStagedItems(): Promise<number> {
  // Drop never-typed text cards — they're not commitable and shouldn't show
  // up as "failed" just because the user left them empty.
  stagedItems.value = stagedItems.value.filter(
    (s) => !(s.kind === 'text' && !(s.textContent ?? '').trim()),
  )

  const toProcess = stagedItems.value.filter(
    (s) => s.state === 'staged' || s.state === 'failed',
  )
  if (toProcess.length === 0) return 0

  // Only fetch auth/url if there's at least one media item — pure-text
  // batches don't need the storage path.
  const hasMedia = toProcess.some((s) => s.kind !== 'text')
  let token: string | undefined
  let supabaseUrl: string | undefined
  if (hasMedia) {
    token = (await supabaseClient.auth.getSession()).data.session?.access_token
    if (!token) throw new Error('no auth token')
    supabaseUrl = useRuntimeConfig().public.supabaseUrl as string
  }

  for (const item of toProcess) {
    item.state = 'uploading'
    item.error = undefined
    item.progress = 0
  }

  await Promise.all(
    toProcess.map(async (item) => {
      try {
        if (item.kind === 'text') {
          const content = (item.textContent ?? '').trim()
          if (!content) throw new Error('empty')
          await $fetch(`/api/memories/${props.memory.id}/items`, {
            method: 'POST',
            body: { type: 'text', textContent: content },
          })
        } else {
          const draftMemoryId = await uploadFileToDraft(
            item.file!,
            token!,
            supabaseUrl!,
            (pct) => {
              item.progress = pct
            },
          )
          await $fetch(`/api/memories/${props.memory.id}/items`, {
            method: 'POST',
            body: { type: 'draft', draftMemoryId },
          })
        }
        item.progress = 100
        item.state = 'done'
      } catch (err) {
        console.error('[edit] stage commit failed:', err)
        item.state = 'failed'
        item.error = err instanceof Error ? err.message : 'failed'
      }
    }),
  )

  return toProcess.filter((s) => s.state === 'done').length
}

// Local-only — saveEdit replays the surviving state to the server.
function removeSlide(itemId: string) {
  removedSlideIds.value.add(itemId)
  slidesEdit.value = slidesEdit.value.filter((s) => s.id !== itemId)
  // If the user just removed what was the cover, fall back to the first
  // remaining non-text slide so a stale cover ID doesn't reach the server.
  if (editCoverMediaId.value === itemId) {
    editCoverMediaId.value =
      slidesEdit.value.find((s) => s.mediaType !== 'text')?.id ?? null
  }
}

function moveSlide(idx: number, direction: -1 | 1) {
  const newIdx = idx + direction
  if (newIdx < 0 || newIdx >= slidesEdit.value.length) return
  const reordered = slidesEdit.value.slice()
  ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx]!, reordered[idx]!]
  slidesEdit.value = reordered
}

function setCover(itemId: string) {
  editCoverMediaId.value = itemId
}

// Reports whether the edit form holds any pending changes vs. the memory
// snapshot we captured on entering edit mode. Drives the Save-button dirty
// dot, the Cancel-confirm prompt, and the beforeunload guard.
const hasUnsavedChanges = computed(() => {
  if (!editing.value) return false

  const origNote = (props.memory.note ?? '').trim()
  if (editNote.value.trim() !== origNote) return true

  const origMilestone = (props.memory.milestone_label ?? '').trim()
  if (editMilestone.value.trim() !== origMilestone) return true

  const origDate = props.memory.memory_date?.slice(0, 10) ?? ''
  if (editDate.value && editDate.value !== origDate) return true

  const origChildren = (props.memory.memory_children ?? [])
    .map((c) => c.child_id)
    .sort()
  const editChildren = editChildIds.value.slice().sort()
  if (
    origChildren.length !== editChildren.length ||
    origChildren.some((id, i) => id !== editChildren[i])
  )
    return true

  const origMembers = (props.memory.memory_members ?? [])
    .map((m) => m.user_id)
    .sort()
  const editMembers = editMemberIds.value.slice().sort()
  if (
    origMembers.length !== editMembers.length ||
    origMembers.some((id, i) => id !== editMembers[i])
  )
    return true

  if (stagedItems.value.length > 0) return true
  if (removedSlideIds.value.size > 0) return true
  if (editCoverMediaId.value !== (props.memory.cover_media_id ?? null))
    return true

  const order = slidesEdit.value.map((s) => s.id)
  if (
    order.length !== originalSlideOrder.value.length ||
    order.some((id, i) => id !== originalSlideOrder.value[i])
  )
    return true

  return false
})

function startEditing() {
  editNote.value = props.memory.note ?? ''
  editMilestone.value = props.memory.milestone_label ?? ''
  editDate.value = props.memory.memory_date?.slice(0, 10) ?? ''
  editChildIds.value = (props.memory.memory_children ?? []).map(
    (mc) => mc.child_id,
  )
  editMemberIds.value = (props.memory.memory_members ?? []).map(
    (mm) => mm.user_id,
  )
  editing.value = true
  nextTick(() => editTextareaEl.value?.focus())
}

// In-app discard confirmation. We expose a promise-returning helper so the
// async callers (cancelEditing, canClose) read like the old window.confirm
// version but render a styled dialog instead of the browser chrome.
const discardConfirmOpen = ref(false)
let discardResolver: ((value: boolean) => void) | null = null

function askDiscardConfirm(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    discardResolver = resolve
    discardConfirmOpen.value = true
  })
}
function settleDiscardConfirm(decision: boolean) {
  const resolve = discardResolver
  discardResolver = null
  resolve?.(decision)
}

async function cancelEditing() {
  if (hasUnsavedChanges.value && !(await askDiscardConfirm())) return
  clearStagedItems()
  editing.value = false
}

// Asked by MemoryShell before backdrop/X/navigation closes the modal.
// If edits are pending, prompt for discard confirmation.
async function canClose(): Promise<boolean> {
  if (props.viewerMode) return true
  if (!editing.value || !hasUnsavedChanges.value) return true
  const ok = await askDiscardConfirm()
  if (ok) {
    clearStagedItems()
    editing.value = false
  }
  return ok
}
defineExpose({ canClose })

// Browser-level guard: stop tab close / refresh while edits are pending.
// Modern browsers ignore the message string and show their own dialog, but
// preventDefault + returnValue are required to trigger it at all.
function beforeUnloadHandler(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}
watch(
  () => editing.value && hasUnsavedChanges.value,
  (dirty) => {
    if (dirty) window.addEventListener('beforeunload', beforeUnloadHandler)
    else window.removeEventListener('beforeunload', beforeUnloadHandler)
  },
)
onUnmounted(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
})

function toggleEditChild(childId: string) {
  const idx = editChildIds.value.indexOf(childId)
  if (idx === -1) editChildIds.value = [...editChildIds.value, childId]
  else editChildIds.value = editChildIds.value.filter((id) => id !== childId)
}

function toggleEditMember(userId: string) {
  const idx = editMemberIds.value.indexOf(userId)
  if (idx === -1) editMemberIds.value = [...editMemberIds.value, userId]
  else editMemberIds.value = editMemberIds.value.filter((id) => id !== userId)
}

function memberInitials(member: CircleMember): string {
  return (
    (
      (member.firstName?.[0] ?? '') + (member.lastName?.[0] ?? '')
    ).toUpperCase() || '?'
  )
}

async function saveEdit() {
  if (saving.value) return
  saving.value = true
  try {
    const removedIds = Array.from(removedSlideIds.value)
    const desiredOrder = slidesEdit.value.map((s) => s.id)
    const orderChanged =
      desiredOrder.length !== originalSlideOrder.value.length ||
      desiredOrder.some((id, i) => id !== originalSlideOrder.value[i])
    const originalCoverId = props.memory.cover_media_id ?? null
    const coverChanged = editCoverMediaId.value !== originalCoverId

    // Phase 1: independent edits, deletes, and uploads — all in parallel.
    const [editResults, uploadedCount] = await Promise.all([
      Promise.all([
        $fetch<{
          memory: {
            id: string
            note: string | null
            milestone_label: string | null
            memory_date: string
          }
        }>(`/api/memories/${props.memory.id}`, {
          method: 'PATCH',
          body: {
            note: editNote.value.trim() || null,
            milestone_label: editMilestone.value.trim() || null,
            memory_date: editDate.value || undefined,
          },
        }),
        $fetch(`/api/memories/${props.memory.id}/children`, {
          method: 'POST',
          body: { childIds: editChildIds.value },
        }),
        $fetch(`/api/memories/${props.memory.id}/members`, {
          method: 'POST',
          body: { userIds: editMemberIds.value },
        }),
        // Per-slide DELETE for each item the user removed in this session.
        ...removedIds.map((id) =>
          $fetch(`/api/memories/${props.memory.id}/items/${id}`, {
            method: 'DELETE',
          }),
        ),
      ]),
      flushStagedItems(),
    ])
    const [{ memory: updated }] = editResults

    // Phase 2: reorder + cover. Both run after Phase 1 so they operate on the
    // post-delete set of items. They depend on each other's inputs being valid
    // (a deleted ID can't appear in the reorder list or as the cover).
    await Promise.all([
      orderChanged
        ? $fetch(`/api/memories/${props.memory.id}/items/order`, {
            method: 'PATCH',
            body: { orderedIds: desiredOrder },
          })
        : Promise.resolve(),
      coverChanged && editCoverMediaId.value !== null
        ? $fetch(`/api/memories/${props.memory.id}`, {
            method: 'PATCH',
            body: { coverMediaId: editCoverMediaId.value },
          })
        : Promise.resolve(),
    ])

    // Refresh slide data if anything structural changed (uploads, deletes,
    // reorder, cover). Single round-trip syncs both the editor and the
    // view-mode carousel to canonical server state.
    let mediaCount = props.memory.media_count
    const anyStructuralChange =
      uploadedCount > 0 ||
      removedIds.length > 0 ||
      orderChanged ||
      coverChanged
    if (anyStructuralChange) {
      const { slides: refreshed } = await $fetch<{ slides: Slide[] }>(
        `/api/memories/${props.memory.id}/slides`,
      )
      slidesEdit.value = refreshed
      // Push the refreshed carousel state up to MemoryShell (which owns the
      // carousel) and forward the new cover so the page-level handler can
      // patch the timeline cover thumbnail.
      emit('slides-update', {
        slides: refreshed,
        currentSlideIdx: 0,
        coverMediaId: coverChanged ? editCoverMediaId.value : undefined,
      })
      mediaCount = refreshed.length
      // Re-snapshot so further edits in the same session diff cleanly.
      originalSlideOrder.value = refreshed.map((s) => s.id)
      removedSlideIds.value = new Set()
    }

    // Drop successfully-uploaded staged items; keep failures visible so the
    // user can either remove or retry by saving again.
    const failures: StagedItem[] = []
    for (const s of stagedItems.value) {
      if (s.state === 'done') {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
      } else failures.push(s)
    }
    stagedItems.value = failures

    const updatedMemoryChildren = editChildIds.value
      .map((childId) => {
        const child = props.children?.find((c) => c.id === childId)
        return child
          ? {
              child_id: childId,
              childprofile: {
                id: child.id,
                name: child.name,
                date_of_birth: child.date_of_birth,
              },
            }
          : null
      })
      .filter(Boolean) as Memory['memory_children']

    const updatedMemoryMembers = editMemberIds.value
      .map((userId) => {
        const member = props.members?.find((m) => m.userId === userId)
        return member
          ? {
              user_id: userId,
              user: {
                id: member.userId,
                first_name: member.firstName,
                last_name: member.lastName,
                avatar_url: member.avatarUrl,
              },
            }
          : null
      })
      .filter(Boolean) as Memory['memory_members']

    const prevMilestone = props.memory.milestone_label
    const patch: Partial<Memory> & { id: string } = {
      id: updated.id,
      note: updated.note,
      milestone_label: updated.milestone_label,
      memory_date: updated.memory_date,
      memory_children: updatedMemoryChildren,
      memory_members: updatedMemoryMembers,
    }
    if (mediaCount !== undefined) patch.media_count = mediaCount
    if (coverChanged) {
      patch.cover_media_id = editCoverMediaId.value
      // Patch memorymedia[0] so the timeline polaroid swaps to the new cover
      // image without waiting for a full timeline refresh.
      const newCover = slidesEdit.value.find(
        (s) => s.id === editCoverMediaId.value,
      )
      if (newCover && newCover.mediaType !== 'text' && newCover.url) {
        patch.memorymedia = [
          {
            id: newCover.id,
            media_type: newCover.mediaType,
            url: newCover.url,
            thumbnailUrl: newCover.url,
            file_size: 0,
          },
        ]
      }
    }
    emit('update', patch)
    // Stay in edit mode if any upload failed, so the user can fix or retry.
    if (failures.length === 0) editing.value = false

    if (updated.milestone_label && !prevMilestone) {
      track('milestone_created', {
        circle_id: props.memory.circle_id,
        milestone_type: classifyMilestone(updated.milestone_label ?? ''),
      })
      const firstPhoto = props.memory.memorymedia.find(
        (m) => m.media_type !== 'video',
      )
      if (firstPhoto?.url) {
        const ages = updatedMemoryChildren
          .map((mc) => {
            const age = computeBabyAge(
              mc.childprofile.date_of_birth,
              props.memory.memory_date,
            )
            return age ? { name: mc.childprofile.name, age } : null
          })
          .filter(Boolean) as Array<{ name: string; age: string }>
        // MemoryShell owns the share card modal — emit the payload up so it
        // can render. (saveEdit auto-triggers; openShareCard handles the
        // on-demand share button.)
        emit('milestone-share-prompt', {
          photoUrl: firstPhoto.thumbnailUrl ?? firstPhoto.url,
          milestoneLabel: updated.milestone_label,
          memoryDate: props.memory.memory_date,
          childAges: ages,
          onDemand: true,
        })
      }
    }
  } catch (err) {
    console.error('[MemoryDetail] failed to save edit:', err)
  } finally {
    saving.value = false
  }
}
</script>
