<template>
  <div
    class="mosaic-cell"
    :class="{ note: isNote }"
    @click="$emit('open', { memory, rect: ($event.currentTarget as HTMLElement)?.getBoundingClientRect() ?? null, tilt: 0 })"
  >
    <!-- Quick-note (text-only) -->
    <template v-if="isNote">
      <div class="quote-glyph">"</div>
      <div class="note-body">{{ memory.note }}</div>
      <div class="note-meta">{{ noteMeta }}</div>
    </template>

    <!-- Photo or video -->
    <template v-else-if="firstMedia">
      <img
        v-if="!isVideo"
        :src="firstMedia.thumbnailUrl ?? firstMedia.url ?? ''"
        :alt="memory.note ?? ''"
        loading="lazy"
      />
      <div v-else class="video-thumb">
        <video
          :src="firstMedia.url ?? ''"
          :poster="firstMedia.thumbnailUrl !== firstMedia.url ? (firstMedia.thumbnailUrl ?? undefined) : undefined"
          muted
          playsinline
          preload="metadata"
        />
        <div class="play-badge" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Memory } from '~/composables/useTimeline'

const { locale } = useI18n()

const props = defineProps<{ memory: Memory }>()

defineEmits<{
  open: [
    payload: { memory: Memory; rect: DOMRect | null; tilt: number },
  ]
}>()

const isNote = computed(
  () => props.memory.memorymedia.length === 0 && Boolean(props.memory.note),
)
const firstMedia = computed(() => props.memory.memorymedia[0] ?? null)
const isVideo = computed(() => firstMedia.value?.media_type === 'video')

const noteMeta = computed(() => {
  const d = new Date(props.memory.memory_date)
  const monthAbbr = new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(d)
  const day = d.getUTCDate()
  const isFormerMember = props.memory.owner_user_id === null
  const author =
    props.memory.user?.first_name ??
    (isFormerMember ? props.memory.former_owner_name : null)
  return author ? `${monthAbbr} ${day} · ${author}` : `${monthAbbr} ${day}`
})
</script>

<style scoped>
.mosaic-cell {
  overflow: hidden;
  background: hsl(var(--card));
  cursor: pointer;
  position: relative;
  aspect-ratio: 1 / 1;
}
.mosaic-cell.wide {
  grid-column: span 2;
  aspect-ratio: 2 / 1;
}
.mosaic-cell.tall {
  grid-row: span 2;
  aspect-ratio: 1 / 2;
}

.mosaic-cell img,
.mosaic-cell video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    filter 300ms ease,
    transform 350ms ease;
}

.mosaic-cell:hover img {
  filter: brightness(var(--photo-hover));
  transform: scale(1.04);
}

.video-thumb {
  position: relative;
  width: 100%;
  height: 100%;
}
.video-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter 300ms ease, transform 350ms ease;
  background: hsl(var(--secondary));
}
.mosaic-cell:hover .video-thumb video {
  filter: brightness(var(--photo-hover));
  transform: scale(1.04);
}
.video-thumb .play-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  pointer-events: none;
}

.mosaic-cell.note {
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.note .quote-glyph {
  font-family: 'Instrument Serif', serif;
  font-style: italic;
  font-size: 36px;
  line-height: 0.5;
  color: hsl(var(--foreground) / 0.35);
  margin-bottom: 2px;
}

.note .note-body {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-weight: 400;
  font-size: 13px;
  line-height: 1.4;
  color: hsl(var(--foreground) / 0.88);
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.note .note-meta {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: hsl(var(--foreground-faint));
  margin-top: 8px;
}
</style>
