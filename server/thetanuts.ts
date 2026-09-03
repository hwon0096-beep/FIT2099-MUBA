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
const SOURCE_RETRY_DELAY_MS = 250
const CACHE_TTL_MS = 12_000

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

// BASE_RPC_URL may hold a comma-separated list (primary, then fallback(s)).
// Blank/unset -> the public endpoint, same as before.
function parseRpcUrls(raw: string | undefined): string[] {
  const urls = (raw ?? '').split(',').map((url) => url.trim()).filter(Boolean)
  return urls.length > 0 ? urls : [DEFAULT_BASE_RPC_URL]
}

// A single RPC URL failing (or the RPC_URL env var being unset) used to mean
// silently going through the public mainnet.base.org endpoint on every single
// request, which throttles under any real load. ethers.FallbackProvider is
// ethers' own building block for exactly this: given multiple RPC URLs, it
// dispatches by priority and moves on to the next on failure/timeout. quorum
// is set to 1 explicitly (rather than relying on the default
// ceil(providerCount / 2)) because this is meant as failover across
// BASE_RPC_URL's list, not multi-node consensus — one healthy endpoint
// responding should be enough, not a majority of them agreeing.
function createProvider(): ethers.Provider {
  const urls = parseRpcUrls(process.env.BASE_RPC_URL)
  if (urls.length === 1) return new ethers.JsonRpcProvider(urls[0], BASE_CHAIN_ID)

  const configs = urls.map((url, index) => ({
    provider: new ethers.JsonRpcProvider(url, BASE_CHAIN_ID),
    priority: index,
  }))
  return new ethers.FallbackProvider(configs, BASE_CHAIN_ID, { quorum: 1 })
}

function createReadOnlyClient() {
  console.info('[Thetanuts API] Creating read-only client')
  const provider = createProvider()
  const client = new ThetanutsClient({
    chainId: BASE_CHAIN_ID,
    provider,
    keyStorageProvider: new MemoryStorageProvider(),
  })

  // These values are SDK defaults/configuration, not user-supplied requests. Keep
  // credentials out of logs: URLs are reduced to origin + path and RPCs to host.
  console.info('[Thetanuts API] SDK endpoint configuration', {
    apiBaseUrl: safeUrl(client.apiBaseUrl),
    indexerApiUrl: safeUrl(client.indexerApiUrl),
    stateApiUrl: safeUrl(client.stateApiUrl),
    pricingApiUrl: safeUrl(client.pricingApiUrl),
    rpcHosts: parseRpcUrls(process.env.BASE_RPC_URL).map(safeRpcHost),
  })

  return client
}

export function describeFailure(source: string, reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason)
  return `${source} could not be loaded: ${message}`
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : undefined
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return value.slice(0, 512)
  }
}

function safeRpcHost(value: string): string {
  try { return new URL(value).host }
  catch { return 'invalid-rpc-url' }
}

function redactAndLimit(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return value.length > 2_000 ? `${value.slice(0, 2_000)}…[truncated]` : value
  if (value instanceof Error) {
    const error = value as Error & UnknownRecord
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
      address: error.address,
      port: error.port,
      cause: redactAndLimit(error.cause, depth + 1),
      errors: redactAndLimit(error.errors, depth + 1),
    }
  }
  if (depth >= 3) return '[max-depth]'
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => redactAndLimit(entry, depth + 1))

  const record = asRecord(value)
  if (!record) return String(value)
  const secretKey = /authorization|cookie|token|secret|password|private.?key|api.?key/i
  return Object.fromEntries(Object.entries(record).slice(0, 40).map(([key, entry]) => [
    key,
    secretKey.test(key) ? '[redacted]' : redactAndLimit(entry, depth + 1),
  ]))
}

/**
 * The SDK wraps Axios failures as ThetanutsError/APIError and puts the original
 * transport error in `cause`. This log is deliberately server-only: callers
 * still receive the existing concise `errors` strings from describeFailure().
 */
