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
})
