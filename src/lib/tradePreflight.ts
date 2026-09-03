import { OrderExpiredError, type OrderWithSignature, type ThetanutsClient } from '@thetanuts-finance/thetanuts-client'
import { BASE_CHAIN_ID } from './WalletContext'

export interface FillPreview {
  amount: bigint
  numContracts: bigint
  pricePerContract: bigint
  totalCollateral: bigint
  collateralToken: string
}

export interface PreflightInput {
  client: ThetanutsClient | null
  order: OrderWithSignature | null
  amountText: string
  walletConnected: boolean
  baseNetwork: boolean
  nowSeconds?: number
}

export function validateTradePreflight(input: PreflightInput): FillPreview {
  const { client, order, amountText, walletConnected, baseNetwork } = input
  if (!order) throw new Error('This order is no longer available. Select another live order.')
  if (!walletConnected) throw new Error('Connect your wallet before reviewing or confirming this trade.')
  if (!baseNetwork) throw new Error('Switch your wallet to Base before reviewing or confirming this trade.')
  if (!client) throw new Error('The Base trading client is not ready. Reconnect your wallet and try again.')

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const quoteExpiry = order.rawApiData?.orderExpiryTimestamp
  if (Number(order.order.expiry) <= now || (quoteExpiry !== undefined && quoteExpiry <= now)) {
    throw new OrderExpiredError('This live order has expired.')
  }

  let amount: bigint
  try { amount = client.utils.toBigInt(amountText, client.chainConfig.tokens.USDC.decimals) }
  catch { throw new Error('Enter a valid USDC amount greater than 0.') }
  if (amount <= 0n) throw new Error('Enter a USDC amount greater than 0.')

  const requestedContracts = client.optionBook.calculateNumContracts(amount, order.order.price)
  const maxContracts = client.optionBook.calculateMaxContracts(order)
  if (requestedContracts > maxContracts) {
    const maxAmount = maxContracts * order.order.price / 100_000_000n
    const formatted = client.utils.fromBigInt(maxAmount, client.chainConfig.tokens.USDC.decimals)
    throw new Error(`Requested amount exceeds this order's current availability. Enter ${formatted} USDC or less.`)
  }

  const preview = client.optionBook.previewFillOrder(order, amount)
  if (preview.numContracts !== requestedContracts) {
    throw new Error('This order changed while it was being reviewed. Refresh it and try a smaller amount.')
  }
  return { amount, ...preview }
}

export async function assertBaseNetwork(provider: { getNetwork: () => Promise<{ chainId: bigint }> }): Promise<void> {
  const network = await provider.getNetwork()
  if (network.chainId !== BASE_CHAIN_ID) throw new Error('Your wallet is no longer connected to Base. Switch to Base and try again.')
}

export async function ensureTradeAllowance(client: ThetanutsClient, preview: FillPreview) {
  const spender = client.chainConfig.contracts.optionBook
  if (!spender) throw new Error('OptionBook is not deployed on Base.')
  // The order's own collateral token — not always USDC (see orderPayoff.ts's isPremiumUsdSafe).
  // Approving USDC for a WETH/cbBTC-collateralized order would grant allowance on a token
  // fillOrder never touches, leaving the real collateral token unapproved and the fill reverting.
  return client.erc20.ensureAllowance(preview.collateralToken, spender, preview.amount)
}
