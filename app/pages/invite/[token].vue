<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm text-center">
      <p
        class="mb-8 text-xs font-bold uppercase tracking-widest text-foreground"
      >
        Our Story
      </p>

      <template v-if="errorMsg">
        <h1 class="mb-3 font-display text-xl font-bold text-foreground">
          {{
            errorMsg === 'invite_expired'
              ? t('invite.expired')
              : errorMsg === 'invite_circle_deleted'
                ? t('invite.circleDeleted')
                : t('invite.error')
          }}
        </h1>
        <p class="mb-6 text-sm text-muted-foreground">
          {{
            errorMsg === 'invite_expired'
              ? t('invite.expiredDesc')
              : errorMsg === 'invite_circle_deleted'
                ? t('invite.circleDeletedDesc')
                : t('invite.errorDesc')
          }}
        </p>
        <NuxtLink
          to="/login"
          class="inline-block rounded-[12px] bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {{ t('invite.goToSignIn') }}
        </NuxtLink>
      </template>

      <template v-else>
        <p class="text-sm text-muted-foreground">{{ t('invite.joining') }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAnalytics } from '~/composables/useAnalytics'
definePageMeta({ auth: false })
const { t } = useI18n()
const { track } = useAnalytics()

const route = useRoute()
const user = useSupabaseUser()
const router = useRouter()
const token = route.params.token as string
const errorMsg = ref('')

// Store token in cookie so it survives the auth redirect
const inviteCookie = useCookie('pending_invite_token', {
  maxAge: 60 * 60 * 24 * 7,
})

onMounted(async () => {
  // Pre-validate the invite before touching auth — this way someone who
  // clicks a stale link sees the right error immediately, without being
  // forced through a sign-in flow first.
  const status = await $fetch<{
    status: 'pending' | 'expired' | 'circle_deleted'
  }>(`/api/invites/${token}/status`).catch(() => ({ status: 'error' as const }))

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
    const result = await $fetch<{ ok: boolean; circleId: string }>(
      `/api/invites/${token}/accept`,
      {
        method: 'POST',
      },
    )
    inviteCookie.value = null
    track('member_joined', {
      circle_id: result.circleId,
      joined_via: 'invite',
    })
    // Refresh user state so subsequent guards see hasMembership: true and the
    // profile-needed flag.
    const { refresh } = useUserState()
    const state = await refresh()
    // Brand-new invitees (account just created via the magic-link sign-in we
    // bounced through) still have needsProfile=true here — skipping
    // /onboarding/profile would leave their byline blank on every memory they
    // post until they discover Settings. Route them through the profile step;
    // once it completes, profile.vue pushes them to /timeline because the
    // accept call has already given them hasMembership.
    if (state.needsProfile) {
      router.push('/onboarding/profile')
      return
    }
    router.push(`/timeline?circle=${result.circleId}&welcome=1`)
  } catch (err: any) {
    // Always clear the cookie — a stale token must not trap the user here on retry
    inviteCookie.value = null
    errorMsg.value = err?.data?.message ?? 'error'
  }
}
</script>
