<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="w-full max-w-sm text-center">
      <p class="text-xs font-bold tracking-widest text-foreground mb-8 uppercase">Our Story</p>

      <template v-if="errorMsg">
        <h1 class="font-display text-xl font-bold text-foreground mb-3">
          {{ errorMsg === 'invite_expired' ? 'This invite has expired' : 'Something went wrong' }}
        </h1>
        <p class="text-sm text-muted-foreground mb-6">
          {{ errorMsg === 'invite_expired'
            ? 'Ask the circle owner to send a new invite.'
            : 'Please try the link again or ask for a new invite.' }}
        </p>
        <NuxtLink
          to="/login"
          class="inline-block bg-primary text-primary-foreground rounded-[12px] px-6 py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Go to sign in
        </NuxtLink>
      </template>

      <template v-else>
        <p class="text-muted-foreground text-sm">Joining your circle…</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

const route = useRoute()
const user = useSupabaseUser()
const router = useRouter()
const token = route.params.token as string
const errorMsg = ref('')

// Store token in cookie so it survives the auth redirect
const inviteCookie = useCookie('pending_invite_token', { maxAge: 60 * 60 * 24 * 7 })

onMounted(async () => {
  if (!user.value) {
    // Not logged in — store token and redirect to login
    inviteCookie.value = token
    router.push('/login')
    return
  }

  await acceptInvite()
})

async function acceptInvite() {
  try {
    const result = await $fetch<{ ok: boolean; familyId: string }>(`/api/invites/${token}/accept`, { method: 'POST' })
    inviteCookie.value = null
    // Refresh user state so the index page guard sees hasMembership: true
    const { refresh } = useUserState()
    await refresh()
    router.push(`/?family=${result.familyId}&welcome=1`)
  } catch (err: any) {
    errorMsg.value = err?.data?.message ?? 'error'
  }
}
</script>
