import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import StrategyDetailModal, { findLiveStrategyExample, type StrategyDetailKind } from './StrategyDetailModal'
import type { ExplorerOrder } from '../lib/thetanuts'

const now = 1_800_000_000_000
// Synthetic test fixtures only; production examples come exclusively from the supplied live orders.
function order(strike: number, overrides: Partial<ExplorerOrder> = {}): ExplorerOrder {
  return { id: `test-${strike}`, asset: 'ETH', expiry: '1900000000', strikes: `$${strike}`, optionType: 'CALL', availableAmount: '1', contracts: '1', collateral: 'USDC', pricePerContract: '', ...overrides }
}

describe('Strategy Detail live strike examples', () => {
  it.each<[StrategyDetailKind, 'CALL' | 'PUT']>([
    ['long-call', 'CALL'], ['long-put', 'PUT'],
  ])('uses one matching live order for %s without inventing a premium', (strategy, optionType) => {
    const otherType = optionType === 'CALL' ? 'PUT' : 'CALL'
    const unsuitable = [order(2300, { optionType: otherType }), order(2400, { optionType, expiry: '1700000000' }), order(2500, { optionType, availableAmount: '0' })]
    expect(findLiveStrategyExample(strategy, unsuitable, now)).toBeNull()
    expect(findLiveStrategyExample(strategy, [...unsuitable, order(2600, { optionType })], now)).toEqual({ asset: 'ETH', expiry: '1900000000', strikes: [2600] })
  })

  it('selects a nearby call pair with ascending, distinct strikes without requiring or inventing prices', () => {
    expect(findLiveStrategyExample('bull-call-spread', [order(3000), order(2500), order(2400), order(2400)], now)).toEqual({
      asset: 'ETH', expiry: '1900000000', strikes: [2400, 2500],
    })
  })

  it('orders a bear put spread with the higher buy strike first', () => {
    expect(findLiveStrategyExample('bear-put-spread', [order(2400, { optionType: 'PUT' }), order(2500, { optionType: 'PUT' })], now)?.strikes).toEqual([2500, 2400])
  })

  it('uses three nearby ascending call strikes for a butterfly', () => {
    const orders = [order(3100), order(2600), order(2400), order(2500)]
    expect(findLiveStrategyExample('butterfly', orders, now)?.strikes).toEqual([2400, 2500, 2600])
    expect(orders[0].strikes).toBe('$3100') // Selection must not reorder the shared input.
  })

  it('only constructs a condor with two lower puts and two higher calls', () => {
    const puts = [order(2200, { optionType: 'PUT' }), order(2300, { optionType: 'PUT' })]
    expect(findLiveStrategyExample('iron-condor', [...puts, order(2500), order(2600)], now)?.strikes).toEqual([2200, 2300, 2500, 2600])
    expect(findLiveStrategyExample('iron-condor', [...puts, order(2300), order(2500)], now)).toBeNull()
    expect(findLiveStrategyExample('iron-condor', [order(2200), order(2300), order(2500), order(2600)], now)).toBeNull()
  })

  it.each<Partial<ExplorerOrder>>([
    { asset: 'BTC' }, { expiry: '1900000100' }, { optionType: 'PUT' }, { collateral: 'WETH' },
  ])('never mixes incompatible orders: %j', mismatch => {
    expect(findLiveStrategyExample('bull-call-spread', [order(2400), order(2500, mismatch)], now)).toBeNull()
  })

  it.each<Partial<ExplorerOrder>>([
    { expiry: '1700000000' }, { expiry: 'invalid' }, { availableAmount: '0' },
    { availableAmount: 'unavailable' }, { optionType: 'UNKNOWN' }, { strikes: '$2500 / $2600' }, { strikes: 'Not supplied' },
  ])('excludes expired, unavailable, unknown and multi-leg orders: %j', invalid => {
    expect(findLiveStrategyExample('bull-call-spread', [order(2400), order(2500, invalid)], now)).toBeNull()
  })

  it('continues past incomplete groups and selects the earliest expiry with a full combination', () => {
    const orders = [order(2000), order(2400, { expiry: '1900000100' }), order(2500, { expiry: '1900000100' }), order(2600, { expiry: '1900000200' }), order(2700, { expiry: '1900000200' })]
    expect(findLiveStrategyExample('bull-call-spread', orders, now)?.expiry).toBe('1900000100')
  })
})

describe('Strategy Detail educational fallback', () => {
  it.each<[StrategyDetailKind, string]>([
    ['long-call', 'Long Call'], ['long-put', 'Long Put'],
    ['bull-call-spread', 'Bull Call Spread'], ['bear-put-spread', 'Bear Put Spread'],
    ['iron-condor', 'Iron Condor'], ['butterfly', 'Butterfly'],
  ])('renders useful details and a close button for %s without data', (strategy, name) => {
    const html = renderToStaticMarkup(createElement(StrategyDetailModal, { strategy, orders: [], onClose: () => {} }))
    expect(html).toContain(name)
    expect(html).toContain('No suitable live Thetanuts combination is currently available.')
    expect(html).toContain('Strategy Legs')
    expect(html).toContain('Best Outcome')
    expect(html).toContain(strategy === 'long-call' || strategy === 'long-put' ? 'Loss is limited to the premium paid.' : 'Defined loss.')
    expect(html).toContain('>Close</button>')
    expect(html).not.toContain('$')
    expect(html).not.toContain('<a ')
  })

  it('highlights the butterfly middle strike as the target without implying a quote', () => {
    const orders = [order(2400, { expiry: '4000000000' }), order(2500, { expiry: '4000000000' }), order(2600, { expiry: '4000000000' })]
    const html = renderToStaticMarkup(createElement(StrategyDetailModal, { strategy: 'butterfly', orders, onClose: () => {} }))
    expect(html).toContain('2× CALL')
    expect(html).toContain('Target Price</h3><strong>$2,500.00')
    expect(html).toContain('Executable bid/ask availability is not verified; no premium is quoted.')
  })
})
