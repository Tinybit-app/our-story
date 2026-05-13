<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm">
      <p class="mb-8 text-xs font-bold uppercase tracking-widest text-foreground">Our Story</p>

      <!-- Step indicator -->
      <div class="mb-8 flex items-center gap-1.5">
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-border" />
        <div class="h-1 w-6 rounded-full bg-border" />
      </div>

      <h1 class="mb-2 font-display text-[1.625rem] font-bold leading-tight text-foreground">
        {{ t('onboarding.whoIsThis') }}
      </h1>
      <p class="mb-8 text-sm text-muted-foreground">
        {{ t('onboarding.personalise') }}
      </p>

      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="type in circleTypes"
          :key="type.value"
          @click="select(type.value)"
          class="rounded-[12px] border px-4 py-3.5 text-left transition-colors"
          :class="
            selected === type.value
              ? 'border-foreground bg-secondary'
              : 'border-border bg-card hover:border-foreground/30'
          "
        >
          <p class="text-sm font-medium leading-snug text-foreground">{{ type.label }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ type.description }}</p>
        </button>
      </div>

      <button
        @click="next"
        :disabled="!selected"
        class="mt-6 w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {{ t('onboarding.continue') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'onboarding' })
const { t } = useI18n()

const selected = ref('')
const router = useRouter()
const circleTypeCookie = useCookie('onboarding_circle_type', { maxAge: 60 * 60 * 2 })

// Clear any stale cookies from a previous partial flow
onMounted(() => {
  circleTypeCookie.value = null
})

const circleTypes = computed(() => [
  {
    value: 'parents',
    label: t('circleType.parents.label'),
    description: t('circleType.parents.description'),
  },
  {
    value: 'couple',
    label: t('circleType.couple.label'),
    description: t('circleType.couple.description'),
  },
  {
    value: 'family',
    label: t('circleType.family.label'),
    description: t('circleType.family.description'),
  },
  {
    value: 'friends',
    label: t('circleType.friends.label'),
    description: t('circleType.friends.description'),
  },
  {
    value: 'caregiving',
    label: t('circleType.caregiving.label'),
    description: t('circleType.caregiving.description'),
  },
  {
    value: 'travel',
    label: t('circleType.travel.label'),
    description: t('circleType.travel.description'),
  },
  {
    value: 'solo',
    label: t('circleType.solo.label'),
    description: t('circleType.solo.description'),
  },
])

function select(value: string) {
  selected.value = value
}

function next() {
  circleTypeCookie.value = selected.value
  router.push('/onboarding/name')
}
</script>
