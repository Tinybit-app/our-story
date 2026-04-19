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

      <!-- Pending circle deletion notice -->
      <NuxtLink
        v-if="hasPendingDeletions"
        to="/settings/account"
        class="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3.5 hover:opacity-80 transition-opacity"
      >
        <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p class="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-0.5">{{ t('noCircle.pendingDeletionTitle') }}</p>
          <p class="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{{ t('noCircle.pendingDeletionDesc') }}</p>
          <p class="text-xs font-medium text-amber-700 dark:text-amber-300 mt-1.5 underline underline-offset-2">{{ t('noCircle.pendingDeletionAction') }}</p>
        </div>
      </NuxtLink>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })
const { t } = useI18n()

const { data } = await useFetch<{ circles: unknown[] }>('/api/circles/deleted')
const hasPendingDeletions = computed(() => (data.value?.circles?.length ?? 0) > 0)
</script>
