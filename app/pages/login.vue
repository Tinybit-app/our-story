<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm">
      <!-- Wordmark -->
      <p class="mb-4 text-xs font-bold uppercase tracking-widest text-foreground">Our Story</p>

      <!-- Headline -->
      <h1 class="mb-2 font-display text-[1.625rem] font-bold leading-tight text-foreground">
        {{ t('login.tagline') }}
      </h1>
      <p class="mb-8 text-sm text-muted-foreground">
        {{ t('login.subtitle') }}
      </p>

      <!-- Email form -->
      <form v-if="!sent" @submit.prevent="submitEmail">
        <input
          v-model="email"
          type="email"
          placeholder="your@email.com"
          required
          class="mb-2.5 w-full rounded-[12px] border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-[12px] bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ loading ? t('login.sending') : t('login.continueWithEmail') }}
        </button>
      </form>

      <!-- Error message -->
      <p v-if="authError" class="mt-4 text-center text-sm font-medium text-destructive">
        {{ authError }}
      </p>

      <!-- Success state -->
      <div
        v-if="sent"
        class="mt-6 rounded-[12px] border border-border bg-card px-5 py-4 text-center"
      >
        <p class="mb-1 text-sm font-semibold text-foreground">{{ t('login.checkInbox') }}</p>
        <p class="text-xs leading-relaxed text-muted-foreground">
          {{ t('login.sentLink', { email }) }}
        </p>
        <button
          type="button"
          class="mt-3 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          @click="
            sent = false
            authError = null
          "
        >
          {{ t('login.tryDifferent') }}
        </button>
      </div>

      <!-- Footer note -->
      <p
        v-else-if="!authError"
        class="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground"
      >
        {{ t('login.noPassword') }}
      </p>

      <!-- Language picker -->
      <div class="mt-8 flex justify-center">
        <LocalePicker />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })
const { t } = useI18n()

const user = useSupabaseUser()
const router = useRouter()

// Session restores async in SPA mode (or arrives via another tab) —
// always route through /confirm so onboarding checks run properly
watchEffect(() => {
  if (user.value) router.replace('/confirm')
})

const supabase = useSupabaseClient()
const email = ref('')
const loading = ref(false)
const sent = ref(false)
const authError = ref<string | null>(null)

async function submitEmail() {
  loading.value = true
  authError.value = null
  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: { emailRedirectTo: `${window.location.origin}/confirm` },
  })
  if (error) {
    authError.value = error.message
  } else {
    sent.value = true
  }
  loading.value = false
}
</script>
