<template>
  <Teleport to="body">
    <div
      v-if="visible && isDesktop"
      class="fixed inset-0 z-50 flex items-center justify-center p-6"
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

      <!-- Prev arrow — outside the card, vertically centered -->
      <button
        v-if="hasPrev"
        class="absolute left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
        style="top: 50%; transform: translateY(-50%)"
        :aria-label="t('modal.swipeHintPrev')"
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

      <!-- Next arrow — outside the card, vertically centered -->
      <button
        v-if="hasNext"
        class="absolute right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
        style="top: 50%; transform: translateY(-50%)"
        :aria-label="t('modal.swipeHintNext')"
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

      <!-- Close — top-right, outside the card -->
      <button
        class="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
        :aria-label="t('modal.closeAriaLabel')"
        @click="close"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <!-- Card: two-column composition (or single-column for quick-note).
           opacity-0 via Tailwind so JS animation owns opacity without
           reactive conflicts. -->
      <div
        ref="cardEl"
        :class="[
          'relative z-10 flex max-h-[85vh] gap-3 opacity-0 will-change-transform',
          isQuickNote
            ? 'w-[min(90vw,460px)]'
            : 'w-full max-w-[1280px]',
        ]"
        @click.stop
      >
        <!-- Photo column — omitted for quick-note memories.
             flex-1 with max-w gives the photo whatever remains after the
             detail column, capped at 800px on wide screens. min-w-0 lets
             the column shrink below its content's intrinsic size. -->
        <div
          v-if="currentMemory && !isQuickNote"
          class="flex h-[80vh] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-card"
          style="max-width: 800px"
        >
          <Transition
            :name="navDirection === 'prev' ? 'mshell-prev' : 'mshell-next'"
            mode="out-in"
          >
            <MemoryViewer
              :key="currentMemory.id"
              :memory="currentMemory"
              :slides="slides"
              :slides-loading="slidesLoading"
              :current-slide-idx="currentSlideIdx"
              fit-mode="contain"
              fill-container
              @current-slide-idx="currentSlideIdx = $event"
              @navigate-memory="navigate($event)"
            />
          </Transition>
        </div>

        <!-- Detail column -->
        <div
          v-if="currentMemory"
          :class="[
            'flex flex-col overflow-hidden rounded-xl bg-background',
            isQuickNote
              ? 'h-[min(80vh,640px)] w-full'
              : 'h-[80vh] w-[min(38vw,440px)] min-w-[320px] flex-shrink-0',
          ]"
        >
          <MemoryDetail
            ref="memoryModalRef"
            :memory="currentMemory"
            :children="children ?? []"
            :members="members ?? []"
            :current-user-id="currentUserId"
            :self-avatar-url="selfAvatarUrl"
            :self-initials="selfInitials"
            :slides="slides"
            :current-slide-idx="currentSlideIdx"
            @update="emit('update', $event)"
            @slides-update="onSlidesUpdate"
            @open-share-card="openShareCard"
            @milestone-share-prompt="shareCardData = $event"
          />
        </div>
      </div>
    </div>

    <div
      v-else-if="visible && !isDesktop"
      ref="mobileContainerEl"
      class="fixed inset-0 z-50 bg-background"
      :style="{
        transform: dismissOffsetY > 0 ? `translateY(${dismissOffsetY}px)` : '',
        opacity:
          dismissOffsetY > 0
            ? Math.max(0, 1 - dismissOffsetY / (mobileViewportHeight * 0.7))
            : 1,
        transition: isVerticalDragging
          ? 'none'
          : 'transform 280ms cubic-bezier(0.4, 0, 1, 1), opacity 280ms ease',
      }"
    >
      <!-- Floating chrome — close + counter (with inline prev/next chevrons
           when there are multiple memories — important affordance for
           multi-photo memories where horizontal swipe drives the carousel
           and can't double as memory navigation). -->
      <div
        class="absolute left-3 right-3 top-3 z-30 flex items-center justify-between transition-opacity duration-200"
        :class="chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      >
        <button
          class="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md"
          :aria-label="t('modal.closeAriaLabel')"
          @click="close"
        >
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div
          v-if="memories.length > 1"
          class="flex items-center gap-0.5 rounded-full bg-black/55 py-0.5 pl-0.5 pr-0.5 backdrop-blur-md"
        >
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:pointer-events-none disabled:text-white/25"
            :disabled="!hasPrev"
            :aria-label="t('modal.swipeHintPrev')"
            @click="navigate('prev')"
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span class="select-none px-1 text-[11px] font-semibold text-white">
            {{ currentIndex + 1 }} / {{ memories.length }}
          </span>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:pointer-events-none disabled:text-white/25"
            :disabled="!hasNext"
            :aria-label="t('modal.swipeHintNext')"
            @click="navigate('next')"
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <span class="h-9 w-9" /><!-- spacer to balance the close button -->
      </div>

      <!-- Outer Transition fires only on type swap (photo↔quicknote). For
           same-type navigation the outer key is stable and the inner photo
           Transition handles animating the photo region. -->
      <Transition
        :name="navDirection === 'prev' ? 'mshell-prev' : 'mshell-next'"
        mode="out-in"
      >
        <!-- Quick-note path -->
        <div
          v-if="currentMemory && isQuickNote"
          key="qn"
          class="absolute inset-0 z-20 flex items-center justify-center p-4"
        >
          <QuickNoteModal
            :key="currentMemory.id"
            :memory="currentMemory"
            :children="children"
            :members="members"
            :current-user-id="currentUserId"
            :self-avatar-url="selfAvatarUrl"
            :self-initials="selfInitials"
            @update="emit('update', $event)"
          />
        </div>

        <!-- Media path: photo region + drawer wrapped so Transition has a
             single root for the type-swap animation. -->
        <div
          v-else-if="currentMemory && !isQuickNote"
          key="media"
          class="absolute inset-0"
        >
          <!-- Photo region fills viewport above the drawer.
               touch-action 'none' makes JS own the pointer stream — needed
               for single-photo swipe-to-next-memory and the vertical-down
               parallax dismiss. On multi-photo, the inner MemoryViewer's
               JS-controlled carousel handles within-memory swipes and emits
               navigate-memory when the user swipes past the first/last
               slide. -->
          <div
            ref="photoRegionEl"
            class="absolute inset-x-0 top-0 z-10 overflow-hidden"
            :style="{
              bottom: `${drawer.heightPx.value}px`,
              touchAction: 'none',
              transition: drawer.isDragging.value
                ? 'none'
                : 'bottom 280ms cubic-bezier(0.32, 0.72, 0, 1)',
            }"
            @pointerdown="onPhotoPointerDown"
            @pointermove="onPhotoPointerMove"
            @click="onPhotoClick"
          >
            <Transition
              :name="navDirection === 'prev' ? 'mshell-prev' : 'mshell-next'"
              mode="out-in"
            >
              <MemoryViewer
                :key="currentMemory.id"
                :memory="currentMemory"
                :slides="slides"
                :slides-loading="slidesLoading"
                :current-slide-idx="currentSlideIdx"
                fill-container
                @current-slide-idx="currentSlideIdx = $event"
                @navigate-memory="navigate($event)"
              />
            </Transition>
          </div>

          <!-- Drawer surface -->
          <div
            class="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[22px] bg-background shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
            :style="{
              height: `${drawer.heightPx.value}px`,
              transition: drawer.isDragging.value
                ? 'none'
                : 'height 280ms cubic-bezier(0.32, 0.72, 0, 1)',
            }"
          >
            <!-- Grabber — generous 36px hit zone above the visible 4px pill. -->
            <div
              class="flex h-9 flex-shrink-0 cursor-grab items-center justify-center touch-none"
              :class="drawer.isDragging.value && 'cursor-grabbing'"
              @pointerdown="onGrabberPointerDown"
            >
              <div class="h-1 w-9 rounded-full bg-foreground/30" />
            </div>

            <div class="min-h-0 flex-1 overflow-hidden">
              <MemoryDetail
                ref="memoryModalRef"
                :memory="currentMemory"
                :children="children ?? []"
                :members="members ?? []"
                :current-user-id="currentUserId"
                :self-avatar-url="selfAvatarUrl"
                :self-initials="selfInitials"
                :slides="slides"
                :current-slide-idx="currentSlideIdx"
                @update="emit('update', $event)"
                @slides-update="onSlidesUpdate"
                @open-share-card="openShareCard"
                @milestone-share-prompt="shareCardData = $event"
              />
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Milestone share card — rendered for both viewports; self-teleports
         to body via its own internal <Teleport>, so position is independent
         of the modal layout. -->
    <MilestoneShareModal
      v-if="shareCardData"
      :photo-url="shareCardData.photoUrl"
      :milestone-label="shareCardData.milestoneLabel"
      :memory-date="shareCardData.memoryDate"
      :child-ages="shareCardData.childAges"
      :on-demand="shareCardData.onDemand"
      @close="shareCardData = null"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from '~/types/memory'
