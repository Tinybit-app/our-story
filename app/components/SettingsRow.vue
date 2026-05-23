<template>
  <component
    :is="to ? 'NuxtLink' : 'div'"
    :to="to"
    class="flex w-full items-center gap-[14px] px-[14px] py-[13px] text-left"
    :class="to ? 'cursor-pointer transition-colors hover:bg-foreground/[.03]' : ''"
  >
    <!-- Icon slot -->
    <div
      v-if="$slots.icon"
      class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-foreground/[.06] text-foreground/80"
    >
      <slot name="icon" />
    </div>

    <!-- Label stack -->
    <div class="min-w-0 flex-1">
      <p
        class="text-[14px] font-medium leading-tight"
        :class="destructive ? 'text-destructive' : 'text-foreground'"
      >
        <slot />
      </p>
      <p
        v-if="$slots.hint"
        class="mt-0.5 text-[11px] leading-[1.35] text-muted-foreground"
      >
        <slot name="hint" />
      </p>
    </div>

    <!-- Control slot (right-aligned) -->
    <div v-if="$slots.control" class="flex-shrink-0">
      <slot name="control" />
    </div>

    <!-- Chevron for drill-rows -->
    <svg
      v-if="to"
      class="h-3 w-3 flex-shrink-0 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      viewBox="0 0 24 24"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  </component>
</template>

<script setup lang="ts">
defineProps<{
  /** When set, the row renders as a NuxtLink and shows a chevron. */
  to?: string
  /** Render label in destructive color (e.g. "Delete account"). */
  destructive?: boolean
}>()
</script>
