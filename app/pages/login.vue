<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <!-- Wordmark -->
      <p class="text-xs font-bold tracking-widest text-foreground mb-4 uppercase">
        Our Story
      </p>

      <!-- Headline -->
      <h1 class="font-display text-[1.625rem] font-bold leading-tight text-foreground mb-2">
        Every moment worth keeping, in one place.
      </h1>
      <p class="text-sm text-muted-foreground mb-8">
        For you, your family, your friends.
      </p>

      <!-- Google -->
      <button
        type="button"
        class="w-full flex items-center gap-3 bg-card border border-border rounded-[12px] px-4 py-3.5 text-sm font-medium text-foreground shadow-sm hover:bg-secondary transition-colors mb-2.5"
        @click="signInWithGoogle"
      >
        <GoogleIcon class="w-[18px] h-[18px] shrink-0" />
        Continue with Google
      </button>

      <!-- Divider -->
      <div v-if="!sent" class="flex items-center gap-3 my-1.5 text-xs text-muted-foreground">
        <div class="flex-1 h-px bg-border" />
        or
        <div class="flex-1 h-px bg-border" />
      </div>

      <!-- Email form -->
      <form v-if="!sent" class="mt-1.5" @submit.prevent="submitEmail">
        <input
          v-model="email"
          type="email"
          placeholder="your@email.com"
          required
          class="w-full bg-card border border-border rounded-[12px] px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-2.5"
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {{ loading ? 'Sending…' : 'Continue with email' }}
        </button>
      </form>

      <!-- Error message -->
      <p v-if="authError" class="mt-4 text-sm text-center text-destructive font-medium">
        {{ authError }}
      </p>

      <!-- Success state -->
      <p v-if="sent" class="mt-4 text-sm text-center text-foreground font-medium">
        Check your inbox — we sent you a sign-in link.
      </p>

      <!-- Footer note -->
      <p v-else-if="!authError" class="mt-4 text-[11px] text-center text-muted-foreground leading-relaxed">
        We'll send you a sign-in link — no password needed.
      </p>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

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

async function signInWithGoogle() {
  authError.value = null
  sent.value = false
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/confirm` },
  })
  if (error) {
    authError.value = error.message
  }
}
</script>
