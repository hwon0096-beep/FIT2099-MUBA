import type { StrategyLeg } from './strategyPayoff'

export interface PaperPosition { id: string; name: string; asset: string; expiry: string; quantity: number; legs: StrategyLeg[]; entryCost: number; createdAt: number; status: 'open' | 'closed'; closedAt?: number; realizedPnl?: number }
export interface PaperAccount { cash: number; open: PaperPosition[]; closed: PaperPosition[] }
const KEY = 'nutscope:paper-account'
export const emptyPaperAccount = (): PaperAccount => ({ cash: 10_000, open: [], closed: [] })
export function loadPaperAccount(): PaperAccount { try { const raw = localStorage.getItem(KEY); if (!raw) return emptyPaperAccount(); const value = JSON.parse(raw) as PaperAccount; return typeof value.cash === 'number' && Array.isArray(value.open) && Array.isArray(value.closed) ? value : emptyPaperAccount() } catch { return emptyPaperAccount() } }
export function persistPaperAccount(account: PaperAccount): void { try { localStorage.setItem(KEY, JSON.stringify(account)) } catch { /* persistence is optional in restricted browsers */ } }
export function openPaperPosition(account: PaperAccount, position: PaperPosition): PaperAccount { if (!Number.isFinite(position.quantity) || position.quantity <= 0) throw new Error('Quantity must be greater than zero.'); if (position.entryCost > account.cash) throw new Error('Insufficient virtual USDC.'); return { ...account, cash: account.cash - position.entryCost, open: [position, ...account.open] } }
export function closePaperPosition(account: PaperAccount, id: string, settlementValue: number): PaperAccount { const position = account.open.find((item) => item.id === id); if (!position) throw new Error('Paper position was not found.'); const closed = { ...position, status: 'closed' as const, closedAt: Date.now(), realizedPnl: settlementValue - position.entryCost }; return { cash: account.cash + settlementValue, open: account.open.filter((item) => item.id !== id), closed: [closed, ...account.closed] } }
