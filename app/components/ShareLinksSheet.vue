<template>
  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      @click="$emit('close')"
    />
  </Transition>

  <!-- Sheet -->
  <Transition name="slide-up">
    <div
      v-if="open"
      class="fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-[24px] shadow-2xl max-h-[85vh] overflow-y-auto"
    >
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1">
        <div class="w-10 h-1 rounded-full bg-border" />
      </div>

      <div class="px-5 pb-8">
        <!-- Header -->
        <div class="flex items-center justify-between py-4">
          <h2 class="text-base font-bold text-foreground">{{ t('viewerLink.shareButton') }}</h2>
          <button @click="$emit('close')" :aria-label="t('viewerLink.close')" class="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="py-12 text-center">
          <p class="text-sm text-muted-foreground">{{ t('viewerLink.loading') }}</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="text-sm text-destructive p-4">{{ error }}</div>

        <!-- Empty state -->
        <div v-else-if="links.length === 0" class="text-center py-10">
          <div class="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-4">
            <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <p class="text-sm font-semibold text-foreground mb-1">{{ t('viewerLink.emptyHeadline') }}</p>
          <p class="text-xs text-muted-foreground mb-6 max-w-[260px] mx-auto">{{ t('viewerLink.emptyBody') }}</p>
          <button
            @click="$emit('create')"
            class="w-full bg-primary text-primary-foreground rounded-[12px] py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {{ t('viewerLink.createLink') }}
          </button>
        </div>

        <!-- Link list -->
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="link in links"
            :key="link.id"
            class="border border-border rounded-[16px] p-4"
          >
            <!-- Label + mode badge -->
            <div class="flex items-start justify-between gap-2 mb-2">
              <p class="text-sm font-semibold text-foreground leading-snug">{{ link.label }}</p>
              <span
                class="flex-shrink-0 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full"
                :class="link.isExpired
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-secondary text-muted-foreground'"
              >
                {{ link.isExpired ? t('viewerLink.expired') : modeBadge(link) }}
              </span>
            </div>

            <!-- Date range / count subline -->
            <p v-if="linkSubline(link)" class="text-xs text-muted-foreground mb-2">
              {{ linkSubline(link) }}
            </p>

            <!-- Expiry row -->
            <div class="mb-3">
              <span v-if="link.isExpired" class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                {{ t('viewerLink.expired') }}
              </span>
              <p v-else class="text-xs text-muted-foreground">
                {{ t('viewerLink.expires', { date: formatExpiry(link.expiresAt) }) }}
              </p>
            </div>

            <!-- Created date -->
            <p class="text-xs text-muted-foreground mb-3">
              {{ formatDate(link.createdAt) }}
            </p>

            <!-- Inline revoke confirmation -->
            <div v-if="revokingId === link.id" class="mt-2 p-3 bg-muted rounded-md">
              <p class="text-sm font-medium mb-1">{{ t('viewerLink.revokeConfirm') }}</p>
              <p class="text-xs text-muted-foreground mb-3">{{ t('viewerLink.revokeConfirmBody') }}</p>
              <div class="flex gap-2">
                <button
                  @click="doRevoke(link.id)"
                  :disabled="revoking"
                  class="h-8 px-3 rounded-[10px] bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {{ t('viewerLink.revoke') }}
                </button>
                <button
                  @click="revokingId = null"
                  class="h-8 px-3 rounded-[10px] bg-secondary text-muted-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors"
                >
                  {{ t('viewerLink.cancel') }}
                </button>
              </div>
            </div>

            <!-- Actions (when not confirming revoke) -->
            <div v-else class="flex items-center gap-2">
              <!-- Copy or Renew -->
              <button
                v-if="!link.isExpired"
                @click="copyLink(link)"
                class="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[10px] bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span>{{ copiedId === link.id ? t('viewerLink.copied') : t('viewerLink.copyLink') }}</span>
              </button>
              <button
                v-else
                @click="$emit('renew', link)"
                class="flex-1 h-8 rounded-[10px] bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors"
              >
                {{ t('viewerLink.renew') }}
              </button>

              <!-- Revoke trigger -->
              <button
                @click="revokingId = link.id"
                :aria-label="t('viewerLink.revokeLabel')"
                class="h-8 w-8 flex items-center justify-center rounded-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Create another -->
          <button
            @click="$emit('create')"
            class="w-full h-10 rounded-[12px] border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            {{ t('viewerLink.createAnother') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t } = useI18n()

interface ViewerLink {
  id: string
  mode: 'full' | 'date_range' | 'selection'
  label: string
  expiresAt: string
  isExpired: boolean
  memoryCount: number | null
  dateRange: { from: string; to: string } | null
  token: string
  createdAt: string
}

const props = defineProps<{
  open: boolean
  circleId: string
}>()

const emit = defineEmits<{
  close: []
  create: []
  renew: [link: ViewerLink]
}>()

const links = ref<ViewerLink[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const revokingId = ref<string | null>(null)
const revoking = ref(false)
const copiedId = ref<string | null>(null)

async function fetchLinks() {
  loading.value = true
  error.value = null
  try {
    links.value = await $fetch<ViewerLink[]>(`/api/circles/${props.circleId}/viewer-links`)
  } catch {
    error.value = t('viewerLink.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(fetchLinks)
watch(() => props.circleId, fetchLinks)

defineExpose({ refresh: fetchLinks })

function modeBadge(link: ViewerLink): string {
  if (link.mode === 'full') return t('viewerLink.modeFull')
  if (link.mode === 'date_range') return t('viewerLink.modeDateRange')
  return t('viewerLink.modeSelection')
}

function linkSubline(link: ViewerLink): string | null {
  if (link.mode === 'selection' && link.memoryCount !== null) {
    if (link.dateRange) {
      return t('viewerLink.selectionBanner', {
        count: link.memoryCount,
        from: formatMonthYear(link.dateRange.from),
        to: formatMonthYear(link.dateRange.to),
      })
    }
    return t('viewerLink.selectedCount', { count: link.memoryCount })
  }
  if (link.mode === 'date_range' && link.dateRange) {
    return t('viewerLink.dateRangeBanner', {
      from: formatMonthYear(link.dateRange.from),
      to: formatMonthYear(link.dateRange.to),
    })
  }
  return null
}

function formatMonthYear(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(dateStr))
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(dateStr))
}

function formatExpiry(isoStr: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(isoStr))
}

let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyLink(link: ViewerLink) {
  const url = `${window.location.origin}/view?token=${link.token}`
  try {
    await navigator.clipboard.writeText(url)
    if (copyTimer) clearTimeout(copyTimer)
    copiedId.value = link.id
    copyTimer = setTimeout(() => { copiedId.value = null }, 2000)
  } catch {
    // Clipboard permission denied — silently ignore, button just won't show feedback
  }
}

onUnmounted(() => { if (copyTimer) clearTimeout(copyTimer) })

async function doRevoke(linkId: string) {
  if (revoking.value) return
  revoking.value = true
  try {
    await $fetch(`/api/circles/${props.circleId}/viewer-links/${linkId}`, { method: 'DELETE' })
    revokingId.value = null
    await fetchLinks()
  } catch {
    // Error is already logged server-side; just close the confirmation
    revokingId.value = null
  } finally {
    revoking.value = false
  }
}
</script>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