import { useSnapDrawer } from '~/composables/useSnapDrawer'
import { computeBabyAge } from '~/composables/useBabyAge'

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
  memories: Memory[]
  startIndex: number | null
  originRect: DOMRect | null
  tilt: number
  children?: ChildProfile[]
  members?: CircleMember[]
}>()

const emit = defineEmits<{
  close: []
  update: [Pick<Memory, 'id'> & Partial<Memory>]
}>()

const isDesktop = useMediaQuery('(min-width: 768px)')
const { t } = useI18n()

// ── Auth + profile (fetched once, passed down to content) ──
const supabaseClient = useSupabaseClient()
const currentUserId = ref<string | null>(useSupabaseUser().value?.id ?? null)
if (!currentUserId.value) {
  supabaseClient.auth.getSession().then(({ data }) => {
    currentUserId.value = data.session?.user?.id ?? null
  })
}

const selfAvatarUrl = ref<string | null>(null)
const selfInitials = ref('?')
supabaseClient.auth.getSession().then(async ({ data }) => {
  if (!data.session?.user?.id) return
  try {
    const profile = await $fetch<{
      avatarUrl: string | null
      firstName: string | null
      lastName: string | null
    }>('/api/profile')
    selfAvatarUrl.value = profile.avatarUrl
    const parts = [profile.firstName, profile.lastName].filter(Boolean)
    selfInitials.value =
      parts
        .map((p) => p![0])
        .join('')
        .toUpperCase() || '?'
  } catch {
    /* non-critical */
  }
})

