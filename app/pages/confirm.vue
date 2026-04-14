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
          Try again
        </button>
      </template>
      <template v-else>
        <p class="text-sm text-muted-foreground">Signing you in…</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

const user = useSupabaseUser()
const router = useRouter()
const errorMsg = ref<string | null>(null)

async function checkMembership() {
  errorMsg.value = null
  try {
    const { hasMembership } = await $fetch<{ hasMembership: boolean }>("/api/auth/membership")
    router.push(hasMembership ? "/" : "/onboarding")
  } catch {
    errorMsg.value = "Something went wrong. Please try again."
  }
}

function retry() {
  if (user.value) checkMembership()
  else router.push("/login")
}

watchEffect(() => {
  if (!user.value) return

  // Check for pending invite token
  const inviteToken = useCookie("pending_invite_token")
  if (inviteToken.value) {
    router.push(`/invite/${inviteToken.value}`)
    return
  }

  checkMembership()
})
</script>
