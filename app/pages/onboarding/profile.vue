<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm">
      <p
        class="mb-8 text-xs font-bold uppercase tracking-widest text-foreground"
      >
        Our Story
      </p>

      <h1
        class="mb-2 font-display text-[1.625rem] font-bold leading-tight text-foreground"
      >
        {{ t('onboarding.whatsYourName') }}
      </h1>
      <p class="mb-8 text-sm text-muted-foreground">
        {{ t('onboarding.nameSub') }}
      </p>

      <!-- Language toggle -->
      <div class="mb-6">
        <p class="mb-2 text-xs text-muted-foreground">
          {{ t('onboarding.language') }}
        </p>
        <div
          class="inline-flex gap-0.5 rounded-[10px] border border-border bg-card p-0.5"
        >
          <button
            v-for="loc in locales"
            :key="loc.code"
            @click="setLocale(loc.code)"
            class="rounded-[8px] px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              locale === loc.code
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            "
          >
            {{ loc.name }}
          </button>
        </div>
      </div>

      <input
        v-model="firstName"
        type="text"
        :placeholder="t('onboarding.firstName')"
        autofocus
        class="mb-3 w-full rounded-[12px] border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        @keyup.enter="lastName && firstName ? save() : undefined"
      />
      <input
        v-model="lastName"
        type="text"
        :placeholder="t('onboarding.lastName')"
        class="mb-4 w-full rounded-[12px] border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        @keyup.enter="firstName ? save() : undefined"
      />

      <p v-if="errorMsg" class="mb-4 text-sm text-destructive">
        {{ errorMsg }}
      </p>

      <button
        @click="save"
        :disabled="!firstName.trim() || loading"
        class="w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {{ loading ? t('onboarding.saving') : t('onboarding.continue') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'onboarding' })
const { t, locale, locales, setLocale } = useI18n()

const router = useRouter()
const firstName = ref('')
const lastName = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function save() {
  if (!firstName.value.trim()) return
  loading.value = true
  errorMsg.value = ''

  try {
    await $fetch('/api/profile', {
      method: 'PATCH',
      body: {
        firstName: firstName.value,
        lastName: lastName.value,
        locale: locale.value,
      },
    })

    const { refresh } = useUserState()
    const { hasMembership } = await refresh()
    router.push(hasMembership ? '/timeline' : '/onboarding')
  } catch (err: any) {
    errorMsg.value = err?.data?.message ?? t('common.errorGeneric')
  } finally {
    loading.value = false
  }
}
</script>
