import { describe, expect, test } from 'vitest'
import { z } from 'zod'

// Mirror the schema from the handler so we can validate it directly.
const querySchema = z.object({
  circleId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

describe('months-with-data · query validation', () => {
  test('accepts a valid query', () => {
    const r = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2026,
      month: 4,
    })
    expect(r.success).toBe(true)
  })

  test('rejects non-UUID circleId', () => {
    const r = querySchema.safeParse({
      circleId: 'not-a-uuid',
      year: 2026,
      month: 4,
    })
    expect(r.success).toBe(false)
  })

  test('rejects out-of-range year', () => {
    const r1 = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 1999,
      month: 4,
    })
    expect(r1.success).toBe(false)
    const r2 = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2101,
      month: 4,
    })
    expect(r2.success).toBe(false)
  })

  test('rejects out-of-range month', () => {
    const r1 = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2026,
      month: 0,
    })
    expect(r1.success).toBe(false)
    const r2 = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2026,
      month: 13,
    })
    expect(r2.success).toBe(false)
  })

  test('coerces string numerics', () => {
    const r = querySchema.safeParse({
      circleId: '550e8400-e29b-41d4-a716-446655440000',
      year: '2026',
      month: '04',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.year).toBe(2026)
      expect(r.data.month).toBe(4)
    }
  })
})

describe('months-with-data · UTC date math', () => {
  // The handler computes currentStart and currentEnd from (year, month).
  // currentStart = Date.UTC(year, month-1, 1)
  // currentEnd   = Date.UTC(year, month,   1)
  // Prev query: memory_date < currentStart
  // Next query: memory_date >= currentEnd

  test('April 2026 currentStart is 2026-04-01T00:00:00.000Z', () => {
    expect(new Date(Date.UTC(2026, 3, 1)).toISOString()).toBe(
      '2026-04-01T00:00:00.000Z',
    )
  })

  test('April 2026 currentEnd is 2026-05-01T00:00:00.000Z', () => {
    expect(new Date(Date.UTC(2026, 4, 1)).toISOString()).toBe(
      '2026-05-01T00:00:00.000Z',
    )
  })

  test('December 2026 currentEnd rolls to January 2027', () => {
    expect(new Date(Date.UTC(2026, 12, 1)).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    )
  })

  test('extracts year/month from a UTC date string', () => {
    const d = new Date('2026-04-15T12:00:00.000Z')
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth() + 1).toBe(4)
  })
})
