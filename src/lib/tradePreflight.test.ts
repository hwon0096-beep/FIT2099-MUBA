import { describe, expect, it, vi } from 'vitest'
import type { OrderWithSignature, ThetanutsClient } from '@thetanuts-finance/thetanuts-client'
import { assertBaseNetwork, ensureTradeAllowance, validateTradePreflight } from './tradePreflight'

const future = 4_102_444_800

function makeOrder(availableContracts = 2_000_000_000n, expiry = future): OrderWithSignature {
  return {
    order: { price: 500_000_000n, expiry: BigInt(expiry) },
    rawApiData: { orderExpiryTimestamp: expiry },
    availableAmount: availableContracts,
  } as unknown as OrderWithSignature
}

function makeClient(options: { previewError?: Error; allowanceResult?: unknown; collateralToken?: string } = {}) {
  const ensureAllowance = vi.fn().mockResolvedValue(options.allowanceResult ?? null)
  const previewFillOrder = vi.fn((order: OrderWithSignature, amount: bigint) => {
    if (options.previewError) throw options.previewError
    const requested = amount * 100_000_000n / order.order.price
    const maximum = order.availableAmount
    return { numContracts: requested > maximum ? maximum : requested, maxContracts: maximum, pricePerContract: order.order.price, totalCollateral: amount, collateralToken: options.collateralToken ?? '0xUSDC' }
  })
  const client = {
    utils: {
      toBigInt: (text: string, decimals: number) => {
        const value = Number(text)
        if (!Number.isFinite(value)) throw new Error('invalid')
        return BigInt(Math.round(value * 10 ** decimals))
      },
      fromBigInt: (value: bigint, decimals: number) => String(Number(value) / 10 ** decimals),
    },
    chainConfig: { tokens: { USDC: { decimals: 6, address: '0xUSDC' } }, contracts: { optionBook: '0xBOOK' } },
    optionBook: {
      calculateNumContracts: (amount: bigint, price: bigint) => amount * 100_000_000n / price,
      calculateMaxContracts: (order: OrderWithSignature) => order.availableAmount,
      previewFillOrder,
    },
    erc20: { ensureAllowance },
  } as unknown as ThetanutsClient
  return { client, ensureAllowance, previewFillOrder }
}

const input = (client: ThetanutsClient, order: OrderWithSignature | null, amountText = '5') => ({
  client, order, amountText, walletConnected: true, baseNetwork: true, nowSeconds: 2_000_000_000,
})

describe('trade pre-flight validation', () => {
  it('accepts a valid trade and previews the requested amount', () => {
    const { client, previewFillOrder } = makeClient()
    const order = makeOrder()
    const result = validateTradePreflight(input(client, order))
    expect(result.amount).toBe(5_000_000n)
    expect(previewFillOrder).toHaveBeenCalledWith(order, 5_000_000n)
  })

  it.each(['', '0', '-1', 'not-a-number'])('rejects invalid amount %j', (amountText) => {
    const { client } = makeClient()
    expect(() => validateTradePreflight(input(client, makeOrder(), amountText))).toThrow(/valid USDC amount|greater than 0/)
  })

  it('rejects an amount exceeding current availability and reports the latest maximum', () => {
    const { client } = makeClient()
    expect(() => validateTradePreflight(input(client, makeOrder(1_000_000n), '6'))).toThrow(/5 USDC or less/)
  })

  it('rejects an expired option or quote', () => {
    const { client } = makeClient()
    expect(() => validateTradePreflight(input(client, makeOrder(2_000_000_000n, 1_999_999_999)))).toThrow(/expired/i)
  })

  it('rejects an order that disappeared before confirmation', () => {
    const { client } = makeClient()
    expect(() => validateTradePreflight(input(client, null))).toThrow(/no longer available/i)
  })

  it('rejects a disconnected wallet', () => {
    const { client } = makeClient()
    expect(() => validateTradePreflight({ ...input(client, makeOrder()), walletConnected: false })).toThrow(/Connect your wallet/)
  })

  it('rejects the wrong network and verifies the provider immediately', async () => {
    const { client } = makeClient()
    expect(() => validateTradePreflight({ ...input(client, makeOrder()), baseNetwork: false })).toThrow(/Switch your wallet to Base/)
    await expect(assertBaseNetwork({ getNetwork: async () => ({ chainId: 1n }) })).rejects.toThrow(/no longer connected to Base/)
  })

  it('uses the existing exact-amount allowance flow when allowance is insufficient', async () => {
    const approval = { hash: '0xapproval' }
    const { client, ensureAllowance } = makeClient({ allowanceResult: approval })
    const preview = validateTradePreflight(input(client, makeOrder()))
    await expect(ensureTradeAllowance(client, preview)).resolves.toBe(approval)
    expect(ensureAllowance).toHaveBeenCalledWith('0xUSDC', '0xBOOK', 5_000_000n)
  })

  it('approves the order\'s own collateral token, not USDC, when the order is collateralized in something else', async () => {
    const { client, ensureAllowance } = makeClient({ collateralToken: '0xWETH' })
    const preview = validateTradePreflight(input(client, makeOrder()))
    await ensureTradeAllowance(client, preview)
    expect(ensureAllowance).toHaveBeenCalledWith('0xWETH', '0xBOOK', 5_000_000n)
  })

  it('surfaces previewFillOrder failure and never produces an executable preview', () => {
    const { client } = makeClient({ previewError: new Error('Preview simulation failed') })
    expect(() => validateTradePreflight(input(client, makeOrder()))).toThrow('Preview simulation failed')
  })

  it('rejects when availability drops between review and final execution', () => {
    const { client } = makeClient()
    expect(validateTradePreflight(input(client, makeOrder(2_000_000n), '5')).amount).toBe(5_000_000n)
    expect(() => validateTradePreflight(input(client, makeOrder(500_000n), '5'))).toThrow(/current availability/)
  })
})
