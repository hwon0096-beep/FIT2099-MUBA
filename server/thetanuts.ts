import {
  MemoryStorageProvider,
  ThetanutsClient,
  buildPriceFeedSymbolMap,
  formatAmount,
  type MarketDataResponse,
  type OrderWithSignature,
  type ProtocolStatsResponse,
} from '@thetanuts-finance/thetanuts-client'
import { ethers } from 'ethers'

const BASE_CHAIN_ID = 8453 as const
const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org'
const SOURCE_TIMEOUT_MS = 12_000

export interface ExplorerOrder {
  id: string
  asset: string
  optionType: 'CALL' | 'PUT' | 'UNKNOWN'
  strikes: string
  expiry: string
  pricePerContract: string
  contracts: string
  availableAmount: string
  collateral: string
}

export interface ThetanutsApiResponse {
  orders?: ExplorerOrder[]
  marketData?: MarketDataResponse
  protocolStats?: ProtocolStatsResponse
  errors: string[]
  fetchedAt: string
}

function createReadOnlyClient() {
  console.info('[Thetanuts API] Creating read-only client')
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL)

  return new ThetanutsClient({
    chainId: BASE_CHAIN_ID,
    provider,
    keyStorageProvider: new MemoryStorageProvider(),
  })
}

function describeFailure(source: string, reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason)
  return `${source} could not be loaded: ${message}`
}

function withTimeout<T>(source: string, request: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${source} timed out after ${SOURCE_TIMEOUT_MS / 1000} seconds`)), SOURCE_TIMEOUT_MS)

    request.then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

async function loadSource<T>(source: string, request: () => Promise<T>): Promise<T> {
  try {
    console.info(`[Thetanuts API] ${source} started`)
    const value = await withTimeout(source, request())
    console.info(`[Thetanuts API] ${source} succeeded`)
    return value
  } catch (error) {
    console.error(`[Thetanuts API] ${source} failed`, error)
    throw error
  }
}

function tokenSymbol(address: string | undefined, client: ThetanutsClient) {
  if (!address) return 'Unknown collateral'

  const token = Object.values(client.chainConfig.tokens).find(
    ({ address: tokenAddress }) => tokenAddress.toLowerCase() === address.toLowerCase(),
  )

  return token?.symbol ?? `${address.slice(0, 6)}…${address.slice(-4)}`
}

function normalizeOrder(orderWithSignature: OrderWithSignature, client: ThetanutsClient): ExplorerOrder {
  const { order, rawApiData } = orderWithSignature
  const priceFeedSymbols = buildPriceFeedSymbolMap(BASE_CHAIN_ID)
  const priceFeed = rawApiData?.priceFeed.toLowerCase()
  // strikes.length tells you the product structure (per @thetanuts-finance/thetanuts-client's
  // PayoutType docs): 1 = vanilla call/put, 2 = vertical spread (call_spread/put_spread, strikes
  // given as [near leg, far leg] — ascending for a call spread, descending for a put spread,
  // since "near" is the long leg and that's the upper strike for a put), 3 = butterfly, 4 =
  // condor/iron_condor/ranger. This app currently only has payoff math for the 1-strike case
  // (src/lib/payoff.ts); 2+ strike orders are real distinct products, not a display quirk.
  const strikes = order.strikes ?? (order.strikePrice ? [order.strikePrice] : [])

  const optionType = rawApiData ? (rawApiData.isCall ? 'CALL' : 'PUT') : 'UNKNOWN'

  return {
    // order.nonce alone collides across an order's legs (e.g. a call/put pair sharing one
    // signature nonce), so the full id also folds in the fields that actually distinguish them.
    id: `${order.maker}-${order.nonce.toString()}-${optionType}-${order.expiry.toString()}-${strikes.join('_')}-${order.price.toString()}`,
    asset: priceFeed ? (priceFeedSymbols[priceFeed] ?? 'Unknown') : 'Unknown',
    optionType,
    strikes: strikes.length > 0 ? strikes.map((strike) => `$${formatAmount(strike, 8, 2)}`).join(' / ') : 'Not supplied',
    expiry: order.expiry.toString(),
    pricePerContract: formatAmount(order.price, 8, 6),
    contracts: formatAmount(order.numContracts, 6, 4),
    availableAmount: formatAmount(orderWithSignature.availableAmount, 6, 4),
    collateral: tokenSymbol(rawApiData?.collateral ?? order.collateralToken, client),
  }
}

// Thetanuts' orderbook API (client.api.fetchOrders()'s apiBaseUrl) doesn't send
// Access-Control-Allow-Origin, so a browser can't call it directly — only from
// here, server-side. Unlike loadThetanutsData()'s normalizeOrder() output, this
// keeps the raw OrderWithSignature (signature + rawApiData intact) since that's
// what previewFillOrder()/fillOrder() require to actually fill an order.
export async function fetchRawOrders(): Promise<OrderWithSignature[]> {
  const client = createReadOnlyClient()
  return loadSource('fetchOrders()', () => client.api.fetchOrders())
}

export async function loadThetanutsData(): Promise<ThetanutsApiResponse> {
  const errors: string[] = []
  const data: ThetanutsApiResponse = { errors, fetchedAt: new Date().toISOString() }
  let client: ThetanutsClient

  try {
    client = createReadOnlyClient()
  } catch (error) {
    console.error('[Thetanuts API] Client creation failed', error)
    errors.push(describeFailure('Thetanuts client creation', error))
    return data
  }

  const [ordersResult, marketResult, statsResult] = await Promise.allSettled([
    loadSource('fetchOrders()', () => client.api.fetchOrders()),
    loadSource('getMarketData()', () => client.api.getMarketData()),
    loadSource('getBookProtocolStats()', () => client.api.getBookProtocolStats()),
  ])

  if (ordersResult.status === 'fulfilled') data.orders = ordersResult.value.map((order) => normalizeOrder(order, client))
  else errors.push(describeFailure('Live OptionBook orders', ordersResult.reason))

  if (marketResult.status === 'fulfilled') data.marketData = marketResult.value
  else errors.push(describeFailure('Live market data', marketResult.reason))

  if (statsResult.status === 'fulfilled') data.protocolStats = statsResult.value
  else errors.push(describeFailure('Live OptionBook protocol statistics', statsResult.reason))

  return data
}
