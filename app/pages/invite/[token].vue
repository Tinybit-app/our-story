<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="w-full max-w-sm text-center">
      <p class="text-xs font-bold tracking-widest text-foreground mb-8 uppercase">Our Story</p>

      <template v-if="errorMsg">
        <h1 class="font-display text-xl font-bold text-foreground mb-3">
          {{ errorMsg === 'invite_expired' ? t('invite.expired') : errorMsg === 'invite_circle_deleted' ? t('invite.circleDeleted') : t('invite.error') }}
        </h1>
        <p class="text-sm text-muted-foreground mb-6">
          {{ errorMsg === 'invite_expired' ? t('invite.expiredDesc') : errorMsg === 'invite_circle_deleted' ? t('invite.circleDeletedDesc') : t('invite.errorDesc') }}
        </p>
        <NuxtLink
          to="/login"
          class="inline-block bg-primary text-primary-foreground rounded-[12px] px-6 py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {{ t('invite.goToSignIn') }}
        </NuxtLink>
      </template>

      <template v-else>
        <p class="text-muted-foreground text-sm">{{ t('invite.joining') }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAnalytics } from "~/composables/useAnalytics"
definePageMeta({ auth: false })
const { t } = useI18n()
const { track } = useAnalytics()

const route = useRoute()
const user = useSupabaseUser()
const router = useRouter()
const token = route.params.token as string
const errorMsg = ref('')

// Store token in cookie so it survives the auth redirect
const inviteCookie = useCookie('pending_invite_token', { maxAge: 60 * 60 * 24 * 7 })

onMounted(async () => {
  // Pre-validate the invite before touching auth — this way someone who
  // clicks a stale link sees the right error immediately, without being
  // forced through a sign-in flow first.
  const status = await $fetch<{ status: 'pending' | 'expired' | 'circle_deleted' }>(
    `/api/invites/${token}/status`
  ).catch(() => ({ status: 'error' as const }))

  if (status.status === 'expired') {
    errorMsg.value = 'invite_expired'
    return
  }

  if (status.status === 'circle_deleted') {
    errorMsg.value = 'invite_circle_deleted'
    return
  }

  if (status.status !== 'pending') {
    errorMsg.value = 'error'
    return
  }

  if (!user.value) {
    // Invite is valid — store token and send to login
    inviteCookie.value = token
    router.push('/login')
    return
  }

  await acceptInvite()
})

async function acceptInvite() {
  try {
    const result = await $fetch<{ ok: boolean; circleId: string }>(`/api/invites/${token}/accept`, { method: 'POST' })
    inviteCookie.value = null
    track("member_joined", {
      circle_id: result.circleId,
      joined_via: "invite",
    })
    // Refresh user state so the index page guard sees hasMembership: true
    const { refresh } = useUserState()
    await refresh()
    router.push(`/timeline?circle=${result.circleId}&welcome=1`)
  } catch (err: any) {
    // Always clear the cookie — a stale token must not trap the user here on retry
    inviteCookie.value = null
    errorMsg.value = err?.data?.message ?? 'error'
  }
}
</script>
