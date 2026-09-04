export interface ExplorerOrder {
  id: string
  asset: string
  optionType: 'CALL' | 'PUT' | 'UNKNOWN'
  /** Whether the maker's resting order is a buy (a bid a taker can sell into) or a sell (an ask a taker can buy from). */
  side?: 'BUY' | 'SELL'
  strikes: string
  expiry: string
  pricePerContract: string
  contracts: string
  availableAmount: string
  collateral: string
}

interface MarketData {
  prices: {
    ETH: number
    BTC: number
    SOL?: number
  }
  metadata: {
    lastUpdated: number
  }
}

interface ProtocolStats {
  totalVolumeUsd: string
  totalPremiumUsd: string
  totalPositions: number
  '24h': {
    positions: number
  }
}

export interface ExplorerData {
  orders?: ExplorerOrder[]
  marketData?: MarketData
  protocolStats?: {
    stats: ProtocolStats
  }
  errors: string[]
  fetchedAt: string
}

/** Resolves an order's underlying spot price from market data by matching the asset symbol (wrapped/bridged tickers included, e.g. 'WETH', 'cbBTC'). */
export function resolveAssetPrice(asset: string, prices: MarketData['prices'] | undefined): number | undefined {
  if (!prices) return undefined
  const upper = asset.trim().toUpperCase()
  if (upper.includes('ETH')) return prices.ETH
  if (upper.includes('BTC')) return prices.BTC
  if (upper.includes('SOL')) return prices.SOL
  return undefined
}

export async function loadExplorerData(): Promise<ExplorerData> {
  console.info('[Thetanuts Explorer] Fetching /api/thetanuts')
  const response = await fetch('/api/thetanuts', { headers: { Accept: 'application/json' } })
  const payload: unknown = await response.json()

  if (!isExplorerData(payload)) {
    throw new Error(`Thetanuts API returned an invalid response (${response.status})`)
  }

  if (!response.ok) {
    console.error('[Thetanuts Explorer] /api/thetanuts failed', payload.errors)
  }

  return payload
}

function isExplorerData(value: unknown): value is ExplorerData {
  return typeof value === 'object' && value !== null && Array.isArray((value as ExplorerData).errors)
}
