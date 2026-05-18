<template>
  <!-- Fills the shell's flex-col card. -->
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Photo / video — single item (rendered by MemoryViewer) -->
    <MemoryViewer
      :memory="memory"
      :slides="slides"
      :slides-loading="slidesLoading"
      :current-slide-idx="currentSlideIdx"
      @current-slide-idx="currentSlideIdx = $event"
    />

    <!-- Photo / video — multi-item carousel -->
    <div
      v-if="(memory.media_count ?? 1) > 1"
      class="relative flex-shrink-0 bg-border"
    >
      <!-- Loading skeleton -->
      <div v-if="slidesLoading" class="skeleton-shimmer aspect-[4/3]" />
      <!-- Carousel -->
      <template v-else-if="slides.length > 0">
        <div
          ref="carouselRef"
          class="no-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
          @scroll="onCarouselScroll"
        >
          <div
            v-for="slide in slides"
            :key="slide.id"
            class="w-full min-w-full shrink-0 snap-center"
          >
            <div class="relative aspect-[4/3] w-full overflow-hidden bg-border">
              <img
                v-if="slide.mediaType === 'photo'"
                :src="slide.url ?? undefined"
                class="absolute inset-0 block h-full w-full object-cover"
              />
              <video
                v-else-if="slide.mediaType === 'video'"
                :src="slide.url ?? undefined"
                class="absolute inset-0 block h-full w-full object-cover"
                controls
                playsinline
                preload="auto"
              />
              <div
                v-else
                class="absolute inset-0 flex h-full w-full items-center justify-center p-8"
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
                <p class="text-center text-[15px] leading-7 text-foreground">
                  {{ slide.textContent }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <!-- Slide nav: a single bottom-center pill combines prev + dots +
             counter + next. Spatially distinct from MemoryShell's full-height
             side rails (which navigate between memories), so the two never
             read as the same control even on narrow mobile widths. -->
        <div
          class="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full bg-black/55 py-1 pl-1 pr-1 backdrop-blur-sm"
        >
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:pointer-events-none disabled:text-white/25"
            :disabled="currentSlideIdx === 0"
            aria-label="Previous slide"
            @click.stop="prevSlide"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <!-- iOS-style adaptive page indicator: fixed-width rail, dots scale
               and dim with distance from current, rail translates to keep the
               current dot near center. Works fluidly from 2 to dozens of
               slides without redesigning the widget. -->
          <div class="relative flex h-3 w-[84px] items-center overflow-hidden">
            <div
              class="flex h-full items-center transition-transform duration-300 ease-out"
              :style="{ transform: `translateX(${dotRailOffset}px)` }"
            >
              <button
                v-for="(_, idx) in slides"
                :key="idx"
                type="button"
                class="flex h-full w-3.5 flex-shrink-0 items-center justify-center"
                :aria-label="`Go to slide ${idx + 1}`"
                :aria-current="idx === currentSlideIdx ? 'true' : undefined"
                @click.stop="goToSlide(idx)"
              >
                <span
                  class="block h-2 w-2 rounded-full bg-white transition-all duration-200"
                  :style="dotStyle(idx)"
                />
              </button>
            </div>
          </div>
          <span
            class="select-none whitespace-nowrap px-1.5 text-[11px] font-medium tabular-nums text-white"
          >
            {{ currentSlideIdx + 1 }} / {{ slides.length }}
          </span>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:pointer-events-none disabled:text-white/25"
            :disabled="currentSlideIdx === slides.length - 1"
            aria-label="Next slide"
            @click.stop="nextSlide"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </template>
    </div>

    <!-- Caption section delegated to MemoryDetail -->
    <MemoryDetail
      ref="memoryDetailRef"
      :memory="memory"
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
import type { Slide } from '~/types/memory'
import { computeBabyAge } from '~/composables/useBabyAge'
import MemoryDetail from './MemoryDetail.vue'
import MemoryViewer from './MemoryViewer.vue'

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

// MemoryDetail ref (exposes canClose for the shell)
const memoryDetailRef = ref<{ canClose: () => Promise<boolean> } | null>(null)

// MemoryShell calls canClose() before backdrop/X/navigation closes the modal.
// Forwards to MemoryDetail where the edit state and discard-confirm logic live.
async function canClose(): Promise<boolean> {
  return (await memoryDetailRef.value?.canClose()) ?? true
}
defineExpose({ canClose })

const memory = computed(() => props.memory)

// ── Multi-item carousel ────────────────────────────────────
const slides = ref<Slide[]>([])
const slidesLoading = ref(false)
const currentSlideIdx = ref(0)
const carouselRef = ref<HTMLDivElement | null>(null)

watch(
  () => props.memory?.id,
  async (id) => {
    currentSlideIdx.value = 0
    if (!id || (props.memory?.media_count ?? 1) <= 1) {
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

function onCarouselScroll() {
  if (!carouselRef.value) return
  const idx = Math.round(
    carouselRef.value.scrollLeft / carouselRef.value.clientWidth,
  )
  currentSlideIdx.value = idx
}

function goToSlide(idx: number) {
  if (!carouselRef.value) return
  carouselRef.value.scrollTo({
    left: idx * carouselRef.value.clientWidth,
    behavior: 'smooth',
  })
}

function nextSlide() {
  if (currentSlideIdx.value < slides.value.length - 1)
    goToSlide(currentSlideIdx.value + 1)
}

function prevSlide() {
  if (currentSlideIdx.value > 0) goToSlide(currentSlideIdx.value - 1)
}

function onSlidesUpdate(payload: {
  slides: Slide[]
  currentSlideIdx?: number
  coverMediaId?: string | null
}) {
  slides.value = payload.slides
  if (payload.currentSlideIdx !== undefined) currentSlideIdx.value = payload.currentSlideIdx
  // coverMediaId is a memory-level field — MemoryDetail's saveEdit propagates
  // it via emit('update', ...) which the page-level handler applies to the
  // timeline. Nothing to do at the carousel-state level here.
}

// Adaptive page indicator geometry. Must match the rail's Tailwind w-[84px]
// and each button's w-3.5 (14px), or the centering math drifts.
const DOT_SLOT_PX = 14
const DOT_RAIL_WIDTH_PX = 84

const dotRailFits = computed(
  () => slides.value.length * DOT_SLOT_PX <= DOT_RAIL_WIDTH_PX,
)

const dotRailOffset = computed(() => {
  if (slides.value.length === 0) return 0
  const totalWidth = slides.value.length * DOT_SLOT_PX
  if (totalWidth <= DOT_RAIL_WIDTH_PX) {
    return (DOT_RAIL_WIDTH_PX - totalWidth) / 2
  }
  // Center on the current dot, but clamp so the rail's edges never reveal
  // empty space past the first/last slot.
  const centered =
    DOT_RAIL_WIDTH_PX / 2 -
    DOT_SLOT_PX / 2 -
    currentSlideIdx.value * DOT_SLOT_PX
  const minOffset = DOT_RAIL_WIDTH_PX - totalWidth
  return Math.min(0, Math.max(minOffset, centered))
})

function dotStyle(idx: number) {
  if (dotRailFits.value) {
    // All dots fit — full size, only opacity carries the active state.
    return idx === currentSlideIdx.value
      ? { transform: 'scale(1)', opacity: 1 }
      : { transform: 'scale(1)', opacity: 0.45 }
  }
  const distance = Math.abs(idx - currentSlideIdx.value)
  const scale =
    distance === 0 ? 1 : distance === 1 ? 0.75 : distance === 2 ? 0.5 : 0.3
  const opacity =
    distance === 0 ? 1 : distance === 1 ? 0.7 : distance === 2 ? 0.4 : 0.2
  return { transform: `scale(${scale})`, opacity }
}

// ── Share card ─────────────────────────────────────────────
interface ShareCardData {
  photoUrl: string
  milestoneLabel: string
  memoryDate: string
  childAges: Array<{ name: string; age: string }>
  onDemand?: boolean
}
const shareCardData = ref<ShareCardData | null>(null)

function openShareCard() {
  if (!props.memory.milestone_label) return
  const firstPhoto = props.memory.memorymedia.find(
    (m) => m.media_type !== 'video',
  )
  if (!firstPhoto?.url) return
  const ages = (props.memory.memory_children ?? [])
    .map((mc) => {
      const age = computeBabyAge(
        mc.childprofile.date_of_birth,
        props.memory.memory_date,
      )
      return age ? { name: mc.childprofile.name, age } : null
    })
    .filter(Boolean) as Array<{ name: string; age: string }>
  shareCardData.value = {
    photoUrl: firstPhoto.thumbnailUrl ?? firstPhoto.url,
    milestoneLabel: props.memory.milestone_label,
    memoryDate: props.memory.memory_date,
    childAges: ages,
    onDemand: true,
  }
}


</script>
