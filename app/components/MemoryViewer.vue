<template>
  <div :class="fillContainer ? 'h-full w-full' : undefined">
    <!-- Photo / video — single item -->
    <div
      v-if="(memory.media_count ?? 1) <= 1"
      :class="[
        'relative overflow-hidden bg-border',
        fillContainer ? 'h-full w-full' : 'aspect-[4/3] flex-shrink-0',
      ]"
    >
      <template v-if="firstMedia && firstMedia.media_type !== 'video'">
        <div v-if="!modalImgLoaded" class="skeleton-shimmer absolute inset-0" />
        <img
          :src="firstMedia.url ?? firstMedia.thumbnailUrl ?? ''"
          :alt="memory.note ?? t('card.photoAlt')"
          class="absolute inset-0 block h-full w-full object-cover transition-opacity duration-300"
          :class="modalImgLoaded ? 'opacity-100' : 'opacity-0'"
          @load="modalImgLoaded = true"
        />
      </template>
      <video
        v-else-if="firstMedia?.media_type === 'video' && firstMedia.url"
        :src="firstMedia.url"
        class="absolute inset-0 block h-full w-full object-cover"
        controls
        playsinline
        autoplay
        preload="auto"
      />
      <div
        v-else-if="memory.note"
        class="absolute inset-0 flex h-full w-full items-center justify-center p-6"
        style="
          background-color: color-mix(in srgb, var(--accent) 12%, var(--card));
          background-image: repeating-linear-gradient(
            transparent,
            transparent 23px,
            color-mix(in srgb, var(--border) 80%, transparent) 24px
          );
        "
      >
        <p class="text-center text-[15px] leading-7 text-foreground">
          {{ memory.note }}
        </p>
      </div>
      <div
        v-else
        class="absolute inset-0 flex h-full w-full items-center justify-center bg-secondary"
      >
        <svg
          class="h-12 w-12 text-muted-foreground/30"
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

      <!-- Download / share action buttons (photo or video only) -->
      <div
        v-if="firstMedia?.url"
        class="absolute right-2 top-2 z-10 flex gap-1"
      >
        <!-- Share with watermark (images only) -->
        <button
          v-if="firstMedia.media_type !== 'video'"
          class="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          :title="t('modal.sharePhoto')"
          aria-label="Share photo"
          @click.stop="shareMedia"
        >
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            viewBox="0 0 24 24"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
        <!-- Save to device -->
        <button
          class="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-50"
          :title="t('modal.saveToDevice')"
          aria-label="Save to device"
          :disabled="downloading"
          @click.stop="downloadMedia"
        >
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Photo / video — multi-item carousel.
         JS-controlled translateX strip (not native overflow-x scroll) so we
         own the boundary behavior: swipe past the last slide → emit
         navigate-memory='next', swipe past the first → 'prev'. -->
    <div
      v-if="(memory.media_count ?? 1) > 1"
      ref="carouselContainerEl"
      :class="[
        'relative overflow-hidden bg-border',
        fillContainer ? 'h-full w-full' : 'flex-shrink-0',
      ]"
      style="touch-action: none"
      @pointerdown="onCarouselPointerDown"
    >
      <!-- Loading skeleton -->
      <div
        v-if="slidesLoading"
        :class="[
          'skeleton-shimmer',
          fillContainer ? 'h-full w-full' : 'aspect-[4/3]',
        ]"
      />
      <!-- Carousel -->
      <template v-else-if="slides.length > 0">
        <div
          ref="carouselStripEl"
          :class="['flex will-change-transform', fillContainer ? 'h-full' : '']"
          :style="{
            transform: `translateX(${stripTranslateX}px)`,
            transition: isCarouselDragging
              ? 'none'
              : 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
          }"
        >
          <div
            v-for="slide in slides"
            :key="slide.id"
            :class="[
              'min-w-full shrink-0',
              fillContainer ? 'h-full' : 'w-full',
            ]"
          >
            <div
              :class="[
                'relative w-full overflow-hidden bg-border',
                fillContainer ? 'h-full' : 'aspect-[4/3]',
              ]"
            >
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from '~/types/memory'

const props = withDefaults(
  defineProps<{
    memory: Memory
    slides: Slide[]
    slidesLoading: boolean
    currentSlideIdx: number
    // When true, the photo wrapper fills its parent container (mobile shell)
    // instead of the desktop card's 4:3 aspect ratio. Spec §6.7 fitMode='cover'.
    fillContainer?: boolean
  }>(),
  { fillContainer: false },
)

const emit = defineEmits<{
  'current-slide-idx': [number]
  // Fired when the user swipes past the first slide (left edge → 'prev')
  // or past the last slide (right edge → 'next'). The parent decides
  // whether/how to navigate between memories.
  'navigate-memory': ['prev' | 'next']
}>()

const { t } = useI18n()

const modalImgLoaded = ref(false)
const downloading = ref(false)

const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)

// ── Multi-item carousel helpers ────────────────────────────────────
import { useElementSize } from '@vueuse/core'

const carouselContainerEl = ref<HTMLDivElement | null>(null)
const carouselStripEl = ref<HTMLDivElement | null>(null)
const { width: carouselWidth } = useElementSize(carouselContainerEl)

