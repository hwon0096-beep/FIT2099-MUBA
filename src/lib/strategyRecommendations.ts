import * as butterflyPayoff from './butterflyPayoff'
import { formatNumber, formatUsd, parseOrderNumber, parseStrikeList } from './formatters'
import { buildPayoffFacts, isPremiumUsdSafe, isSupportedDebitSpread, type PayoffFacts } from './orderPayoff'
import * as payoff from './payoff'
import type { OptionType } from './payoff'
import * as spreadPayoff from './spreadPayoff'
import { resolveAssetPrice, type ExplorerData, type ExplorerOrder } from './thetanuts'

export type Outlook = 'BULLISH' | 'BEARISH' | 'NEUTRAL'
export type StrategyKind = 'BUY_CALL' | 'BULL_CALL_SPREAD' | 'BUY_PUT' | 'BEAR_PUT_SPREAD' | 'BUTTERFLY'

export interface StrategyLeg {
  action: 'BUY' | 'SELL'
  optionType: OptionType
  strike: number
  quantity: number
}

export interface StrategyRecommendation {
  kind: StrategyKind
  name: string
  outlook: Outlook
  order: ExplorerOrder
  asset: string
  expiry: string
  legs: StrategyLeg[]
  premium: number
  maxProfit: number | undefined
  maxLoss: number
  breakevens: number[]
  reason: string
}

export interface StrategyCandidate {
  kind: StrategyKind
  name: string
  recommendation: StrategyRecommendation | null
  unavailableReason?: string
}

function isCallOrPut(optionType: ExplorerOrder['optionType']): optionType is OptionType {
  return optionType === 'CALL' || optionType === 'PUT'
}

/** Live, not-yet-expired orders for one asset with some fillable amount remaining. */
function liveOrdersForAsset(orders: ExplorerOrder[], asset: string): ExplorerOrder[] {
  const now = Date.now()
  return orders.filter((order) => order.asset === asset && Number(order.expiry) * 1000 > now && Number(order.availableAmount) > 0)
}

/** Picks the item whose key is numerically closest to the target — the "most at-the-money" match. */
function closestTo<T>(items: T[], key: (item: T) => number, target: number): T | undefined {
  return items.reduce<{ item: T; distance: number } | undefined>((best, item) => {
    const distance = Math.abs(key(item) - target)
    return !best || distance < best.distance ? { item, distance } : best
  }, undefined)?.item
}

function findVanilla(orders: ExplorerOrder[], marketData: ExplorerData['marketData'], asset: string, optionType: OptionType, spot: number | undefined): StrategyRecommendation | null {
  if (spot === undefined) return null
  const matches = liveOrdersForAsset(orders, asset)
    .filter((order) => order.optionType === optionType)
    .map((order) => ({ order, facts: buildPayoffFacts(order, marketData) }))
    .filter((entry): entry is { order: ExplorerOrder; facts: Extract<PayoffFacts, { kind: 'vanilla' }> } => entry.facts?.kind === 'vanilla')

  const best = closestTo(matches, (entry) => entry.facts.strike, spot)
  if (!best) return null
  const { order, facts } = best

  const breakeven = payoff.breakevenPrice(facts.optionType, facts.strike, facts.premium)
  const maxLoss = payoff.maxLossTotal(facts.premium, 1)
  const maxProfit = facts.optionType === 'PUT' ? payoff.maxPutGainTotal(facts.strike, facts.premium, 1) : undefined
  const direction = optionType === 'CALL' ? 'above' : 'below'

  return {
    kind: optionType === 'CALL' ? 'BUY_CALL' : 'BUY_PUT',
    name: optionType === 'CALL' ? 'Buy Call' : 'Buy Put',
    outlook: optionType === 'CALL' ? 'BULLISH' : 'BEARISH',
    order,
    asset,
    expiry: order.expiry,
    legs: [{ action: 'BUY', optionType, strike: facts.strike, quantity: 1 }],
    premium: facts.premium,
    maxProfit,
    maxLoss,
    breakevens: [breakeven],
    reason: `A straightforward ${optionType === 'CALL' ? 'bullish' : 'bearish'} bet: profits if ${asset} is ${direction} ${formatUsd(breakeven)} at expiry, with loss capped at the ${formatNumber(facts.premium, 6)} USDC premium paid.`,
  }
}

