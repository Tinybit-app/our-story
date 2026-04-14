<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6">
    <div class="w-full max-w-sm">

      <p class="text-xs font-bold tracking-widest text-foreground mb-8 uppercase">Our Story</p>

      <!-- Step indicator -->
      <div class="flex items-center gap-1.5 mb-8">
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-foreground" />
        <div class="h-1 w-6 rounded-full bg-foreground" />
      </div>

      <h1 class="font-display text-[1.625rem] font-bold leading-tight text-foreground mb-2">
        Invite your first member
      </h1>
      <p class="text-sm text-muted-foreground mb-8">
        They'll get an email with a link to join your story.
      </p>

      <input
        v-model="email"
        type="email"
        placeholder="their@email.com"
        class="w-full bg-card border border-border rounded-[12px] px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
        autofocus
        @keyup.enter="email && !loading && sendInvite()"
      />

      <p v-if="errorMsg" class="mb-4 text-sm text-destructive">{{ errorMsg }}</p>

      <div v-if="sent" class="mb-4 rounded-[12px] bg-card border border-border px-4 py-3.5">
        <p class="text-sm font-medium text-foreground">Invite sent</p>
        <p class="text-xs text-muted-foreground mt-0.5">A link has been sent to {{ email }}</p>
      </div>

      <button
        @click="sendInvite"
        :disabled="!email || loading || sent"
        class="w-full bg-primary text-primary-foreground rounded-[12px] py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity mb-3"
      >
        {{ loading ? 'Sending…' : 'Send invite' }}
      </button>

      <button
        @click="finish"
        class="w-full text-muted-foreground text-sm py-2.5 hover:text-foreground transition-colors"
      >
        {{ sent ? 'Continue' : 'Skip for now' }}
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const email = ref('')
const loading = ref(false)
const sent = ref(false)
const errorMsg = ref('')
const router = useRouter()

const circleTypeCookie = useCookie<string | null>('onboarding_circle_type', { maxAge: 60 * 60 * 2 })
const familyIdCookie = useCookie<string | null>('onboarding_family_id', { maxAge: 60 * 60 * 2 })

// Restore familyId from DB if cookie was lost on refresh
onMounted(async () => {
  if (familyIdCookie.value) return
  if (!user.value) return

  const { data } = await supabase
    .from('familymember')
    .select('family_id')
    .eq('user_id', user.value.id)
    .eq('role', 'owner')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data) {
    familyIdCookie.value = data.family_id
  } else {
    router.replace('/onboarding')
  }
})

async function sendInvite() {
  loading.value = true
  errorMsg.value = ''

  try {
    await $fetch('/api/families/invite', {
      method: 'POST',
      body: { familyId: familyIdCookie.value, email: email.value },
    })
    sent.value = true
  } catch (err: any) {
    errorMsg.value = err?.data?.message ?? 'Failed to send invite. Please try again.'
  } finally {
    loading.value = false
  }
}

function finish() {
  circleTypeCookie.value = null
  familyIdCookie.value = null
  router.push('/')
}
</script>
