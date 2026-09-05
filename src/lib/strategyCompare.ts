import { formatNumber, formatUsd } from './formatters'
import type { SavedStrategy } from './savedStrategies'

// A comparison only reads as a comparison with at least two items, and stays legible on screen
// with at most four — the same range the reference UI conversations in this app have used for
// "pick a few things to compare" elsewhere.
export const MIN_COMPARE_ITEMS = 2
export const MAX_COMPARE_ITEMS = 4

export function canCompare(selectedIds: readonly string[]): boolean {
  return selectedIds.length >= MIN_COMPARE_ITEMS && selectedIds.length <= MAX_COMPARE_ITEMS
}

export interface ComparisonRow {
  label: string
  /** One formatted display value per item, in the same order as the items passed to buildComparisonRows. */
  values: string[]
  /** Index (into the same item order) of the single best value for this row, or null when there's
   *  no defensible winner — a tie, or the row isn't safely comparable across the selected items. */
  bestIndex: number | null
}

/**
 * Every value here comes straight from each SavedStrategy's own stored snapshot (captured at save
 * time in AnalyzePage.tsx/StrategyRecommendations.tsx) — nothing is recomputed or estimated.
 * Rows are only ever marked with a winner when every selected item is USD-safe (isUsdSafe), the
 * same rule isPremiumUsdSafe already enforces everywhere else in this app: a premium denominated in
 * a non-USDC token can't be safely compared in USD terms against one that is.
 */
export function buildComparisonRows(items: SavedStrategy[]): ComparisonRow[] {
  const allUsdSafe = items.length > 0 && items.every((item) => item.isUsdSafe)

  const premiumRow: ComparisonRow = {
    label: 'Premium',
    values: items.map((item) => `${formatNumber(item.premium, 6)} ${item.isUsdSafe ? 'USDC' : item.collateral}`),
    bestIndex: allUsdSafe ? lowestIndex(items.map((item) => item.premium)) : null,
  }

  const breakevenRow: ComparisonRow = {
    label: 'Breakeven',
    values: items.map((item) => item.isUsdSafe ? item.breakevens.map((value) => formatUsd(value)).join(' – ') : 'Non-USDC'),
    // Deliberately never picks a "winner" here — whether a higher or lower breakeven is better
    // depends on the position's direction (bullish vs. bearish), which isn't safe to infer just
    // from a saved breakeven number without fabricating an assumption about intent.
    bestIndex: null,
  }

  const maxProfitRow: ComparisonRow = {
    label: 'Max profit',
    values: items.map((item) => item.isUsdSafe ? (item.maxProfit === undefined ? 'Unlimited' : formatUsd(item.maxProfit)) : 'Non-USDC'),
    bestIndex: allUsdSafe ? highestMaxProfitIndex(items) : null,
  }

  const maxLossRow: ComparisonRow = {
    label: 'Max loss',
    values: items.map((item) => item.isUsdSafe ? formatUsd(item.maxLoss) : 'Non-USDC'),
    bestIndex: allUsdSafe ? lowestIndex(items.map((item) => item.maxLoss)) : null,
  }

  return [premiumRow, breakevenRow, maxProfitRow, maxLossRow]
}

/** Index of the single lowest value, or null if the list is empty or the lowest value is tied. */
function lowestIndex(values: number[]): number | null {
  if (!values.length) return null
  const min = Math.min(...values)
  const matches = values.reduce<number[]>((indices, value, index) => value === min ? [...indices, index] : indices, [])
  return matches.length === 1 ? matches[0] : null
}

/** Unlimited beats every finite number; if more than one item is Unlimited, or the top finite
 *  value is tied, there's no single winner. */
function highestMaxProfitIndex(items: SavedStrategy[]): number | null {
  const unlimited = items.reduce<number[]>((indices, item, index) => item.maxProfit === undefined ? [...indices, index] : indices, [])
  if (unlimited.length === 1) return unlimited[0]
  if (unlimited.length > 1) return null
  return lowestIndex(items.map((item) => -(item.maxProfit as number)))
}
