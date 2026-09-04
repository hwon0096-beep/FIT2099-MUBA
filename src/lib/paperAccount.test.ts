import { describe, expect, it } from 'vitest'
import { emptyPaperAccount, openPaperPosition, closePaperPosition } from './paperAccount'
const position = { id: 'one', name: 'Long Call', asset: 'BTC', expiry: '1', quantity: 1, legs: [], entryCost: 100, createdAt: 1, status: 'open' as const }
describe('paper account', () => { it('starts with virtual cash and debits a paper trade', () => expect(openPaperPosition(emptyPaperAccount(), position).cash).toBe(9900)); it('rejects invalid paper orders', () => expect(() => openPaperPosition(emptyPaperAccount(), { ...position, quantity: 0 })).toThrow()); it('closes and credits an open position', () => expect(closePaperPosition(openPaperPosition(emptyPaperAccount(), position), 'one', 120).cash).toBe(10020)) })
