<template>
  <div>
    <!-- Photo / video — single item -->
    <div
      v-if="(memory.media_count ?? 1) <= 1"
      class="relative aspect-[4/3] flex-shrink-0 overflow-hidden bg-border"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from '~/types/memory'

const props = defineProps<{
  memory: Memory
  slides: Slide[]
  slidesLoading: boolean
  currentSlideIdx: number
}>()

defineEmits<{
  'current-slide-idx': [number]
}>()

const { t } = useI18n()

const modalImgLoaded = ref(false)
const downloading = ref(false)

const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)

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
