<template>
  <Teleport to="body">
    <div
      v-if="visible && isDesktop"
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

      <!-- Prev arrow — hidden on mobile where the card takes full viewport
           width and the arrows would overlap modal content. Mobile users
           close the modal and tap another card. -->
      <button
        v-if="hasPrev"
        class="absolute left-3 z-20 hidden h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white sm:left-6 sm:flex"
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

      <!-- Next arrow — hidden on mobile (see prev-arrow comment). -->
      <button
        v-if="hasNext"
        class="absolute right-3 z-20 hidden h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white sm:right-6 sm:flex"
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

      <!-- Card — opacity-0 via Tailwind so JS animation owns opacity without reactive conflicts -->
      <div
        ref="cardEl"
        class="relative z-10 flex flex-col bg-card opacity-0 will-change-transform"
        :style="cardSizeStyle"
        @click.stop
      >
        <!-- Pin -->
        <div
          class="absolute -top-3 left-1/2 z-20 h-4 w-4 -translate-x-1/2 rounded-full bg-[#d64040] opacity-90 shadow-[0_2px_8px_rgba(214,64,64,.5)] dark:bg-[#e05454]"
        />

        <!-- Close -->
        <button
          class="absolute right-0 top-0 z-20 flex h-7 w-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80"
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

        <!-- Content — :key resets all local state on navigation -->
        <MemoryModal
          v-if="currentMemory && !isQuickNote"
          ref="memoryModalRef"
          :key="currentMemory.id"
          :memory="currentMemory"
          :children="children"
          :members="members"
          :current-user-id="currentUserId"
          :self-avatar-url="selfAvatarUrl"
          :self-initials="selfInitials"
          @update="emit('update', $event)"
        />
        <QuickNoteModal
          v-else-if="currentMemory && isQuickNote"
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
    </div>

    <div v-else-if="visible && !isDesktop" class="fixed inset-0 z-50 bg-background">
      <!-- Floating chrome — close + counter -->
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
        <span
          v-if="memories.length > 1"
          class="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md"
        >
          {{ currentIndex + 1 }} / {{ memories.length }}
        </span>
        <span class="h-9 w-9" /><!-- spacer; right-side share button is a future enhancement -->
      </div>

      <!-- Quick-note path: legacy QuickNoteModal in a full-screen container -->
      <div
        v-if="currentMemory && isQuickNote"
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

      <!-- Media path: viewer top + drawer bottom -->
      <template v-else-if="currentMemory && !isQuickNote">
        <!-- Photo region fills viewport above the drawer -->
        <div
          ref="photoRegionEl"
          class="absolute inset-x-0 top-0 z-10 overflow-hidden"
          :style="{ bottom: `${drawer.heightPx.value}px` }"
        >
          <MemoryViewer
            :memory="currentMemory"
            :slides="slides"
            :slides-loading="slidesLoading"
            :current-slide-idx="currentSlideIdx"
            @current-slide-idx="currentSlideIdx = $event"
          />
        </div>

        <!-- Drawer surface -->
        <div
          class="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[22px] bg-background shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
          :style="{ height: `${drawer.heightPx.value}px` }"
        >
          <div
            class="flex h-7 flex-shrink-0 cursor-grab items-center justify-center touch-none"
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
              @slides-update="onMobileSlidesUpdate"
              @open-share-card="onMobileOpenShareCard"
              @milestone-share-prompt="mobileShareCardData = $event"
            />
          </div>
        </div>
      </template>

      <!-- Mobile-only milestone share card teleport -->
      <MilestoneShareModal
        v-if="mobileShareCardData"
        :photo-url="mobileShareCardData.photoUrl"
        :milestone-label="mobileShareCardData.milestoneLabel"
        :memory-date="mobileShareCardData.memoryDate"
        :child-ages="mobileShareCardData.childAges"
        :on-demand="mobileShareCardData.onDemand"
        @close="mobileShareCardData = null"
      />
    </div>
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
const visible = ref(false)
const navigating = ref(false)
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
const mobileShareCardData = ref<ShareCardData | null>(null)

// Snap drawer state (initialized lazily; viewportHeight needs window).
const drawer = useSnapDrawer({
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
  snaps: ['peek', 'default', 'full'],
})

// Chrome visibility (for Task 6 tap-to-toggle). Start visible.
const chromeVisible = ref(true)

