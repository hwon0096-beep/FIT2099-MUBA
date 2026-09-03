import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daysToExpiry } from './formatters'

describe('daysToExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts whole days remaining until expiry', () => {
    const threeDaysOut = String(Math.floor(new Date('2026-01-04T00:00:00Z').getTime() / 1000))
    expect(daysToExpiry(threeDaysOut)).toBe(3)
  })

  it('floors a partial day rather than rounding up', () => {
    const almostTwoDays = String(Math.floor(new Date('2026-01-02T23:00:00Z').getTime() / 1000))
    expect(daysToExpiry(almostTwoDays)).toBe(1)
  })

  it('clamps to zero once expired', () => {
    const yesterday = String(Math.floor(new Date('2025-12-31T00:00:00Z').getTime() / 1000))
    expect(daysToExpiry(yesterday)).toBe(0)
  })
})
