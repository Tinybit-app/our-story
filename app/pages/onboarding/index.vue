<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <p class="text-xs font-bold tracking-widest text-foreground mb-8 uppercase">Our Story</p>

      <!-- Step indicator -->
      <div class="flex items-center gap-1.5 mb-8">
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-border" />
        <div class="h-1 w-6 rounded-full bg-border" />
      </div>

      <h1 class="font-display text-[1.625rem] font-bold leading-tight text-foreground mb-2">
        Who is this story for?
      </h1>
      <p class="text-sm text-muted-foreground mb-8">
        We'll personalise your experience based on your group.
      </p>

      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="type in circleTypes"
          :key="type.value"
          @click="select(type.value)"
          class="rounded-[12px] px-4 py-3.5 text-left border transition-colors"
          :class="selected === type.value
            ? 'border-foreground bg-secondary'
            : 'border-border bg-card hover:border-foreground/30'"
        >
          <p class="text-sm font-medium text-foreground leading-snug">{{ type.label }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">{{ type.description }}</p>
        </button>
      </div>

      <button
        @click="next"
        :disabled="!selected"
        class="mt-6 w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        Continue
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
const selected = ref('')
const router = useRouter()
const circleTypeCookie = useCookie('onboarding_circle_type', { maxAge: 60 * 60 * 2 })

// Guard: profile must be complete before onboarding can proceed
onMounted(async () => {
  const { needsProfile } = await $fetch<{ needsProfile: boolean }>('/api/auth/membership')
  if (needsProfile) router.replace('/onboarding/profile')
})

const circleTypes = [
  { value: 'parents',    label: 'New parents',   description: 'Baby milestones & growth' },
  { value: 'couple',     label: 'Couple',         description: 'Relationship milestones' },
  { value: 'family',     label: 'Family',         description: 'General family memories' },
  { value: 'friends',    label: 'Friend group',   description: 'Trips, reunions, moments' },
  { value: 'caregiving', label: 'Caregiving',     description: 'Health & life events' },
  { value: 'travel',     label: 'Travel group',   description: 'Adventures together' },
  { value: 'solo',       label: 'Just me',        description: 'Personal timeline' },
]

function select(value: string) {
  selected.value = value
}

function next() {
  circleTypeCookie.value = selected.value
  router.push('/onboarding/name')
}
</script>
