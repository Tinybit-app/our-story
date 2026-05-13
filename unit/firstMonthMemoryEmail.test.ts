import { describe, it, expect } from 'vitest'
import { buildFirstMonthMemoryEmail } from '../server/utils/email'

const baseOpts = {
  recipientFirstName: 'Dao',
  circleName: 'The Smiths',
  uploaderName: 'Mom',
  memoryNote: 'First steps at the park',
  memoryDate: '2025-08-15',
  memoryThumbnailUrl: 'https://example.com/photo.jpg',
  appUrl: 'https://our-story.tinybit.app/timeline?circle=c1&memory=m1',
  unsubscribeUrl: 'https://our-story.tinybit.app/notification-settings',
  locale: 'en' as const,
}

describe('buildFirstMonthMemoryEmail — subject', () => {
  it('en mentions circle name + first month', () => {
    const { subject } = buildFirstMonthMemoryEmail(baseOpts)
    expect(subject).toContain('The Smiths')
    expect(subject.toLowerCase()).toMatch(/first month|memory/)
  })

  it('zh-CN is in Chinese', () => {
    const { subject } = buildFirstMonthMemoryEmail({ ...baseOpts, locale: 'zh-CN' })
    expect(subject).toMatch(/[一-鿿]/)
  })

  it('fr is not English', () => {
    const { subject } = buildFirstMonthMemoryEmail({ ...baseOpts, locale: 'fr' })
    expect(subject.toLowerCase()).not.toMatch(/^a memory from/)
  })
})

describe('buildFirstMonthMemoryEmail — body', () => {
  it('includes the memory thumbnail URL', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('https://example.com/photo.jpg')
  })

  it('includes the memory note in quotes', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('First steps at the park')
  })

  it('includes uploader name and a formatted date', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('Mom')
    expect(html).toMatch(/August|2025/)
  })

  it('includes appUrl as primary CTA', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('https://our-story.tinybit.app/timeline?circle=c1&memory=m1')
  })

  it('includes unsubscribe link', () => {
    const { html } = buildFirstMonthMemoryEmail(baseOpts)
    expect(html).toContain('/notification-settings')
  })

  it("handles null memoryNote without rendering 'null'", () => {
    const { html } = buildFirstMonthMemoryEmail({ ...baseOpts, memoryNote: null })
    expect(html).not.toContain('null')
  })

  it("handles null memoryThumbnailUrl without rendering 'null'", () => {
    const { html } = buildFirstMonthMemoryEmail({ ...baseOpts, memoryThumbnailUrl: null })
    expect(html).not.toContain('null')
  })
})
