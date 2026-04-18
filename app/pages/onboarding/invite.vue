<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <p class="text-xs font-bold tracking-widest text-foreground mb-8 uppercase">Our Story</p>

      <!-- Step indicator -->
      <div class="flex items-center gap-1.5 mb-8">
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-foreground" />
      </div>

      <h1 class="font-display text-[1.625rem] font-bold leading-tight text-foreground mb-2">
        {{ t('onboarding.inviteFirst') }}
      </h1>
      <p class="text-sm text-muted-foreground mb-8">
        {{ t('onboarding.inviteSub') }}
      </p>

      <input
        v-model="email"
        type="email"
        placeholder="their@email.com"
        class="w-full bg-card border border-border rounded-[12px] px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
        autofocus
        @keyup.enter="email && !loading && sendInvite()"
      />

      <p v-if="errorMsg" class="mb-4 text-sm text-destructive">{{ errorMsg }}</p>

      <div v-if="sent" class="mb-4 rounded-[12px] bg-card border border-border px-4 py-3.5">
        <p class="text-sm font-medium text-foreground">{{ t('onboarding.inviteSent') }}</p>
        <p class="text-xs text-muted-foreground mt-0.5">{{ t('onboarding.inviteSentLink', { email }) }}</p>
      </div>

      <button
        @click="sendInvite"
        :disabled="!email || loading || sent"
        class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity mb-3"
      >
        {{ loading ? t('nav.sending') : t('onboarding.sendInvite') }}
      </button>

      <button
        @click="finish"
        class="w-full text-muted-foreground text-sm py-2.5 hover:text-foreground transition-colors"
      >
        {{ sent ? t('onboarding.continue') : t('onboarding.skipForNow') }}
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'onboarding' })
const { t } = useI18n()

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
  router.push(newCircleId ? `/?circle=${newCircleId}` : '/')
}
</script>
