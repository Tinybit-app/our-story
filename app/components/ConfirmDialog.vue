<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
        @keydown.esc="onCancel"
      >
        <!-- Backdrop: click-outside cancels (safer default than confirming). -->
        <div
          class="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          @click="onCancel"
        />

        <Transition
          appear
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
        >
          <div
            v-if="modelValue"
            ref="dialogEl"
            role="alertdialog"
            aria-modal="true"
            :aria-labelledby="title ? titleId : undefined"
            :aria-describedby="bodyId"
            tabindex="-1"
            class="relative z-10 w-full max-w-[340px] rounded-2xl border border-border bg-card p-5 shadow-[0_24px_60px_rgba(0,0,0,.45)]"
          >
            <h3
              v-if="title"
              :id="titleId"
              class="text-[15px] font-semibold tracking-tight text-foreground"
            >
              {{ title }}
            </h3>
            <p
              :id="bodyId"
              class="text-[13px] leading-relaxed text-muted-foreground"
              :class="title ? 'mt-1.5' : ''"
            >
              {{ message }}
            </p>

            <div class="mt-5 flex items-center justify-end gap-4">
              <button
                type="button"
                class="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                @click="onCancel"
              >
                {{ cancelLabel ?? t('confirmDialog.cancel') }}
              </button>
              <button
                type="button"
                class="text-[12px] font-semibold transition-opacity hover:opacity-80"
                :class="
                  variant === 'destructive' ? 'text-destructive' : 'text-accent'
                "
                @click="onConfirm"
              >
                {{ confirmLabel ?? t('confirmDialog.confirm') }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'destructive' | 'accent'
  }>(),
  { variant: 'destructive' },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
  cancel: []
}>()

const titleId = useId()
const bodyId = useId()
const dialogEl = ref<HTMLDivElement | null>(null)

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      await nextTick()
      dialogEl.value?.focus()
    }
  },
)

function onConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
}
function onCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>
