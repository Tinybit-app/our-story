export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()
  const publicRoutes = ["/login", "/confirm", "/invite", "/view"]

  if (user.value && to.path === "/login") {
    return navigateTo("/")
  }

  if (!user.value && !publicRoutes.some((r) => to.path.startsWith(r))) {
    return navigateTo("/login")
  }
})
