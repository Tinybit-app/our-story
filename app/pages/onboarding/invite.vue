<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm">
      <p class="mb-8 text-xs font-bold uppercase tracking-widest text-foreground">Our Story</p>

      <!-- Step indicator -->
      <div class="mb-8 flex items-center gap-1.5">
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-foreground" />
      </div>

      <h1 class="mb-2 font-display text-[1.625rem] font-bold leading-tight text-foreground">
        {{ t('onboarding.inviteFirst') }}
      </h1>
      <p class="mb-8 text-sm text-muted-foreground">
        {{ t('onboarding.inviteSub') }}
      </p>

      <input
        v-model="email"
        type="email"
        placeholder="their@email.com"
        class="mb-4 w-full rounded-[12px] border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        autofocus
        @keyup.enter="email && !loading && sendInvite()"
      />

      <p v-if="errorMsg" class="mb-4 text-sm text-destructive">{{ errorMsg }}</p>

      <div v-if="sent" class="mb-4 rounded-[12px] border border-border bg-card px-4 py-3.5">
        <p class="text-sm font-medium text-foreground">{{ t('onboarding.inviteSent') }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ t('onboarding.inviteSentLink', { email }) }}
        </p>
      </div>

      <button
        @click="sendInvite"
        :disabled="!email || loading || sent"
        class="mb-3 w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {{ loading ? t('nav.sending') : t('onboarding.sendInvite') }}
      </button>

      <button
        @click="finish"
        class="w-full py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {{ sent ? t('onboarding.continue') : t('onboarding.skipForNow') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAnalytics } from '~/composables/useAnalytics'
definePageMeta({ middleware: 'onboarding' })
const { t } = useI18n()
const { track } = useAnalytics()

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const errorMsg = ref('')
const router = useRouter()

const circleTypeCookie = useCookie<string | null>('onboarding_circle_type', { maxAge: 60 * 60 * 2 })
const circleIdCookie = useCookie<string | null>('onboarding_circle_id', { maxAge: 60 * 60 * 2 })

async function sendInvite() {
  loading.value = true
  errorMsg.value = ''

  try {
    await $fetch('/api/circles/invite', {
      method: 'POST',
      body: { circleId: circleIdCookie.value, email: email.value },
    })
    track('member_invited', {
      circle_id: circleIdCookie.value ?? '',
      invite_method: 'link',
    })
    sent.value = true
  } catch (err: any) {
    errorMsg.value = err?.data?.message ?? t('nav.inviteFailed')
  } finally {
    loading.value = false
  }
}

function finish() {
  const newCircleId = circleIdCookie.value
  circleTypeCookie.value = null
  circleIdCookie.value = null
  router.push(newCircleId ? `/timeline?circle=${newCircleId}` : '/timeline')
}
</script>
