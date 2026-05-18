<template>
  <div>
    <!-- Photo region content moves in over Tasks 2-4 -->
  </div>
</template>

<script setup lang="ts">
import type { Memory } from '~/composables/useTimeline'
import type { Slide } from '~/types/memory'

defineProps<{
  memory: Memory
  slides: Slide[]
  slidesLoading: boolean
  currentSlideIdx: number
}>()

defineEmits<{
  'current-slide-idx': [number]
}>()
</script>
