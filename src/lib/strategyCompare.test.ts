import { describe, expect, it } from 'vitest'
import { buildComparisonRows, canCompare, MAX_COMPARE_ITEMS, MIN_COMPARE_ITEMS } from './strategyCompare'
import type { SavedStrategy } from './savedStrategies'

function makeStrategy(overrides: Partial<SavedStrategy> & { id: string }): SavedStrategy {
  return {
    savedAt: 0,
    source: 'analyze',
    name: 'Test strategy',
    asset: 'ETH',
    optionType: 'CALL',
    strikes: '2000',
    expiry: '9999999999',
    collateral: 'USDC',
    orderId: `order-${overrides.id}`,
    isUsdSafe: true,
    premium: 1,
    maxProfit: undefined,
    maxLoss: 1,
    breakevens: [2001],
    ...overrides,
  }
}

describe('canCompare', () => {
  it('requires at least MIN_COMPARE_ITEMS', () => {
    expect(canCompare([])).toBe(false)
    expect(canCompare(['a'])).toBe(false)
    expect(canCompare(Array.from({ length: MIN_COMPARE_ITEMS }, (_, i) => String(i)))).toBe(true)
  })

  it('rejects more than MAX_COMPARE_ITEMS', () => {
    expect(canCompare(Array.from({ length: MAX_COMPARE_ITEMS }, (_, i) => String(i)))).toBe(true)
    expect(canCompare(Array.from({ length: MAX_COMPARE_ITEMS + 1 }, (_, i) => String(i)))).toBe(false)
  })
})

describe('buildComparisonRows', () => {
  it('picks the lower premium and lower max loss as the winner when both items are USD-safe', () => {
    const cheaper = makeStrategy({ id: 'a', premium: 1, maxLoss: 1 })
    const pricier = makeStrategy({ id: 'b', premium: 2, maxLoss: 2 })
    const rows = buildComparisonRows([cheaper, pricier])

    const premiumRow = rows.find((row) => row.label === 'Premium')!
    expect(premiumRow.values).toEqual(['1 USDC', '2 USDC'])
    expect(premiumRow.bestIndex).toBe(0)

    const maxLossRow = rows.find((row) => row.label === 'Max loss')!
    expect(maxLossRow.bestIndex).toBe(0)
  })

  it('never picks a winner for breakeven — direction (bullish/bearish) isn\'t knowable from the number alone', () => {
    const a = makeStrategy({ id: 'a', breakevens: [1000] })
    const b = makeStrategy({ id: 'b', breakevens: [5000] })
    const rows = buildComparisonRows([a, b])
    expect(rows.find((row) => row.label === 'Breakeven')!.bestIndex).toBeNull()
  })

  it('treats Unlimited max profit as beating any finite value', () => {
    const capped = makeStrategy({ id: 'a', maxProfit: 500 })
    const uncapped = makeStrategy({ id: 'b', maxProfit: undefined })
    const rows = buildComparisonRows([capped, uncapped])
    const maxProfitRow = rows.find((row) => row.label === 'Max profit')!
    expect(maxProfitRow.values).toEqual([expect.stringContaining('500'), 'Unlimited'])
    expect(maxProfitRow.bestIndex).toBe(1)
  })

  it('calls it a tie (no winner) when more than one item has Unlimited max profit', () => {
    const a = makeStrategy({ id: 'a', maxProfit: undefined })
    const b = makeStrategy({ id: 'b', maxProfit: undefined })
    const rows = buildComparisonRows([a, b])
    expect(rows.find((row) => row.label === 'Max profit')!.bestIndex).toBeNull()
  })

  it('calls it a tie (no winner) when the lowest value is shared by more than one item', () => {
    const a = makeStrategy({ id: 'a', premium: 1 })
    const b = makeStrategy({ id: 'b', premium: 1 })
    const rows = buildComparisonRows([a, b])
    expect(rows.find((row) => row.label === 'Premium')!.bestIndex).toBeNull()
  })

  it('never declares a winner on any row when any selected item is not USD-safe', () => {
    const usdcItem = makeStrategy({ id: 'a', isUsdSafe: true, premium: 1, maxLoss: 1, collateral: 'USDC' })
    const nonUsdcItem = makeStrategy({ id: 'b', isUsdSafe: false, premium: 0.5, maxLoss: 0.5, collateral: 'WETH' })
    const rows = buildComparisonRows([usdcItem, nonUsdcItem])
    for (const row of rows) expect(row.bestIndex).toBeNull()

    const premiumRow = rows.find((row) => row.label === 'Premium')!
    expect(premiumRow.values).toEqual(['1 USDC', '0.5 WETH'])
    const maxLossRow = rows.find((row) => row.label === 'Max loss')!
    expect(maxLossRow.values[1]).toBe('Non-USDC')
  })
})
