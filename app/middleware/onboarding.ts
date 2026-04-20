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

  // Value-prop page: only for first-time users (no membership yet)
  if (to.path === '/onboarding/value-prop') {
    if (hasMembership) return navigateTo('/onboarding')
    return
  }

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

  // /onboarding (index): for first-time users (no membership), show value-prop
  // screens first unless already seen. Existing members creating a second circle
  // skip value-prop and go straight to the circle type picker.
  if (to.path === '/onboarding' && !hasMembership) {
    const { hasSeen } = useValuePropSeen()
    if (!hasSeen()) return navigateTo('/onboarding/value-prop')
  }
})
