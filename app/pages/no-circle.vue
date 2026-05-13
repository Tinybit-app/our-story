<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm">
      <!-- Wordmark -->
      <p class="mb-12 text-center text-xs font-bold uppercase tracking-widest text-foreground">
        Our Story
      </p>

      <!-- Icon -->
      <div
        class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary"
      >
        <svg
          class="h-6 w-6 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>

      <!-- Heading -->
      <h1 class="mb-2 text-center text-xl font-bold leading-snug text-foreground">
        {{ t('noCircle.title') }}
      </h1>
      <p class="mb-8 text-center text-sm leading-relaxed text-muted-foreground">
        {{ t('noCircle.desc') }}
      </p>

      <!-- Create circle CTA -->
      <NuxtLink
        to="/onboarding"
        class="mb-6 block w-full rounded-[12px] bg-primary py-3.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {{ t('noCircle.createCircle') }}
      </NuxtLink>

      <!-- Divider -->
      <div class="mb-6 flex items-center gap-3">
        <div class="h-px flex-1 bg-border" />
        <span class="text-xs text-muted-foreground">{{ t('login.or') }}</span>
        <div class="h-px flex-1 bg-border" />
      </div>

      <!-- Waiting for invite -->
      <div class="rounded-2xl border border-border bg-secondary/40 px-5 py-4">
        <p class="mb-1 text-xs font-semibold text-foreground">{{ t('noCircle.waitingTitle') }}</p>
        <p class="text-xs leading-relaxed text-muted-foreground">{{ t('noCircle.waitingDesc') }}</p>
      </div>

      <!-- Pending circle deletion notice -->
      <NuxtLink
        v-if="hasPendingDeletions"
        to="/settings/account"
        class="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 transition-opacity hover:opacity-80 dark:border-amber-800/50 dark:bg-amber-900/20"
      >
        <svg
          class="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <p class="mb-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {{ t('noCircle.pendingDeletionTitle') }}
          </p>
          <p class="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
            {{ t('noCircle.pendingDeletionDesc') }}
          </p>
          <p
            class="mt-1.5 text-xs font-medium text-amber-700 underline underline-offset-2 dark:text-amber-300"
          >
            {{ t('noCircle.pendingDeletionAction') }}
          </p>
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
