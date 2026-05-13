import { describe, it, expect } from 'vitest'
import {
  buildChildMilestoneEmail,
  buildAnniversaryEmail,
} from '../server/utils/email'

const baseChild = {
  recipientFirstName: 'Dao',
  childName: 'Mia',
  milestoneLabel: '6 months',
  phase: 'T-3' as const,
  daysUntil: 3,
  circleName: 'The Smiths',
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildChildMilestoneEmail — subjects', () => {
  it('T-3 includes child name + milestone label', () => {
    const { subject } = buildChildMilestoneEmail(baseChild)
    expect(subject).toContain('Mia')
    expect(subject).toContain('6 months')
  })

  it('T+0 says today', () => {
    const { subject } = buildChildMilestoneEmail({
      ...baseChild,
      phase: 'T0',
      daysUntil: 0,
    })
    expect(subject.toLowerCase()).toMatch(/today|🎉/)
    expect(subject).toContain('Mia')
  })

  it('T+3 asks if captured', () => {
    const { subject } = buildChildMilestoneEmail({
      ...baseChild,
      phase: 'T+3',
      daysUntil: -3,
    })
    expect(subject.toLowerCase()).toMatch(/capture|did you/)
    expect(subject).toContain('Mia')
  })

  it('renders zh-CN subject with Chinese characters', () => {
    const { subject } = buildChildMilestoneEmail({
      ...baseChild,
      locale: 'zh-CN',
    })
    expect(subject).toMatch(/[一-鿿]/)
  })

  it('renders fr subject (not English)', () => {
    const { subject } = buildChildMilestoneEmail({ ...baseChild, locale: 'fr' })
    expect(subject.toLowerCase()).not.toMatch(/turns/)
  })
})

describe('buildChildMilestoneEmail — body', () => {
  it('contains the appUrl as primary CTA', () => {
    const { html } = buildChildMilestoneEmail(baseChild)
    expect(html).toContain('https://our-story.tinybit.app/timeline?circle=c1')
  })

  it('contains the unsubscribe link', () => {
    const { html } = buildChildMilestoneEmail(baseChild)
    expect(html).toContain('/notification-settings')
  })

  it('includes milestone label in body', () => {
    const { html } = buildChildMilestoneEmail(baseChild)
    expect(html).toContain('6 months')
  })
})

describe('buildAnniversaryEmail — couple', () => {
  const base = {
    recipientFirstName: 'Dao',
    years: 5,
    scopeType: 'couple' as const,
    phase: 'T0' as const,
    circleName: 'Sarah & Dao',
    appUrl: 'https://our-story.tinybit.app/timeline?circle=c2',
    unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
    locale: 'en' as const,
  }

  it('T+0 subject mentions years', () => {
    const { subject } = buildAnniversaryEmail(base)
    expect(subject).toContain('5')
  })

  it('T-3 subject for couple anniversary', () => {
    const { subject } = buildAnniversaryEmail({ ...base, phase: 'T-3' })
    expect(subject.toLowerCase()).toMatch(/anniversary|3 days/)
  })
})

describe('buildAnniversaryEmail — trip', () => {
  const base = {
    recipientFirstName: 'Dao',
    years: 5,
    scopeType: 'trip' as const,
    phase: 'T0' as const,
    circleName: 'Barcelona Crew',
    appUrl: 'https://our-story.tinybit.app/timeline?circle=c3',
    unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
    locale: 'en' as const,
  }

  it('trip anniversary subject differs from couple', () => {
    const { subject } = buildAnniversaryEmail(base)
    expect(subject.toLowerCase()).toMatch(/trip|years/)
  })
})
