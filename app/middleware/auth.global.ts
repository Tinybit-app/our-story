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

  // If the user has a valid session but their account is pending deletion,
  // restrict them to /settings/account (where the cancellation banner is shown).
  // useUserState caches the result so this adds no extra requests on subsequent
  // navigations within the same session.
  if (session && to.path !== "/settings/account") {
    const { ensure } = useUserState()
    const state = await ensure()
    if (state.deletedAt) {
      return navigateTo("/settings/account")
    }
  }
})
