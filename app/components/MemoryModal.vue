<template>
  <!-- Fills the shell's flex-col card. @click closes the emoji picker. -->
  <div class="flex flex-col flex-1 min-h-0" @click="pickerOpen = false">

    <!-- Photo / video — single item -->
    <div v-if="(memory.media_count ?? 1) <= 1" class="relative overflow-hidden bg-border flex-shrink-0 aspect-[4/3]">
      <template v-if="firstMedia && firstMedia.media_type !== 'video'">
        <div v-if="!modalImgLoaded" class="absolute inset-0 skeleton-shimmer" />
        <img
          :src="firstMedia.url ?? firstMedia.thumbnailUrl ?? ''"
          :alt="memory.note ?? t('card.photoAlt')"
          class="absolute inset-0 w-full h-full object-cover block transition-opacity duration-300"
          :class="modalImgLoaded ? 'opacity-100' : 'opacity-0'"
          @load="modalImgLoaded = true"
        />
      </template>
      <video
        v-else-if="firstMedia?.media_type === 'video' && firstMedia.url"
        :src="firstMedia.url"
        class="absolute inset-0 w-full h-full object-cover block"
        controls
        playsinline
        autoplay
        preload="auto"
      />
      <div
        v-else-if="memory.note"
        class="absolute inset-0 w-full h-full flex items-center justify-center p-6"
        style="
          background-color: color-mix(in srgb, var(--accent) 12%, var(--card));
          background-image: repeating-linear-gradient(transparent, transparent 23px, color-mix(in srgb, var(--border) 80%, transparent) 24px);
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

      <!-- Download / share action buttons (photo or video only) -->
      <div v-if="firstMedia?.url" class="absolute top-2 right-2 flex gap-1.5 z-10">
        <!-- Share with watermark (images only) -->
        <button
          v-if="firstMedia.media_type !== 'video'"
          class="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          :title="t('modal.sharePhoto')"
          aria-label="Share photo"
          @click.stop="shareMedia"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
        <!-- Save to device -->
        <button
          class="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors disabled:opacity-50"
          :title="t('modal.saveToDevice')"
          aria-label="Save to device"
          :disabled="downloading"
          @click.stop="downloadMedia"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Photo / video — multi-item carousel -->
    <div v-if="(memory.media_count ?? 1) > 1" class="relative flex-shrink-0 bg-border">
      <!-- Loading skeleton -->
      <div v-if="slidesLoading" class="aspect-[4/3] skeleton-shimmer" />
      <!-- Carousel -->
      <template v-else-if="slides.length > 0">
        <div ref="carouselRef" class="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar" @scroll="onCarouselScroll">
          <div v-for="slide in slides" :key="slide.id" class="snap-center flex-shrink-0 w-full">
            <div class="relative aspect-[4/3] overflow-hidden bg-border">
              <img
                v-if="slide.mediaType === 'photo'"
                :src="slide.url ?? undefined"
                class="absolute inset-0 w-full h-full object-cover block"
              />
              <video
                v-else-if="slide.mediaType === 'video'"
                :src="slide.url ?? undefined"
                class="absolute inset-0 w-full h-full object-cover block"
                controls
                playsinline
                preload="auto"
              />
              <div
                v-else
                class="absolute inset-0 w-full h-full flex items-center justify-center p-8"
                style="
                  background-color: color-mix(in srgb, var(--accent) 12%, var(--card));
                  background-image: repeating-linear-gradient(transparent, transparent 23px, color-mix(in srgb, var(--border) 80%, transparent) 24px);
                "
              >
                <p class="text-[15px] text-foreground leading-7 text-center">{{ slide.textContent }}</p>
              </div>
            </div>
          </div>
        </div>
        <!-- Dot indicators + counter -->
        <div class="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
          <div class="flex justify-center gap-1">
            <span
              v-for="(_, idx) in slides"
              :key="idx"
              class="w-1.5 h-1.5 rounded-full transition-colors"
              :class="idx === currentSlideIdx ? 'bg-white' : 'bg-white/40'"
            />
          </div>
          <span class="text-[10px] text-white/70 font-medium tabular-nums drop-shadow">
            {{ currentSlideIdx + 1 }} / {{ slides.length }}
          </span>
        </div>
      </template>
    </div>

    <!-- Caption section: tab bar + independent scroll panels -->
    <div class="flex-1 flex flex-col min-h-0">
      <!-- Tab bar -->
      <div class="flex-shrink-0 flex border-b border-border px-3">
        <button
          class="tab-btn py-2.5 px-3 text-[11px] font-semibold tracking-[.06em] border-b-2 transition-colors"
          :class="activeTab === 'caption' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'caption'"
        >
          {{ t('modal.tabCaption') }}
        </button>
        <button
          class="tab-btn py-2.5 px-3 text-[11px] font-semibold tracking-[.06em] border-b-2 transition-colors"
          :class="activeTab === 'comments' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'comments'"
        >
          {{ t('modal.tabComments') }}
          <span v-if="comments.length > 0" class="ml-1 opacity-50 font-normal">{{ comments.length }}</span>
        </button>
      </div>

      <!-- Caption tab -->
      <div v-show="activeTab === 'caption'" class="scroll-styled flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4">
        <!-- View mode -->
        <template v-if="!editing">
          <div class="flex items-start justify-between gap-2 group/meta">
            <div class="flex-1 min-w-0">
              <div v-if="memory.milestone_label" class="flex items-center gap-1.5 mb-1.5 group/milestone">
                <p class="text-[10px] font-bold text-accent tracking-[.2em] uppercase leading-none">
                  ✦ {{ memory.milestone_label }}
                </p>
                <button
                  class="flex items-center justify-center w-4 h-4 rounded text-accent/60 hover:text-accent hover:bg-accent/10 transition-all flex-shrink-0"
                  :title="t('milestone.shareTitle')"
                  @click="openShareCard"
                >
                  <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>
              </div>
              <p v-if="memory.note" class="text-[15px] text-foreground leading-relaxed mb-2 overflow-auto break-all">
                {{ memory.note }}
              </p>
              <p v-else class="text-[13px] text-muted-foreground/50 italic mb-2">
                {{ isOwner ? t('modal.noNoteOwner') : t('modal.noNote') }}
              </p>
            </div>
            <button
              v-if="isOwner"
              class="flex-shrink-0 mt-0.5 w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              :title="t('modal.editNote')"
              @click="startEditing"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
          <div v-if="childAges.length" class="flex flex-wrap gap-1.5 mt-2">
            <span
              v-for="child in childAges"
              :key="child.name"
              class="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[11px] leading-none font-medium"
              style="background: hsl(var(--accent) / 0.13); color: hsl(var(--accent));"
            >
              <span style="font-size:10px;flex-shrink:0;line-height:1">👶</span>
              <span>{{ child.name }}</span>
              <template v-if="child.age">
                <span style="opacity:0.45">·</span>
                <span style="opacity:0.85">{{ child.age }}</span>
              </template>
            </span>
          </div>
          <div v-if="memory.memory_members?.length" class="flex items-center gap-2 flex-wrap mt-2">
            <span class="text-[10px] font-semibold tracking-[.08em] uppercase" style="color: hsl(var(--muted-foreground) / 0.55)">with</span>
            <div v-for="mm in memory.memory_members" :key="mm.user_id" class="flex items-center gap-1">
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
            <label class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em] block mb-1">{{ t('modal.date') }}</label>
            <input
              v-model="editDate"
              type="date"
              :max="new Date().toLocaleDateString('en-CA')"
              class="w-full bg-secondary rounded-lg px-3 py-1.5 text-base text-foreground outline-none focus:ring-1 focus:ring-accent/40 mb-3"
              :style="{ colorScheme: $colorMode.value === 'dark' ? 'dark' : 'light' }"
            />
            <div class="flex items-baseline justify-between mb-1">
              <label class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em]">{{ t('modal.milestone') }}</label>
              <span class="text-[10px]" :class="editMilestone.length >= 40 ? 'text-destructive' : 'text-muted-foreground'">{{ editMilestone.length }} / 40</span>
            </div>
            <input
              v-model="editMilestone"
              type="text"
              :placeholder="t('modal.milestonePlaceholder')"
              maxlength="40"
              class="w-full bg-secondary rounded-lg px-3 py-1.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-accent/40 mb-3"
            />
            <div class="flex items-baseline justify-between mb-1">
              <label class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em]">{{ t('modal.note') }}</label>
              <span class="text-[10px]" :class="editNote.length >= 500 ? 'text-destructive' : 'text-muted-foreground'">{{ editNote.length }} / 500</span>
            </div>
            <textarea
              ref="editTextareaEl"
              v-model="editNote"
              :placeholder="t('modal.notePlaceholder')"
              rows="3"
              maxlength="500"
              class="w-full bg-secondary rounded-lg px-3 py-2 text-base text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-accent/40 leading-relaxed"
              style="max-height: 140px; overflow-y: auto"
            />
            <div v-if="props.members?.length || props.children?.length" class="mt-3">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em] mb-1.5">{{ t('modal.whoIsIn') }}</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="member in props.members"
                  :key="member.userId"
                  type="button"
                  class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border"
                  :class="editMemberIds.includes(member.userId) ? 'bg-accent/15 border-accent/40 text-foreground' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'"
                  @click="toggleEditMember(member.userId)"
                >
                  <span class="w-4 h-4 rounded-full overflow-hidden bg-border flex-shrink-0 flex items-center justify-center text-[7px] font-bold">
                    <img v-if="member.avatarUrl" :src="member.avatarUrl" class="w-full h-full object-cover" />
                    <span v-else>{{ memberInitials(member) }}</span>
                  </span>
                  {{ member.firstName ?? t('common.someone') }}
                </button>
                <button
                  v-for="child in props.children"
                  :key="child.id"
                  type="button"
                  class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border"
                  :class="editChildIds.includes(child.id) ? 'bg-accent/15 border-accent/40 text-foreground' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'"
                  @click="toggleEditChild(child.id)"
                >
                  {{ child.name }}
                </button>
              </div>
            </div>
            <!-- Slides editor (multi-item only) -->
            <div v-if="(memory.media_count ?? 1) > 1" class="mt-4 pt-4 border-t border-border">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-[.12em] mb-2">
                {{ t('modal.slides') }}
              </p>

              <!-- Slide list -->
              <div class="space-y-2 mb-3">
                <div
                  v-for="(slide, idx) in slidesEdit"
                  :key="slide.id"
                  class="flex items-center gap-2 p-2 bg-secondary rounded-[10px]"
                >
                  <!-- Thumbnail / preview -->
                  <div class="w-10 h-10 rounded-[6px] bg-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                    <img v-if="slide.mediaType === 'photo'" :src="slide.url ?? undefined" class="w-full h-full object-cover" />
                    <video v-else-if="slide.mediaType === 'video'" :src="slide.url ?? undefined" class="w-full h-full object-cover" muted />
                    <span v-else class="text-[8px] italic text-muted-foreground p-1 text-center line-clamp-3">{{ (slide.textContent ?? '').slice(0, 30) }}…</span>
                  </div>
                  <!-- Type label -->
                  <span class="text-[11px] text-muted-foreground flex-1 min-w-0">
                    {{ slide.mediaType === 'text' ? t('modal.slideTypeText') : slide.mediaType === 'video' ? t('modal.slideTypeVideo') : t('modal.slideTypePhoto') }}
                    <span v-if="slide.id === memory.cover_media_id" class="ml-1 text-[9px] text-accent uppercase tracking-wider">{{ t('modal.cover') }}</span>
                  </span>
                  <!-- Move up -->
                  <button
                    type="button"
                    :disabled="idx === 0"
                    class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 flex-shrink-0"
                    :aria-label="t('modal.moveUp')"
                    @click="moveSlide(idx, -1)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"/></svg>
                  </button>
                  <!-- Move down -->
                  <button
                    type="button"
                    :disabled="idx === slidesEdit.length - 1"
                    class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 flex-shrink-0"
                    :aria-label="t('modal.moveDown')"
                    @click="moveSlide(idx, 1)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  <!-- Set cover (photo/video only) -->
                  <button
                    v-if="slide.mediaType !== 'text' && slide.id !== memory.cover_media_id"
                    type="button"
                    class="text-[10px] text-accent hover:opacity-70 px-1 flex-shrink-0"
                    @click="setCover(slide.id)"
                  >
                    {{ t('modal.setAsCover') }}
                  </button>
                  <!-- Remove -->
                  <button
                    type="button"
                    class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive flex-shrink-0"
                    :aria-label="t('modal.removeSlide')"
                    @click="removeSlide(slide.id)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Add text slide -->
              <div v-if="!showAddTextSlide" class="text-center">
                <button
                  type="button"
                  class="text-[11px] text-accent hover:opacity-70 font-medium"
                  @click="showAddTextSlide = true"
                >
                  + {{ t('modal.addTextSlide') }}
                </button>
              </div>
              <div v-else class="space-y-2">
                <textarea
                  v-model="newTextSlideContent"
                  :placeholder="t('modal.notePlaceholder')"
                  rows="3"
                  maxlength="2000"
                  class="w-full bg-secondary rounded-lg px-3 py-2 text-base text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-accent/40"
                />
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="text-[12px] text-muted-foreground hover:text-foreground"
                    @click="showAddTextSlide = false; newTextSlideContent = ''"
                  >
                    {{ t('modal.cancel') }}
                  </button>
                  <button
                    type="button"
                    :disabled="!newTextSlideContent.trim()"
                    class="text-[12px] font-semibold text-accent disabled:text-muted-foreground"
                    @click="addTextSlide"
                  >
                    {{ t('modal.add') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end mt-1.5">
              <div class="flex items-center gap-2">
                <button class="text-[12px] text-muted-foreground hover:text-foreground transition-colors" @click="cancelEditing">
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
              <span style="font-size:10px;flex-shrink:0;line-height:1">👶</span>
              <span>{{ child.name }}</span>
              <template v-if="child.age">
                <span style="opacity:0.45">·</span>
                <span style="opacity:0.85">{{ child.age }}</span>
              </template>
            </span>
          </div>
          <div class="mb-3" />
        </template>

        <!-- Reactions -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <div v-for="(group, emoji) in reactionGroups" :key="emoji" class="relative group/rxn">
            <button
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all duration-150"
              :class="group.mine ? 'bg-accent/15 border-accent/25 text-foreground font-medium' : 'bg-secondary border-transparent text-muted-foreground hover:border-border'"
              @click="toggleReaction(emoji as string)"
            >
              {{ emoji }}<span class="text-[11px]">{{ group.count }}</span>
            </button>
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-[10px] rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover/rxn:opacity-100 transition-opacity duration-150 z-40 shadow-md">
              {{ reactionTooltip(group.names) }}
              <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
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
                  @click.stop="toggleReaction(e); pickerOpen = false;"
                >
                  {{ e }}
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- Comments tab -->
      <div v-show="activeTab === 'comments'" class="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div class="flex-shrink-0 px-3 py-3 border-b border-border">
          <div class="flex gap-2 items-center">
            <div class="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
              <img v-if="props.selfAvatarUrl" :src="props.selfAvatarUrl" class="w-full h-full object-cover" />
              <span v-else>{{ props.selfInitials }}</span>
            </div>
            <div class="flex-1 flex items-end gap-2 bg-secondary rounded-2xl px-3 py-2">
              <textarea
                ref="textareaEl"
                v-model="commentDraft"
                :placeholder="t('modal.addComment')"
                rows="1"
                class="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground resize-none outline-none leading-snug"
                style="max-height: 80px; overflow-y: auto"
                @keydown.enter.exact.prevent="submitComment"
                @input="autoResize"
              />
              <button
                :disabled="!commentDraft.trim() || submitting"
                class="flex-shrink-0 text-[12px] font-semibold text-accent disabled:text-muted-foreground transition-colors pb-0.5"
                @click="submitComment"
              >
                {{ submitting ? '…' : t('modal.post') }}
              </button>
            </div>
          </div>
        </div>
        <div class="scroll-styled flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4">
          <div v-if="comments.length > 0" class="space-y-3">
            <div v-for="c in visibleComments" :key="c.id" class="flex gap-2.5 group/comment">
              <div class="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                <img v-if="c.user?.avatar_url" :src="c.user.avatar_url" class="w-full h-full object-cover" />
                <span v-else>{{ commentInitials(c.user) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <template v-if="editingCommentId !== c.id">
                  <div class="relative">
                    <div class="bg-secondary rounded-2xl rounded-tl-sm px-3 py-2">
                      <span class="text-[11px] font-semibold text-foreground mr-1.5">{{ commentDisplayName(c.user) }}</span>
                      <span class="text-[13px] text-foreground leading-snug">{{ c.body }}</span>
                    </div>
                    <div
                      v-if="c.user_id === props.currentUserId"
                      class="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover/comment:opacity-100 transition-all"
                    >
                      <button
                        class="w-5 h-5 flex items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors shadow-sm"
                        :title="t('modal.editComment')"
                        @click.stop="startEditingComment(c)"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        class="w-5 h-5 flex items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shadow-sm"
                        :title="t('modal.deleteComment')"
                        @click.stop="requestDeleteComment(c.id)"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <!-- Timestamp + edited label -->
                  <p class="text-[10px] text-muted-foreground mt-0.5 ml-3">
                    {{ timeAgo(c.created_at) }}
                    <span v-if="c.updated_at" class="ml-1 opacity-60">· {{ t('modal.edited') }}</span>
                  </p>
                  <!-- Inline delete confirmation -->
                  <div v-if="confirmDeleteId === c.id" class="flex items-center gap-2 mt-1 ml-3">
                    <span class="text-[11px] text-muted-foreground">{{ t('modal.confirmDelete') }}</span>
                    <button
                      class="text-[11px] font-semibold text-destructive hover:opacity-80 transition-opacity"
                      @click="deleteComment(c.id)"
                    >{{ t('modal.delete') }}</button>
                    <button
                      class="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      @click="cancelDeleteComment"
                    >{{ t('modal.cancel') }}</button>
                  </div>
                </template>
                <template v-else>
                  <div class="bg-secondary rounded-2xl rounded-tl-sm px-3 py-2">
                    <span class="text-[11px] font-semibold text-foreground mr-1.5 block mb-1">{{ commentDisplayName(c.user) }}</span>
                    <textarea
                      ref="commentEditEl"
                      v-model="commentEditDraft"
                      rows="2"
                      maxlength="2000"
                      class="w-full bg-transparent text-base text-foreground resize-none outline-none leading-snug"
                      style="max-height: 120px; overflow-y: auto"
                      @keydown.enter.exact.prevent="saveCommentEdit(c.id)"
                      @keydown.escape="cancelCommentEdit"
                    />
                  </div>
                  <div class="flex items-center gap-2 mt-1 ml-3">
                    <span class="text-[10px] text-muted-foreground">{{ commentEditDraft.length }} / 2000</span>
                    <button class="text-[11px] text-muted-foreground hover:text-foreground transition-colors" @click="cancelCommentEdit">
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
          <p v-else class="text-[12px] text-muted-foreground text-center py-6">{{ t('modal.noComments') }}</p>
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
  </div>

  <!-- Milestone share card — uses its own Teleport, so position is independent -->
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
import type { Memory } from '~/composables/useTimeline'
import { computeBabyAge } from '~/composables/useBabyAge'
import { useAnalytics } from "~/composables/useAnalytics"
const { t, locale } = useI18n()
const { track } = useAnalytics()

interface ChildProfile { id: string; name: string; date_of_birth: string }
interface CircleMember { userId: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }

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

const PRESET_EMOJIS = ['❤️', '😂', '😍', '🥹', '👏', '🔥', '😮', '🥰', '😭', '✨', '🎉', '👍']

const pickerOpen = ref(false)
const modalImgLoaded = ref(false)

const memory = computed(() => props.memory)
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)

// ── Multi-item carousel ────────────────────────────────────
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

watch(() => props.memory?.id, async (id) => {
  currentSlideIdx.value = 0
  if (!id || (props.memory?.media_count ?? 1) <= 1) {
    slides.value = []
    return
  }
  slidesLoading.value = true
  try {
    const data = await $fetch<{ slides: Slide[] }>(`/api/memories/${id}/slides`)
    slides.value = data.slides
  } finally {
    slidesLoading.value = false
  }
}, { immediate: true })

function onCarouselScroll() {
  if (!carouselRef.value) return
  const idx = Math.round(carouselRef.value.scrollLeft / carouselRef.value.clientWidth)
  currentSlideIdx.value = idx
}

const formattedDate = computed(() =>
  new Date(props.memory.memory_date).toLocaleDateString(locale.value, { month: 'long', day: 'numeric', year: 'numeric' })
)

const childAges = computed(() =>
  (props.memory.memory_children ?? [])
    .map(mc => ({ name: mc.childprofile.name, age: computeBabyAge(mc.childprofile.date_of_birth, props.memory.memory_date) }))
)

const isFormerMember = computed(() => props.memory.owner_user_id === null)
const authorName = computed(() => {
  if (props.memory.user?.first_name) return props.memory.user.first_name
  if (isFormerMember.value && props.memory.former_owner_name) return props.memory.former_owner_name
  return null
})

const isOwner = computed(() => !!props.currentUserId && props.memory.owner_user_id === props.currentUserId)

// ── Edit ───────────────────────────────────────────────────
const activeTab = ref<'caption' | 'comments'>('caption')
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
const newTextSlideContent = ref('')
const showAddTextSlide = ref(false)

watch(editing, async (isEditing) => {
  if (isEditing && (props.memory.media_count ?? 1) > 1) {
    try {
      const data = await $fetch<{ slides: Slide[] }>(`/api/memories/${props.memory.id}/slides`)
      slidesEdit.value = data.slides.slice().sort((a, b) => a.displayOrder - b.displayOrder)
    } catch (err) {
      console.error('[MemoryModal] failed to load slides for edit:', err)
    }
  } else if (!isEditing) {
    slidesEdit.value = []
    showAddTextSlide.value = false
    newTextSlideContent.value = ''
  }
})

async function addTextSlide() {
  const content = newTextSlideContent.value.trim()
  if (!content) return
  try {
    const { itemId } = await $fetch<{ itemId: string }>(`/api/memories/${props.memory.id}/items`, {
      method: 'POST',
      body: { type: 'text', textContent: content },
    })
    slidesEdit.value.push({
      id: itemId,
      mediaType: 'text',
      textContent: content,
      displayOrder: slidesEdit.value.length,
    })
    showAddTextSlide.value = false
    newTextSlideContent.value = ''
    emit('update', { id: props.memory.id, media_count: slidesEdit.value.length })
  } catch (err) {
    console.error('[edit] add text slide failed:', err)
  }
}

async function removeSlide(itemId: string) {
  try {
    await $fetch(`/api/memories/${props.memory.id}/items/${itemId}`, { method: 'DELETE' })
    slidesEdit.value = slidesEdit.value.filter((s) => s.id !== itemId)
    emit('update', { id: props.memory.id, media_count: slidesEdit.value.length })
  } catch (err) {
    console.error('[edit] remove slide failed:', err)
  }
}

async function moveSlide(idx: number, direction: -1 | 1) {
  const newIdx = idx + direction
  if (newIdx < 0 || newIdx >= slidesEdit.value.length) return
  const reordered = slidesEdit.value.slice()
  ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx]!, reordered[idx]!]
  slidesEdit.value = reordered
  try {
    await $fetch(`/api/memories/${props.memory.id}/items/order`, {
      method: 'PATCH',
      body: { orderedIds: reordered.map((s) => s.id) },
    })
  } catch (err) {
    console.error('[edit] reorder failed:', err)
  }
}

async function setCover(itemId: string) {
  try {
    await $fetch(`/api/memories/${props.memory.id}`, {
      method: 'PATCH',
      body: { coverMediaId: itemId },
    })
    emit('update', { id: props.memory.id, cover_media_id: itemId })
  } catch (err) {
    console.error('[edit] set cover failed:', err)
  }
}

function startEditing() {
  editNote.value = props.memory.note ?? ''
  editMilestone.value = props.memory.milestone_label ?? ''
  editDate.value = props.memory.memory_date?.slice(0, 10) ?? ''
  editChildIds.value = (props.memory.memory_children ?? []).map(mc => mc.child_id)
  editMemberIds.value = (props.memory.memory_members ?? []).map(mm => mm.user_id)
  editing.value = true
  nextTick(() => editTextareaEl.value?.focus())
}

function cancelEditing() { editing.value = false }

function toggleEditChild(childId: string) {
  const idx = editChildIds.value.indexOf(childId)
  if (idx === -1) editChildIds.value = [...editChildIds.value, childId]
  else editChildIds.value = editChildIds.value.filter(id => id !== childId)
}

function toggleEditMember(userId: string) {
  const idx = editMemberIds.value.indexOf(userId)
  if (idx === -1) editMemberIds.value = [...editMemberIds.value, userId]
  else editMemberIds.value = editMemberIds.value.filter(id => id !== userId)
}

function memberInitials(member: CircleMember): string {
  return ((member.firstName?.[0] ?? '') + (member.lastName?.[0] ?? '')).toUpperCase() || '?'
}

async function saveEdit() {
  if (saving.value) return
  saving.value = true
  try {
    const [{ memory: updated }] = await Promise.all([
      $fetch<{ memory: { id: string; note: string | null; milestone_label: string | null; memory_date: string } }>(
        `/api/memories/${props.memory.id}`,
        { method: 'PATCH', body: { note: editNote.value.trim() || null, milestone_label: editMilestone.value.trim() || null, memory_date: editDate.value || undefined } }
      ),
      $fetch(`/api/memories/${props.memory.id}/children`, { method: 'POST', body: { childIds: editChildIds.value } }),
      $fetch(`/api/memories/${props.memory.id}/members`, { method: 'POST', body: { userIds: editMemberIds.value } }),
    ])

    const updatedMemoryChildren = editChildIds.value
      .map(childId => { const child = props.children?.find(c => c.id === childId); return child ? { child_id: childId, childprofile: { id: child.id, name: child.name, date_of_birth: child.date_of_birth } } : null })
      .filter(Boolean) as Memory['memory_children']

    const updatedMemoryMembers = editMemberIds.value
      .map(userId => { const member = props.members?.find(m => m.userId === userId); return member ? { user_id: userId, user: { id: member.userId, first_name: member.firstName, last_name: member.lastName, avatar_url: member.avatarUrl } } : null })
      .filter(Boolean) as Memory['memory_members']

    const prevMilestone = props.memory.milestone_label
    emit('update', { id: updated.id, note: updated.note, milestone_label: updated.milestone_label, memory_date: updated.memory_date, memory_children: updatedMemoryChildren, memory_members: updatedMemoryMembers })
    editing.value = false

    if (updated.milestone_label && !prevMilestone) {
      track("milestone_created", {
        circle_id: props.memory.circle_id,
        milestone_type: updated.milestone_label,
      })
      const firstPhoto = props.memory.memorymedia.find(m => m.media_type !== 'video')
      if (firstPhoto?.url) {
        const ages = updatedMemoryChildren
          .map(mc => { const age = computeBabyAge(mc.childprofile.date_of_birth, props.memory.memory_date); return age ? { name: mc.childprofile.name, age } : null })
          .filter(Boolean) as Array<{ name: string; age: string }>
        shareCardData.value = { photoUrl: firstPhoto.thumbnailUrl ?? firstPhoto.url, milestoneLabel: updated.milestone_label, memoryDate: props.memory.memory_date, childAges: ages }
      }
    }
  } catch (err) {
    console.error('[MemoryModal] failed to save edit:', err)
  } finally {
    saving.value = false
  }
}

// ── Share card ─────────────────────────────────────────────
interface ShareCardData { photoUrl: string; milestoneLabel: string; memoryDate: string; childAges: Array<{ name: string; age: string }>; onDemand?: boolean }
const shareCardData = ref<ShareCardData | null>(null)

function openShareCard() {
  if (!props.memory.milestone_label) return
  const firstPhoto = props.memory.memorymedia.find(m => m.media_type !== 'video')
  if (!firstPhoto?.url) return
  const ages = (props.memory.memory_children ?? [])
    .map(mc => { const age = computeBabyAge(mc.childprofile.date_of_birth, props.memory.memory_date); return age ? { name: mc.childprofile.name, age } : null })
    .filter(Boolean) as Array<{ name: string; age: string }>
  shareCardData.value = { photoUrl: firstPhoto.thumbnailUrl ?? firstPhoto.url, milestoneLabel: props.memory.milestone_label, memoryDate: props.memory.memory_date, childAges: ages, onDemand: true }
}

// ── Download / share ───────────────────────────────────────
const downloading = ref(false)

async function downloadMedia() {
  const media = firstMedia.value
  if (!media?.url) return
  downloading.value = true
  try {
    const res = await fetch(media.url)
    const blob = await res.blob()
    const ext = media.media_type === 'video' ? 'mp4' : (blob.type.split('/')[1] || 'jpg')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `our-story-${props.memory.memory_date}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (err) {
    console.error('[MemoryModal] download failed:', err)
  } finally {
    downloading.value = false
  }
}

async function shareMedia() {
  const media = firstMedia.value
  if (!media?.url || media.media_type === 'video') return
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('cors'))
      img.src = media.url!
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    // Watermark: small "Our Story" in bottom-right corner
    const margin = Math.round(canvas.width * 0.025)
    const fontSize = Math.max(20, Math.round(canvas.width * 0.03))
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 10
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.fillText('Our Story', canvas.width - margin, canvas.height - margin)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) return
    const filename = `our-story-${props.memory.memory_date}.jpg`
    const file = new File([blob], filename, { type: 'image/jpeg' })
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    }
  } catch (err) {
    // User dismissed the share sheet (AbortError) — do nothing
    if (err instanceof DOMException && err.name === 'AbortError') return
    // CORS blocked the canvas draw — fall back to plain download
    await downloadMedia()
  }
}

// ── Reactions ──────────────────────────────────────────────
type Reaction = { id: string; emoji: string; user_id: string | null; guest_name: string | null; user: { first_name: string | null; last_name: string | null } | null }
const supabaseClient = useSupabaseClient()

// Initialized from prop — :key on this component resets it per-memory
const localReactions = ref<Reaction[]>([...(props.memory.memoryreaction ?? [])] as Reaction[])

const reactionGroups = computed(() => {
  const groups: Record<string, { count: number; mine: boolean; names: string[] }> = {}
  for (const r of localReactions.value) {
    if (!r.emoji) continue
    if (!groups[r.emoji]) groups[r.emoji] = { count: 0, mine: false, names: [] }
    const g = groups[r.emoji]!
    g.count++
    if (r.user_id === props.currentUserId) { g.mine = true; g.names.unshift(t('common.you')) }
    else if (!r.user_id) g.names.push(r.guest_name ?? t('common.someone'))
    else g.names.push(r.user?.first_name ?? t('common.someone'))
  }
  return groups
})

function reactionTooltip(names: string[]): string {
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

async function toggleReaction(emoji: string) {
  const userId = props.currentUserId ?? (await supabaseClient.auth.getSession()).data.session?.user?.id
  if (!userId) return
  const existing = localReactions.value.find(r => r.emoji === emoji && r.user_id === userId)
  if (existing) localReactions.value = localReactions.value.filter(r => r !== existing)
  else localReactions.value = [...localReactions.value, { id: 'optimistic', emoji, user_id: userId, guest_name: null, user: null }]

  const memoryId = props.memory.id
  const wasAdding = !existing
  try {
    const { reactions } = await $fetch<{ reactions: any[] }>(`/api/memories/${memoryId}/reactions`, { method: 'POST', body: { emoji } })
    localReactions.value = reactions
    emit('update', { id: memoryId, memoryreaction: reactions })
    if (wasAdding) {
      track("reaction_added", {
        circle_id: props.memory.circle_id,
        memory_id: memoryId,
        emoji,
      })
    }
  } catch (err) {
    console.error('[MemoryModal] reaction error:', err)
    localReactions.value = [...(props.memory.memoryreaction ?? [])] as Reaction[]
  }
}

// ── Comments ───────────────────────────────────────────────
type Comment = { id: string; body: string; created_at: string; updated_at: string | null; user_id: string; user: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null }
const comments = ref<Comment[]>([])
const commentDraft = ref('')
const allCommentsVisible = ref(false)
const COMMENT_LIMIT = 5
const sortedComments = computed(() => [...comments.value].reverse())
const visibleComments = computed(() => allCommentsVisible.value ? sortedComments.value : sortedComments.value.slice(0, COMMENT_LIMIT))
const hiddenCommentCount = computed(() => Math.max(0, comments.value.length - COMMENT_LIMIT))
const submitting = ref(false)
const textareaEl = ref<HTMLTextAreaElement>()

async function loadComments() {
  try {
    const { comments: fetched } = await $fetch<{ comments: Comment[] }>(`/api/memories/${props.memory.id}/comments`)
    comments.value = fetched
  } catch (err) {
    console.error('[MemoryModal] failed to load comments:', err)
  }
}

async function submitComment() {
  const body = commentDraft.value.trim()
  if (!body || submitting.value) return
  submitting.value = true
  try {
    const { comments: updated } = await $fetch<{ comments: Comment[] }>(`/api/memories/${props.memory.id}/comments`, { method: 'POST', body: { body } })
    comments.value = updated
    commentDraft.value = ''
    if (textareaEl.value) textareaEl.value.style.height = 'auto'
    track("comment_added", {
      circle_id: props.memory.circle_id,
      memory_id: props.memory.id,
    })
  } catch (err) {
    console.error('[MemoryModal] failed to post comment:', err)
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
  return ((user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '')).toUpperCase() || '?'
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
    await $fetch(`/api/memories/${props.memory.id}/comments/${commentId}`, { method: 'PATCH', body: { body } })
    const idx = comments.value.findIndex(c => c.id === commentId)
    if (idx !== -1) comments.value[idx] = { ...comments.value[idx]!, body, updated_at: new Date().toISOString() }
    editingCommentId.value = null
    commentEditDraft.value = ''
  } catch (err) {
    console.error('[MemoryModal] failed to update comment:', err)
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
    await $fetch(`/api/memories/${props.memory.id}/comments/${commentId}`, { method: 'DELETE' })
    comments.value = comments.value.filter(c => c.id !== commentId)
  } catch (err) {
    console.error('[MemoryModal] failed to delete comment:', err)
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
  return new Date(iso).toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
}

// Load comments when the component mounts (triggered by :key change on navigation)
onMounted(() => loadComments())
</script>
