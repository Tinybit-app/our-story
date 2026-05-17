import { describe, expect, test } from 'vitest'
import { mosaicVariant } from '../app/composables/useTimeline'

describe('mosaicVariant · determinism', () => {
  test('the same id always returns the same variant', () => {
    const id = 'a8f0e1c2-b3d4-4e5f-9a0b-1c2d3e4f5a6b'
    const first = mosaicVariant(id)
    for (let i = 0; i < 100; i++) {
      expect(mosaicVariant(id)).toBe(first)
    }
  })

  test('different ids generally produce different variants', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      seen.add(mosaicVariant(`memory-${i}`))
    }
    // We expect to see at least two distinct variants in 50 trials.
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })
})

describe('mosaicVariant · distribution', () => {
  function pseudoUuid(n: number): string {
    return `${n.toString(16).padStart(8, '0')}-${(n * 31).toString(16).padStart(4, '0')}-${(n * 7919).toString(16).padStart(4, '0')}`
  }

  test('15% wide / 13% tall / 72% square (±2% over 10k samples)', () => {
    const counts = { square: 0, wide: 0, tall: 0 }
    for (let i = 0; i < 10_000; i++) {
      counts[mosaicVariant(pseudoUuid(i))]++
    }
    const pct = (n: number) => (n / 10_000) * 100
    expect(pct(counts.wide)).toBeGreaterThanOrEqual(13)
    expect(pct(counts.wide)).toBeLessThanOrEqual(17)
    expect(pct(counts.tall)).toBeGreaterThanOrEqual(11)
    expect(pct(counts.tall)).toBeLessThanOrEqual(15)
    expect(pct(counts.square)).toBeGreaterThanOrEqual(70)
    expect(pct(counts.square)).toBeLessThanOrEqual(74)
  })
})
