<template>
  <!-- Fills the shell's flex-col card. @click closes the emoji picker. -->
  <div class="flex min-h-0 flex-1 flex-col" @click="pickerOpen = false">
    <!-- Editorial quote area — single quick note -->
    <div
      v-if="(props.memory.media_count ?? 0) <= 1"
      class="relative flex flex-shrink-0 flex-col justify-center px-8 pb-8 pt-9"
      style="
        background: color-mix(in srgb, var(--accent) 6%, var(--card));
        min-height: 190px;
        border-bottom: 1px solid hsl(var(--border));
      "
    >
      <!-- Decorative opening quote mark -->
      <span
        class="pointer-events-none absolute select-none"
        aria-hidden="true"
        style="
          font-size: 130px;
          font-family: Georgia, 'Times New Roman', serif;
          color: rgba(200, 168, 130, 0.16);
          top: -8px;
          left: 12px;
          line-height: 1;
          z-index: 0;
        "
        >&ldquo;</span
      >

      <span
        class="absolute right-4 top-3 select-none text-[10px] italic"
        style="color: hsl(var(--muted-foreground) / 0.5)"
        >Quick note</span
      >

      <div
        v-if="props.memory.milestone_label"
        class="mb-3 inline-flex items-center gap-1 self-start rounded-sm px-2 py-[3px]"
        style="
          background: hsl(var(--accent) / 0.88);
          border: 1px solid hsl(var(--accent) / 0.55);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
        "
      >
        <span
          class="text-[9px] font-bold uppercase leading-none tracking-[.18em] text-white/90"
          >✦ {{ props.memory.milestone_label }}</span
        >
      </div>

      <p
        class="relative"
        style="
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 17px;
          line-height: 1.72;
          color: hsl(var(--foreground));
          z-index: 1;
          max-height: 210px;
          overflow-y: auto;
        "
      >
        {{ props.memory.cover_text_content ?? props.memory.note }}
      </p>

      <span
        class="absolute bottom-3 right-4 select-none text-[10px]"
        style="color: hsl(var(--muted-foreground) / 0.5)"
        >{{ formattedDate }}</span
      >
    </div>

    <!-- Multi-slide carousel — multi-text memory -->
    <div
      v-else
      class="relative flex-shrink-0"
      style="
        background: color-mix(in srgb, var(--accent) 6%, var(--card));
        border-bottom: 1px solid hsl(var(--border));
      "
    >
      <!-- Loading skeleton -->
      <div
        v-if="slidesLoading"
        class="skeleton-shimmer"
        style="min-height: 230px"
      />
      <!-- Carousel -->
      <template v-else-if="slides.length > 0">
        <div
          ref="carouselRef"
          class="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          @scroll="onCarouselScroll"
        >
          <div
            v-for="slide in slides"
            :key="slide.id"
            class="relative w-full flex-shrink-0 snap-center px-8 pb-10 pt-9"
            style="min-height: 230px"
          >
            <span
              class="pointer-events-none absolute select-none"
              aria-hidden="true"
              style="
                font-size: 130px;
                font-family: Georgia, 'Times New Roman', serif;
                color: rgba(200, 168, 130, 0.16);
                top: -8px;
                left: 12px;
                line-height: 1;
                z-index: 0;
              "
              >&ldquo;</span
            >
            <p
              v-if="slide.mediaType === 'text'"
              class="relative flex items-center justify-center text-center"
              style="
                font-family: Georgia, 'Times New Roman', serif;
                font-style: italic;
                font-size: 17px;
                line-height: 1.72;
                color: hsl(var(--foreground));
                z-index: 1;
                max-height: 180px;
                overflow-y: auto;
              "
            >
              {{ slide.textContent }}
            </p>
            <img
              v-else-if="slide.mediaType === 'photo'"
              :src="slide.url ?? undefined"
              class="block h-full w-full object-contain"
              style="max-height: 200px; margin: 0 auto"
            />
            <video
              v-else-if="slide.mediaType === 'video'"
              :src="slide.url ?? undefined"
              class="block h-full w-full object-contain"
              style="max-height: 200px; margin: 0 auto"
              controls
              playsinline
              preload="auto"
            />
          </div>
        </div>
        <!-- Dot indicators + counter -->
        <div
          class="pointer-events-none absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1"
        >
          <div class="flex justify-center gap-1">
            <span
              v-for="(_, idx) in slides"
              :key="idx"
              class="h-1.5 w-1.5 rounded-full transition-colors"
              :class="
                idx === currentSlideIdx ? 'bg-foreground' : 'bg-foreground/20'
              "
            />
          </div>
          <span
            class="text-[10px] font-medium tabular-nums text-muted-foreground"
          >
            {{ currentSlideIdx + 1 }} / {{ slides.length }}
          </span>
        </div>
      </template>
    </div>

    <!-- Bottom: info row + comments -->
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- Slim info row — view mode -->
      <div
        v-if="!editing"
        class="flex-shrink-0 space-y-2 border-b border-border px-4 py-3"
      >
        <div class="flex items-center justify-between gap-2">
          <div
            class="flex items-center gap-1.5 text-[12px] text-muted-foreground"
          >
            <span>{{ formattedDate }}</span>
            <template v-if="authorName">
              <span>·</span>
              <span :class="isFormerMember ? 'text-muted-foreground/40' : ''">{{
                authorName
              }}</span>
            </template>
          </div>
          <button
            v-if="isOwner"
            class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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

        <div v-if="childAges.length" class="flex flex-wrap gap-1.5">
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
          v-if="props.memory.memory_members?.length"
          class="flex flex-wrap items-center gap-2"
        >
          <span
            class="text-[10px] font-semibold uppercase tracking-[.08em]"
            style="color: hsl(var(--muted-foreground) / 0.55)"
            >with</span
          >
          <div
            v-for="mm in props.memory.memory_members"
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

        <!-- Reactions row -->
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
              @click="toggleReaction(emoji as string)"
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
            <!-- Add-reaction trigger — matches the smiley-with-plus pattern
                 used on PolaroidCard + MemoryModal. Expands to a labelled
                 button when no reactions exist yet, collapses to icon-only
                 once chips above already teach the affordance. -->
            <button
              class="group inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-secondary/30 text-muted-foreground transition-all hover:border-accent/50 hover:bg-secondary hover:text-foreground"
              :class="hasAnyReaction ? 'w-8 px-0' : 'px-3'"
              :title="t('modal.addReaction')"
              :aria-label="t('modal.addReaction')"
              @click.stop="pickerOpen = !pickerOpen"
            >
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

      <!-- Edit mode panel -->
      <div v-else class="flex-shrink-0 border-b border-border px-4 py-3">
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
          class="mb-3 w-full resize-none rounded-lg bg-secondary px-3 py-2 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-accent/40"
          style="max-height: 120px; overflow-y: auto"
        />

        <div
          v-if="props.members?.length || props.children?.length"
          class="mb-3"
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

        <div class="flex items-center justify-end gap-3">
          <button
            class="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            @click="cancelEditing"
          >
            {{ t('modal.cancel') }}
          </button>
          <button
            :disabled="saving"
            class="text-[12px] font-semibold text-accent transition-colors disabled:text-muted-foreground"
            @click="saveEdit"
          >
            {{ saving ? t('modal.saving') : t('modal.save') }}
          </button>
        </div>
      </div>

      <!-- Comments section -->
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
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
import type { Memory } from '~/composables/useTimeline'
import { computeBabyAge } from '~/composables/useBabyAge'
import { useAnalytics, classifyMilestone } from '~/composables/useAnalytics'

