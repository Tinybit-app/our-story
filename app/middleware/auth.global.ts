import { useOnboardingIntent } from "~/composables/useOnboardingIntent"

export default defineNuxtRouteMiddleware(async (to) => {
  const client = useSupabaseClient()
  const publicRoutePrefixes = ["/login", "/confirm", "/invite", "/view"]
  const publicRoutesExact = ["/", "/pricing", "/privacy", "/terms"]

  // getSession() reads from localStorage synchronously (wrapped in a Promise)
  // so this always resolves immediately on the client — no network round-trip.
  // Using this instead of useSupabaseUser() avoids the flash where the reactive
  // ref is null for a tick before Supabase fires INITIAL_SESSION.
  const { data: { session } } = await client.auth.getSession()

  // Authenticated users on the login page → send to the app
  if (session && to.path === "/login") {
    return navigateTo("/timeline")
  }

  if (!session && !publicRoutePrefixes.some((r) => to.path.startsWith(r)) && !publicRoutesExact.includes(to.path)) {
    return navigateTo("/login")
  }

  // Check membership state for authenticated users. useUserState caches the
  // result so this adds no extra requests on subsequent navigations.
  if (session) {
    // Routes that don't require an active circle membership
    const noMembershipPrefixes = ["/onboarding", "/settings/account", "/invite"]
    const noMembershipExact = ["/", "/pricing", "/privacy", "/terms"]
    const needsMembership = !noMembershipPrefixes.some((r) => to.path.startsWith(r)) && !noMembershipExact.includes(to.path)

    // Always load state for authenticated users so we can gate deleted accounts
    // regardless of which route they're navigating to.
    const { ensure } = useUserState()
    const state = await ensure()

    // Account pending deletion → restrict to settings only (applies to all routes)
    if (state.deletedAt && !to.path.startsWith("/settings/account")) {
      return navigateTo("/settings/account")
    }

    // Already onboarded users should not be able to re-enter the picker page,
    // except via the 'Start new circle' flow which sets a one-shot intent flag
    // (see useOnboardingIntent). Sub-routes (/onboarding/name, /invite, /profile)
    // are part of an in-progress flow and stay accessible.
    if (to.path === "/onboarding" && state.hasMembership) {
      const intent = useOnboardingIntent()
      if (intent.value) {
        intent.value = false  // one-shot — consume on first allowed render
        return
      }
      return navigateTo("/timeline")
    }

    if (needsMembership) {
      if (to.path === "/no-circle") {
        // Already on the right page but bounce away if state has changed
        if (state.needsProfile) return navigateTo("/onboarding/profile")
        if (state.hasMembership) return navigateTo("/timeline")
        return
      }

      // Any other route that needs membership → redirect if not a member
      if (!state.hasMembership) {
        return navigateTo(state.needsProfile ? "/onboarding" : "/no-circle")
      }
    }
  }
})
