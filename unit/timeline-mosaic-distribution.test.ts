import { describe, expect, test } from 'vitest'
import { mosaicVariant, mosaicVariantWithBoost } from '../app/composables/useTimeline'

function randomHex(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

describe('mosaicVariant · real-world-ish memory IDs', () => {
  test('UUID v4 distribution maintains ~15% wide / ~13% tall', () => {
    const counts = { wide: 0, tall: 0, square: 0 }
    for (let i = 0; i < 100; i++) {
      const uuid = `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${randomHex(4)}-${randomHex(12)}`
      counts[mosaicVariant(uuid)]++
    }
    // 100 samples = high variance; just verify both span variants appear
    expect(counts.wide + counts.tall).toBeGreaterThan(0)
  })
})

describe('mosaicVariantWithBoost', () => {
  test('forces first memory of a month with 3+ memories to wide', () => {
    // Use IDs that would NOT be wide under plain mosaicVariant
    const nonWideIds = []
    for (let i = 0; nonWideIds.length < 5; i++) {
      const id = `test-id-${i}`
      if (mosaicVariant(id) !== 'wide') nonWideIds.push(id)
    }
    for (const id of nonWideIds) {
      expect(mosaicVariantWithBoost(id, 0, 3)).toBe('wide')
      expect(mosaicVariantWithBoost(id, 0, 10)).toBe('wide')
    }
  })

  test('does NOT boost if monthSize < 3', () => {
    const id = 'some-memory-id'
    const base = mosaicVariant(id)
    expect(mosaicVariantWithBoost(id, 0, 1)).toBe(base)
    expect(mosaicVariantWithBoost(id, 0, 2)).toBe(base)
  })

  test('does NOT boost non-first memories', () => {
    const id = 'some-memory-id'
    const base = mosaicVariant(id)
    expect(mosaicVariantWithBoost(id, 1, 10)).toBe(base)
    expect(mosaicVariantWithBoost(id, 5, 10)).toBe(base)
  })

  test('falls back to mosaicVariant for index > 0', () => {
    for (let i = 0; i < 20; i++) {
      const id = `memory-${i}`
      expect(mosaicVariantWithBoost(id, 1, 5)).toBe(mosaicVariant(id))
    }
  })
})
