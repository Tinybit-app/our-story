<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <p class="text-xs font-bold tracking-widest text-foreground mb-8 uppercase">Our Story</p>

      <!-- Step indicator -->
      <div class="flex items-center gap-1.5 mb-8">
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-border" />
      </div>

      <h1 class="font-display text-[1.625rem] font-bold leading-tight text-foreground mb-2">
        {{ t('onboarding.nameCircle') }}
      </h1>
      <p class="text-sm text-muted-foreground mb-8">
        {{ t('onboarding.nameCircleSub') }}
      </p>

      <input
        v-model="name"
        type="text"
        :placeholder="placeholder"
        class="w-full bg-card border border-border rounded-[12px] px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
        autofocus
        @keyup.enter="name && !loading && createCircle()"
      />

      <p v-if="errorMsg" class="mb-4 text-sm text-destructive">{{ errorMsg }}</p>

      <button
        @click="createCircle"
        :disabled="!name || loading"
        class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity mb-3"
      >
        {{ loading ? t('onboarding.creating') : t('onboarding.continue') }}
      </button>

      <button
        @click="router.back()"
        class="w-full text-muted-foreground text-sm py-2.5 hover:text-foreground transition-colors"
      >
        {{ t('onboarding.back') }}
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'onboarding' })
const { t } = useI18n()

const router = useRouter()
const name = ref('')
const loading = ref(false)
const errorMsg = ref('')

const circleTypeCookie = useCookie<string | null>('onboarding_circle_type', { maxAge: 60 * 60 * 2 })
const circleIdCookie = useCookie<string | null>('onboarding_circle_id', { maxAge: 60 * 60 * 2 })

const placeholder = computed(() => {
  const map: Record<string, string> = {
    parents:    t('onboarding.circlePlaceholderParents'),
    couple:     t('onboarding.circlePlaceholderCouple'),
    friends:    t('onboarding.circlePlaceholderFriends'),
    solo:       t('onboarding.circlePlaceholderSolo'),
    family:     t('onboarding.circlePlaceholderFamily'),
    travel:     t('onboarding.circlePlaceholderTravel'),
    caregiving: t('onboarding.circlePlaceholderCaregiving'),
  }
  return map[circleTypeCookie.value ?? ''] ?? t('onboarding.circlePlaceholderDefault')
})

async function createCircle() {
  loading.value = true
  errorMsg.value = ''

  try {
    const { circleId } = await $fetch<{ circleId: string }>('/api/circles/create', {
      method: 'POST',
      body: { name: name.value, circleType: circleTypeCookie.value },
    })

    circleIdCookie.value = circleId

    const { refresh } = useUserState()
    await refresh()

    if (circleTypeCookie.value === 'solo') {
      circleTypeCookie.value = null
      circleIdCookie.value = null
      router.push('/')
    } else {
      router.push('/onboarding/invite')
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.message ?? t('common.errorGeneric')
  } finally {
    loading.value = false
  }
}
</script>