function findSpread(orders: ExplorerOrder[], marketData: ExplorerData['marketData'], asset: string, spreadType: spreadPayoff.SpreadType, spot: number | undefined): StrategyRecommendation | null {
  if (spot === undefined) return null
  const optionType: OptionType = spreadType === 'CALL_SPREAD' ? 'CALL' : 'PUT'
  const matches = liveOrdersForAsset(orders, asset)
    .filter((order) => order.optionType === optionType)
    .map((order) => ({ order, facts: buildPayoffFacts(order, marketData) }))
    .filter((entry): entry is { order: ExplorerOrder; facts: Extract<PayoffFacts, { kind: 'spread' }> } =>
      entry.facts?.kind === 'spread' && entry.facts.spreadType === spreadType && isSupportedDebitSpread(entry.facts))

  const best = closestTo(matches, (entry) => entry.facts.nearStrike, spot)
  if (!best) return null
  const { order, facts } = best

  const breakeven = spreadPayoff.breakevenPrice(facts.spreadType, facts.nearStrike, facts.premium)
  const maxLoss = spreadPayoff.maxLossTotal(facts.premium, 1)
  const maxProfit = spreadPayoff.maxGainTotal(facts.nearStrike, facts.farStrike, facts.premium, 1)
  const direction = spreadType === 'CALL_SPREAD' ? 'above' : 'below'

  return {
    kind: spreadType === 'CALL_SPREAD' ? 'BULL_CALL_SPREAD' : 'BEAR_PUT_SPREAD',
    name: spreadType === 'CALL_SPREAD' ? 'Bull Call Spread' : 'Bear Put Spread',
    outlook: spreadType === 'CALL_SPREAD' ? 'BULLISH' : 'BEARISH',
    order,
    asset,
    expiry: order.expiry,
    legs: [
      { action: 'BUY', optionType, strike: facts.nearStrike, quantity: 1 },
      { action: 'SELL', optionType, strike: facts.farStrike, quantity: 1 },
    ],
    premium: facts.premium,
    maxProfit,
    maxLoss,
    breakevens: [breakeven],
    reason: `A capped-risk ${spreadType === 'CALL_SPREAD' ? 'bullish' : 'bearish'} bet: profits if ${asset} is ${direction} ${formatUsd(breakeven)} at expiry, gains capped at ${formatNumber(maxProfit, 6)} USDC, loss capped at the ${formatNumber(facts.premium, 6)} USDC debit.`,
  }
}

/**
 * Butterflies (3-strike orders, same option type throughout) are the only 3+ leg structure this
 * recommender treats as "Neutral" — see the Thetanuts SDK's ButterflyRFQParams (buy low, sell 2x
 * mid, buy high, one option type) vs. IronCondorRFQParams (buy put/sell put/sell call/buy put,
 * mixing both). Buying an iron condor is actually a directional/breakout bet, not a range-bound
 * one, and this app's ExplorerOrder data (just optionType + strikes) can't reliably tell a same-
 * type condor (which would be neutral) apart from an iron condor (which wouldn't) — so 4-strike
 * orders are deliberately excluded here rather than risk mislabeling a directional trade as
 * neutral.
 */
