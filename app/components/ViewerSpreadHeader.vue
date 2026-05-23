<template>
  <div class="border-b border-border bg-background">
    <!-- Top strip — sticky, compact -->
    <div
      class="sticky top-0 z-20 flex items-center justify-between border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-md"
    >
      <div class="min-w-0">
        <p
          class="text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-muted-foreground"
        >
          Our Story
        </p>
        <p
          class="mt-1 truncate font-serif text-[13px] italic text-foreground/80"
        >
          {{ t('viewerLink.fromCircle', { circle: circleName }) }}
        </p>
      </div>
      <div class="flex flex-shrink-0 items-center gap-2">
        <LocalePicker guest />
        <NuxtLink
          to="/login"
          class="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {{ t('viewerLink.signIn') }}
        </NuxtLink>
      </div>
    </div>

    <!-- Hero block — italic display title -->
    <div class="px-5 py-7 sm:px-8 sm:py-10">
      <p
        class="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground/70 sm:text-[11px]"
      >
        {{
          mode === 'selection'
            ? t('viewerLink.selectedCollection')
            : t('viewerLink.privateCollection')
        }}
      </p>
      <h1
        class="font-serif text-[36px] italic leading-[1.05] text-foreground sm:text-[44px]"
      >
        {{
          linkLabel
            ? t('viewerLink.forRecipient', { recipient: linkLabel })
            : t('viewerLink.forYou')
        }}
      </h1>
      <p
        v-if="ownerLabel || memoryCount > 0"
        class="mt-4 flex items-baseline gap-2 text-[12px] text-muted-foreground sm:text-[13px]"
      >
        <span v-if="ownerLabel" class="font-serif italic">{{
          `— ${ownerLabel}`
        }}</span>
        <span v-if="ownerLabel && memoryCount > 0" class="text-border">·</span>
        <span v-if="memoryCount > 0" class="font-mono tabular-nums">
          {{ t('viewerLink.memoriesCount', { n: memoryCount }, memoryCount) }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  circleName: string
  ownerLabel: string | null
  linkLabel: string | null
  memoryCount: number
  mode: 'full' | 'selection'
}>()

const { t } = useI18n()
</script>
