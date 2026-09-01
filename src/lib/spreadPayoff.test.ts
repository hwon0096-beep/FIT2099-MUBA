import { describe, expect, it } from 'vitest'
import { breakevenPrice, intrinsicValueAtExpiry, maxGainTotal, maxLossTotal, netPnlAtExpiry, type SpreadPayoffInputs } from './spreadPayoff'

describe('vertical debit spread payoff', () => {
  const bullCall: SpreadPayoffInputs = { spreadType: 'CALL_SPREAD', nearStrike: 100, farStrike: 110, premium: 3, positionSize: 1, currentPrice: 105 }
  const bearPut: SpreadPayoffInputs = { spreadType: 'PUT_SPREAD', nearStrike: 110, farStrike: 100, premium: 4, positionSize: 1, currentPrice: 105 }

  it('calculates bull call debit-spread risk and break-even', () => {
    expect(breakevenPrice('CALL_SPREAD', 100, 3)).toBe(103)
    expect(maxLossTotal(3, 1)).toBe(3)
    expect(maxGainTotal(100, 110, 3, 1)).toBe(7)
  })

  it('calculates bear put debit-spread risk and break-even', () => {
    expect(breakevenPrice('PUT_SPREAD', 110, 4)).toBe(106)
    expect(maxLossTotal(4, 1)).toBe(4)
    expect(maxGainTotal(110, 100, 4, 1)).toBe(6)
  })

  it('handles prices below both strikes', () => {
    expect(intrinsicValueAtExpiry('CALL_SPREAD', 100, 110, 90)).toBe(0)
    expect(netPnlAtExpiry(bullCall, 90)).toBe(-3)
    expect(intrinsicValueAtExpiry('PUT_SPREAD', 110, 100, 90)).toBe(10)
    expect(netPnlAtExpiry(bearPut, 90)).toBe(6)
  })

  it('handles prices between the strikes', () => {
    expect(intrinsicValueAtExpiry('CALL_SPREAD', 100, 110, 106)).toBe(6)
    expect(netPnlAtExpiry(bullCall, 106)).toBe(3)
    expect(intrinsicValueAtExpiry('PUT_SPREAD', 110, 100, 106)).toBe(4)
    expect(netPnlAtExpiry(bearPut, 106)).toBe(0)
  })

  it('handles prices above both strikes', () => {
    expect(intrinsicValueAtExpiry('CALL_SPREAD', 100, 110, 120)).toBe(10)
    expect(netPnlAtExpiry(bullCall, 120)).toBe(7)
    expect(intrinsicValueAtExpiry('PUT_SPREAD', 110, 100, 120)).toBe(0)
    expect(netPnlAtExpiry(bearPut, 120)).toBe(-4)
  })
})
