export type SpreadType = 'CALL_SPREAD' | 'PUT_SPREAD'

export interface SpreadPayoffInputs {
  spreadType: SpreadType
  /** The long leg's strike — "near" per the Thetanuts SDK's [near, far] convention (lower strike for a call spread, upper strike for a put spread). */
  nearStrike: number
  /** The short leg's strike — "far" per the same convention. */
  farStrike: number
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

/** The strike width defines both the max payout per unit and the max collateral/loss for the short leg. */
export function spreadWidth(nearStrike: number, farStrike: number): number {
  return Math.abs(farStrike - nearStrike)
}

/** Payout of one unit at expiry: a diagonal ramp from the long leg's strike, capped at the strike width by the short leg. European-style — only price at expiry matters. */
export function intrinsicValueAtExpiry(spreadType: SpreadType, nearStrike: number, farStrike: number, priceAtExpiry: number): number {
  const width = spreadWidth(nearStrike, farStrike)
  const raw = spreadType === 'CALL_SPREAD' ? priceAtExpiry - nearStrike : nearStrike - priceAtExpiry
  return Math.min(Math.max(raw, 0), width)
}

/** Net P&L for the full position if the underlying settles at `priceAtExpiry`. */
export function netPnlAtExpiry(inputs: SpreadPayoffInputs, priceAtExpiry: number): number {
  const { spreadType, nearStrike, farStrike, premium, positionSize } = inputs
  return (intrinsicValueAtExpiry(spreadType, nearStrike, farStrike, priceAtExpiry) - premium) * positionSize
}

/** Break-even settlement price: where the ramp from the long leg's strike exactly covers the premium paid. */
export function breakevenPrice(spreadType: SpreadType, nearStrike: number, premium: number): number {
  return spreadType === 'CALL_SPREAD' ? nearStrike + premium : nearStrike - premium
}

/** Max loss for a long spread position is capped at the premium paid, same principle as a vanilla long option. */
export function maxLossTotal(premium: number, positionSize: number): number {
  return premium * positionSize
}

/** Max gain is capped at the strike width minus the premium paid — unlike a vanilla long call, a spread's upside is bounded by its short leg. */
export function maxGainTotal(nearStrike: number, farStrike: number, premium: number, positionSize: number): number {
  return (spreadWidth(nearStrike, farStrike) - premium) * positionSize
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

export function buildPayoffCurve(inputs: SpreadPayoffInputs, rangeFraction = 0.3, steps = 61): PricePoint[] {
  return buildPriceRange(inputs.currentPrice, rangeFraction, steps)
    .map(({ price }) => ({ price, pnl: netPnlAtExpiry(inputs, price) }))
}

const DEFAULT_SCENARIO_PERCENTS = [-10, -5, 0, 5, 10, 25]

/** Mirrors Odette-style settlement scenario rows: P&L if the underlying is up/down X% from the current price at expiry. */
export function buildScenarios(inputs: SpreadPayoffInputs, changePercents: number[] = DEFAULT_SCENARIO_PERCENTS): Scenario[] {
  return changePercents.map((changePercent) => {
    const price = inputs.currentPrice * (1 + changePercent / 100)
    return { changePercent, price, pnl: netPnlAtExpiry(inputs, price) }
  })
}
