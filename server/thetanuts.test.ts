import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getChainConfigById, type OrderWithSignature, type ThetanutsClient } from '@thetanuts-finance/thetanuts-client'
import { describeFailure, normalizeOrder, tokenSymbol } from './thetanuts.js'

const chainConfig = getChainConfigById(8453)
// tokenSymbol/normalizeOrder only ever touch client.chainConfig — a real chain
// config (for realistic token symbols) on a stub is enough, no live client needed.
const fakeClient = { chainConfig } as unknown as ThetanutsClient

function makeOrderWithSignature(overrides: {
  maker?: string
  nonce?: bigint
  expiry?: bigint
  price?: bigint
  numContracts?: bigint
  strikes?: bigint[]
  isCall?: boolean
  collateral?: string
  withRawApiData?: boolean
} = {}): OrderWithSignature {
  const maker = overrides.maker ?? '0x000000000000000000000000000000000000A1'
  const nonce = overrides.nonce ?? 1n
  const expiry = overrides.expiry ?? 1_800_000_000n
  const price = overrides.price ?? 50_000_000n
  const numContracts = overrides.numContracts ?? 1_000_000n
  const strikes = overrides.strikes ?? [200_000_000_000n]
  const isCall = overrides.isCall ?? true
  const collateral = overrides.collateral ?? '0x000000000000000000000000000000000000B2'

  return {
    order: {
      maker,
      taker: '0x0000000000000000000000000000000000dEaD',
      option: '',
      isBuyer: true,
      numContracts,
      price,
      expiry,
      nonce,
      strikes,
    },
    signature: '0xsignature',
    availableAmount: numContracts,
    makerAddress: maker,
    rawApiData: overrides.withRawApiData === false ? undefined : {
      collateral,
      priceFeed: '0x000000000000000000000000000000000000C3',
      implementation: '0x000000000000000000000000000000000000D4',
      strikes: strikes.map((strike) => strike.toString()),
      isCall,
      isLong: false,
      orderExpiryTimestamp: Number(expiry),
      extraOptionData: '0x',
      maxCollateralUsable: numContracts.toString(),
    },
  }
}

describe('describeFailure', () => {
  it('includes the source name and an Error reason\'s message', () => {
    expect(describeFailure('Live market data', new Error('timed out'))).toBe('Live market data could not be loaded: timed out')
  })

  it('stringifies a non-Error reason', () => {
    expect(describeFailure('Live market data', 'plain string reason')).toBe('Live market data could not be loaded: plain string reason')
  })
})

describe('tokenSymbol', () => {
  it('returns "Unknown collateral" for an undefined address', () => {
    expect(tokenSymbol(undefined, fakeClient)).toBe('Unknown collateral')
  })

  it('resolves a known token address to its symbol, case-insensitively', () => {
    const usdc = chainConfig.tokens.USDC
    expect(tokenSymbol(usdc.address.toUpperCase(), fakeClient)).toBe('USDC')
  })

  it('falls back to a truncated address for an unrecognized token', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678'
    expect(tokenSymbol(address, fakeClient)).toBe('0x1234…5678')
  })
})

describe('normalizeOrder', () => {
  // The comment above normalizeOrder's `id` field warns that order.nonce alone
  // collides across an order's legs (a call/put pair sharing one signature
  // nonce) — this is the regression test for that: same maker+nonce, opposite
  // side, must still produce distinct ids.
  it('gives two legs sharing a maker+nonce (a call/put pair) distinct ids', () => {
    const call = makeOrderWithSignature({ maker: '0xSameMaker', nonce: 7n, isCall: true })
    const put = makeOrderWithSignature({ maker: '0xSameMaker', nonce: 7n, isCall: false })

    expect(normalizeOrder(call, fakeClient).id).not.toBe(normalizeOrder(put, fakeClient).id)
  })

  it('produces the same id for identical input (deterministic, not random)', () => {
    const orderA = makeOrderWithSignature({ maker: '0xSameMaker', nonce: 7n })
    const orderB = makeOrderWithSignature({ maker: '0xSameMaker', nonce: 7n })

    expect(normalizeOrder(orderA, fakeClient).id).toBe(normalizeOrder(orderB, fakeClient).id)
  })

  it('derives optionType from rawApiData.isCall, and UNKNOWN when rawApiData is missing', () => {
    expect(normalizeOrder(makeOrderWithSignature({ isCall: true }), fakeClient).optionType).toBe('CALL')
    expect(normalizeOrder(makeOrderWithSignature({ isCall: false }), fakeClient).optionType).toBe('PUT')
    expect(normalizeOrder(makeOrderWithSignature({ withRawApiData: false }), fakeClient).optionType).toBe('UNKNOWN')
  })

  it('falls back to strikePrice when strikes is absent, and to "Not supplied" when both are', () => {
    const withStrikePriceOnly = makeOrderWithSignature()
    withStrikePriceOnly.order.strikes = undefined
    withStrikePriceOnly.order.strikePrice = 150_000_000_000n

    const withNeither = makeOrderWithSignature()
    withNeither.order.strikes = undefined

    expect(normalizeOrder(withStrikePriceOnly, fakeClient).strikes).toMatch(/^\$/)
    expect(normalizeOrder(withNeither, fakeClient).strikes).toBe('Not supplied')
  })

  it('resolves collateral through tokenSymbol', () => {
    const usdc = chainConfig.tokens.USDC
    const order = makeOrderWithSignature({ collateral: usdc.address })
    expect(normalizeOrder(order, fakeClient).collateral).toBe('USDC')
  })

  // availableAmount is a raw on-chain balance in the collateral token's own decimals (18 for
  // WETH, not the 6 used elsewhere for USDC-denominated price/numContracts) — formatting it at
  // a fixed 6 decimals understates an 18-decimal balance by a factor of a trillion.
  it('formats availableAmount using the collateral token\'s own decimals, not a fixed 6', () => {
    const weth = chainConfig.tokens.WETH
    const order = makeOrderWithSignature({ collateral: weth.address })
    order.availableAmount = 4_162_850_720_173_174_589n // ~4.1628 WETH, raw 18-decimal
    expect(normalizeOrder(order, fakeClient).availableAmount).toBe('4.1628')
  })

  it('falls back to 6 decimals for an unrecognized collateral token', () => {
    const order = makeOrderWithSignature({ collateral: '0x1234567890abcdef1234567890abcdef12345678' })
    order.availableAmount = 5_000_000n
    expect(normalizeOrder(order, fakeClient).availableAmount).toBe('5')
  })
})

