<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        @click="emit('close')"
      />

      <!-- Sheet -->
      <div
        class="relative w-full overflow-hidden rounded-t-[24px] bg-background shadow-2xl sm:max-w-sm sm:rounded-[24px]"
      >
        <!-- Accent stripe -->
        <div
          class="h-[3px] bg-gradient-to-r from-foreground/20 via-foreground/60 to-foreground/20"
        />

        <div class="px-5 pb-5 pt-4">
          <!-- Header -->
          <div class="mb-4 flex items-start justify-between gap-2">
            <div>
              <p
                class="mb-0.5 text-[10px] font-bold uppercase tracking-[.18em] text-accent"
              >
                ✦ {{ t('milestone.shareLabel') }}
              </p>
              <h2 class="text-sm font-semibold leading-snug text-foreground">
                {{ t('milestone.shareTitle') }}
              </h2>
              <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {{ t('milestone.shareSubtitle') }}
              </p>
            </div>
            <button
              v-if="onDemand"
              class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              :aria-label="t('modal.cancel')"
              @click="emit('close')"
            >
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Card preview -->
          <div class="mb-4 flex justify-center">
            <div
              class="relative flex-shrink-0 overflow-hidden rounded-[12px] bg-secondary shadow-lg"
              :style="previewStyle"
            >
              <!-- Canvas renders the card -->
              <canvas ref="previewCanvas" class="block h-full w-full" />

              <!-- Generating overlay -->
              <div
                v-if="generating"
                class="absolute inset-0 flex items-center justify-center bg-black/20"
              >
                <div
                  class="h-7 w-7 animate-spin rounded-full border-2 border-white/60 border-t-white"
                />
              </div>

              <!-- Error state -->
              <div
                v-if="drawError"
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-4 text-center"
              >
                <svg
                  class="h-6 w-6 text-white/60"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  />
                </svg>
                <p class="text-[11px] leading-snug text-white/70">
                  {{ t('milestone.corsError') }}
                </p>
              </div>
            </div>
          </div>

          <!-- Format toggle -->
          <div
            class="mb-3.5 flex rounded-[10px] border border-border bg-secondary p-0.5"
          >
            <button
              class="flex-1 rounded-[8px] py-1.5 text-[11px] font-medium transition-colors"
              :class="
                format === '9:16'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="setFormat('9:16')"
            >
              {{ t('milestone.formatStories') }}
            </button>
            <button
              class="flex-1 rounded-[8px] py-1.5 text-[11px] font-medium transition-colors"
              :class="
                format === '1:1'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="setFormat('1:1')"
            >
              {{ t('milestone.formatSquare') }}
            </button>
          </div>

          <!-- Action buttons -->
          <div class="space-y-2">
            <!-- Primary: native share or download -->
            <button
              class="flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              :disabled="generating || !!drawError"
              @click="shareOrDownload"
            >
              <svg
                class="h-4 w-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"
                />
                <rect x="8" y="10" width="12" height="12" rx="2" />
              </svg>
              {{
                format === '9:16'
                  ? t('milestone.saveInstagram')
                  : t('milestone.saveWhatsapp')
              }}
            </button>

            <!-- Secondary row: copy + download -->
            <div class="flex gap-2">
              <!-- Copy to clipboard -->
              <button
                class="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-border bg-secondary py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border disabled:opacity-50"
                :disabled="generating || !!drawError"
                @click="copyImage"
              >
                <svg
                  class="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    v-if="!copied"
                    d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6"
                  />
                  <path v-else d="M20 6 9 17l-5-5" />
                </svg>
                {{ copied ? t('milestone.copied') : t('milestone.copyImage') }}
              </button>

              <!-- Download -->
              <button
                class="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-border bg-secondary py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border disabled:opacity-50"
                :disabled="generating || !!drawError"
                @click="downloadImage"
              >
                <svg
                  class="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {{ t('milestone.downloadImage') }}
              </button>
            </div>
          </div>

          <!-- Skip — only shown when this is a prompt (upload flow), not when opened on demand -->
          <button
            v-if="!onDemand"
            class="mt-3 w-full py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            @click="emit('close')"
          >
            {{ t('milestone.skip') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()

const props = defineProps<{
  photoUrl: string
  milestoneLabel: string
  memoryDate: string
  childAges?: Array<{ name: string; age: string }>
  onDemand?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

// ── State ──────────────────────────────────────────────────────────────────
const format = ref<'9:16' | '1:1'>('9:16')
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const generating = ref(true)
const drawError = ref(false)
const copied = ref(false)

// Preview dimensions (CSS px) — actual canvas renders at 2× for crispness
const PREVIEW_W = 162
const previewStyle = computed(() => {
  if (format.value === '9:16') {
    return `width: ${PREVIEW_W}px; height: ${Math.round((PREVIEW_W * 16) / 9)}px`
  }
  return `width: 230px; height: 230px`
})

// ── Card drawing ──────────────────────────────────────────────────────────

async function drawCard(
  canvas: HTMLCanvasElement,
  targetW: number,
  targetH: number,
): Promise<void> {
  canvas.width = targetW
  canvas.height = targetH

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no_ctx')

  // Load photo
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('load_failed'))
    img.src = props.photoUrl
  })

  // Cover-fit photo
  const imgAspect = img.naturalWidth / img.naturalHeight
  const canvasAspect = targetW / targetH
  let sx = 0,
    sy = 0,
    sw = img.naturalWidth,
    sh = img.naturalHeight
  if (imgAspect > canvasAspect) {
    sw = sh * canvasAspect
    sx = (img.naturalWidth - sw) / 2
  } else {
    sh = sw / canvasAspect
    sy = (img.naturalHeight - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)

  // Vignette gradient (bottom 65% of card)
  const grad = ctx.createLinearGradient(0, targetH * 0.35, 0, targetH)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.50)')
  grad.addColorStop(1, 'rgba(0,0,0,0.82)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, targetW, targetH)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // --- Milestone label (italic serif) ---
  const labelSize =
    format.value === '9:16'
      ? Math.round(targetW * 0.072)
      : Math.round(targetW * 0.06)
  ctx.font = `italic bold ${labelSize}px Georgia, "Times New Roman", serif`
  ctx.fillStyle = 'rgba(255,255,255,0.97)'

  const maxLabelW = targetW * 0.82
  const labelLines = wrapText(ctx, props.milestoneLabel, maxLabelW)
  const labelLineH = labelSize * 1.25

  // Start text block at 58% from top for 9:16, 50% for 1:1
  const textBlockStart =
    format.value === '9:16' ? targetH * 0.58 : targetH * 0.5
  let y = textBlockStart

  for (const line of labelLines) {
    ctx.fillText(line, targetW / 2, y)
    y += labelLineH
  }
  y += labelSize * 0.45

  // --- Date ---
  const dateSize =
    format.value === '9:16'
      ? Math.round(targetW * 0.035)
      : Math.round(targetW * 0.03)
  const dateLabel = new Date(props.memoryDate).toLocaleDateString(
    locale.value,
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    },
  )
  ctx.font = `${dateSize}px system-ui, -apple-system, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.80)'
  ctx.fillText(dateLabel, targetW / 2, y)
  y += dateSize * 1.6

  // --- Child ages ---
  if (props.childAges?.length) {
    const ageSize = Math.round(dateSize * 0.88)
    ctx.font = `${ageSize}px system-ui, -apple-system, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.60)'
    for (const { name, age } of props.childAges) {
      ctx.fillText(`${name} · ${age}`, targetW / 2, y)
      y += ageSize * 1.5
    }
  }

  // --- Wordmark ---
  const brandY = format.value === '9:16' ? targetH * 0.915 : targetH * 0.893
  const brandSize =
    format.value === '9:16'
      ? Math.round(targetW * 0.03)
      : Math.round(targetW * 0.026)
  ctx.font = `bold ${brandSize}px Georgia, "Times New Roman", serif`
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillText('Our Story', targetW / 2, brandY)

  const urlSize = Math.round(brandSize * 0.76)
  ctx.font = `${urlSize}px system-ui, -apple-system, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fillText('ourstory.tinybit.app', targetW / 2, brandY + brandSize * 1.5)
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

async function renderPreview() {
  const canvas = previewCanvas.value
  if (!canvas) return
  generating.value = true
  drawError.value = false

  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const cssW = format.value === '9:16' ? PREVIEW_W : 230
  const cssH = format.value === '9:16' ? Math.round((PREVIEW_W * 16) / 9) : 230

  try {
    await drawCard(canvas, cssW * dpr, cssH * dpr)
  } catch {
    drawError.value = true
  } finally {
    generating.value = false
  }
}

function setFormat(f: '9:16' | '1:1') {
  format.value = f
  nextTick(renderPreview)
}

// ── Share / download ──────────────────────────────────────────────────────

async function buildBlob(): Promise<Blob | null> {
  const fullW = 1080
  const fullH = format.value === '9:16' ? 1920 : 1080
  const offscreen = document.createElement('canvas')
  try {
    await drawCard(offscreen, fullW, fullH)
    return await new Promise<Blob | null>((res) =>
      offscreen.toBlob(res, 'image/png'),
    )
  } catch {
    return null
  }
}

async function shareOrDownload() {
  generating.value = true
  try {
    const blob = await buildBlob()
    if (!blob) return

    const filename = `milestone-${format.value === '9:16' ? 'stories' : 'square'}.png`
    const file = new File([blob], filename, { type: 'image/png' })

    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({ files: [file], title: props.milestoneLabel })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  } finally {
    generating.value = false
  }
}

async function downloadImage() {
  if (generating.value) return
  const blob = await buildBlob()
  if (!blob) return
  const filename = `milestone-${format.value === '9:16' ? 'stories' : 'square'}.png`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function copyImage() {
  if (generating.value) return
  const blob = await buildBlob()
  if (!blob) return
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2500)
  } catch {
    // Clipboard API blocked — fall back to download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'milestone.png'
    a.click()
    URL.revokeObjectURL(url)
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  nextTick(renderPreview)
})
</script>
