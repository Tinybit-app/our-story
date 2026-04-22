<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />

        <!-- Sheet -->
        <div class="relative bg-background w-full sm:max-w-xs rounded-t-[24px] sm:rounded-[24px] shadow-2xl overflow-hidden">
          <div class="h-[3px] bg-gradient-to-r from-accent via-pink-400 to-orange-300" />

          <div class="px-4 pt-4 pb-5">
            <p class="text-[10px] font-bold tracking-[.18em] text-muted-foreground uppercase mb-3">
              {{ t('addMemory.title') }}
            </p>

            <!-- Photo / Video -->
            <button
              class="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] border border-border hover:border-foreground/30 hover:bg-secondary transition-colors mb-2 text-left"
              @click="emit('photo')"
            >
              <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-4.5 h-4.5 text-accent" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-foreground leading-snug">{{ t('addMemory.photoVideo') }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ t('addMemory.photoVideoDesc') }}</p>
              </div>
            </button>

            <!-- Quick note -->
            <button
              class="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] border border-border hover:border-foreground/30 hover:bg-secondary transition-colors text-left"
              @click="emit('quickNote')"
            >
              <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-4.5 h-4.5 text-accent" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-foreground leading-snug">{{ t('addMemory.quickNote') }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ t('addMemory.quickNoteDesc') }}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { t } = useI18n()

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; photo: []; quickNote: [] }>()
</script>
