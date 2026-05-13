import { describe, it, expect } from 'vitest'
import { buildFirstMonthRecapEmail } from '../server/utils/email'

const baseOpts = {
  recipientFirstName: 'Dao',
  circleName: 'The Smiths',
  firstMemoryUploaderName: 'Mom',
  firstMemoryNote: 'First steps at the park',
  firstMemoryDate: '2026-04-11',
  firstMemoryThumbnailUrl: 'https://example.com/first.jpg',
  memoryCount: 12,
  milestoneCount: 2,
  topReactionMemoryThumbnailUrl: 'https://example.com/top.jpg',
  topReactionMemoryNote: 'Cake time',
  topReactionEmoji: '❤️',
  topReactionCount: 5,
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1',
  inviteUrl: 'https://our-story.tinybit.app/timeline?circle=c1&invite=1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildFirstMonthRecapEmail — subject', () => {
  it('en subject includes circle name', () => {
    const { subject } = buildFirstMonthRecapEmail(baseOpts)
    expect(subject).toContain('The Smiths')
    expect(subject.toLowerCase()).toMatch(/first month|month with/)
  })

  it('zh-CN subject is in Chinese', () => {
    const { subject } = buildFirstMonthRecapEmail({
      ...baseOpts,
      locale: 'zh-CN',
    })
    expect(subject).toMatch(/[一-鿿]/)
    expect(subject).toContain('The Smiths')
  })

  it('fr subject is in French (not English)', () => {
    const { subject } = buildFirstMonthRecapEmail({ ...baseOpts, locale: 'fr' })
    expect(subject.toLowerCase()).not.toMatch(/^your first month/)
  })
})

describe('buildFirstMonthRecapEmail — body', () => {
  it('includes the first memory thumbnail URL', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('https://example.com/first.jpg')
  })

  it('includes the first memory note', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('First steps at the park')
  })

  it('includes uploader name in the nostalgia hook', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('Mom')
  })

  it('renders memory count and milestone count', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('12')
    expect(html).toContain('2')
  })

  it('includes top reaction section when reactions exist', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('❤️')
    expect(html).toContain('5')
  })

  it('omits top reaction section when topReactionMemoryThumbnailUrl is null', () => {
    const { html } = buildFirstMonthRecapEmail({
      ...baseOpts,
      topReactionMemoryThumbnailUrl: null,
      topReactionMemoryNote: null,
      topReactionEmoji: null,
      topReactionCount: null,
    })
    expect(html).not.toContain('https://example.com/top.jpg')
  })

  it('includes appUrl as primary CTA', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('https://our-story.tinybit.app/timeline?circle=c1')
  })

  it('includes inviteUrl as secondary CTA', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('invite=1')
  })

  it('includes unsubscribe link', () => {
    const { html } = buildFirstMonthRecapEmail(baseOpts)
    expect(html).toContain('/notification-settings')
  })

  it("handles null firstMemoryNote without rendering 'null'", () => {
    const { html } = buildFirstMonthRecapEmail({
      ...baseOpts,
      firstMemoryNote: null,
    })
    expect(html).not.toContain('null')
  })
})
