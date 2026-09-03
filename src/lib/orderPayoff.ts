import type { PayoffFacts } from '../components/PayoffPreviewBody'
export type { PayoffFacts } from '../components/PayoffPreviewBody'
import { parseOrderNumber, parseStrikeList } from './formatters'
import { spreadWidth } from './spreadPayoff'
import { resolveAssetPrice, type ExplorerData, type ExplorerOrder } from './thetanuts'

/**
 * An order's premium (pricePerContract) is quoted in its collateral token, per unit — for a
 * PHYSICAL_CALL that's the base asset (WETH for ETH, cbBTC for BTC), not USD (see the Thetanuts
 * SDK's OrderParams.price doc: "Price per contract in collateral token units"). Strike and spot
 * prices elsewhere in this app are always USD, so a premium can only be mixed into USD payoff math
 * when its collateral is USDC itself — anything else must be shown in its native denomination
 * instead of silently treated as a 1:1 USD amount.
 */
export function isPremiumUsdSafe(order: { collateral: string }): boolean {
  return order.collateral === 'USDC'
}

/**
 * Turns a raw order into payoff facts for PayoffPreviewBody, branching on strike count per the
 * Thetanuts SDK's PayoutType convention (see server/thetanuts.ts's note on `strikes`): 1 strike is
 * a vanilla call/put, 2 strikes is a vertical spread (near leg = long, far leg = short — never
 * reordered). Returns null for anything else (UNKNOWN type, 0 strikes, 3+ strike structures like
 * butterflies/condors/rangers, or a premium not denominated in USDC — see isPremiumUsdSafe), which
 * callers should treat as "no payoff preview available".
 */
export function buildPayoffFacts(order: ExplorerOrder, marketData: ExplorerData['marketData']): PayoffFacts | null {
  if (order.optionType === 'UNKNOWN') return null
  if (!isPremiumUsdSafe(order)) return null

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

/**
 * A 2-strike order is only a well-formed vertical debit spread if its strikes follow the Thetanuts
 * SDK's [near, far] convention (near = the long leg, ascending for a call spread since the long
 * leg is the lower strike, descending for a put spread since the long leg is the upper strike) and
 * the debit paid doesn't exceed the spread's own width (a premium above the width would make the
 * position a guaranteed loser, which isn't a real tradeable structure).
 */
export function isSupportedDebitSpread(facts: Extract<PayoffFacts, { kind: 'spread' }>): boolean {
  const ordered = facts.spreadType === 'CALL_SPREAD' ? facts.nearStrike < facts.farStrike : facts.nearStrike > facts.farStrike
  return ordered && facts.premium > 0 && facts.premium <= spreadWidth(facts.nearStrike, facts.farStrike)
}
