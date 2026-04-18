export default defineNuxtRouteMiddleware(async (to) => {
  const client = useSupabaseClient()
  const publicRoutes = ["/login", "/confirm", "/invite", "/view"]

  // getSession() reads from localStorage synchronously (wrapped in a Promise)
  // so this always resolves immediately on the client — no network round-trip.
  // Using this instead of useSupabaseUser() avoids the flash where the reactive
  // ref is null for a tick before Supabase fires INITIAL_SESSION.
  const { data: { session } } = await client.auth.getSession()

  if (session && to.path === "/login") {
    return navigateTo("/")
  }

  if (!session && !publicRoutes.some((r) => to.path.startsWith(r))) {
    return navigateTo("/login")
  }

  // Check membership state for authenticated users. useUserState caches the
  // result so this adds no extra requests on subsequent navigations.
  if (session) {
    // Routes that don't require an active circle membership
    const noMembershipRoutes = ["/onboarding", "/settings/account", "/invite"]
    const needsMembership = !noMembershipRoutes.some((r) => to.path.startsWith(r))

    if (needsMembership) {
      const { ensure } = useUserState()
      const state = await ensure()

      // Account pending deletion → restrict to settings
      if (state.deletedAt) {
        return navigateTo("/settings/account")
      }

      if (to.path === "/no-circle") {
        // Already on the right page but bounce away if state has changed
        if (state.needsProfile) return navigateTo("/onboarding/profile")
        if (state.hasMembership) return navigateTo("/")
        return
      }

      // Any other route that needs membership → redirect if not a member
      if (!state.hasMembership) {
        return navigateTo(state.needsProfile ? "/onboarding" : "/no-circle")
      }
    }
  }
})
