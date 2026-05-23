<template>
  <section class="mb-8">
    <h2
      v-if="label"
      class="mb-2 ml-[14px] font-mono text-[9px] font-bold uppercase leading-none tracking-[.22em] text-muted-foreground"
    >
      {{ label }}
    </h2>
    <div
      class="overflow-hidden rounded-[14px] border border-border bg-card divide-y divide-foreground/[.05]"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>