// Photo region element ref (used in Tasks 4-5 for swipe gestures).
const photoRegionEl = ref<HTMLElement>()

async function confirmCloseIfNeeded(): Promise<boolean> {
  const guard = memoryModalRef.value?.canClose
  if (!guard) return true
  return guard()
}

// ── Derived ────────────────────────────────────────────────
const currentMemory = computed(() => props.memories[currentIndex.value] ?? null)
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < props.memories.length - 1)
const isQuickNote = computed(() => {
  const m = currentMemory.value
  return !!m && !m.memorymedia.length && !!m.note
})

// Sizing changes between quick note and photo/video card types.
// The switch happens while opacity is 0 (mid-navigation), so it's invisible.
const cardSizeStyle = computed(() =>
  isQuickNote.value
    ? {
        width: '100%',
        maxWidth: '520px',
        minHeight: '420px',
        maxHeight: '82vh',
      }
    : {
        width: '100%',
        height: '100%',
        maxWidth: '750px',
        maxHeight: '75vh',
        padding: '12px 12px 0',
      },
)

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
  const newIdx =
    dir === 'prev' ? currentIndex.value - 1 : currentIndex.value + 1
  if (newIdx < 0 || newIdx >= props.memories.length) return

  // Navigating swaps the modal's :key and remounts the child, which would
  // silently discard in-progress edits. Let the child guard prompt first.
  if (!(await confirmCloseIfNeeded())) return

  navigating.value = true

  const el = cardEl.value
  if (el) {
    const xOut = dir === 'next' ? -50 : 50
    el.style.transition = 'transform 180ms ease-in, opacity 160ms ease-in'
    el.style.transform = `translateX(${xOut}px)`
    el.style.opacity = '0'
    await new Promise((r) => setTimeout(r, 190))
  }

  // Switch index — card size and content component may both change here.
  // Since opacity is 0, the layout shift is invisible.
  currentIndex.value = newIdx
  await nextTick()

  if (el) {
    const xIn = dir === 'next' ? 50 : -50
    el.style.transition = 'none'
    el.style.transform = `translateX(${xIn}px)`
    el.style.opacity = '0'
    el.getBoundingClientRect() // force reflow
    el.style.transition =
      'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease'
    el.style.transform = 'none'
    el.style.opacity = '1'
    await new Promise((r) => setTimeout(r, 290))
  }

  navigating.value = false
}

// ── Close ──────────────────────────────────────────────────
async function close() {
  // Backdrop/X click also discards unsaved edits — ask the child first.
  if (!(await confirmCloseIfNeeded())) return

  const el = cardEl.value
  const bd = backdropEl.value

  if (el) {
    el.style.transition =
      'transform 280ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms ease, box-shadow 220ms ease'
    el.style.transform = 'scale(0.88) rotate(-1.5deg)'
    el.style.opacity = '0'
    el.style.boxShadow = '0 4px 8px rgba(44,36,32,.08)'
  }
  if (bd) {
    bd.style.transition = 'background 220ms ease, backdrop-filter 220ms ease'
    bd.style.background = 'rgba(0,0,0,0)'
    bd.style.backdropFilter = 'blur(0px)'
  }

  await new Promise((r) => setTimeout(r, 290))
  visible.value = false
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
watch(
  () => currentMemory.value?.id,
  async (id) => {
    if (isDesktop.value) return
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

function onMobileSlidesUpdate(payload: {
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

function onMobileOpenShareCard() {
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
  mobileShareCardData.value = {
    photoUrl: firstPhoto.thumbnailUrl ?? firstPhoto.url,
    milestoneLabel: m.milestone_label,
    memoryDate: m.memory_date,
    childAges: ages,
    onDemand: true,
  }
}

// Grabber drag handler using pointer events.
function onGrabberPointerDown(e: PointerEvent) {
  if (drawer.isDragging.value) return
  drawer.onDragStart(e.clientY)
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)

  const onMove = (ev: PointerEvent) => drawer.onDragMove(ev.clientY)
  const onUp = (ev: PointerEvent) => {
    drawer.onDragEnd()
    try {
      target.releasePointerCapture(ev.pointerId)
    } catch {
      /* already released */
    }
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    target.removeEventListener('pointercancel', onUp)
  }
  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
  target.addEventListener('pointercancel', onUp)
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

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>
