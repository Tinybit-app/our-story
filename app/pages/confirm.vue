<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-gray-500">Signing you in...</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ auth: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

watchEffect(async () => {
  if (!user.value) return

  // Check for pending invite token
  const inviteToken = useCookie("pending_invite_token")
  if (inviteToken.value) {
    router.push(`/invite/${inviteToken.value}`)
    return
  }

  // Check if user has any family membership — if not, onboard them
  const { data: membership } = await supabase
    .from("FamilyMember")
    .select("id")
    .eq("user_id", user.value.id)
    .limit(1)
    .maybeSingle()

  router.push(membership ? "/" : "/onboarding")
})
</script>
