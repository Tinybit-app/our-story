<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm">
      <p
        class="mb-8 text-xs font-bold uppercase tracking-widest text-foreground"
      >
        Our Story
      </p>

      <!-- Step indicator -->
      <div class="mb-8 flex items-center gap-1.5">
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-border" />
      </div>

      <h1
        class="mb-2 font-display text-[1.625rem] font-bold leading-tight text-foreground"
      >
        {{ t('onboarding.nameCircle') }}
      </h1>
      <p class="mb-8 text-sm text-muted-foreground">
        {{ t('onboarding.nameCircleSub') }}
      </p>

      <input
        v-model="name"
        type="text"
        :placeholder="placeholder"
        class="mb-4 w-full rounded-[12px] border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        autofocus
        @keyup.enter="name && !loading && createCircle()"
      />

      <p v-if="errorMsg" class="mb-4 text-sm text-destructive">
        {{ errorMsg }}
      </p>

      <button
        @click="createCircle"
        :disabled="!name || loading"
        class="mb-3 w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {{ loading ? t('onboarding.creating') : t('onboarding.continue') }}
      </button>

      <button
        @click="router.back()"
        class="w-full py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {{ t('onboarding.back') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAnalytics, type CircleType } from '~/composables/useAnalytics'

definePageMeta({ middleware: 'onboarding' })
const { t } = useI18n()
const { track } = useAnalytics()

const router = useRouter()
const name = ref('')
const loading = ref(false)
const errorMsg = ref('')

const circleTypeCookie = useCookie<string | null>('onboarding_circle_type', {
  maxAge: 60 * 60 * 2,
})
const circleIdCookie = useCookie<string | null>('onboarding_circle_id', {
  maxAge: 60 * 60 * 2,
})

const placeholder = computed(() => {
  const map: Record<string, string> = {
    parents: t('onboarding.circlePlaceholderParents'),
    couple: t('onboarding.circlePlaceholderCouple'),
    friends: t('onboarding.circlePlaceholderFriends'),
    solo: t('onboarding.circlePlaceholderSolo'),
    family: t('onboarding.circlePlaceholderFamily'),
    travel: t('onboarding.circlePlaceholderTravel'),
    caregiving: t('onboarding.circlePlaceholderCaregiving'),
  }
  return (
    map[circleTypeCookie.value ?? ''] ??
    t('onboarding.circlePlaceholderDefault')
  )
})

async function createCircle() {
  loading.value = true
  errorMsg.value = ''

  try {
    const { circleId } = await $fetch<{ circleId: string }>(
      '/api/circles/create',
      {
        method: 'POST',
        body: { name: name.value, circleType: circleTypeCookie.value },
      },
    )

    circleIdCookie.value = circleId

    track('circle_created', {
      circle_id: circleId,
      circle_type: (circleTypeCookie.value ?? 'custom') as CircleType,
    })

    const { refresh } = useUserState()
    await refresh()

    if (circleTypeCookie.value === 'solo') {
      circleTypeCookie.value = null
      const newCircleId = circleId
      circleIdCookie.value = null
      router.push(`/timeline?circle=${newCircleId}`)
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