// ── Core state ─────────────────────────────────────────────
const cardEl = ref<HTMLElement>()
const backdropEl = ref<HTMLElement>()
const mobileContainerEl = ref<HTMLElement>()
const visible = ref(false)
const navigating = ref(false)

// Mobile vertical-down dismiss parallax. dismissOffsetY tracks how far the
// finger has dragged down; the mobile container translates by that amount
// with proportional opacity. isVerticalDragging gates the CSS transition
// so real-time drag is 1:1 and release animates smoothly.
const dismissOffsetY = ref(0)
const isVerticalDragging = ref(false)
const mobileViewportHeight = ref(
  typeof window !== 'undefined' ? window.innerHeight : 800,
)
// Direction of the in-flight navigation, used by the mobile photo-region
// <Transition> to pick which slide animation plays (next = slide right→left,
// prev = slide left→right). Null when no navigation is in flight.
const navDirection = ref<'next' | 'prev' | null>(null)
const currentIndex = ref(0)
// The active child modal can expose a canClose() guard so we can prompt the
// user before discarding unsaved edits via backdrop / X / arrow navigation.
const memoryModalRef = ref<{ canClose?: () => Promise<boolean> } | null>(null)

// ── Mobile-only state (parallels MemoryModal's for desktop) ───
// MemoryShell composes <MemoryViewer> + <MemoryDetail> directly on mobile
// (bypassing MemoryModal which still owns the desktop slide state), so it
// takes on the slide-load duplicate. This goes away in sub-plan #3d.
const slides = ref<Slide[]>([])
const slidesLoading = ref(false)
const currentSlideIdx = ref(0)

