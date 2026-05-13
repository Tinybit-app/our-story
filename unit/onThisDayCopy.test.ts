import { describe, it, expect } from 'vitest'
import {
  buildOnThisDayPushTitle,
  buildOnThisDayPushBody,
  buildFirstMonthMemoryPushTitle,
  buildFirstMonthMemoryPushBody,
} from '../server/utils/onThisDayCopy'

describe('buildOnThisDayPushTitle', () => {
  it("en uses 'year' singular for 1 year", () => {
    expect(buildOnThisDayPushTitle(1, 'en')).toBe('On this day, 1 year ago')
  })

  it("en uses 'years' plural for 2+ years", () => {
    expect(buildOnThisDayPushTitle(2, 'en')).toBe('On this day, 2 years ago')
    expect(buildOnThisDayPushTitle(7, 'en')).toBe('On this day, 7 years ago')
  })

  it('zh-CN renders Chinese', () => {
    expect(buildOnThisDayPushTitle(3, 'zh-CN')).toBe('3 年前的今天')
  })

  it("fr uses 'an' singular for 1", () => {
    expect(buildOnThisDayPushTitle(1, 'fr')).toBe("Il y a 1 an aujourd'hui")
  })

  it("fr uses 'ans' plural for 2+", () => {
    expect(buildOnThisDayPushTitle(5, 'fr')).toBe("Il y a 5 ans aujourd'hui")
  })
})

describe('buildOnThisDayPushBody', () => {
  it('returns note when present', () => {
    expect(buildOnThisDayPushBody('Emma', 'First steps at the park', 'en')).toBe(
      'First steps at the park',
    )
  })

  it('truncates note longer than 80 chars to ~80 with ellipsis', () => {
    const long = 'A'.repeat(120)
    const result = buildOnThisDayPushBody('Emma', long, 'en')
    expect(result.length).toBeLessThanOrEqual(81)
    expect(result.endsWith('…')).toBe(true)
  })

  it('falls back to uploader name (en) when note is null', () => {
    expect(buildOnThisDayPushBody('Emma', null, 'en')).toBe('Emma added a memory')
  })

  it('falls back to uploader name (zh-CN) when note is null', () => {
    expect(buildOnThisDayPushBody('Emma', null, 'zh-CN')).toBe('Emma 添加了一条记忆')
  })

  it('falls back to uploader name (fr) when note is null', () => {
    expect(buildOnThisDayPushBody('Emma', null, 'fr')).toBe('Emma a ajouté un souvenir')
  })

  it('falls back to uploader name when note is empty string', () => {
    expect(buildOnThisDayPushBody('Emma', '', 'en')).toBe('Emma added a memory')
  })
})

describe('buildFirstMonthMemoryPushTitle', () => {
  it('en', () => {
    expect(buildFirstMonthMemoryPushTitle('en')).toBe('A memory from your first month')
  })

  it('zh-CN renders Chinese', () => {
    expect(buildFirstMonthMemoryPushTitle('zh-CN')).toMatch(/[一-鿿]/)
  })

  it('fr is not English', () => {
    const t = buildFirstMonthMemoryPushTitle('fr')
    expect(t.toLowerCase()).not.toContain('memory from')
  })
})

describe('buildFirstMonthMemoryPushBody', () => {
  it('returns note when present', () => {
    expect(buildFirstMonthMemoryPushBody('Mom', 'First steps', 'en')).toBe('First steps')
  })

  it('falls back to uploader name in en', () => {
    expect(buildFirstMonthMemoryPushBody('Mom', null, 'en')).toBe('Mom added a memory')
  })
})
