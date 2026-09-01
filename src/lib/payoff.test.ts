import { describe, expect, it } from 'vitest'
import { breakevenPrice, buildScenarios, intrinsicValueAtExpiry, maxLossTotal, maxPutGainTotal, netPnlAtExpiry, type PayoffInputs } from './payoff'

describe('vanilla option payoff', () => {
  const call: PayoffInputs = { optionType: 'CALL', strike: 2000, premium: 50, positionSize: 2, currentPrice: 2000 }
  const put: PayoffInputs = { optionType: 'PUT', strike: 2000, premium: 40, positionSize: 3, currentPrice: 2000 }

  it('calculates a standard long call payoff at expiry', () => {
    expect(intrinsicValueAtExpiry('CALL', 2000, 1800)).toBe(0)
    expect(intrinsicValueAtExpiry('CALL', 2000, 2000)).toBe(0)
    expect(intrinsicValueAtExpiry('CALL', 2000, 2150)).toBe(150)

    // Below/at strike: the option expires worthless, so loss is capped at the premium paid.
    expect(netPnlAtExpiry(call, 1800)).toBe(-100)
    expect(netPnlAtExpiry(call, 2000)).toBe(-100)
    // Above strike: intrinsic value minus premium, scaled by position size.
    expect(netPnlAtExpiry(call, 2150)).toBe(200)
  })

  it('calculates a standard long put payoff at expiry', () => {
    expect(intrinsicValueAtExpiry('PUT', 2000, 2150)).toBe(0)
    expect(intrinsicValueAtExpiry('PUT', 2000, 2000)).toBe(0)
    expect(intrinsicValueAtExpiry('PUT', 2000, 1800)).toBe(200)

    // At/above strike: the option expires worthless, so loss is capped at the premium paid.
    expect(netPnlAtExpiry(put, 2150)).toBe(-120)
    expect(netPnlAtExpiry(put, 2000)).toBe(-120)
    // Below strike: intrinsic value minus premium, scaled by position size.
    expect(netPnlAtExpiry(put, 1800)).toBe(480)
  })

  it('calculates break-even settlement price for calls and puts', () => {
    expect(breakevenPrice('CALL', 2000, 50)).toBe(2050)
    expect(breakevenPrice('PUT', 2000, 40)).toBe(1960)
  })

  it('caps max loss at the premium paid', () => {
    expect(maxLossTotal(50, 2)).toBe(100)
    expect(maxLossTotal(40, 3)).toBe(120)
  })

  it('caps a long put max gain at strike minus premium, since the underlying cannot settle below zero', () => {
    expect(maxPutGainTotal(2000, 40, 3)).toBe((2000 - 40) * 3)
    // A premium larger than the strike would go negative without the floor at zero.
    expect(maxPutGainTotal(10, 40, 1)).toBe(0)
  })

  it('builds settlement scenarios anchored on the current price', () => {
    const scenarios = buildScenarios(call, [-10, 0, 10])
    expect(scenarios).toEqual([
      { changePercent: -10, price: 1800, pnl: netPnlAtExpiry(call, 1800) },
      { changePercent: 0, price: 2000, pnl: netPnlAtExpiry(call, 2000) },
      { changePercent: 10, price: 2200, pnl: netPnlAtExpiry(call, 2200) },
    ])
  })
})
