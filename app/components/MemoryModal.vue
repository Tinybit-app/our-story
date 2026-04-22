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
          height: 100%;
          max-width: 750px;
          max-height: 75vh;
          padding: 12px 12px 0;
          opacity: 0;
        "
        @click.stop="pickerOpen = false"
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
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- Photo / video: full width, aspect-ratio drives card height -->
        <div
          class="relative overflow-hidden bg-border flex-shrink-0 aspect-[4/3]"
        >
          <template v-if="firstMedia && firstMedia.media_type !== 'video'">
            <div v-if="!modalImgLoaded" class="absolute inset-0 skeleton-shimmer" />
            <img
              :src="firstMedia.url ?? firstMedia.thumbnailUrl ?? ''"
              :alt="memory?.note ?? t('card.photoAlt')"
              class="absolute inset-0 w-full h-full object-cover block transition-opacity duration-300"
              :class="modalImgLoaded ? 'opacity-100' : 'opacity-0'"
              @load="modalImgLoaded = true"
            />
          </template>
          <video
            v-else-if="firstMedia?.media_type === 'video' && firstMedia.url"
            ref="videoEl"
            :src="firstMedia.url"
            class="absolute inset-0 w-full h-full object-cover block"
            controls
            playsinline
            autoplay
            preload="auto"
          />
          <div
            v-else-if="memory?.note"
            class="absolute inset-0 w-full h-full flex items-center justify-center p-6"
            style="
              background-color: color-mix(
                in srgb,
                var(--accent) 12%,
                var(--card)
              );
              background-image: repeating-linear-gradient(
                transparent,
                transparent 23px,
                color-mix(in srgb, var(--border) 80%, transparent) 24px
              );
            "
          >
            <p class="text-[15px] text-foreground leading-7 text-center">
              {{ memory.note }}
            </p>
          </div>
          <div
            v-else
            class="absolute inset-0 w-full h-full flex items-center justify-center bg-secondary"
          >
            <svg
              class="w-12 h-12 text-muted-foreground/30"
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
        </div>

        <!-- Caption section: tab bar + independent scroll panels -->
        <div class="flex-1 flex flex-col min-h-0">
          <!-- Tab bar -->
          <div class="flex-shrink-0 flex border-b border-border px-3">
            <button
              class="tab-btn py-2.5 px-3 text-[11px] font-semibold tracking-[.06em] border-b-2 transition-colors"
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
              class="tab-btn py-2.5 px-3 text-[11px] font-semibold tracking-[.06em] border-b-2 transition-colors"
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
                class="ml-1 opacity-50 font-normal"
                >{{ comments.length }}</span
              >
            </button>
          </div>

          <!-- Caption tab -->
          <div
            v-show="activeTab === 'caption'"
            class="scroll-styled flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4"
          >
            <!-- View mode -->
            <template v-if="!editing">
              <div class="flex items-start justify-between gap-2 group/meta">
                <div class="flex-1 min-w-0">
                  <div
                    v-if="memory?.milestone_label"
                    class="flex items-center gap-1.5 mb-1.5 group/milestone"
                  >
                    <p class="text-[10px] font-bold text-accent tracking-[.2em] uppercase leading-none">
                      ✦ {{ memory.milestone_label }}
                    </p>
                    <!-- Share card re-entry point — always accessible after the initial prompt -->
                    <button
                      class="opacity-0 group-hover/milestone:opacity-100 flex items-center justify-center w-4 h-4 rounded text-accent/60 hover:text-accent hover:bg-accent/10 transition-all flex-shrink-0"
                      :title="t('milestone.shareTitle')"
                      @click="openShareCard"
                    >
                      <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </button>
                  </div>
                  <p
                    v-if="memory?.note"
                    class="text-[15px] text-foreground leading-relaxed mb-2 overflow-auto break-all"
                  >
                    {{ memory.note }}
                  </p>
                  <p
                    v-else
                    class="text-[13px] text-muted-foreground/50 italic mb-2"
                  >{{ isOwner ? t('modal.noNoteOwner') : t('modal.noNote') }}</p>
                </div>
                <button
                  v-if="isOwner"
                  class="flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover/meta:opacity-100"
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
              <p class="text-[12px] mb-1">
                <span class="text-muted-foreground">{{ formattedDate }}</span>
                <template v-if="authorName">
                  <span class="text-muted-foreground"> · </span>
                  <span :class="isFormerMember ? 'text-muted-foreground/40' : 'text-muted-foreground'">{{ authorName }}</span>
                </template>
              </p>
              <!-- Child age pills -->
              <div v-if="childAges.length" class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-for="child in childAges"
                  :key="child.name"
                  class="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[11px] leading-none font-medium"
                  style="background: hsl(var(--accent) / 0.13); color: hsl(var(--accent));"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8;flex-shrink:0">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M8.5 14s1 2 3.5 2 3.5-2 3.5-2"/>
                    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/>
                    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                  <span>{{ child.name }}</span>
                  <span style="opacity:0.45">·</span>
                  <span style="opacity:0.85">{{ child.age }}</span>
                </span>
              </div>
              <!-- Tagged members: "with" label + avatar+name chips -->
              <div v-if="memory?.memory_members?.length" class="flex items-center gap-2 flex-wrap mt-2">
                <span class="text-[10px] font-semibold tracking-[.08em] uppercase" style="color: hsl(var(--muted-foreground) / 0.55);">with</span>
                <div
                  v-for="mm in memory.memory_members"
                  :key="mm.user_id"
                  class="flex items-center gap-1"
                >
                  <div class="w-5 h-5 rounded-full overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-foreground">
                    <img v-if="mm.user?.avatar_url" :src="mm.user.avatar_url" class="w-full h-full object-cover" />
                    <span v-else>{{ ((mm.user?.first_name?.[0] ?? '') + (mm.user?.last_name?.[0] ?? '')).toUpperCase() || '?' }}</span>
                  </div>
                  <span class="text-[11px] text-muted-foreground">{{ mm.user?.first_name ?? t('common.someone') }}</span>
                </div>
              </div>
              <div class="mb-3" />
            </template>

            <!-- Edit mode -->
            <template v-else>
              <div class="mb-2">
                <div class="flex items-baseline justify-between mb-1">
                  <label
                    class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em]"
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
                  class="w-full bg-secondary rounded-lg px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-accent/40 mb-3"
                />
                <div class="flex items-baseline justify-between mb-1">
                  <label
                    class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em]"
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
                  class="w-full bg-secondary rounded-lg px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-accent/40 leading-relaxed"
                  style="max-height: 140px; overflow-y: auto"
                />
                <!-- Combined people picker: members + children -->
                <div v-if="props.members?.length || props.children?.length" class="mt-3">
                  <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em] mb-1.5">
                    {{ t('modal.whoIsIn') }}
                  </p>
                  <div class="flex flex-wrap gap-1.5">
                    <!-- Member chips -->
                    <button
                      v-for="member in props.members"
                      :key="member.userId"
                      type="button"
                      class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border"
                      :class="editMemberIds.includes(member.userId)
                        ? 'bg-accent/15 border-accent/40 text-foreground'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground'"
                      @click="toggleEditMember(member.userId)"
                    >
                      <span class="w-4 h-4 rounded-full overflow-hidden bg-border flex-shrink-0 flex items-center justify-center text-[7px] font-bold">
                        <img v-if="member.avatarUrl" :src="member.avatarUrl" class="w-full h-full object-cover" />
                        <span v-else>{{ memberInitials(member) }}</span>
                      </span>
                      {{ member.firstName ?? t('common.someone') }}
                    </button>
                    <!-- Child chips -->
                    <button
                      v-for="child in props.children"
                      :key="child.id"
                      type="button"
                      class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border"
                      :class="editChildIds.includes(child.id)
                        ? 'bg-accent/15 border-accent/40 text-foreground'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground'"
                      @click="toggleEditChild(child.id)"
                    >
                      {{ child.name }}
                    </button>
                  </div>
                </div>
                <div class="flex items-center justify-end mt-1.5">
                  <div class="flex items-center gap-2">
                    <button
                      class="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                      @click="cancelEditing"
                    >
                      {{ t('modal.cancel') }}
                    </button>
                    <button
                      :disabled="saving"
                      class="text-[12px] font-semibold text-accent disabled:text-muted-foreground transition-colors"
                      @click="saveEdit"
                    >
                      {{ saving ? t('modal.saving') : t('modal.save') }}
                    </button>
                  </div>
                </div>
              </div>
              <p class="text-[12px] mb-1">
                <span class="text-muted-foreground">{{ formattedDate }}</span>
                <template v-if="authorName">
                  <span class="text-muted-foreground"> · </span>
                  <span :class="isFormerMember ? 'text-muted-foreground/40' : 'text-muted-foreground'">{{ authorName }}</span>
                </template>
              </p>
              <div v-if="childAges.length" class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-for="child in childAges"
                  :key="child.name"
                  class="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[11px] leading-none font-medium"
                  style="background: hsl(var(--accent) / 0.13); color: hsl(var(--accent));"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8;flex-shrink:0">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M8.5 14s1 2 3.5 2 3.5-2 3.5-2"/>
                    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/>
                    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                  <span>{{ child.name }}</span>
                  <span style="opacity:0.45">·</span>
                  <span style="opacity:0.85">{{ child.age }}</span>
                </span>
              </div>
              <div class="mb-3" />
            </template>

            <!-- Reactions -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <div
                v-for="(group, emoji) in reactionGroups"
                :key="emoji"
                class="relative group/rxn"
              >
                <button
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all duration-150"
                  :class="
                    group.mine
                      ? 'bg-accent/15 border-accent/25 text-foreground font-medium'
                      : 'bg-secondary border-transparent text-muted-foreground hover:border-border'
                  "
                  @click="toggleReaction(emoji as string)"
                >
                  {{ emoji }}<span class="text-[11px]">{{ group.count }}</span>
                </button>
                <!-- Tooltip -->
                <div
                  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-[10px] rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover/rxn:opacity-100 transition-opacity duration-150 z-40 shadow-md"
                >
                  {{ reactionTooltip(group.names) }}
                  <div
                    class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground"
                  />
                </div>
              </div>
              <div class="relative">
                <button
                  class="w-8 h-8 rounded-full border border-border text-muted-foreground text-[16px] flex items-center justify-center hover:bg-secondary transition-colors"
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
                    class="absolute bottom-full mb-1.5 left-0 z-30 bg-card border border-border rounded-xl shadow-xl px-2 py-1.5 grid gap-0.5"
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
          </div>

          <!-- Comments tab -->
          <div
            v-show="activeTab === 'comments'"
            class="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <!-- Comment input — always visible at top of tab -->
            <div class="flex-shrink-0 px-3 py-3 border-b border-border">
              <div class="flex gap-2 items-center">
                <div
                  class="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground"
                >
                  <img
                    v-if="selfAvatarUrl"
                    :src="selfAvatarUrl"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ selfInitials }}</span>
                </div>
                <div
                  class="flex-1 flex items-end gap-2 bg-secondary rounded-2xl px-3 py-2"
                >
                  <textarea
                    ref="textareaEl"
                    v-model="commentDraft"
                    :placeholder="t('modal.addComment')"
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
                  >
                    {{ submitting ? "…" : t('modal.post') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Comment thread — scrollable -->
            <div
              class="scroll-styled flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4"
            >
              <div v-if="comments.length > 0" class="space-y-3">
                <div
                  v-for="c in visibleComments"
                  :key="c.id"
                  class="flex gap-2.5 group/comment"
                >
                  <div
                    class="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground"
                  >
                    <img
                      v-if="c.user?.avatar_url"
                      :src="c.user.avatar_url"
                      class="w-full h-full object-cover"
                    />
                    <span v-else>{{ commentInitials(c.user) }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <!-- View mode -->
                    <template v-if="editingCommentId !== c.id">
                      <div class="relative">
                        <div
                          class="bg-secondary rounded-2xl rounded-tl-sm px-3 py-2"
                        >
                          <span
                            class="text-[11px] font-semibold text-foreground mr-1.5"
                            >{{ commentDisplayName(c.user) }}</span
                          >
                          <span
                            class="text-[13px] text-foreground leading-snug"
                            >{{ c.body }}</span
                          >
                        </div>
                        <!-- Pencil edit button (own comments only) -->
                        <button
                          v-if="c.user_id === currentUserId"
                          class="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-accent hover:border-accent/40 transition-all opacity-0 group-hover/comment:opacity-100 shadow-sm"
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
                      </div>
                      <p class="text-[10px] text-muted-foreground mt-0.5 ml-3">
                        {{ timeAgo(c.created_at) }}
                      </p>
                    </template>

                    <!-- Edit mode -->
                    <template v-else>
                      <div
                        class="bg-secondary rounded-2xl rounded-tl-sm px-3 py-2"
                      >
                        <span
                          class="text-[11px] font-semibold text-foreground mr-1.5 block mb-1"
                          >{{ commentDisplayName(c.user) }}</span
                        >
                        <textarea
                          ref="commentEditEl"
                          v-model="commentEditDraft"
                          rows="2"
                          maxlength="2000"
                          class="w-full bg-transparent text-[13px] text-foreground resize-none outline-none leading-snug"
                          style="max-height: 120px; overflow-y: auto"
                          @keydown.enter.exact.prevent="saveCommentEdit(c.id)"
                          @keydown.escape="cancelCommentEdit"
                        />
                      </div>
                      <div class="flex items-center gap-2 mt-1 ml-3">
                        <span class="text-[10px] text-muted-foreground"
                          >{{ commentEditDraft.length }} / 2000</span
                        >
                        <button
                          class="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          @click="cancelCommentEdit"
                        >
                          {{ t('modal.cancel') }}
                        </button>
                        <button
                          :disabled="!commentEditDraft.trim() || savingComment"
                          class="text-[11px] font-semibold text-accent disabled:text-muted-foreground transition-colors"
                          @click="saveCommentEdit(c.id)"
                        >
                          {{ savingComment ? t('modal.saving') : t('modal.save') }}
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <p
                v-else
                class="text-[12px] text-muted-foreground text-center py-6"
              >
                {{ t('modal.noComments') }}
              </p>
              <button
                v-if="!allCommentsVisible && hiddenCommentCount > 0"
                class="mt-3 w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors text-left"
                @click="allCommentsVisible = true"
              >
                {{ t('modal.viewOlderComments', hiddenCommentCount) }} ↓
              </button>
            </div>
          </div>
        </div>
        <!-- /caption section -->
      </div>
      <!-- /polaroid -->
    </div>
  </Teleport>

  <!-- Milestone share card — offered when a milestone label is newly set in edit mode -->
  <MilestoneShareModal
    v-if="shareCardData"
    :photo-url="shareCardData.photoUrl"
    :milestone-label="shareCardData.milestoneLabel"
    :memory-date="shareCardData.memoryDate"
    :child-ages="shareCardData.childAges"
    :on-demand="shareCardData.onDemand"
    @close="shareCardData = null"
  />
</template>

<script setup lang="ts">
import type { Memory } from "~/composables/useTimeline";
import { computeBabyAge } from "~/composables/useBabyAge";
const { t, locale } = useI18n()

interface ChildProfile { id: string; name: string; date_of_birth: string }
interface CircleMember { userId: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }

const props = defineProps<{
  memories: Memory[];
  startIndex: number | null;
  originRect: DOMRect | null;
  tilt: number;
  children?: ChildProfile[];
  members?: CircleMember[];
}>();

const emit = defineEmits<{
  close: [];
  update: [Pick<Memory, "id"> & Partial<Memory>];
}>();

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
const videoEl = ref<HTMLVideoElement>();
const visible = ref(false);

function stopVideo() {
  if (videoEl.value) {
    videoEl.value.pause();
    videoEl.value.currentTime = 0;
  }
}
const pickerOpen = ref(false);
const navigating = ref(false);


// ── Current memory ─────────────────────────────────────────
const currentIndex = ref(0);
const memory = computed(() => props.memories[currentIndex.value] ?? null);
const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value < props.memories.length - 1);

const firstMedia = computed(() => memory.value?.memorymedia[0] ?? null);
const modalImgLoaded = ref(false);

// Reset when navigating to a different memory
watch(firstMedia, () => { modalImgLoaded.value = false; });

const formattedDate = computed(() => {
  if (!memory.value) return "";
  return new Date(memory.value.memory_date).toLocaleDateString(locale.value, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
});

const childAges = computed(() => {
  if (!memory.value) return [];
  return (memory.value.memory_children ?? [])
    .map((mc) => ({ name: mc.childprofile.name, age: computeBabyAge(mc.childprofile.date_of_birth, memory.value!.memory_date) }))
    .filter((c) => c.age !== null) as Array<{ name: string; age: string }>;
});

const isFormerMember = computed(() => memory.value?.owner_user_id === null);

const authorName = computed(() => {
  if (memory.value?.user?.first_name) return memory.value.user.first_name;
  if (isFormerMember.value && memory.value?.former_owner_name) return memory.value.former_owner_name;
  return null;
});

// ── Reactions ──────────────────────────────────────────────
const supabaseClient = useSupabaseClient();
// Initialise synchronously from useSupabaseUser (available from SSR/hydration);
// fall back to getSession() in case the ref hasn't populated yet.
const currentUserId = ref<string | null>(useSupabaseUser().value?.id ?? null);
if (!currentUserId.value) {
  supabaseClient.auth.getSession().then(({ data }) => {
    currentUserId.value = data.session?.user?.id ?? null;
  });
}

// ── Edit note ──────────────────────────────────────────────
const activeTab = ref<"caption" | "comments">("caption");
const editing = ref(false);
const noteExpanded = ref(false);
const saving = ref(false);
const editNote = ref("");
const editMilestone = ref("");

interface ShareCardData {
  photoUrl: string;
  milestoneLabel: string;
  memoryDate: string;
  childAges: Array<{ name: string; age: string }>;
  onDemand?: boolean;
}
const shareCardData = ref<ShareCardData | null>(null);
const editChildIds = ref<string[]>([]);
const editMemberIds = ref<string[]>([]);
const editTextareaEl = ref<HTMLTextAreaElement>();

const isOwner = computed(
  () =>
    !!currentUserId.value &&
    memory.value?.owner_user_id === currentUserId.value,
);

function startEditing() {
  editNote.value = memory.value?.note ?? "";
  editMilestone.value = memory.value?.milestone_label ?? "";
  editChildIds.value = (memory.value?.memory_children ?? []).map((mc) => mc.child_id);
  editMemberIds.value = (memory.value?.memory_members ?? []).map((mm) => mm.user_id);
  editing.value = true;
  nextTick(() => editTextareaEl.value?.focus());
}

function toggleEditChild(childId: string) {
  const idx = editChildIds.value.indexOf(childId);
  if (idx === -1) editChildIds.value = [...editChildIds.value, childId];
  else editChildIds.value = editChildIds.value.filter((id) => id !== childId);
}

function toggleEditMember(userId: string) {
  const idx = editMemberIds.value.indexOf(userId);
  if (idx === -1) editMemberIds.value = [...editMemberIds.value, userId];
  else editMemberIds.value = editMemberIds.value.filter((id) => id !== userId);
}

function memberInitials(member: CircleMember): string {
  return ((member.firstName?.[0] ?? '') + (member.lastName?.[0] ?? '')).toUpperCase() || '?';
}

function cancelEditing() {
  editing.value = false;
}

async function saveEdit() {
  if (saving.value || !memory.value) return;
  saving.value = true;
  try {
    const [{ memory: updated }] = await Promise.all([
      $fetch<{
        memory: {
          id: string;
          note: string | null;
          milestone_label: string | null;
        };
      }>(`/api/memories/${memory.value.id}`, {
        method: "PATCH",
        body: {
          note: editNote.value.trim() || null,
          milestone_label: editMilestone.value.trim() || null,
        },
      }),
      $fetch(`/api/memories/${memory.value.id}/children`, {
        method: "POST",
        body: { childIds: editChildIds.value },
      }),
      $fetch(`/api/memories/${memory.value.id}/members`, {
        method: "POST",
        body: { userIds: editMemberIds.value },
      }),
    ]);

    // Reconstruct memory_children from editChildIds + available children profiles
    const updatedMemoryChildren = editChildIds.value
      .map((childId) => {
        const child = props.children?.find((c) => c.id === childId);
        return child
          ? { child_id: childId, childprofile: { id: child.id, name: child.name, date_of_birth: child.date_of_birth } }
          : null;
      })
      .filter(Boolean) as Memory["memory_children"];

    // Reconstruct memory_members from editMemberIds + available member profiles
    const updatedMemoryMembers = editMemberIds.value
      .map((userId) => {
        const member = props.members?.find((m) => m.userId === userId);
        return member
          ? { user_id: userId, user: { id: member.userId, first_name: member.firstName, last_name: member.lastName, avatar_url: member.avatarUrl } }
          : null;
      })
      .filter(Boolean) as Memory["memory_members"];

    const prevMilestone = memory.value.milestone_label;

    // Propagate to parent memoriesFlat
    emit("update", {
      id: updated.id,
      note: updated.note,
      milestone_label: updated.milestone_label,
      memory_children: updatedMemoryChildren,
      memory_members: updatedMemoryMembers,
    });
    editing.value = false;

    // Offer share card when a milestone is newly set (not just edited) and a photo is available
    if (updated.milestone_label && !prevMilestone) {
      const firstMedia = memory.value.memorymedia.find((m) => m.media_type !== "video");
      if (firstMedia?.url) {
        const childAges = updatedMemoryChildren
          .map((mc) => {
            const age = computeBabyAge(mc.childprofile.date_of_birth, memory.value!.memory_date);
            return age ? { name: mc.childprofile.name, age } : null;
          })
          .filter(Boolean) as Array<{ name: string; age: string }>;

        shareCardData.value = {
          photoUrl: firstMedia.thumbnailUrl ?? firstMedia.url,
          milestoneLabel: updated.milestone_label,
          memoryDate: memory.value.memory_date,
          childAges,
        };
      }
    }
  } catch (err) {
    console.error("[MemoryModal] failed to save edit:", err);
  } finally {
    saving.value = false;
  }
}

// Open the share card on demand (re-entry point from the ✦ milestone badge)
function openShareCard() {
  if (!memory.value?.milestone_label) return;
  const firstMedia = memory.value.memorymedia.find((m) => m.media_type !== "video");
  if (!firstMedia?.url) return;

  const childAges = (memory.value.memory_children ?? [])
    .map((mc) => {
      const age = computeBabyAge(mc.childprofile.date_of_birth, memory.value!.memory_date);
      return age ? { name: mc.childprofile.name, age } : null;
    })
    .filter(Boolean) as Array<{ name: string; age: string }>;

  shareCardData.value = {
    photoUrl: firstMedia.thumbnailUrl ?? firstMedia.url,
    milestoneLabel: memory.value.milestone_label,
    memoryDate: memory.value.memory_date,
    childAges,
    onDemand: true,
  };
}

type Reaction = {
  id: string;
  emoji: string;
  user_id: string | null;
  guest_name: string | null;
  user: { first_name: string | null; last_name: string | null } | null;
};
const localReactions = ref<Reaction[]>([]);

const reactionGroups = computed(() => {
  const groups: Record<
    string,
    { count: number; mine: boolean; names: string[] }
  > = {};
  for (const r of localReactions.value) {
    if (!r.emoji) continue;
    if (!groups[r.emoji])
      groups[r.emoji] = { count: 0, mine: false, names: [] };
    const g = groups[r.emoji]!;
    g.count++;
    if (r.user_id === currentUserId.value) {
      g.mine = true;
      g.names.unshift(t('common.you'));
    } else if (!r.user_id) {
      // Guest reaction from viewer link — use guest_name if available
      g.names.push(r.guest_name ?? t('common.someone'));
    } else {
      g.names.push(r.user?.first_name ?? t('common.someone'));
    }
  }
  return groups;
});

function reactionTooltip(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

async function toggleReaction(emoji: string) {
  const userId =
    currentUserId.value ??
    (await supabaseClient.auth.getSession()).data.session?.user?.id;
  if (!userId || !memory.value) return;
  if (!currentUserId.value) currentUserId.value = userId;

  const existing = localReactions.value.find(
    (r) => r.emoji === emoji && r.user_id === userId,
  );
  if (existing) {
    localReactions.value = localReactions.value.filter((r) => r !== existing);
  } else {
    localReactions.value = [
      ...localReactions.value,
      { id: "optimistic", emoji, user_id: userId, guest_name: null, user: null },
    ];
  }

  const memoryId = memory.value.id;
  try {
    const { reactions } = await $fetch<{ reactions: any[] }>(
      `/api/memories/${memoryId}/reactions`,
      { method: "POST", body: { emoji } },
    );
    localReactions.value = reactions;
    emit("update", { id: memoryId, memoryreaction: reactions });
  } catch (err) {
    console.error("[MemoryModal] reaction error:", err);
    localReactions.value = [...(memory.value?.memoryreaction ?? [])] as Reaction[];
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

  stopVideo();

  // Switch to new memory
  currentIndex.value = newIdx;
  localReactions.value = [...(props.memories[newIdx]?.memoryreaction ?? [])] as Reaction[];
  comments.value = [];
  commentDraft.value = "";
  allCommentsVisible.value = false;
  activeTab.value = "caption";
  editing.value = false;
  noteExpanded.value = false;
  editNote.value = "";
  editMilestone.value = "";
  editChildIds.value = [];
  editMemberIds.value = [];
  editingCommentId.value = null;
  commentEditDraft.value = "";

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
  stopVideo();
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
  if (!user) return t('common.someone');
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : t('common.someone');
}

function commentInitials(user: Comment["user"]): string {
  const first = user?.first_name?.[0] ?? "";
  const last = user?.last_name?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

// ── Comment editing ────────────────────────────────────────
const editingCommentId = ref<string | null>(null);
const commentEditDraft = ref("");
const savingComment = ref(false);
const commentEditEl = ref<HTMLTextAreaElement>();

function startEditingComment(c: Comment) {
  editingCommentId.value = c.id;
  commentEditDraft.value = c.body;
  nextTick(() => commentEditEl.value?.focus());
}

function cancelCommentEdit() {
  editingCommentId.value = null;
  commentEditDraft.value = "";
}

async function saveCommentEdit(commentId: string) {
  const body = commentEditDraft.value.trim();
  if (!body || savingComment.value || !memory.value) return;
  savingComment.value = true;
  try {
    await $fetch(`/api/memories/${memory.value.id}/comments/${commentId}`, {
      method: "PATCH",
      body: { body },
    });
    const idx = comments.value.findIndex((c) => c.id === commentId);
    if (idx !== -1) comments.value[idx] = { ...comments.value[idx]!, body };
    editingCommentId.value = null;
    commentEditDraft.value = "";
  } catch (err) {
    console.error("[MemoryModal] failed to update comment:", err);
  } finally {
    savingComment.value = false;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minsAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hoursAgo', { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t('common.daysAgo', { n: days });
  return new Date(iso).toLocaleDateString(locale.value, {
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
      localReactions.value = [...(props.memories[idx]?.memoryreaction ?? [])] as Reaction[];
      comments.value = [];
      commentDraft.value = "";
      allCommentsVisible.value = false;
      activeTab.value = "caption";
      editing.value = false;
      editNote.value = "";
      editMilestone.value = "";
      editChildIds.value = [];
      editMemberIds.value = [];
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
