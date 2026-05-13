import { describe, it, expect } from 'vitest'
import { buildQuietCircleNudgeEmail } from '../server/utils/email'

const baseOpts = {
  recipientFirstName: 'Dao',
  circleName: 'The Smiths',
  nudgeCount: 1 as 1 | 2 | 3,
  daysSinceLastMemory: 15,
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildQuietCircleNudgeEmail — subject', () => {
  it('count=1 mentions circle name and days', () => {
    const { subject } = buildQuietCircleNudgeEmail(baseOpts)
    expect(subject).toContain('The Smiths')
    expect(subject).toMatch(/quiet|days|15/i)
  })

  it("count=2 mentions 'a while'", () => {
    const { subject } = buildQuietCircleNudgeEmail({
      ...baseOpts,
      nudgeCount: 2,
    })
    expect(subject).toContain('The Smiths')
    expect(subject.toLowerCase()).toMatch(/while|since/)
  })

  it("count=3 says 'last reminder'", () => {
    const { subject } = buildQuietCircleNudgeEmail({
      ...baseOpts,
      nudgeCount: 3,
    })
    expect(subject.toLowerCase()).toMatch(/last reminder|final/)
    expect(subject).toContain('The Smiths')
  })

  it('renders zh-CN subject with Chinese characters', () => {
    const { subject } = buildQuietCircleNudgeEmail({
      ...baseOpts,
      locale: 'zh-CN',
    })
    expect(subject).toMatch(/[一-鿿]/)
  })

  it('renders fr subject (not English)', () => {
    const { subject } = buildQuietCircleNudgeEmail({
      ...baseOpts,
      locale: 'fr',
    })
    expect(subject.toLowerCase()).not.toMatch(/^the smiths has been/)
  })
})

describe('buildQuietCircleNudgeEmail — body', () => {
  it('count=1 has gentle tone', () => {
    const { html } = buildQuietCircleNudgeEmail(baseOpts)
    expect(html).toContain('Dao')
    expect(html).toContain('15')
    expect(html.toLowerCase()).toMatch(/quick note|keeps the story|even a/i)
  })

  it('count=2 mentions photos piling up or similar firmer tone', () => {
    const { html } = buildQuietCircleNudgeEmail({
      ...baseOpts,
      nudgeCount: 2,
      daysSinceLastMemory: 30,
    })
    expect(html.toLowerCase()).toMatch(/pile up|phones|while/)
  })

  it("count=3 explicitly says it's the last nudge", () => {
    const { html } = buildQuietCircleNudgeEmail({
      ...baseOpts,
      nudgeCount: 3,
      daysSinceLastMemory: 45,
    })
    expect(html.toLowerCase()).toMatch(
      /last nudge|won't (ask|badger)|here when you/,
    )
  })

  it('includes appUrl as CTA', () => {
    const { html } = buildQuietCircleNudgeEmail(baseOpts)
    expect(html).toContain('https://our-story.tinybit.app/timeline?circle=c1')
  })

  it('includes unsubscribe link', () => {
    const { html } = buildQuietCircleNudgeEmail(baseOpts)
    expect(html).toContain('/notification-settings')
  })
})