// Mobile-only share card state (parallels MemoryModal's).
interface ShareCardData {
  photoUrl: string
  milestoneLabel: string
  memoryDate: string
  childAges: Array<{ name: string; age: string }>
  onDemand?: boolean
}
const shareCardData = ref<ShareCardData | null>(null)

// Snap drawer state (initialized lazily; viewportHeight needs window).
const drawer = useSnapDrawer({
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
  snaps: ['peek', 'default', 'full'],
})

// Chrome visibility (for Task 6 tap-to-toggle). Start visible.
const chromeVisible = ref(true)

// Photo region element ref (used in Tasks 4-5 for swipe gestures).
const photoRegionEl = ref<HTMLElement>()

// ── Photo region gestures (mobile) ────────────────────────
// One unified pointer handler that distinguishes tap / horizontal swipe /
// vertical-down parallax. Multi-photo memories have their own carousel
// handler that consumes horizontal touches first (vertical falls through
// to here for the parallax dismiss).
const pointerMoved = ref(false)

function onPhotoPointerDown(e: PointerEvent) {
  if (isDesktop.value) return
  const startX = e.clientX
  const startY = e.clientY
  let lockedDirection: 'horizontal' | 'vertical-down' | null = null
  pointerMoved.value = false

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY

    if (!pointerMoved.value && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      pointerMoved.value = true
    }

    if (lockedDirection === null) {
      // Wait for 12px of movement before committing to a direction.
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
      if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
        // Vertical down → parallax dismiss
        lockedDirection = 'vertical-down'
        isVerticalDragging.value = true
      } else if (Math.abs(dx) > Math.abs(dy) && !isMultiPhoto.value) {
        // Horizontal on single-photo → memory navigation (tracked on release)
        lockedDirection = 'horizontal'
      } else {
        // Multi-photo horizontal (owned by carousel) or vertical-up (no-op):
        // detach and let other handlers continue.
        cleanup()
        return
      }
    }

    if (lockedDirection === 'vertical-down' && dy > 0) {
      dismissOffsetY.value = dy
    }
  }

  const onUp = (ev: PointerEvent) => {
    cleanup()

    if (lockedDirection === 'vertical-down') {
      isVerticalDragging.value = false
      const dy = ev.clientY - startY
      const dismissThreshold = Math.max(120, mobileViewportHeight.value * 0.18)
      if (dy >= dismissThreshold) {
        // Commit dismiss — close() will animate the rest of the way out
        // by setting dismissOffsetY to viewport height.
        close()
      } else {
        // Snap back to resting position via CSS transition.
        dismissOffsetY.value = 0
      }
    } else if (lockedDirection === 'horizontal' && !isMultiPhoto.value) {
      const dx = ev.clientX - startX
      if (dx <= -60) navigate('next')
      else if (dx >= 60) navigate('prev')
    }
  }

  function cleanup() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

// onPhotoPointerMove kept as a no-op alias so the existing @pointermove
// template binding doesn't error — all real handling now lives in the
// window listeners attached by onPhotoPointerDown.
function onPhotoPointerMove(_e: PointerEvent) {}

function onPhotoClick() {
  if (pointerMoved.value) return // gesture in progress; skip the toggle
  chromeVisible.value = !chromeVisible.value
}

async function confirmCloseIfNeeded(): Promise<boolean> {
  const guard = memoryModalRef.value?.canClose
  if (!guard) return true
  return guard()
}