const { t, locale } = useI18n()
const { track } = useAnalytics()

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
  children?: ChildProfile[]
  members?: CircleMember[]
  currentUserId: string | null
  selfAvatarUrl: string | null
  selfInitials: string
}>()

const emit = defineEmits<{
  update: [Pick<Memory, 'id'> & Partial<Memory>]
}>()

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

const pickerOpen = ref(false)

const formattedDate = computed(() =>
  new Date(props.memory.memory_date).toLocaleDateString(locale.value, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }),
)

// ── Multi-item slides (carousel) ─────────────────────────────────────
interface Slide {
  id: string
  mediaType: 'photo' | 'video' | 'text'
  url?: string | null
  textContent?: string
  displayOrder: number
}
const slides = ref<Slide[]>([])
const slidesLoading = ref(false)
const currentSlideIdx = ref(0)
const carouselRef = ref<HTMLDivElement | null>(null)

watch(
  () => props.memory?.id,
  async (id) => {
    if (!id || (props.memory?.media_count ?? 0) <= 1) {
      slides.value = []
      return
    }
    slidesLoading.value = true
    try {
      const data = await $fetch<{ slides: Slide[] }>(
        `/api/memories/${id}/slides`,
      )
      slides.value = data.slides
      currentSlideIdx.value = 0
    } finally {
      slidesLoading.value = false
    }
  },
  { immediate: true },
)

function onCarouselScroll() {
  if (!carouselRef.value) return
  const idx = Math.round(
    carouselRef.value.scrollLeft / carouselRef.value.clientWidth,
  )
  currentSlideIdx.value = idx
}

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

// ── Edit ───────────────────────────────────────────────────
const editing = ref(false)
const saving = ref(false)
const editNote = ref('')
const editMilestone = ref('')
const editDate = ref('')
const editChildIds = ref<string[]>([])
const editMemberIds = ref<string[]>([])
const editTextareaEl = ref<HTMLTextAreaElement>()

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

function cancelEditing() {
  editing.value = false
}

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
  const prevMilestone = props.memory.milestone_label
  try {
    const [{ memory: updated }] = await Promise.all([
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
    ])

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

    emit('update', {
      id: updated.id,
      note: updated.note,
      milestone_label: updated.milestone_label,
      memory_date: updated.memory_date,
      memory_children: updatedMemoryChildren,
      memory_members: updatedMemoryMembers,
    })
    editing.value = false
    if (updated.milestone_label && !prevMilestone) {
      track('milestone_created', {
        circle_id: props.memory.circle_id,
        milestone_type: classifyMilestone(updated.milestone_label ?? ''),
      })
    }
  } catch (err) {
    console.error('[QuickNoteModal] failed to save edit:', err)
  } finally {
    saving.value = false
  }
}

// ── Reactions ──────────────────────────────────────────────
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
  const wasAdding = !existing
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
    console.error('[QuickNoteModal] reaction error:', err)
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
    console.error('[QuickNoteModal] failed to load comments:', err)
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
    console.error('[QuickNoteModal] failed to post comment:', err)
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
    console.error('[QuickNoteModal] failed to update comment:', err)
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
    console.error('[QuickNoteModal] failed to delete comment:', err)
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

// Load comments when the component mounts (triggered by :key change on navigation)
onMounted(() => loadComments())
</script>
