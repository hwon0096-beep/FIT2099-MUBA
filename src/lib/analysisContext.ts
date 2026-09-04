import { daysToExpiry, parseOrderNumber, parseStrikeList } from './formatters'
import { buildPayoffFacts, isSupportedDebitSpread } from './orderPayoff'
import * as payoff from './payoff'
import * as spreadPayoff from './spreadPayoff'
import { resolveAssetPrice, type ExplorerData, type ExplorerOrder } from './thetanuts'

export interface AnalystScenario { changePercent: number; priceAtExpiry: number; pnl: number }

export interface OptionAnalysisContext {
  orderId: string
  asset: string
  optionType: 'CALL' | 'PUT' | 'UNKNOWN'
  strikes: number[]
  expiry: string
  premium: number | null
  premiumUnit: string
  spotPrice: number | null
  breakEven: number | null
  maxProfit: number | null
  maxProfitIsUnlimited: boolean
  maxLoss: number | null
  moneyness: 'ITM' | 'ATM' | 'OTM' | null
  dte: number
  quantity: number
  strategyType: 'LONG_CALL' | 'LONG_PUT' | 'BULL_CALL_DEBIT_SPREAD' | 'BEAR_PUT_DEBIT_SPREAD' | 'UNSUPPORTED'
  spread: { nearStrike: number; farStrike: number; width: number } | null
  scenarioPnL: AnalystScenario[]
}

const SCENARIOS = [-20, -10, 0, 10, 20]

/** Builds AI context exclusively from the same verified deterministic utilities used by Analyze. */
export function buildAnalysisContext(order: ExplorerOrder, marketData: ExplorerData['marketData'], quantity = 1): OptionAnalysisContext {
  const strikes = parseStrikeList(order.strikes)
  const spot = resolveAssetPrice(order.asset, marketData?.prices)
  const facts = buildPayoffFacts(order, marketData)
  const base = {
    orderId: order.id, asset: order.asset, optionType: order.optionType, strikes, expiry: order.expiry,
    premium: Number.isFinite(parseOrderNumber(order.pricePerContract)) ? parseOrderNumber(order.pricePerContract) : null,
    premiumUnit: order.collateral, spotPrice: spot ?? null, dte: daysToExpiry(order.expiry), quantity,
  }

  if (!facts || spot === undefined || (facts.kind === 'spread' && !isSupportedDebitSpread(facts))) {
    return { ...base, breakEven: null, maxProfit: null, maxProfitIsUnlimited: false, maxLoss: null, moneyness: null, strategyType: 'UNSUPPORTED', spread: null, scenarioPnL: [] }
  }

  if (facts.kind === 'spread') {
    const inputs = { ...facts, positionSize: quantity }
    return {
      ...base,
      breakEven: spreadPayoff.breakevenPrice(facts.spreadType, facts.nearStrike, facts.premium),
      maxProfit: spreadPayoff.maxGainTotal(facts.nearStrike, facts.farStrike, facts.premium, quantity),
      maxProfitIsUnlimited: false,
      maxLoss: spreadPayoff.maxLossTotal(facts.premium, quantity),
      moneyness: payoff.moneyness(order.optionType as 'CALL' | 'PUT', facts.nearStrike, spot),
      strategyType: facts.spreadType === 'CALL_SPREAD' ? 'BULL_CALL_DEBIT_SPREAD' : 'BEAR_PUT_DEBIT_SPREAD',
      spread: { nearStrike: facts.nearStrike, farStrike: facts.farStrike, width: spreadPayoff.spreadWidth(facts.nearStrike, facts.farStrike) },
      scenarioPnL: spreadPayoff.buildScenarios(inputs, SCENARIOS).map(({ changePercent, price, pnl }) => ({ changePercent, priceAtExpiry: price, pnl })),
    }
  }

  const inputs = { ...facts, positionSize: quantity }
  const unlimited = facts.optionType === 'CALL'
  return {
    ...base,
    breakEven: payoff.breakevenPrice(facts.optionType, facts.strike, facts.premium),
    maxProfit: unlimited ? null : payoff.maxPutGainTotal(facts.strike, facts.premium, quantity),
    maxProfitIsUnlimited: unlimited,
    maxLoss: payoff.maxLossTotal(facts.premium, quantity),
    moneyness: payoff.moneyness(facts.optionType, facts.strike, spot),
    strategyType: facts.optionType === 'CALL' ? 'LONG_CALL' : 'LONG_PUT',
    spread: null,
    scenarioPnL: payoff.buildScenarios(inputs, SCENARIOS).map(({ changePercent, price, pnl }) => ({ changePercent, priceAtExpiry: price, pnl })),
  }
}