// ── Derived ────────────────────────────────────────────────
const currentMemory = computed(() => props.memories[currentIndex.value] ?? null)
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < props.memories.length - 1)
const isMultiPhoto = computed(
  () => (currentMemory.value?.media_count ?? 1) > 1,
)
const isQuickNote = computed(() => {
  const m = currentMemory.value
  return !!m && !m.memorymedia.length && !!m.note
})

// ── Enter animation ────────────────────────────────────────
async function runEnterAnimation() {
  const el = cardEl.value
  const bd = backdropEl.value
  if (!el) return

  const targetRect = el.getBoundingClientRect()

  if (props.originRect) {
    const srcCX = props.originRect.left + props.originRect.width / 2
    const srcCY = props.originRect.top + props.originRect.height / 2
    const tgtCX = targetRect.left + targetRect.width / 2
    const tgtCY = targetRect.top + targetRect.height / 2
    const dx = srcCX - tgtCX
    const dy = srcCY - tgtCY
    const scale = props.originRect.width / targetRect.width
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${props.tilt}deg)`
    el.style.opacity = '0.9'
    el.style.boxShadow = '0 4px 16px rgba(44,36,32,.14)'
    el.getBoundingClientRect()
  } else {
    el.style.transform = 'scale(0.9) rotate(-1deg)'
    el.style.opacity = '0'
    el.getBoundingClientRect()
  }

  el.style.transition =
    'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease, box-shadow 420ms ease'
  el.style.transform = 'none'
  el.style.opacity = '1'
  el.style.boxShadow =
    '0 28px 80px rgba(44,36,32,.38), 0 6px 20px rgba(44,36,32,.18)'

  if (bd) {
    bd.getBoundingClientRect()
    bd.style.transition = 'background 300ms ease, backdrop-filter 300ms ease'
    bd.style.background = 'rgba(0,0,0,0.6)'
    bd.style.backdropFilter = 'blur(6px)'
  }
}

// ── Navigation (unified — works for both photo↔note transitions) ──
async function navigate(dir: 'prev' | 'next') {
  if (navigating.value) return

  // Drawer snap is intentionally preserved across navigation — if the user
  // was reading comments at 'full' on memory A, memory B opens at 'full'
  // too. Same applies to peek / default.

  const newIdx =
    dir === 'prev' ? currentIndex.value - 1 : currentIndex.value + 1
  if (newIdx < 0 || newIdx >= props.memories.length) return

  // The :memory prop change discards any in-progress edit silently — let
  // MemoryDetail's canClose guard prompt the user first.
  if (!(await confirmCloseIfNeeded())) return

  navigating.value = true
  navDirection.value = dir

  // Both viewports drive the photo navigation via the inner <Transition>
  // wrapping MemoryViewer (mshell-next / mshell-prev keyframes). We just
  // swap the index and wait for the Transition to play (out 220ms + in
  // 220ms with mode="out-in") before clearing the navigating flag so a
  // rapid second swipe doesn't interrupt the in-flight animation.
  currentIndex.value = newIdx
  await nextTick()
  await new Promise((r) => setTimeout(r, 440))

  navigating.value = false
  navDirection.value = null
}

// ── Close ──────────────────────────────────────────────────
async function close() {
  // Backdrop/X click also discards unsaved edits — ask the child first.
  if (!(await confirmCloseIfNeeded())) return

  const el = cardEl.value
  const bd = backdropEl.value

  if (el) {
    // Desktop close animation
    el.style.transition =
      'transform 280ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms ease, box-shadow 220ms ease'
    el.style.transform = 'scale(0.88) rotate(-1.5deg)'
    el.style.opacity = '0'
    el.style.boxShadow = '0 4px 8px rgba(44,36,32,.08)'
  } else if (!isDesktop.value) {
    // Mobile close animation — finish whatever parallax was already in
    // flight by sliding the container the rest of the way off-screen.
    // isVerticalDragging is false here, so the :style binding's CSS
    // transition is active and the change tweens smoothly.
    isVerticalDragging.value = false
    dismissOffsetY.value = mobileViewportHeight.value
  }
  if (bd) {
    bd.style.transition = 'background 220ms ease, backdrop-filter 220ms ease'
    bd.style.background = 'rgba(0,0,0,0)'
    bd.style.backdropFilter = 'blur(0px)'
  }

  await new Promise((r) => setTimeout(r, 290))
  visible.value = false
  // Reset dismiss state so a future open starts from a clean baseline.
  dismissOffsetY.value = 0
  emit('close')
}

// ── Open when startIndex prop arrives ──────────────────────
watch(
  () => props.startIndex,
  async (idx) => {
    if (idx !== null && idx !== undefined) {
      currentIndex.value = idx
      visible.value = true
      await nextTick()
      await runEnterAnimation()
    }
  },
)

// ── Mobile-only slide loading + handlers ───────────────────
// Trigger on BOTH visibility flips and memory navigation so we fetch on
// every open (including the very first open of the initially-selected
// memory, where id alone doesn't change). The isDesktop / !visible guard
// suppresses the initial-mount fire.
watch(
  [() => visible.value, () => currentMemory.value?.id],
  async ([isVisible, id]) => {
    if (!isVisible) return
    currentSlideIdx.value = 0
    if (!id || (currentMemory.value?.media_count ?? 1) <= 1) {
      slides.value = []
      return
    }
    slidesLoading.value = true
    try {
      const data = await $fetch<{ slides: Slide[] }>(
        `/api/memories/${id}/slides`,
      )
      slides.value = data.slides
    } finally {
      slidesLoading.value = false
    }
  },
  { immediate: true },
)

function onSlidesUpdate(payload: {
  slides: Slide[]
  currentSlideIdx?: number
  coverMediaId?: string | null
}) {
  slides.value = payload.slides
  if (payload.currentSlideIdx !== undefined)
    currentSlideIdx.value = payload.currentSlideIdx
  // coverMediaId is propagated by MemoryDetail's emit('update', ...) to the
  // page handler; nothing to do at the carousel-state level.
}

function openShareCard() {
  const m = currentMemory.value
  if (!m?.milestone_label) return
  const firstPhoto = m.memorymedia.find((mm) => mm.media_type !== 'video')
  if (!firstPhoto?.url) return
  const ages = (m.memory_children ?? [])
    .map((mc) => {
      const age = computeBabyAge(mc.childprofile.date_of_birth, m.memory_date)
      return age ? { name: mc.childprofile.name, age } : null
    })
    .filter(Boolean) as Array<{ name: string; age: string }>
  shareCardData.value = {
    photoUrl: firstPhoto.thumbnailUrl ?? firstPhoto.url,
    milestoneLabel: m.milestone_label,
    memoryDate: m.memory_date,
    childAges: ages,
    onDemand: true,
  }
}

// Grabber drag — listen on window so the drag keeps tracking even if the
// finger leaves the small grabber, and so re-renders during navigation
// don't strand the listeners on a stale node.
function onGrabberPointerDown(e: PointerEvent) {
  if (drawer.isDragging.value) return
  drawer.onDragStart(e.clientY)
  e.preventDefault()

  const onMove = (ev: PointerEvent) => drawer.onDragMove(ev.clientY)
  const onUp = () => {
    drawer.onDragEnd()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

// ── Keyboard ───────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (!visible.value) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') navigate('prev')
  else if (e.key === 'ArrowRight') navigate('next')
}

watch(visible, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})

function onWindowResize() {
  mobileViewportHeight.value = window.innerHeight
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onWindowResize)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onWindowResize)
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* Mobile photo-region navigation animation. mode="out-in" plays leave
   first, then enter. 'next' (swipe left): old slides out to the left,
   new slides in from the right. 'prev' (swipe right): mirror. */
.mshell-next-enter-active,
.mshell-next-leave-active,
.mshell-prev-enter-active,
.mshell-prev-leave-active {
  transition:
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 200ms ease;
}
.mshell-next-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.mshell-next-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
.mshell-prev-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.mshell-prev-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
