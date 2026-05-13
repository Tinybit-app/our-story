/**
 * One-shot in-memory flag for "I'm intentionally navigating to /onboarding
 * to create a new circle". Set by the 'Start new circle' button before
 * router.push('/onboarding'); consumed by auth.global.ts middleware on first
 * /onboarding render so subsequent reloads or direct URL hits get blocked.
 *
 * Lives in Nuxt useState — survives SPA navigation, resets on hard refresh.
 * Refresh-resets is intentional: if the user F5s mid-onboarding-of-second-circle,
 * they'll bounce to /timeline (since they're a member). They can click the
 * button again.
 */
export const useOnboardingIntent = () =>
  useState<boolean>('onboardingIntent', () => false)
