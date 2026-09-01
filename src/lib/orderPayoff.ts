import type { PayoffFacts } from '../components/PayoffPreviewBody'
export type { PayoffFacts } from '../components/PayoffPreviewBody'
import { parseOrderNumber, parseStrikeList } from './formatters'
import { resolveAssetPrice, type ExplorerData, type ExplorerOrder } from './thetanuts'

/**
 * Turns a raw order into payoff facts for PayoffPreviewBody, branching on strike count per the
 * Thetanuts SDK's PayoutType convention (see server/thetanuts.ts's note on `strikes`): 1 strike is
 * a vanilla call/put, 2 strikes is a vertical spread (near leg = long, far leg = short — never
 * reordered). Returns null for anything else (UNKNOWN type, 0 strikes, or 3+ strike structures
 * like butterflies/condors/rangers), which callers should treat as "no payoff preview available".
 */
export function buildPayoffFacts(order: ExplorerOrder, marketData: ExplorerData['marketData']): PayoffFacts | null {
  if (order.optionType === 'UNKNOWN') return null

  const strikes = parseStrikeList(order.strikes)
  const premium = parseOrderNumber(order.pricePerContract)
  const currentPrice = resolveAssetPrice(order.asset, marketData?.prices) ?? strikes[0] ?? 0

  if (strikes.length === 1) {
    return { kind: 'vanilla', optionType: order.optionType, strike: strikes[0], premium, currentPrice }
  }

  if (strikes.length === 2) {
    return {
      kind: 'spread',
      spreadType: order.optionType === 'CALL' ? 'CALL_SPREAD' : 'PUT_SPREAD',
      nearStrike: strikes[0],
      farStrike: strikes[1],
      premium,
      currentPrice,
    }
  }

  return null
}
