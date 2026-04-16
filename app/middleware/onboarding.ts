export default defineNuxtRouteMiddleware(async (to) => {
  const { ensure } = useUserState()
  const { hasMembership, needsProfile } = await ensure()

  // Profile page: only accessible when profile is incomplete
  if (to.path === '/onboarding/profile') {
    if (!needsProfile) return navigateTo(hasMembership ? '/' : '/onboarding')
    return
  }

  // All other onboarding routes require a complete profile
  if (needsProfile) return navigateTo('/onboarding/profile')

  // Invite page: requires the circleId cookie (set after creating a circle in /onboarding/name)
  if (to.path === '/onboarding/invite') {
    const circleIdCookie = useCookie('onboarding_circle_id')
    if (!circleIdCookie.value) return navigateTo(hasMembership ? '/' : '/onboarding')
    return
  }

  // Name page: requires the circleType cookie (set after selecting a type in /onboarding)
  if (to.path === '/onboarding/name') {
    const circleTypeCookie = useCookie('onboarding_circle_type')
    if (!circleTypeCookie.value) return navigateTo('/onboarding')
    return
  }

  // /onboarding (index): only accessible before a circle has been created
  if (hasMembership) return navigateTo('/')
})
