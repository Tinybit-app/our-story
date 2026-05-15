<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <Toaster />
  </div>
</template>

<script setup lang="ts">
import { useAnalytics } from '~/composables/useAnalytics'
import { Toaster } from '~/components/ui/toast'

const user = useSupabaseUser()
const { identifyUser, resetUser } = useAnalytics()
const supabase = useSupabaseClient()

// Track the last identified user.id so we don't re-identify on every render
const lastIdentifiedId = ref<string | null>(null)

watchEffect(async () => {
  const u = user.value
  if (u?.id && u.id !== lastIdentifiedId.value) {
    // Fetch a lightweight property for the person profile — circle count.
    // Failure here must not block the app; analytics is best-effort.
    let circleCount: number | undefined
    try {
      const { count } = await supabase
        .from('circlemember')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.id)
      circleCount = count ?? undefined
    } catch {
      circleCount = undefined
    }
    identifyUser(
      u.id,
      circleCount !== undefined ? { circle_count: circleCount } : undefined,
    )
    lastIdentifiedId.value = u.id
  } else if (!u && lastIdentifiedId.value) {
    resetUser()
    lastIdentifiedId.value = null
  }
})
</script>
