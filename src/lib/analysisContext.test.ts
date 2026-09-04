import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildAnalysisContext } from './analysisContext'
import type { ExplorerData, ExplorerOrder } from './thetanuts'

const marketData: ExplorerData['marketData'] = { prices: { ETH: 105, BTC: 60_000 }, metadata: { lastUpdated: 0 } }
const order = (overrides: Partial<ExplorerOrder> = {}): ExplorerOrder => ({ id: 'eth-call', asset: 'ETH', optionType: 'CALL', strikes: '$100.00', expiry: '4102444800', pricePerContract: '5', contracts: '10', availableAmount: '10', collateral: 'USDC', ...overrides })

describe('AI selected-order context', () => {
  afterEach(() => vi.useRealTimers())

  it('uses verified vanilla metrics and scenario P&L', () => {
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    const context = buildAnalysisContext(order(), marketData)
    expect(context).toMatchObject({ orderId: 'eth-call', asset: 'ETH', optionType: 'CALL', strikes: [100], premium: 5, premiumUnit: 'USDC', spotPrice: 105, breakEven: 105, maxLoss: 5, maxProfit: null, maxProfitIsUnlimited: true, moneyness: 'ITM', strategyType: 'LONG_CALL' })
    expect(context.scenarioPnL.find(row => row.changePercent === 10)?.pnl).toBeCloseTo(10.5)
  })

  it('switching orders produces isolated context with combined spread metrics', () => {
    const first = buildAnalysisContext(order(), marketData)
    const second = buildAnalysisContext(order({ id: 'eth-put-spread', optionType: 'PUT', strikes: '$110 / $100', pricePerContract: '4' }), marketData)
    expect(second.orderId).not.toBe(first.orderId)
    expect(second).toMatchObject({ strategyType: 'BEAR_PUT_DEBIT_SPREAD', breakEven: 106, maxLoss: 4, maxProfit: 6, maxProfitIsUnlimited: false, spread: { nearStrike: 110, farStrike: 100, width: 10 } })
  })

  it('passes unsupported calculations as unavailable instead of guessing', () => {
    expect(buildAnalysisContext(order({ strikes: '$90 / $100 / $110' }), marketData)).toMatchObject({ strategyType: 'UNSUPPORTED', breakEven: null, maxProfit: null, maxLoss: null, scenarioPnL: [] })
  })
})
