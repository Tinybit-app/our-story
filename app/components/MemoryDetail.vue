<template>
  <div class="flex h-full flex-col">
    <!-- Content moves in over Tasks 2-6 -->
  </div>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from './MemoryModal.vue'

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

defineProps<{
  memory: Memory
  children: ChildProfile[]
  members: CircleMember[]
  currentUserId: string | null
  selfAvatarUrl: string | null
  selfInitials: string
  slides: Slide[]
  currentSlideIdx: number
}>()

defineEmits<{
  update: [Pick<Memory, 'id'> & Partial<Memory>]
  'slides-update': [
    { slides: Slide[]; currentSlideIdx?: number; coverMediaId?: string | null },
  ]
  'open-share-card': []
}>()

async function canClose(): Promise<boolean> {
  return true
}
defineExpose({ canClose })
</script>
