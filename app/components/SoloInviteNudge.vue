<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('update:modelValue', false)" />
      <div class="relative w-full max-w-sm bg-card border border-border rounded-[20px] shadow-2xl overflow-hidden">

        <!-- Header -->
        <div class="px-6 pt-6 pb-4">
          <h2 class="text-base font-bold text-foreground mb-1">{{ t('soloNudge.title') }}</h2>
          <p class="text-sm text-muted-foreground leading-relaxed">{{ t('soloNudge.desc') }}</p>
        </div>

        <!-- Type grid -->
        <div class="px-6 pb-4 grid grid-cols-2 gap-2">
          <button
            v-for="type in SHARED_TYPES"
            :key="type.value"
            class="flex flex-col items-start gap-0.5 px-4 py-3 rounded-[12px] border text-left transition-all"
            :class="selectedType === type.value
              ? 'border-foreground bg-secondary'
              : 'border-border hover:border-foreground/30 hover:bg-secondary/40'"
            @click="selectedType = type.value"
          >
            <span class="text-sm font-semibold text-foreground">{{ t(`circleType.${type.value}.label`) }}</span>
            <span class="text-[11px] text-muted-foreground">{{ t(`circleType.${type.value}.description`) }}</span>
          </button>
        </div>

        <!-- Footer -->
        <div class="px-6 pb-6 space-y-2">
          <p v-if="switchError" class="text-xs text-destructive">{{ switchError }}</p>
          <button
            class="w-full py-3 rounded-[10px] text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
            :disabled="!selectedType || switching"
            @click="switchAndInvite"
          >
            {{ switching ? t('soloNudge.switching') : t('soloNudge.switchAndInvite') }}
          </button>
          <button
            class="w-full py-3 rounded-[10px] text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
            :disabled="switching"
            @click="$emit('inviteAnyway')"
          >
            {{ t('soloNudge.inviteAnyway') }}
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  circleId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  switched: [newType: string]
  inviteAnyway: []
}>()

const SHARED_TYPES = [
  { value: 'couple' },
  { value: 'family' },
  { value: 'friends' },
  { value: 'parents' },
  { value: 'caregiving' },
  { value: 'travel' },
] as const

const selectedType = ref<string | null>(null)
const switching = ref(false)
const switchError = ref('')

// Reset state when dialog opens
watch(() => props.modelValue, (open) => {
  if (open) {
    selectedType.value = null
    switchError.value = ''
  }
})

async function switchAndInvite() {
  if (!selectedType.value) return
  switching.value = true
  switchError.value = ''
  try {
    await $fetch(`/api/circles/${props.circleId}`, {
      method: 'PATCH',
      body: { circleType: selectedType.value },
    })
    emit('switched', selectedType.value)
    emit('update:modelValue', false)
  } catch (err: any) {
    switchError.value = err?.data?.message ?? t('common.errorGeneric')
  } finally {
    switching.value = false
  }
}
</script>
