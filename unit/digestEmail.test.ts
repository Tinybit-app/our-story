import { describe, it, expect } from 'vitest'
import {
  buildWeeklyDigestEmail,
  buildMonthlyDigestEmail,
} from '../server/utils/email'

const baseOpts = {
  recipientFirstName: 'Dao',
  circleName: 'The Smiths',
  childName: null,
  childAge: null,
  memories: [
    {
      id: 'm1',
      note: null,
      milestoneLabel: null,
      thumbnailUrl: 'https://example.com/1.jpg',
      isVideo: false,
    },
  ],
  totalCount: 1,
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildWeeklyDigestEmail — subject line', () => {
  it('uses circle name when no child', () => {
    const { subject } = buildWeeklyDigestEmail({ ...baseOpts, totalCount: 5 })
    expect(subject).toContain('The Smiths')
    expect(subject).toContain('5')
    expect(subject).toMatch(/week/i)
  })

  it('uses child name when child exists', () => {
    const { subject } = buildWeeklyDigestEmail({
      ...baseOpts,
      childName: 'Mia',
      totalCount: 3,
    })
    expect(subject).toContain('Mia')
    expect(subject).toContain('3')
  })

  it('singularises 1 memory', () => {
    const { subject } = buildWeeklyDigestEmail({ ...baseOpts, totalCount: 1 })
    expect(subject).toMatch(/1 (new )?memory\b/i)
  })

  it('renders zh-CN', () => {
    const { subject } = buildWeeklyDigestEmail({
      ...baseOpts,
      locale: 'zh-CN',
      totalCount: 4,
    })
    expect(subject).toMatch(/[一-鿿]/) // contains Chinese chars
  })

  it('renders fr', () => {
    const { subject } = buildWeeklyDigestEmail({
      ...baseOpts,
      locale: 'fr',
      totalCount: 4,
    })
    expect(subject.toLowerCase()).not.toMatch(/^the smiths added/) // not English
  })
})

describe('buildMonthlyDigestEmail — subject line', () => {
  it('uses month name when no child', () => {
    const { subject } = buildMonthlyDigestEmail({ ...baseOpts, totalCount: 12 })
    expect(subject).toContain('The Smiths')
    expect(subject).toMatch(/[A-Z][a-z]+/) // some month name capitalised
  })

  it('uses child name when child exists', () => {
    const { subject } = buildMonthlyDigestEmail({
      ...baseOpts,
      childName: 'Mia',
      totalCount: 12,
    })
    expect(subject).toContain('Mia')
  })
})

describe('digest body — content', () => {
  it('renders all 3 memory thumbnails as deep links', () => {
    const { html } = buildWeeklyDigestEmail({
      ...baseOpts,
      memories: [
        {
          id: 'm1',
          note: null,
          milestoneLabel: null,
          thumbnailUrl: 'https://example.com/1.jpg',
          isVideo: false,
        },
        {
          id: 'm2',
          note: null,
          milestoneLabel: null,
          thumbnailUrl: 'https://example.com/2.jpg',
          isVideo: false,
        },
        {
          id: 'm3',
          note: null,
          milestoneLabel: null,
          thumbnailUrl: 'https://example.com/3.jpg',
          isVideo: false,
        },
      ],
      totalCount: 3,
    })
    expect(html).toContain('https://example.com/1.jpg')
    expect(html).toContain('https://example.com/2.jpg')
    expect(html).toContain('https://example.com/3.jpg')
    expect(html).toContain('circle=c1')
  })

  it('includes child name and age when set', () => {
    const { html } = buildWeeklyDigestEmail({
      ...baseOpts,
      childName: 'Mia',
      childAge: '8 months',
    })
    expect(html).toContain('Mia')
    expect(html).toContain('8 months')
  })

  it('contains unsubscribe link to /notification-settings', () => {
    const { html } = buildWeeklyDigestEmail(baseOpts)
    expect(html).toContain('/notification-settings')
  })

  it('contains main CTA linking to circle timeline', () => {
    const { html } = buildWeeklyDigestEmail(baseOpts)
    expect(html).toContain(
      'href="https://our-story.tinybit.app/timeline?circle=c1"',
    )
  })
})
