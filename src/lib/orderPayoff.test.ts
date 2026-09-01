import { describe, expect, it } from 'vitest'
import { buildPayoffFacts, isPremiumUsdSafe } from './orderPayoff'
import type { ExplorerOrder } from './thetanuts'

function makeOrder(overrides: Partial<ExplorerOrder> = {}): ExplorerOrder {
  return {
    id: 'order-1',
    asset: 'ETH',
    optionType: 'CALL',
    strikes: '$2500',
    expiry: '1999999999',
    pricePerContract: '20.5',
    contracts: '1',
    availableAmount: '10',
    collateral: 'USDC',
    ...overrides,
  }
}

const marketData = { prices: { ETH: 2450, BTC: 80000, SOL: 100 }, metadata: { lastUpdated: 0 } }

describe('premium denomination safety', () => {
  it('treats a USDC-collateralized premium as USD-safe', () => {
    expect(isPremiumUsdSafe(makeOrder({ collateral: 'USDC' }))).toBe(true)
  })

  it('never treats a non-USDC premium (e.g. WETH-collateralized) as USD-safe', () => {
    // A real live order: an ETH call collateralized in WETH quotes its premium in WETH, not USD
    // (e.g. "0.004336" WETH ~= $10.64 at $2454/ETH, not $0.004336). Silently formatting this as
    // USD would understate risk by roughly 2500x.
    expect(isPremiumUsdSafe(makeOrder({ collateral: 'aBasWETH', pricePerContract: '0.004336' }))).toBe(false)
    expect(isPremiumUsdSafe(makeOrder({ collateral: 'cbBTC' }))).toBe(false)
    // Aave-wrapped USDC is economically ~1:1 with USD but is not the literal 'USDC' the app has a
    // verified 1:1 conversion for, so it must stay excluded rather than assumed safe.
    expect(isPremiumUsdSafe(makeOrder({ collateral: 'aBasUSDC' }))).toBe(false)
  })

  it('returns null payoff facts for a non-USD-safe premium instead of computing USD payoff on it', () => {
    const order = makeOrder({ collateral: 'aBasWETH', pricePerContract: '0.004336', strikes: '$2520' })
    expect(buildPayoffFacts(order, marketData)).toBeNull()
  })

  it('returns real payoff facts for a USDC-denominated vanilla order', () => {
    const order = makeOrder({ collateral: 'USDC', pricePerContract: '20.5', strikes: '$2500' })
    expect(buildPayoffFacts(order, marketData)).toEqual({
      kind: 'vanilla',
      optionType: 'CALL',
      strike: 2500,
      premium: 20.5,
      currentPrice: 2450,
    })
  })

  it('returns real payoff facts for a USDC-denominated two-strike spread', () => {
    const order = makeOrder({ collateral: 'USDC', pricePerContract: '5', strikes: '$2400 / $2500' })
    expect(buildPayoffFacts(order, marketData)).toEqual({
      kind: 'spread',
      spreadType: 'CALL_SPREAD',
      nearStrike: 2400,
      farStrike: 2500,
      premium: 5,
      currentPrice: 2450,
    })
  })

  it('returns null for an UNKNOWN option type regardless of collateral', () => {
    expect(buildPayoffFacts(makeOrder({ optionType: 'UNKNOWN', collateral: 'USDC' }), marketData)).toBeNull()
  })
})