// loadThetanutsData()'s Promise.allSettled -> errors[] aggregation, now wrapped
// in a retry-per-source and a TTL cache. ThetanutsClient is mocked so no real
// network/RPC call happens; vi.resetModules() + a fresh dynamic import per
// test sidesteps the module-level cache (cachedData/inFlightRequest) rather
// than exporting a test-only reset hook into production code.
const fetchOrders = vi.fn()
const getMarketData = vi.fn()
const getBookProtocolStats = vi.fn()

vi.mock('@thetanuts-finance/thetanuts-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@thetanuts-finance/thetanuts-client')>()
  return {
    ...actual,
    // `new ThetanutsClient(...)` requires something constructible — an arrow
    // function can't be `new`-ed (vitest logs a warning and the mock throws
    // "is not a constructor"), so this has to be a plain function, not
    // mockImplementation(() => ({...})).
    ThetanutsClient: vi.fn().mockImplementation(function ThetanutsClientMock() {
      return {
        chainConfig: actual.getChainConfigById(8453),
        api: { fetchOrders, getMarketData, getBookProtocolStats },
      }
    }),
  }
})

describe('loadThetanutsData error aggregation', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchOrders.mockReset()
    getMarketData.mockReset()
    getBookProtocolStats.mockReset()
  })

  it('records one error for a source that still fails after its retry, keeps the others', async () => {
    fetchOrders.mockResolvedValue([])
    getMarketData.mockRejectedValue(new Error('market down'))
    getBookProtocolStats.mockResolvedValue({
      stats: { totalVolumeUsd: '0', totalPremiumUsd: '0', totalPositions: 0, '24h': { positions: 0 } },
    })

    const { loadThetanutsData } = await import('./thetanuts.js')
    const result = await loadThetanutsData()

    expect(result.orders).toEqual([])
    expect(result.marketData).toBeUndefined()
    expect(result.protocolStats).toBeDefined()
    expect(result.errors).toEqual(['Live market data could not be loaded: market down'])
    expect(getMarketData).toHaveBeenCalledTimes(2)
  })

  it('recovers a source that fails once but succeeds on its retry — no error recorded', async () => {
    fetchOrders.mockResolvedValue([])
    getMarketData.mockRejectedValueOnce(new Error('flaky')).mockResolvedValueOnce({
      prices: { ETH: 1, BTC: 1 },
      metadata: { lastUpdated: 0 },
    })
    getBookProtocolStats.mockResolvedValue({
      stats: { totalVolumeUsd: '0', totalPremiumUsd: '0', totalPositions: 0, '24h': { positions: 0 } },
    })

    const { loadThetanutsData } = await import('./thetanuts.js')
    const result = await loadThetanutsData()

    expect(result.errors).toEqual([])
    expect(result.marketData).toBeDefined()
    expect(getMarketData).toHaveBeenCalledTimes(2)
  })

  // A source that never settles (a hung RPC/HTTP call) must still be bounded by
  // the per-source 12s timeout rather than hanging loadThetanutsData() forever.
  // Fake timers turn the real 2x12s (attempt + one retry) into an instant test.
  it('times out a source that never resolves, after both attempts, without hanging', async () => {
    vi.useFakeTimers()
    try {
      fetchOrders.mockResolvedValue([])
      getMarketData.mockImplementation(() => new Promise(() => {}))
      getBookProtocolStats.mockResolvedValue({
        stats: { totalVolumeUsd: '0', totalPremiumUsd: '0', totalPositions: 0, '24h': { positions: 0 } },
      })

      const { loadThetanutsData } = await import('./thetanuts.js')
      const pending = loadThetanutsData()

      await vi.advanceTimersByTimeAsync(12_000) // first attempt's timeout fires
      await vi.advanceTimersByTimeAsync(250) // retry delay
      await vi.advanceTimersByTimeAsync(12_000) // retried attempt's timeout fires

      const result = await pending
      expect(result.marketData).toBeUndefined()
      expect(result.orders).toEqual([])
      expect(result.protocolStats).toBeDefined()
      expect(result.errors).toEqual(['Live market data could not be loaded: getMarketData() timed out after 12 seconds'])
      expect(getMarketData).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