function logSourceFailure(source: string, error: unknown) {
  const outer = asRecord(error)
  const cause = outer?.cause
  const causeRecord = asRecord(cause)
  const response = asRecord(causeRecord?.response) ?? asRecord(outer?.response)
  const config = asRecord(causeRecord?.config) ?? asRecord(outer?.config)
  const request = asRecord(causeRecord?.request) ?? asRecord(outer?.request)
  const meta = asRecord(outer?.meta)
  const configuredUrl = typeof config?.url === 'string' ? config.url : undefined
  const baseUrl = typeof config?.baseURL === 'string' ? config.baseURL : undefined
  const resolvedUrl = configuredUrl && baseUrl ? new URL(configuredUrl, baseUrl).toString() : configuredUrl

  const diagnostics = {
    source,
    errorClass: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    sdkCode: outer?.code,
    sdkStatus: outer?.status,
    sdkMeta: redactAndLimit(meta),
    cause: redactAndLimit(cause),
    httpStatus: response?.status ?? outer?.status,
    requestUrl: safeUrl(resolvedUrl ?? (typeof meta?.url === 'string' ? meta.url : undefined)),
    requestMethod: config?.method,
    requestTimeoutMs: config?.timeout,
    responseBody: redactAndLimit(response?.data),
    network: {
      axiosCode: causeRecord?.code ?? outer?.code,
      errno: causeRecord?.errno ?? outer?.errno,
      syscall: causeRecord?.syscall ?? outer?.syscall,
      hostname: causeRecord?.hostname ?? request?.host,
      address: causeRecord?.address,
      port: causeRecord?.port,
    },
  }
  // JSON keeps nested AggregateError connection attempts visible in plain
  // process logs instead of Node collapsing them to `[Array]`.
  console.error('[Thetanuts API] source failure diagnostics', JSON.stringify(diagnostics))
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
    logSourceFailure(source, error)
    throw error
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// One transient failure (a dropped RPC call, a momentary 502 from Thetanuts'
// API) used to kill that source for the whole request with no second chance.
// Wraps loadSource rather than changing it: same timeout/logging behavior per
// attempt, just tried twice before the source is recorded as failed.
async function loadSourceWithRetry<T>(source: string, request: () => Promise<T>): Promise<T> {
  try {
    return await loadSource(source, request)
  } catch (firstError) {
    console.warn(`[Thetanuts API] ${source} failed once, retrying in ${SOURCE_RETRY_DELAY_MS}ms`, firstError)
    await delay(SOURCE_RETRY_DELAY_MS)
    return loadSource(source, request)
  }
}

function findToken(address: string | undefined, client: ThetanutsClient) {
  if (!address) return undefined
  return Object.values(client.chainConfig.tokens).find(
    ({ address: tokenAddress }) => tokenAddress.toLowerCase() === address.toLowerCase(),
  )
}

export function tokenSymbol(address: string | undefined, client: ThetanutsClient) {
  if (!address) return 'Unknown collateral'
  return findToken(address, client)?.symbol ?? `${address.slice(0, 6)}…${address.slice(-4)}`
}

// availableAmount is the maker's raw on-chain collateral balance for this order — reported in
// that collateral token's own decimals (18 for WETH-family, 8 for cbBTC-family, 6 for USDC-family),
// not a fixed protocol-wide scale like price/numContracts. Formatting it with the wrong decimals
// (verified directly against live orders) is off by orders of magnitude, not just imprecise.
function collateralDecimals(address: string | undefined, client: ThetanutsClient): number {
  return findToken(address, client)?.decimals ?? 6
}

export function normalizeOrder(orderWithSignature: OrderWithSignature, client: ThetanutsClient): ExplorerOrder {
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
  const collateralAddress = rawApiData?.collateral ?? order.collateralToken

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
    availableAmount: formatAmount(orderWithSignature.availableAmount, collateralDecimals(collateralAddress, client), 4),
    collateral: tokenSymbol(collateralAddress, client),
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

/** Raw signed orders paired with the same stable IDs used by Markets/Analyze. */
export async function fetchFillOrders(): Promise<Array<{ id: string; order: OrderWithSignature }>> {
  const client = createReadOnlyClient()
  const orders = await loadSource('fetchOrders()', () => client.api.fetchOrders())
  return orders.map((order) => ({ id: normalizeOrder(order, client).id, order }))
}

// client.api.getBookOption() hits Thetanuts' indexer (stateApiUrl), which — verified directly —
// has the same missing-Access-Control-Allow-Origin issue as fetchOrders()'s apiBaseUrl, so
// PortfolioPage.tsx can't call it from the browser either. Its response is already plain JSON
// (strings/numbers/booleans, no bigints), so unlike /api/fill/orders this needs no marshalling.
export async function fetchBookOption(optionAddress: string): Promise<unknown> {
  const client = createReadOnlyClient()
  return loadSource(`getBookOption(${optionAddress})`, () => client.api.getBookOption(optionAddress))
}

async function loadThetanutsDataUncached(): Promise<ThetanutsApiResponse> {
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
    loadSourceWithRetry('fetchOrders()', () => client.api.fetchOrders()),
    loadSourceWithRetry('getMarketData()', () => client.api.getMarketData()),
    loadSourceWithRetry('getBookProtocolStats()', () => client.api.getBookProtocolStats()),
  ])

  if (ordersResult.status === 'fulfilled') data.orders = ordersResult.value.map((order) => normalizeOrder(order, client))
  else errors.push(describeFailure('Live OptionBook orders', ordersResult.reason))

  if (marketResult.status === 'fulfilled') data.marketData = marketResult.value
  else errors.push(describeFailure('Live market data', marketResult.reason))

  if (statsResult.status === 'fulfilled') data.protocolStats = statsResult.value
  else errors.push(describeFailure('Live OptionBook protocol statistics', statsResult.reason))

  return data
}

// Short TTL cache in front of the real fetch: nothing here trades, so a few
// seconds of staleness is fine, and it stops rapid/concurrent frontend
// polling (or several browser tabs) from each re-hitting the SDK and RPC.
// inFlightRequest additionally collapses concurrent callers that land while a
// fetch is already in progress onto that same fetch, rather than each firing
// their own. fetchRawOrders() (the fill flow) deliberately has none of this —
// it backs real trade execution and must stay live.
let cachedData: { value: ThetanutsApiResponse; expiresAt: number } | null = null
let inFlightRequest: Promise<ThetanutsApiResponse> | null = null

export async function loadThetanutsData(): Promise<ThetanutsApiResponse> {
  const now = Date.now()
  if (cachedData && cachedData.expiresAt > now) return cachedData.value
  if (inFlightRequest) return inFlightRequest

  inFlightRequest = loadThetanutsDataUncached()
    .then((value) => {
      cachedData = { value, expiresAt: Date.now() + CACHE_TTL_MS }
      return value
    })
    .finally(() => {
      inFlightRequest = null
    })

  return inFlightRequest
}
