import { intrinsicValueAtExpiry, type OptionType } from './payoff'

export type LegAction = 'BUY' | 'SELL'
export interface StrategyLeg { action: LegAction; type: OptionType; strike: number; premium: number; quantity: number }
export interface StrategyMetrics { netPremium: number; scenarioPnl: (price: number) => number; maxProfit?: number; maxLoss?: number; breakevens: number[]; curve: { price: number; pnl: number }[] }

/** Paper-only generic expiry engine. It deliberately has no connection to OptionBook execution. */
export function legPnlAtExpiry(leg: StrategyLeg, price: number): number {
  const longPnl = intrinsicValueAtExpiry(leg.type, leg.strike, price) - leg.premium
  return (leg.action === 'BUY' ? longPnl : -longPnl) * leg.quantity
}

export function strategyPnlAtExpiry(legs: StrategyLeg[], price: number): number { return legs.reduce((total, leg) => total + legPnlAtExpiry(leg, price), 0) }
export function netPremium(legs: StrategyLeg[]): number { return legs.reduce((total, leg) => total + (leg.action === 'BUY' ? leg.premium : -leg.premium) * leg.quantity, 0) }

/** Finds all zero crossings over the piecewise-linear payoff, including between strikes. */
export function strategyMetrics(legs: StrategyLeg[], spot: number): StrategyMetrics {
  const strikes = [...new Set(legs.map((leg) => leg.strike))].sort((a, b) => a - b)
  const low = Math.max(0, Math.min(spot * .5, (strikes[0] ?? spot) * .5))
  const high = Math.max(spot * 1.5, (strikes.at(-1) ?? spot) * 1.5)
  const nodes = [...new Set([low, ...strikes, high])].sort((a, b) => a - b)
  const values = nodes.map((price) => strategyPnlAtExpiry(legs, price))
  const breakevens: number[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = values[i], b = values[i + 1]
    if (a === 0) breakevens.push(nodes[i])
    if (a * b < 0) breakevens.push(nodes[i] + (-a / (b - a)) * (nodes[i + 1] - nodes[i]))
  }
  if (values.at(-1) === 0) breakevens.push(nodes.at(-1)!)
  const curve = Array.from({ length: 61 }, (_, i) => { const price = low + (high - low) * i / 60; return { price, pnl: strategyPnlAtExpiry(legs, price) } })
  const min = Math.min(...values), max = Math.max(...values)
  const upperSlope = legs.reduce((s, leg) => s + (leg.type === 'CALL' ? (leg.action === 'BUY' ? 1 : -1) * leg.quantity : 0), 0)
  const lowerSlope = legs.reduce((s, leg) => s + (leg.type === 'PUT' ? (leg.action === 'BUY' ? -1 : 1) * leg.quantity : 0), 0)
  return { netPremium: netPremium(legs), scenarioPnl: (price) => strategyPnlAtExpiry(legs, price), maxProfit: upperSlope > 0 || lowerSlope < 0 ? undefined : max, maxLoss: upperSlope < 0 || lowerSlope > 0 ? undefined : -min, breakevens: [...new Set(breakevens.map((n) => Number(n.toFixed(6))))], curve }
}
