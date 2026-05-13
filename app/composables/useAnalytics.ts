import type { PostHog } from 'posthog-js'

export type CircleType =
  | 'parents'
  | 'couple'
  | 'family'
  | 'friends'
  | 'caregiving'
  | 'travel'
  | 'solo'
  | 'custom'

/**
 * Discriminated union of every analytics event in the Phase 1 catalog.
 * Adding a new event = adding a variant here. TypeScript enforces the
 * (name, props) shape at every call site — no string typos, no rogue
 * properties.
 *
 * Spec: docs/superpowers/specs/2026-05-11-posthog-analytics-design.md §2
 */
export type AnalyticsEvent =
  | { name: 'user_signed_up'; props: { method: 'email' } }
  | {
      name: 'circle_created'
      props: { circle_id: string; circle_type: CircleType }
    }
  | {
      name: 'member_invited'
      props: { circle_id: string; invite_method: 'link' }
    }
  | {
      name: 'member_joined'
      props: { circle_id: string; joined_via: 'invite' }
    }
  | {
      name: 'memory_uploaded'
      props: {
        circle_id: string
        memory_type: 'photo' | 'video' | 'note' | 'mixed'
        visibility: 'circle' | 'private'
        media_count: number
      }
    }
  | {
      name: 'memory_shared_to_circle'
      props: { circle_id: string; memory_id: string }
    }
  | { name: 'comment_added'; props: { circle_id: string; memory_id: string } }
  | {
      name: 'reaction_added'
      props: { circle_id: string; memory_id: string; emoji: string }
    }
  | {
      name: 'milestone_created'
      props: { circle_id: string; milestone_type: 'suggested' | 'custom' }
    }
  | { name: 'export_requested'; props: { circle_id: string; format: 'zip' } }
  | {
      name: 'subscription_upgraded'
      props: { tier: 'plus'; interval: 'monthly' | 'annual' }
    }
  | { name: 'subscription_cancelled'; props: { tier: 'plus' } }

type EventName = AnalyticsEvent['name']
type PropsFor<N extends EventName> = Extract<
  AnalyticsEvent,
  { name: N }
>['props']

/**
 * Pure factory — easy to unit test without Nuxt context.
 * Pass `null` to no-op (matches the "key unset / DNT browser" case where
 * the plugin provides `$posthog: null`).
 */
export function createAnalytics(posthog: PostHog | null) {
  return {
    track<N extends EventName>(name: N, props: PropsFor<N>) {
      if (!posthog) return
      posthog.capture(name, props)
    },
    identifyUser(userId: string, props?: { circle_count?: number }) {
      if (!posthog) return
      posthog.identify(userId, props)
    },
    resetUser() {
      if (!posthog) return
      posthog.reset()
    },
  }
}

/**
 * Nuxt composable — wraps the factory with `useNuxtApp().$posthog`.
 */
export function useAnalytics() {
  const { $posthog } = useNuxtApp()
  return createAnalytics(($posthog as PostHog | null) ?? null)
}

// Known milestone chip labels from useCircleTypeConfig.ts — kept in sync manually.
// Must match the CHIPS constant in app/composables/useCircleTypeConfig.ts exactly.
const KNOWN_MILESTONE_CHIPS = new Set<string>([
  // parents
  'First smile',
  'First steps',
  'First word',
  'First birthday',
  'First tooth',
  // couple
  'First date',
  'Anniversary',
  'Engaged',
  'Moved in together',
  'Wedding day',
  // family
  'Family trip',
  'Birthday',
  'Holiday',
  'Graduation',
  'Reunion',
  // friends
  'Trip',
  'Party',
  'Concert',
  'Road trip',
  // caregiving
  'Good day',
  'Doctor visit',
  'Treatment',
  'Recovery',
  'Milestone',
  // travel
  'Arrived',
  'Best meal',
  'Hidden gem',
  'Adventure',
  'Last day',
  // solo
  'Achievement',
  'New chapter',
  'Goal reached',
  'Reflection',
  'Memory',
])

/**
 * Classifies a milestone_label as "suggested" (matched a known chip) or
 * "custom" (free-form user text). Used to avoid sending PII in analytics
 * events while still tracking which milestones came from suggestions.
 */
export function classifyMilestone(label: string): 'suggested' | 'custom' {
  return KNOWN_MILESTONE_CHIPS.has(label.trim()) ? 'suggested' : 'custom'
}
