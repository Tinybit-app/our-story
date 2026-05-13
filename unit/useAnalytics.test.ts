/**
 * Analytics composable unit tests (build plan §1.7)
 *
 * Tests the pure factory createAnalytics(posthog) — the Nuxt composable
 * useAnalytics() just wraps this factory with useNuxtApp().$posthog.
 *
 * Covers:
 *   - No-op behavior when posthog is null (key unset / local dev)
 *   - Capture proxied through to posthog.capture with exact name + props
 *   - identifyUser and resetUser proxy through correctly
 */

import { describe, it, expect, vi } from 'vitest'
import { createAnalytics, classifyMilestone } from '../app/composables/useAnalytics'

function makeMockPostHog() {
  return {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  }
}

describe('createAnalytics', () => {
  describe('when posthog is null (key unset)', () => {
    it('track is a no-op', () => {
      const a = createAnalytics(null)
      expect(() => a.track('user_signed_up', { method: 'email' })).not.toThrow()
    })

    it('identifyUser is a no-op', () => {
      const a = createAnalytics(null)
      expect(() => a.identifyUser('user-123', { circle_count: 2 })).not.toThrow()
    })

    it('resetUser is a no-op', () => {
      const a = createAnalytics(null)
      expect(() => a.resetUser()).not.toThrow()
    })
  })

  describe('when posthog is present', () => {
    it('track calls posthog.capture with name and props', () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.track('memory_uploaded', {
        circle_id: 'c1',
        memory_type: 'photo',
        visibility: 'circle',
        media_count: 3,
      })
      expect(ph.capture).toHaveBeenCalledWith('memory_uploaded', {
        circle_id: 'c1',
        memory_type: 'photo',
        visibility: 'circle',
        media_count: 3,
      })
    })

    it('identifyUser calls posthog.identify with userId and props', () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.identifyUser('user-123', { circle_count: 2 })
      expect(ph.identify).toHaveBeenCalledWith('user-123', { circle_count: 2 })
    })

    it('identifyUser works without props', () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.identifyUser('user-123')
      expect(ph.identify).toHaveBeenCalledWith('user-123', undefined)
    })

    it('resetUser calls posthog.reset', () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.resetUser()
      expect(ph.reset).toHaveBeenCalledOnce()
    })

    it('track passes through circle_created event', () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.track('circle_created', { circle_id: 'c1', circle_type: 'parents' })
      expect(ph.capture).toHaveBeenCalledWith('circle_created', {
        circle_id: 'c1',
        circle_type: 'parents',
      })
    })

    it('track passes through reaction_added event with emoji', () => {
      const ph = makeMockPostHog()
      const a = createAnalytics(ph as never)
      a.track('reaction_added', { circle_id: 'c1', memory_id: 'm1', emoji: '❤️' })
      expect(ph.capture).toHaveBeenCalledWith('reaction_added', {
        circle_id: 'c1',
        memory_id: 'm1',
        emoji: '❤️',
      })
    })
  })
})

describe('classifyMilestone', () => {
  it("returns 'suggested' for known chip labels", () => {
    expect(classifyMilestone('First steps')).toBe('suggested')
    expect(classifyMilestone('Anniversary')).toBe('suggested')
    expect(classifyMilestone('Wedding day')).toBe('suggested')
  })

  it("returns 'custom' for free-form user text", () => {
    expect(classifyMilestone("Emma's first day at school")).toBe('custom')
    expect(classifyMilestone("Dad's 50th")).toBe('custom')
  })

  it('trims whitespace before matching', () => {
    expect(classifyMilestone('  First steps  ')).toBe('suggested')
  })
})
