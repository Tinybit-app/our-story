<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <p class="text-xs font-bold tracking-widest text-foreground mb-8 uppercase">Our Story</p>

      <h1 class="font-display text-[1.625rem] font-bold leading-tight text-foreground mb-2">
        {{ t('onboarding.whatsYourName') }}
      </h1>
      <p class="text-sm text-muted-foreground mb-8">
        {{ t('onboarding.nameSub') }}
      </p>

      <!-- Language toggle -->
      <div class="mb-6">
        <p class="text-xs text-muted-foreground mb-2">{{ t('onboarding.language') }}</p>
        <div class="inline-flex rounded-[10px] border border-border bg-card p-0.5 gap-0.5">
          <button
            v-for="loc in locales"
            :key="loc.code"
            @click="setLocale(loc.code)"
            class="px-4 py-1.5 rounded-[8px] text-sm font-medium transition-colors"
            :class="locale === loc.code
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'"
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
        class="w-full bg-card border border-border rounded-[12px] px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-3"
        @keyup.enter="lastName && firstName ? save() : undefined"
      />
      <input
        v-model="lastName"
        type="text"
        :placeholder="t('onboarding.lastName')"
        class="w-full bg-card border border-border rounded-[12px] px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
        @keyup.enter="firstName ? save() : undefined"
      />

      <p v-if="errorMsg" class="mb-4 text-sm text-destructive">{{ errorMsg }}</p>

      <button
        @click="save"
        :disabled="!firstName.trim() || loading"
        class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
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
      body: { firstName: firstName.value, lastName: lastName.value, locale: locale.value },
    })

    const { refresh } = useUserState()
    const { hasMembership } = await refresh()
    router.push(hasMembership ? '/' : '/onboarding')
  } catch (err: any) {
    errorMsg.value = err?.data?.message ?? t('common.errorGeneric')
  } finally {
    loading.value = false
  }
}
</script>
