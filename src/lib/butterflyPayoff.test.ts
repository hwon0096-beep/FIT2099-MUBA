import { describe, expect, it } from 'vitest'
import { breakevens, intrinsicValueAtExpiry, maxGainTotal, maxLossTotal } from './butterflyPayoff'

describe('long butterfly payoff', () => {
  it('calculates a symmetric call butterfly (peak at the mid strike, floored loss at the premium)', () => {
    expect(intrinsicValueAtExpiry('CALL', 1800, 1900, 2000, 1800)).toBe(0)
    expect(intrinsicValueAtExpiry('CALL', 1800, 1900, 2000, 1900)).toBe(100)
    expect(intrinsicValueAtExpiry('CALL', 1800, 1900, 2000, 2000)).toBe(0)

    expect(maxGainTotal('CALL', 1800, 1900, 2000, 30, 1)).toBe(70)
    expect(maxLossTotal('CALL', 1800, 1900, 2000, 30, 1)).toBe(30)
    expect(breakevens('CALL', 1800, 1900, 2000, 30)).toEqual([1830, 1970])
  })

  it('calculates a symmetric put butterfly identically to the equivalent call butterfly, by put-call symmetry', () => {
    expect(intrinsicValueAtExpiry('PUT', 1800, 1900, 2000, 1800)).toBe(0)
    expect(intrinsicValueAtExpiry('PUT', 1800, 1900, 2000, 1900)).toBe(100)
    expect(intrinsicValueAtExpiry('PUT', 1800, 1900, 2000, 2000)).toBe(0)

    expect(maxGainTotal('PUT', 1800, 1900, 2000, 30, 1)).toBe(70)
    expect(maxLossTotal('PUT', 1800, 1900, 2000, 30, 1)).toBe(30)
    expect(breakevens('PUT', 1800, 1900, 2000, 30)).toEqual([1830, 1970])
  })

  it('scales max profit and max loss by position size', () => {
    expect(maxGainTotal('CALL', 1800, 1900, 2000, 30, 3)).toBe(210)
    expect(maxLossTotal('CALL', 1800, 1900, 2000, 30, 3)).toBe(90)
  })

  it('reports no breakevens when the premium exceeds the peak value', () => {
    expect(breakevens('CALL', 1800, 1900, 2000, 150)).toEqual([])
  })

  it('accounts for extra residual risk on an uneven ("broken-wing") butterfly beyond the premium paid', () => {
    // Mid strike (120) is much closer to the low strike (100) than the high strike (200), so the
    // far tail doesn't cancel back to zero: value at 100 is 0, at 120 is 20, at 200 is -60.
    expect(intrinsicValueAtExpiry('CALL', 100, 120, 200, 100)).toBe(0)
    expect(intrinsicValueAtExpiry('CALL', 100, 120, 200, 120)).toBe(20)
    expect(intrinsicValueAtExpiry('CALL', 100, 120, 200, 200)).toBe(-60)

    expect(maxGainTotal('CALL', 100, 120, 200, 5, 1)).toBe(15)
    // Max loss exceeds the premium paid (5) because of the broken wing's residual risk.
    expect(maxLossTotal('CALL', 100, 120, 200, 5, 1)).toBe(65)
    expect(breakevens('CALL', 100, 120, 200, 5)).toEqual([105, 135])
  })
})