const isCarouselDragging = ref(false)
const dragOffsetX = ref(0)

const stripTranslateX = computed(
  () => -props.currentSlideIdx * carouselWidth.value + dragOffsetX.value,
)

const DOT_SLOT_PX = 14
const DOT_RAIL_WIDTH_PX = 84

const dotRailFits = computed(
  () => props.slides.length * DOT_SLOT_PX <= DOT_RAIL_WIDTH_PX,
)

const dotRailOffset = computed(() => {
  if (props.slides.length === 0) return 0
  const totalWidth = props.slides.length * DOT_SLOT_PX
  if (totalWidth <= DOT_RAIL_WIDTH_PX) {
    return (DOT_RAIL_WIDTH_PX - totalWidth) / 2
  }
  const centered =
    DOT_RAIL_WIDTH_PX / 2 -
    DOT_SLOT_PX / 2 -
    props.currentSlideIdx * DOT_SLOT_PX
  const minOffset = DOT_RAIL_WIDTH_PX - totalWidth
  return Math.min(0, Math.max(minOffset, centered))
})

function dotStyle(idx: number) {
  if (dotRailFits.value) {
    return idx === props.currentSlideIdx
      ? { transform: 'scale(1)', opacity: 1 }
      : { transform: 'scale(1)', opacity: 0.45 }
  }
  const distance = Math.abs(idx - props.currentSlideIdx)
  const scale =
    distance === 0 ? 1 : distance === 1 ? 0.75 : distance === 2 ? 0.5 : 0.3
  const opacity =
    distance === 0 ? 1 : distance === 1 ? 0.7 : distance === 2 ? 0.4 : 0.2
  return { transform: `scale(${scale})`, opacity }
}

function goToSlide(idx: number) {
  if (idx !== props.currentSlideIdx) emit('current-slide-idx', idx)
}

function nextSlide() {
  if (props.currentSlideIdx < props.slides.length - 1)
    goToSlide(props.currentSlideIdx + 1)
}

function prevSlide() {
  if (props.currentSlideIdx > 0) goToSlide(props.currentSlideIdx - 1)
}

// ── Carousel drag (mobile) ────────────────────────────────────
// Direction-locked horizontal drag with boundary detection. While dragging
// the strip follows the finger; on release we snap to the nearest slide,
// or — if the user swiped past the first/last slide — emit navigate-memory.
function onCarouselPointerDown(e: PointerEvent) {
  if (props.slides.length <= 1) return

  const startX = e.clientX
  const startY = e.clientY
  const containerWidth =
    carouselContainerEl.value?.clientWidth ?? carouselWidth.value
  let lockedDirection: 'horizontal' | 'vertical' | null = null
  let didCapture = false

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY

    if (lockedDirection === null) {
      // Wait until the user has moved at least 8px to decide axis. Avoids
      // hijacking a vertical drag (which the outer shell uses for dismiss).
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      lockedDirection = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      if (lockedDirection === 'vertical') {
        cleanup()
        return
      }
      isCarouselDragging.value = true
      didCapture = true
      ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
    }

    if (lockedDirection === 'horizontal') {
      // Apply resistance when overshooting at the first/last slide so the
      // drag has weight before triggering memory navigation.
      let offset = dx
      const atStart = props.currentSlideIdx === 0
      const atEnd = props.currentSlideIdx === props.slides.length - 1
      if ((atStart && offset > 0) || (atEnd && offset < 0)) {
        offset = offset * 0.4
      }
      dragOffsetX.value = offset
    }
  }

  const onUp = (ev: PointerEvent) => {
    cleanup()
    if (didCapture) {
      try {
        ;(e.target as HTMLElement)?.releasePointerCapture?.(ev.pointerId)
      } catch {
        /* already released */
      }
    }
    if (lockedDirection !== 'horizontal') return

    const dx = ev.clientX - startX
    const threshold = Math.max(60, containerWidth * 0.2)
    const atStart = props.currentSlideIdx === 0
    const atEnd = props.currentSlideIdx === props.slides.length - 1

    if (dx <= -threshold) {
      if (atEnd) emit('navigate-memory', 'next')
      else emit('current-slide-idx', props.currentSlideIdx + 1)
    } else if (dx >= threshold) {
      if (atStart) emit('navigate-memory', 'prev')
      else emit('current-slide-idx', props.currentSlideIdx - 1)
    }
    // Reset drag offset — the strip transitions to the new (or same) slide.
    dragOffsetX.value = 0
    isCarouselDragging.value = false
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

async function downloadMedia() {
  const media = firstMedia.value
  if (!media?.url) return
  downloading.value = true
  try {
    const res = await fetch(media.url)
    const blob = await res.blob()
    const ext =
      media.media_type === 'video' ? 'mp4' : blob.type.split('/')[1] || 'jpg'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `our-story-${props.memory.memory_date}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (err) {
    console.error('[MemoryViewer] download failed:', err)
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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    if (!blob) return
    const filename = `our-story-${props.memory.memory_date}.jpg`
    const file = new File([blob], filename, { type: 'image/jpeg' })
    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare?.({ files: [file] })
    ) {
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
</script>
