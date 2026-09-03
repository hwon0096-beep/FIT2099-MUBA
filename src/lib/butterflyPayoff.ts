import type { OptionType } from './payoff'

/**
 * Long butterfly: buy 1 low-strike leg, sell 2 mid-strike legs, buy 1 high-strike leg, all the same
 * option type (Thetanuts' CALL_FLY/PUT_FLY implementations — a single option type throughout,
 * unlike an iron condor which mixes calls and puts). This is the classic 1:-2:1 weighting; the
 * formula below doesn't assume the strikes are evenly spaced (a "broken-wing" butterfly still uses
 * the same weights, it just isn't guaranteed to floor its loss at the premium paid — see
 * maxLossTotal).
 */
function legValue(optionType: OptionType, strike: number, priceAtExpiry: number): number {
  return optionType === 'CALL' ? Math.max(priceAtExpiry - strike, 0) : Math.max(strike - priceAtExpiry, 0)
}

/** Intrinsic value of one unit at expiry. European-style: only the price at expiry matters. */
export function intrinsicValueAtExpiry(optionType: OptionType, lowStrike: number, midStrike: number, highStrike: number, priceAtExpiry: number): number {
  return legValue(optionType, lowStrike, priceAtExpiry) - 2 * legValue(optionType, midStrike, priceAtExpiry) + legValue(optionType, highStrike, priceAtExpiry)
}

/**
 * The payoff is piecewise-linear with slope 0 below lowStrike, +1 between low and mid, -1 between
 * mid and high, and 0 above highStrike — true for calls and puts alike, evenly spaced or not, since
 * each vanilla leg's own slope is always 0 or ±1 and the 1:-2:1 weights fix the pattern. So the
 * function's global min and max across every settlement price are exactly its values at the three
 * strikes themselves.
 */
function valuesAtStrikes(optionType: OptionType, lowStrike: number, midStrike: number, highStrike: number): [number, number, number] {
  return [lowStrike, midStrike, highStrike].map((strike) => intrinsicValueAtExpiry(optionType, lowStrike, midStrike, highStrike, strike)) as [number, number, number]
}

/** Best-case profit: the highest value across the three strikes, minus the premium paid. */
export function maxGainTotal(optionType: OptionType, lowStrike: number, midStrike: number, highStrike: number, premium: number, positionSize: number): number {
  return (Math.max(...valuesAtStrikes(optionType, lowStrike, midStrike, highStrike)) - premium) * positionSize
}

/**
 * Worst-case loss: the premium paid for an evenly spaced butterfly (whose tails settle back to
 * zero), plus any extra residual loss on an uneven "broken-wing" butterfly, whose far tail doesn't
 * fully cancel back to zero.
 */
export function maxLossTotal(optionType: OptionType, lowStrike: number, midStrike: number, highStrike: number, premium: number, positionSize: number): number {
  return (premium - Math.min(...valuesAtStrikes(optionType, lowStrike, midStrike, highStrike))) * positionSize
}

/**
 * Break-even settlement prices: up to two, where the payoff crosses the premium paid — one on the
 * rising [low, mid] leg, one on the falling [mid, high] leg. Returns an empty array if the premium
 * exceeds the peak value (the position can never turn a profit).
 */
export function breakevens(optionType: OptionType, lowStrike: number, midStrike: number, highStrike: number, premium: number): number[] {
  const [valueAtLow, valueAtMid, valueAtHigh] = valuesAtStrikes(optionType, lowStrike, midStrike, highStrike)
  const crossings: number[] = []

  if (valueAtMid !== valueAtLow) {
    const t = (premium - valueAtLow) / (valueAtMid - valueAtLow)
    if (t >= 0 && t <= 1) crossings.push(lowStrike + t * (midStrike - lowStrike))
  }

  if (valueAtHigh !== valueAtMid) {
    const t = (premium - valueAtMid) / (valueAtHigh - valueAtMid)
    if (t >= 0 && t <= 1) crossings.push(midStrike + t * (highStrike - midStrike))
  }

  return crossings
}
