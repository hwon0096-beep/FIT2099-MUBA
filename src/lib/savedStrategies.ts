export type SavedStrategySource = 'analyze' | 'recommendation'

/**
 * A locally-saved snapshot of a strategy/order idea — never an on-chain position. Metrics are
 * captured at save time because the live order behind them can expire or its book state can
 * change later; `orderId` is kept only so a saved item can be looked up again in the live orders
 * list for a "View Live" link, never to imply the saved snapshot itself is still accurate.
 */
export interface SavedStrategy {
  id: string
  savedAt: number
  source: SavedStrategySource
  kind?: string
  name: string
  asset: string
  optionType: 'CALL' | 'PUT' | 'UNKNOWN'
  strikes: string
  expiry: string
  collateral: string
  orderId: string
  isUsdSafe: boolean
  premium: number
  maxProfit: number | undefined
  maxLoss: number
  breakevens: number[]
}

const STORAGE_KEY = 'nutscope:saved-strategies'

function isSavedStrategy(value: unknown): value is SavedStrategy {
  return typeof value === 'object' && value !== null && typeof (value as SavedStrategy).id === 'string' && typeof (value as SavedStrategy).orderId === 'string'
}

export function loadSavedStrategies(): SavedStrategy[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSavedStrategy) : []
  } catch {
    return []
  }
}

export function persistSavedStrategies(items: SavedStrategy[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage may be unavailable (private browsing, quota) — saving silently no-ops
  }
}
