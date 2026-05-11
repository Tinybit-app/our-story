import type { PostHog } from "posthog-js"

/**
 * Discriminated union of every analytics event in the Phase 1 catalog.
 * Adding a new event = adding a variant here. TypeScript enforces the
 * (name, props) shape at every call site — no string typos, no rogue
 * properties.
 *
 * Spec: docs/superpowers/specs/2026-05-11-posthog-analytics-design.md §2
 */
export type AnalyticsEvent =
  | { name: "user_signed_up"; props: { method: "email" } }
  | { name: "circle_created"; props: { circle_id: string; circle_type: string } }
  | { name: "member_invited"; props: { circle_id: string; invite_method: "link" } }
  | { name: "member_joined"; props: { circle_id: string; joined_via: "invite" } }
  | {
      name: "memory_uploaded"
      props: {
        circle_id: string
        memory_type: "photo" | "video" | "note" | "mixed"
        visibility: "circle" | "private"
        media_count: number
      }
    }
  | { name: "memory_shared_to_circle"; props: { circle_id: string; memory_id: string } }
  | { name: "comment_added"; props: { circle_id: string; memory_id: string } }
  | { name: "reaction_added"; props: { circle_id: string; memory_id: string; emoji: string } }
  | { name: "milestone_created"; props: { circle_id: string; milestone_type: string } }
  | { name: "export_requested"; props: { circle_id: string; format: "zip" } }
  | { name: "subscription_upgraded"; props: { tier: "plus"; interval: "monthly" | "annual" } }
  | { name: "subscription_cancelled"; props: { tier: "plus" } }

type EventName = AnalyticsEvent["name"]
type PropsFor<N extends EventName> = Extract<AnalyticsEvent, { name: N }>["props"]

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
