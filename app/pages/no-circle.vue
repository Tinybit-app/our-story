<template>
  <div class="min-h-screen bg-background flex flex-col items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <!-- Wordmark -->
      <p class="text-xs font-bold tracking-widest text-foreground uppercase mb-12 text-center">Our Story</p>

      <!-- Icon -->
      <div class="w-14 h-14 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
        <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>

      <!-- Heading -->
      <h1 class="text-xl font-bold text-foreground text-center leading-snug mb-2">
        {{ t('noCircle.title') }}
      </h1>
      <p class="text-sm text-muted-foreground text-center leading-relaxed mb-8">
        {{ t('noCircle.desc') }}
      </p>

      <!-- Create circle CTA -->
      <NuxtLink
        to="/onboarding"
        class="block w-full py-3.5 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold text-center hover:opacity-90 transition-opacity mb-6"
      >
        {{ t('noCircle.createCircle') }}
      </NuxtLink>

      <!-- Divider -->
      <div class="flex items-center gap-3 mb-6">
        <div class="flex-1 h-px bg-border" />
        <span class="text-xs text-muted-foreground">{{ t('login.or') }}</span>
        <div class="flex-1 h-px bg-border" />
      </div>

      <!-- Waiting for invite -->
      <div class="rounded-2xl border border-border bg-secondary/40 px-5 py-4">
        <p class="text-xs font-semibold text-foreground mb-1">{{ t('noCircle.waitingTitle') }}</p>
        <p class="text-xs text-muted-foreground leading-relaxed">{{ t('noCircle.waitingDesc') }}</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })
const { t } = useI18n()
const router = useRouter()

// If the user already has a membership, send them home
onMounted(async () => {
  const { ensure } = useUserState()
  const { hasMembership, needsProfile } = await ensure()
  if (needsProfile) {
    router.replace('/onboarding/profile')
  } else if (hasMembership) {
    router.replace('/')
  }
})
</script>
