<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-foreground mb-6 uppercase">Our Story</p>

      <template v-if="errorMsg">
        <p class="text-sm text-destructive mb-4">{{ errorMsg }}</p>
        <button
          @click="retry"
          class="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          {{ t('confirm.tryAgain') }}
        </button>
      </template>
      <template v-else>
        <p class="text-sm text-muted-foreground">{{ t('confirm.signingIn') }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })
const { t } = useI18n()

const user = useSupabaseUser()
const router = useRouter()
const errorMsg = ref<string | null>(null)

async function checkMembership() {
  errorMsg.value = null
  try {
    const { refresh } = useUserState()
    const { hasMembership, needsProfile } = await refresh()

    if (needsProfile) {
      router.push("/onboarding/profile")
    } else {
      router.push(hasMembership ? "/timeline" : "/onboarding")
    }
  } catch {
    errorMsg.value = t('confirm.error')
  }
}

function retry() {
  if (user.value) checkMembership()
  else router.push("/login")
}

// If no user after 5 seconds, redirect to login (handles direct URL access)
const noAuthTimeout = setTimeout(() => {
  if (!user.value) router.push("/login")
}, 5000)

watchEffect(() => {
  if (!user.value) return
  clearTimeout(noAuthTimeout)

  // Check for pending invite token
  const inviteToken = useCookie("pending_invite_token")
  if (inviteToken.value) {
    router.push(`/invite/${inviteToken.value}`)
    return
  }

  checkMembership()
})
</script>
