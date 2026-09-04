import { describe, expect, it } from 'vitest'
import { strategyMetrics, strategyPnlAtExpiry } from './strategyPayoff'

describe('paper strategy payoff engine', () => {
  it('combines long calls and puts', () => { expect(strategyPnlAtExpiry([{ action: 'BUY', type: 'CALL', strike: 100, premium: 10, quantity: 1 }], 120)).toBe(10); expect(strategyPnlAtExpiry([{ action: 'BUY', type: 'PUT', strike: 100, premium: 10, quantity: 1 }], 80)).toBe(10) })
  it('handles a bull call debit spread', () => { const m = strategyMetrics([{ action: 'BUY', type: 'CALL', strike: 100, premium: 12, quantity: 1 }, { action: 'SELL', type: 'CALL', strike: 120, premium: 4, quantity: 1 }], 110); expect(m.scenarioPnl(90)).toBe(-8); expect(m.scenarioPnl(120)).toBe(12); expect(m.breakevens).toEqual([108]) })
  it('handles a short-credit position', () => { expect(strategyPnlAtExpiry([{ action: 'SELL', type: 'PUT', strike: 100, premium: 6, quantity: 1 }], 90)).toBe(-4) })
})
