export type OptionType = 'CALL' | 'PUT'

export interface PayoffInputs {
  optionType: OptionType
  strike: number
  premium: number
  positionSize: number
  currentPrice: number
}

export interface PricePoint {
  price: number
  pnl: number
}

export interface Scenario extends PricePoint {
  changePercent: number
}

/** Intrinsic value of one unit at expiry. European-style: only the price at expiry matters, never the spot price today. */
export function intrinsicValueAtExpiry(optionType: OptionType, strike: number, priceAtExpiry: number): number {
  return optionType === 'CALL' ? Math.max(priceAtExpiry - strike, 0) : Math.max(strike - priceAtExpiry, 0)
}

/** Net P&L for the full position if the underlying settles at `priceAtExpiry`. */
export function netPnlAtExpiry(inputs: PayoffInputs, priceAtExpiry: number): number {
  const { optionType, strike, premium, positionSize } = inputs
  return (intrinsicValueAtExpiry(optionType, strike, priceAtExpiry) - premium) * positionSize
}

/** Break-even settlement price: where intrinsic value exactly covers the premium paid. */
export function breakevenPrice(optionType: OptionType, strike: number, premium: number): number {
  return optionType === 'CALL' ? strike + premium : strike - premium
}

/** Max loss for a long option position is capped at the premium paid, regardless of how far out-of-the-money it settles. */
export function maxLossTotal(premium: number, positionSize: number): number {
  return premium * positionSize
}

/** Best-case profit for a long put: the underlying can't settle below zero, so gain is capped at strike minus premium. A long call has no such cap (uncapped upside). */
export function maxPutGainTotal(strike: number, premium: number, positionSize: number): number {
  return Math.max(0, strike - premium) * positionSize
}

export type Moneyness = 'ITM' | 'ATM' | 'OTM'

/** Classifies a call/put as in/at/out-of-the-money by comparing live spot to strike, treating spot within 0.1% of the strike as at-the-money rather than requiring an exact match. */
export function moneyness(optionType: OptionType, strike: number, spot: number): Moneyness {
  const band = strike * 0.001
  if (Math.abs(spot - strike) <= band) return 'ATM'
  return (optionType === 'CALL' ? spot > strike : spot < strike) ? 'ITM' : 'OTM'
}

/** Reward-to-risk ratio (max profit ÷ max loss). Undefined when max profit is uncapped (e.g. a long call's unlimited upside) or max loss isn't positive. */
export function riskRewardRatio(maxProfit: number | undefined, maxLoss: number): number | undefined {
  if (maxProfit === undefined || maxLoss <= 0) return undefined
  return maxProfit / maxLoss
}

/** Evenly spaced expiry-price samples spanning [currentPrice * (1 - rangeFraction), currentPrice * (1 + rangeFraction)]. */
export function buildPriceRange(currentPrice: number, rangeFraction = 0.3, steps = 61): PricePoint[] {
  const min = currentPrice * (1 - rangeFraction)
  const max = currentPrice * (1 + rangeFraction)
  const stepSize = (max - min) / (steps - 1)
  return Array.from({ length: steps }, (_, index) => {
    const price = min + stepSize * index
    return { price, pnl: 0 }
  })
}

export function buildPayoffCurve(inputs: PayoffInputs, rangeFraction = 0.3, steps = 61): PricePoint[] {
  return buildPriceRange(inputs.currentPrice, rangeFraction, steps)
    .map(({ price }) => ({ price, pnl: netPnlAtExpiry(inputs, price) }))
}

const DEFAULT_SCENARIO_PERCENTS = [-10, -5, 0, 5, 10, 25]

/** Mirrors Odette-style settlement scenario rows: P&L if the underlying is up/down X% from the current price at expiry. */
export function buildScenarios(inputs: PayoffInputs, changePercents: number[] = DEFAULT_SCENARIO_PERCENTS): Scenario[] {
  return changePercents.map((changePercent) => {
    const price = inputs.currentPrice * (1 + changePercent / 100)
    return { changePercent, price, pnl: netPnlAtExpiry(inputs, price) }
  })
}
