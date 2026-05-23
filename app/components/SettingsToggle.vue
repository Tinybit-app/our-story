<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="relative inline-flex h-[22px] w-10 flex-shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50"
    :class="modelValue ? 'bg-foreground' : 'bg-foreground/10'"
    @click="onClick"
  >
    <span
      class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform duration-200"
      :class="[
        modelValue
          ? 'translate-x-[20px] bg-background'
          : 'translate-x-[2px] bg-white',
      ]"
    />
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

function onClick() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>