function findButterfly(orders: ExplorerOrder[], asset: string, spot: number | undefined): StrategyRecommendation | null {
  if (spot === undefined) return null
  const candidates = liveOrdersForAsset(orders, asset)
    .filter((order) => isCallOrPut(order.optionType) && isPremiumUsdSafe(order))
    .map((order) => {
      const strikes = parseStrikeList(order.strikes).slice().sort((a, b) => a - b)
      const premium = parseOrderNumber(order.pricePerContract)
      return { order, strikes, premium }
    })
    .filter((entry) => entry.strikes.length === 3 && entry.premium > 0)
    .map((entry) => {
      const optionType = entry.order.optionType as OptionType
      const [lowStrike, midStrike, highStrike] = entry.strikes
      return {
        ...entry,
        optionType,
        lowStrike,
        midStrike,
        highStrike,
        maxProfit: butterflyPayoff.maxGainTotal(optionType, lowStrike, midStrike, highStrike, entry.premium, 1),
        maxLoss: butterflyPayoff.maxLossTotal(optionType, lowStrike, midStrike, highStrike, entry.premium, 1),
        breakevens: butterflyPayoff.breakevens(optionType, lowStrike, midStrike, highStrike, entry.premium),
      }
    })
    .filter((entry) => entry.maxProfit > 0 && entry.breakevens.length === 2)

  const best = closestTo(candidates, (entry) => entry.midStrike, spot)
  if (!best) return null

  return {
    kind: 'BUTTERFLY',
    name: `${best.optionType === 'CALL' ? 'Call' : 'Put'} Butterfly`,
    outlook: 'NEUTRAL',
    order: best.order,
    asset,
    expiry: best.order.expiry,
    legs: [
      { action: 'BUY', optionType: best.optionType, strike: best.lowStrike, quantity: 1 },
      { action: 'SELL', optionType: best.optionType, strike: best.midStrike, quantity: 2 },
      { action: 'BUY', optionType: best.optionType, strike: best.highStrike, quantity: 1 },
    ],
    premium: best.premium,
    maxProfit: best.maxProfit,
    maxLoss: best.maxLoss,
    breakevens: best.breakevens,
    reason: `A range-bound bet: profits most if ${asset} settles near ${formatUsd(best.midStrike)} at expiry, staying between ${formatUsd(best.breakevens[0])} and ${formatUsd(best.breakevens[1])}, with loss capped at ${formatNumber(best.maxLoss, 6)} USDC.`,
  }
}

const STRATEGIES_BY_OUTLOOK: Record<Outlook, { kind: StrategyKind; name: string }[]> = {
  BULLISH: [
    { kind: 'BUY_CALL', name: 'Buy Call' },
    { kind: 'BULL_CALL_SPREAD', name: 'Bull Call Spread' },
  ],
  BEARISH: [
    { kind: 'BUY_PUT', name: 'Buy Put' },
    { kind: 'BEAR_PUT_SPREAD', name: 'Bear Put Spread' },
  ],
  NEUTRAL: [{ kind: 'BUTTERFLY', name: 'Butterfly' }],
}

/** Builds one candidate per strategy shape for the given outlook, from real live orders only — never a fabricated example. */
export function buildStrategyCandidates(orders: ExplorerOrder[], marketData: ExplorerData['marketData'], asset: string, outlook: Outlook): StrategyCandidate[] {
  const spot = resolveAssetPrice(asset, marketData?.prices)

  return STRATEGIES_BY_OUTLOOK[outlook].map(({ kind, name }) => {
    const recommendation =
      kind === 'BUY_CALL' ? findVanilla(orders, marketData, asset, 'CALL', spot) :
      kind === 'BUY_PUT' ? findVanilla(orders, marketData, asset, 'PUT', spot) :
      kind === 'BULL_CALL_SPREAD' ? findSpread(orders, marketData, asset, 'CALL_SPREAD', spot) :
      kind === 'BEAR_PUT_SPREAD' ? findSpread(orders, marketData, asset, 'PUT_SPREAD', spot) :
      findButterfly(orders, asset, spot)

    if (recommendation) return { kind, name, recommendation }

    const unavailableReason = spot === undefined
      ? `Live spot price for ${asset} is unavailable right now.`
      : `No suitable live ${name} orders are currently available for ${asset}.`
    return { kind, name, recommendation: null, unavailableReason }
  })
}
