import { describe, expect, it } from 'vitest'
import { buildStrategyCandidates } from './strategyRecommendations'
import type { ExplorerData, ExplorerOrder } from './thetanuts'

let nextId = 0
function makeOrder(overrides: Partial<ExplorerOrder> = {}): ExplorerOrder {
  nextId += 1
  return {
    id: `order-${nextId}`,
    asset: 'ETH',
    optionType: 'CALL',
    strikes: '$2500',
    expiry: '1999999999', // far future
    pricePerContract: '20.5',
    contracts: '1',
    availableAmount: '10',
    collateral: 'USDC',
    ...overrides,
  }
}

const marketData: ExplorerData['marketData'] = { prices: { ETH: 2450, BTC: 80000, SOL: 100 }, metadata: { lastUpdated: 0 } }

describe('buildStrategyCandidates', () => {
  it('picks the closest-to-spot live Buy Call and Bull Call Spread for a bullish outlook', () => {
    const orders = [
      makeOrder({ optionType: 'CALL', strikes: '$2400', pricePerContract: '60' }),
      makeOrder({ optionType: 'CALL', strikes: '$2700', pricePerContract: '5' }), // further from spot, should lose
      makeOrder({ optionType: 'CALL', strikes: '$2450 / $2500', pricePerContract: '15' }), // call spread
      makeOrder({ asset: 'BTC', optionType: 'CALL', strikes: '$80000', pricePerContract: '500' }), // wrong asset
    ]

    const candidates = buildStrategyCandidates(orders, marketData, 'ETH', 'BULLISH')
    expect(candidates.map((c) => c.kind)).toEqual(['BUY_CALL', 'BULL_CALL_SPREAD'])

    const buyCall = candidates[0].recommendation!
    expect(buyCall.legs).toEqual([{ action: 'BUY', optionType: 'CALL', strike: 2400, quantity: 1 }])
    expect(buyCall.maxProfit).toBeUndefined() // uncapped long call upside
    expect(buyCall.maxLoss).toBe(60)
    expect(buyCall.breakevens).toEqual([2460])

    const spread = candidates[1].recommendation!
    expect(spread.legs).toEqual([
      { action: 'BUY', optionType: 'CALL', strike: 2450, quantity: 1 },
      { action: 'SELL', optionType: 'CALL', strike: 2500, quantity: 1 },
    ])
    expect(spread.maxLoss).toBe(15)
    expect(spread.maxProfit).toBe(35) // width 50 - premium 15
    expect(spread.breakevens).toEqual([2465])
  })

  it('picks the closest-to-spot live Buy Put and Bear Put Spread for a bearish outlook', () => {
    const orders = [
      makeOrder({ optionType: 'PUT', strikes: '$2300', pricePerContract: '30' }),
      makeOrder({ optionType: 'PUT', strikes: '$2500', pricePerContract: '55' }), // closer to spot 2450
      makeOrder({ optionType: 'PUT', strikes: '$2500 / $2450', pricePerContract: '20' }), // put spread, near=2500 far=2450
    ]

    const candidates = buildStrategyCandidates(orders, marketData, 'ETH', 'BEARISH')
    expect(candidates.map((c) => c.kind)).toEqual(['BUY_PUT', 'BEAR_PUT_SPREAD'])

    const buyPut = candidates[0].recommendation!
    expect(buyPut.legs).toEqual([{ action: 'BUY', optionType: 'PUT', strike: 2500, quantity: 1 }])
    expect(buyPut.maxLoss).toBe(55)
    expect(buyPut.maxProfit).toBe(2445) // strike - premium, floored underlying-to-zero case
    expect(buyPut.breakevens).toEqual([2445])

    const spread = candidates[1].recommendation!
    expect(spread.legs).toEqual([
      { action: 'BUY', optionType: 'PUT', strike: 2500, quantity: 1 },
      { action: 'SELL', optionType: 'PUT', strike: 2450, quantity: 1 },
    ])
    expect(spread.maxLoss).toBe(20)
    expect(spread.maxProfit).toBe(30) // width 50 - premium 20
    expect(spread.breakevens).toEqual([2480])
  })

  it('recommends a butterfly for a neutral outlook, built from a real 3-strike live order', () => {
    const orders = [makeOrder({ optionType: 'CALL', strikes: '$2400 / $2450 / $2500', pricePerContract: '10' })]

    const candidates = buildStrategyCandidates(orders, marketData, 'ETH', 'NEUTRAL')
    expect(candidates.map((c) => c.kind)).toEqual(['BUTTERFLY'])

    const butterfly = candidates[0].recommendation!
    expect(butterfly.legs).toEqual([
      { action: 'BUY', optionType: 'CALL', strike: 2400, quantity: 1 },
      { action: 'SELL', optionType: 'CALL', strike: 2450, quantity: 2 },
      { action: 'BUY', optionType: 'CALL', strike: 2500, quantity: 1 },
    ])
    expect(butterfly.maxProfit).toBe(40)
    expect(butterfly.maxLoss).toBe(10)
    expect(butterfly.breakevens).toEqual([2410, 2490])
  })

  it('never treats a 4-strike condor/iron-condor order as a neutral candidate', () => {
    // Verified against the Thetanuts SDK: buying an iron condor is a breakout bet, not a neutral
    // one, and this order shape can't be told apart from a genuinely neutral same-type condor from
    // ExplorerOrder data alone — so 4-strike orders must never surface as a Neutral recommendation.
    const orders = [makeOrder({ optionType: 'CALL', strikes: '$2300 / $2400 / $2500 / $2600', pricePerContract: '50' })]

    const candidates = buildStrategyCandidates(orders, marketData, 'ETH', 'NEUTRAL')
    expect(candidates[0].recommendation).toBeNull()
    expect(candidates[0].unavailableReason).toMatch(/no suitable live/i)
  })

  it('excludes a non-USD-safe premium order from being recommended', () => {
    const orders = [makeOrder({ optionType: 'CALL', strikes: '$2400', collateral: 'aBasWETH', pricePerContract: '0.02' })]
    const candidates = buildStrategyCandidates(orders, marketData, 'ETH', 'BULLISH')
    expect(candidates[0].recommendation).toBeNull()
  })

  it('excludes an expired order from being recommended', () => {
    const orders = [makeOrder({ optionType: 'CALL', strikes: '$2400', expiry: '1' })]
    const candidates = buildStrategyCandidates(orders, marketData, 'ETH', 'BULLISH')
    expect(candidates[0].recommendation).toBeNull()
  })

  it('excludes a fully-filled (zero available amount) order from being recommended', () => {
    const orders = [makeOrder({ optionType: 'CALL', strikes: '$2400', availableAmount: '0' })]
    const candidates = buildStrategyCandidates(orders, marketData, 'ETH', 'BULLISH')
    expect(candidates[0].recommendation).toBeNull()
  })

  it('shows a clear "no suitable live orders" reason rather than fabricating a recommendation', () => {
    const candidates = buildStrategyCandidates([], marketData, 'SOL', 'BULLISH')
    expect(candidates[0].recommendation).toBeNull()
    expect(candidates[0].unavailableReason).toBe('No suitable live Buy Call orders are currently available for SOL.')
  })
})
