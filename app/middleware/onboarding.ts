export default defineNuxtRouteMiddleware(async (to) => {
  const { ensure } = useUserState()
  const { hasMembership, needsProfile } = await ensure()

  // Profile page: only accessible when profile is incomplete
  if (to.path === '/onboarding/profile') {
    if (!needsProfile) return navigateTo(hasMembership ? '/timeline' : '/onboarding')
    return
  }

  // All other onboarding routes require a complete profile
  if (needsProfile) return navigateTo('/onboarding/profile')

  // Invite page: requires the circleId cookie (set after creating a circle in /onboarding/name)
  if (to.path === '/onboarding/invite') {
    const circleIdCookie = useCookie('onboarding_circle_id')
    if (!circleIdCookie.value) return navigateTo(hasMembership ? '/timeline' : '/onboarding')
    return
  }

  // Name page: requires the circleType cookie (set after selecting a type in /onboarding)
  if (to.path === '/onboarding/name') {
    const circleTypeCookie = useCookie('onboarding_circle_type')
    if (!circleTypeCookie.value) return navigateTo('/onboarding')
    return
  }

  // /onboarding (index): accessible to any authenticated user who wants to create
  // a circle — including existing members creating a second circle. Do NOT block
  // on hasMembership here. The circle type picker is the entry point for all
  // circle creation, both first-time and subsequent.
})
