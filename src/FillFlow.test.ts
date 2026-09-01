import { describe, expect, it, vi } from 'vitest'
import type { OrderWithSignature, ThetanutsClient } from '@thetanuts-finance/thetanuts-client'
import { computeFillPreview } from './FillFlow'

const MaxUint256 = 2n ** 256n - 1n
const order = { order: { price: 500_000n, expiry: 4_102_444_800n }, rawApiData: { orderExpiryTimestamp: 4_102_444_800 } } as unknown as OrderWithSignature

// A minimal stand-in for ThetanutsClient covering only what computeFillPreview
// touches (client.utils.toBigInt, client.chainConfig.tokens.USDC.decimals,
// client.optionBook.previewFillOrder) — no real SDK/network call involved.
function makeClient() {
  const previewFillOrder = vi.fn((currentOrder: OrderWithSignature, usdcAmount: bigint) => ({
    numContracts: usdcAmount * 100_000_000n / currentOrder.order.price,
    maxContracts: usdcAmount * 100n,
    collateralToken: '0xUSDC',
    pricePerContract: 500_000n,
    totalCollateral: usdcAmount,
  }))
  const toBigInt = (text: string, decimals: number) => BigInt(Math.round(Number(text || '0') * 10 ** decimals))
  const client = {
    utils: { toBigInt, fromBigInt: (value: bigint, decimals: number) => String(Number(value) / 10 ** decimals) },
    chainConfig: { tokens: { USDC: { decimals: 6 } } },
    optionBook: {
      previewFillOrder,
      calculateNumContracts: (amount: bigint, price: bigint) => amount * 100_000_000n / price,
      calculateMaxContracts: () => 10n ** 30n,
    },
  } as unknown as ThetanutsClient
  return { client, previewFillOrder }
}

describe('computeFillPreview', () => {
  // This is the exact bigint that FillFlow.tsx's approve() passes to
  // client.erc20.ensureAllowance() and fill() passes to client.optionBook.fillOrder() —
  // asserting it here is what guarantees the app never approves more than the trade needs.
  it('uses the exact amount the user typed, not an unbounded/MaxUint256 value', () => {
    const { client, previewFillOrder } = makeClient()
    const result = computeFillPreview(client, '12.5', order)

    expect(result.amount).toBe(12_500_000n) // 12.5 USDC at 6 decimals, exactly
    expect(result.amount).not.toBe(MaxUint256)
    expect(previewFillOrder).toHaveBeenCalledWith(order, 12_500_000n)
    expect(result.totalCollateral).toBe(12_500_000n)
  })

  it('scales with the input — the approval is always exactly what was asked for, never a fixed ceiling', () => {
    const { client } = makeClient()
    expect(computeFillPreview(client, '1', order).amount).toBe(1_000_000n)
    expect(computeFillPreview(client, '1000', order).amount).toBe(1_000_000_000n)
  })

  it('rejects a zero or empty amount instead of silently falling through to an unbounded fill', () => {
    const { client } = makeClient()
    expect(() => computeFillPreview(client, '0', order)).toThrow('Enter a USDC amount greater than 0.')
    expect(() => computeFillPreview(client, '', order)).toThrow('Enter a USDC amount greater than 0.')
  })

  it('rejects a negative amount', () => {
    const { client } = makeClient()
    expect(() => computeFillPreview(client, '-5', order)).toThrow('Enter a USDC amount greater than 0.')
  })
})
