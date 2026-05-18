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
