import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrowserProvider } from 'ethers'
import {
  ThetanutsClient,
  ContractRevertError,
  InsufficientAllowanceError,
  OrderExpiredError,
  ThetanutsError,
  OptionTypeEnum,
  type OrderWithSignature,
} from '@thetanuts-finance/thetanuts-client'
import { formatExpiry } from './lib/formatters'
import { isUserRejection, useWallet } from './lib/WalletContext'

const STALE_PREVIEW_MS = 30_000

type PreviewResult = ReturnType<ThetanutsClient['optionBook']['previewFillOrder']>

type OrdersState = { loading: boolean; orders: OrderWithSignature[] | null; error: string | null }

type PreviewState = {
  order: OrderWithSignature
  amountBigInt: bigint
  preview: PreviewResult
  timestamp: number
} | null

type TxState =
  | { phase: 'idle' }
  | { phase: 'approving' }
  | { phase: 'approved' }
  | { phase: 'awaiting-signature' }
  | { phase: 'confirming' }
  | { phase: 'success'; hash: string }
  | { phase: 'cancelled' }
  | { phase: 'error'; message: string }

function describeFillError(error: unknown): string {
  if (error instanceof OrderExpiredError) return 'This order expired, please pick another.'
  if (error instanceof ContractRevertError) return 'This order is no longer available — please refresh and pick another.'
  if (error instanceof ThetanutsError) return error.message
  if (error instanceof Error) return error.message
  return 'An unknown error occurred.'
}

// Mirrors the { $bigint: "..." } marshalling in server/index.ts's /api/fill/orders,
// reversing it back into real bigints so previewFillOrder()/fillOrder() get the
// types they expect (order.price, .expiry, .nonce, .strikes, availableAmount, ...).
function parseOrdersWithBigInts(text: string): OrderWithSignature[] {
  return JSON.parse(text, (_key, value) => (
    value && typeof value === 'object' && '$bigint' in value ? BigInt((value as { $bigint: string }).$bigint) : value
  ))
}

function tokenSymbolFor(client: ThetanutsClient, address: string): string {
  const match = Object.values(client.chainConfig.tokens).find((token) => token.address.toLowerCase() === address.toLowerCase())
  return match?.symbol ?? `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * client.optionBook.fillOrder() awaits the mined receipt internally with no
 * progress callback, so we can't tell "MetaMask confirmed" from "still mining"
 * from its return value alone. Tapping ethers' documented "debug" event lets us
 * see the eth_sendTransaction RPC round-trip complete (wallet broadcast the tx)
 * and flip the UI from "waiting on you" to "waiting on the chain".
 */
function watchForBroadcast(provider: BrowserProvider, onBroadcast: () => void): () => void {
  let pendingId: number | null = null
  const onDebug = (info: unknown) => {
    const event = info as { action?: string; payload?: unknown; result?: unknown }
    if (event.action === 'sendRpcPayload') {
      const payloads = Array.isArray(event.payload) ? event.payload : [event.payload]
      const match = (payloads as Array<{ id?: number; method?: string }>).find((p) => p?.method === 'eth_sendTransaction')
      if (match?.id !== undefined) pendingId = match.id
    } else if (event.action === 'receiveRpcResult' && pendingId !== null) {
      const results = Array.isArray(event.result) ? event.result : [event.result]
      const match = (results as Array<{ id?: number; error?: unknown }>).find((r) => r?.id === pendingId)
      if (match && !match.error) {
        onBroadcast()
        pendingId = null
      }
    }
  }
  provider.on('debug', onDebug)
  return () => { provider.off('debug', onDebug) }
}

export default function FillFlow() {
  const { connection, chain, client, connectWallet, switchToBase } = useWallet()
  const [ordersState, setOrdersState] = useState<OrdersState>({ loading: false, orders: null, error: null })
  const [selectedOrder, setSelectedOrder] = useState<OrderWithSignature | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState>(null)
  const [txState, setTxState] = useState<TxState>({ phase: 'idle' })

  const loadOrders = useCallback(async () => {
    if (!client) return
    setOrdersState({ loading: true, orders: null, error: null })
    try {
      // Not client.api.fetchOrders() directly: Thetanuts' orderbook API doesn't
      // send Access-Control-Allow-Origin, so the browser can't read it cross-origin.
      // The local server proxies it (see server/index.ts's /api/fill/orders).
      const response = await fetch('/api/fill/orders', { headers: { Accept: 'application/json' } })
      const text = await response.text()
      if (!response.ok) {
        const body: unknown = JSON.parse(text)
        const message = typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : `Request failed with status ${response.status}`
        throw new Error(message)
      }
      const orders = parseOrdersWithBigInts(text)
      setOrdersState({ loading: false, orders, error: null })
    } catch (error) {
      setOrdersState({ loading: false, orders: null, error: error instanceof Error ? error.message : 'Could not load orders.' })
    }
  }, [client])

  useEffect(() => { if (client) void loadOrders() }, [client, loadOrders])

  // Never let the approve/fill buttons act on a quote older than ~30s: silently
  // re-run the (synchronous, no-network) preview in the background instead of
  // surfacing a "stale" state the user would have to notice and dismiss.
  useEffect(() => {
    if (!client) return
    const interval = setInterval(() => {
      setPreviewState((current) => {
        if (!current || Date.now() - current.timestamp < STALE_PREVIEW_MS) return current
        const refreshed = client.optionBook.previewFillOrder(current.order, current.amountBigInt)
        return { ...current, preview: refreshed, timestamp: Date.now() }
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [client])

  const selectOrder = useCallback((order: OrderWithSignature) => {
    setSelectedOrder(order)
    setAmountInput('')
    setPreviewState(null)
    setPreviewError(null)
    setTxState({ phase: 'idle' })
  }, [])

  const runPreview = useCallback(() => {
    if (!client || !selectedOrder) return
    setPreviewError(null)
    try {
      const amountBigInt = client.utils.toBigInt(amountInput || '0', client.chainConfig.tokens.USDC.decimals)
      if (amountBigInt <= 0n) {
        setPreviewError('Enter a USDC amount greater than 0.')
        setPreviewState(null)
        return
      }
      const preview = client.optionBook.previewFillOrder(selectedOrder, amountBigInt)
      setPreviewState({ order: selectedOrder, amountBigInt, preview, timestamp: Date.now() })
      setTxState({ phase: 'idle' })
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Could not preview this fill.')
      setPreviewState(null)
    }
  }, [client, selectedOrder, amountInput])

  const fillOnceRef = useRef<() => Promise<{ hash: string }>>(null)
  fillOnceRef.current = async () => {
    if (!client || connection.status !== 'connected' || !previewState) throw new Error('Not ready to fill.')
    setTxState({ phase: 'awaiting-signature' })
    const stopWatching = watchForBroadcast(connection.provider, () => setTxState({ phase: 'confirming' }))
    try {
      return await client.optionBook.fillOrder(previewState.order, previewState.amountBigInt)
    } finally {
      stopWatching()
    }
  }

  const handleApprove = useCallback(async () => {
    if (!client || !previewState) return
    const optionBookAddress = client.chainConfig.contracts.optionBook
    if (!optionBookAddress) {
      setTxState({ phase: 'error', message: 'OptionBook is not deployed on this chain.' })
      return
    }
    setTxState({ phase: 'approving' })
    try {
      // Approve the EXACT fill amount, never MaxUint256. This is a deliberate
      // constraint — it caps what OptionBook can ever pull to this one fill —
      // not a shortcut we forgot to widen.
      await client.erc20.ensureAllowance(client.chainConfig.tokens.USDC.address, optionBookAddress, previewState.amountBigInt)
      setTxState({ phase: 'approved' })
    } catch (error) {
      setTxState(isUserRejection(error) ? { phase: 'cancelled' } : { phase: 'error', message: describeFillError(error) })
    }
  }, [client, previewState])

  const handleFillOrder = useCallback(async () => {
    if (!fillOnceRef.current) return
    try {
      const receipt = await fillOnceRef.current()
      setTxState({ phase: 'success', hash: receipt.hash })
    } catch (error) {
      if (isUserRejection(error)) {
        setTxState({ phase: 'cancelled' })
        return
      }
      if (error instanceof InsufficientAllowanceError && client && previewState) {
        const optionBookAddress = client.chainConfig.contracts.optionBook
        try {
          setTxState({ phase: 'approving' })
          if (!optionBookAddress) throw new Error('OptionBook is not deployed on this chain.')
          await client.erc20.ensureAllowance(client.chainConfig.tokens.USDC.address, optionBookAddress, previewState.amountBigInt)
          const receipt = await fillOnceRef.current()
          setTxState({ phase: 'success', hash: receipt.hash })
        } catch (retryError) {
          setTxState(isUserRejection(retryError) ? { phase: 'cancelled' } : { phase: 'error', message: describeFillError(retryError) })
        }
        return
      }
      setTxState({ phase: 'error', message: describeFillError(error) })
    }
  }, [client, previewState])

  if (connection.status === 'no-wallet') {
    return (
      <div style={styles.card}>
        <h2 style={styles.heading}>Fill an OptionBook order</h2>
        <p style={styles.muted}>No wallet extension was found in this browser.</p>
        <a href="https://metamask.io" target="_blank" rel="noreferrer" style={styles.primaryButtonLink}>Install MetaMask</a>
      </div>
    )
  }

  if (connection.status !== 'connected') {
    return (
      <div style={styles.card}>
        <h2 style={styles.heading}>Fill an OptionBook order</h2>
        {connection.status === 'cancelled' && <p style={styles.muted}>Connection cancelled. You can try again whenever you're ready.</p>}
        {connection.status === 'disconnected' && connection.error && <p style={styles.error}>{connection.error}</p>}
        <button style={styles.primaryButton} disabled={connection.status === 'connecting'} onClick={() => void connectWallet()}>
          {connection.status === 'connecting' ? 'Connecting…' : 'Connect MetaMask'}
        </button>
      </div>
    )
  }

  if (chain.status !== 'correct') {
    return (
      <div style={styles.card}>
        <h2 style={styles.heading}>Fill an OptionBook order</h2>
        <p style={styles.muted}>Connected as {connection.address}.</p>
        <p style={styles.error}>This flow only works on Base mainnet. Switch networks to continue.</p>
        {chain.status === 'wrong' && chain.message && <p style={styles.error}>{chain.message}</p>}
        <button style={styles.primaryButton} disabled={chain.status === 'switching'} onClick={() => void switchToBase()}>
          {chain.status === 'switching' ? 'Switching…' : 'Switch to Base'}
        </button>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.heading}>Fill an OptionBook order</h2>
      <p style={styles.muted}>Connected as {connection.address} on Base.</p>

      <section style={styles.section}>
        <div style={styles.rowBetween}>
          <h3 style={styles.subheading}>Open orders</h3>
          <button style={styles.linkButton} onClick={() => void loadOrders()} disabled={ordersState.loading}>
            {ordersState.loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {ordersState.error && <p style={styles.error}>{ordersState.error}</p>}
        {ordersState.orders && ordersState.orders.length === 0 && <p style={styles.muted}>No open orders right now.</p>}
        {ordersState.orders && ordersState.orders.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Strike</th>
                <th style={styles.th}>Expiry</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {ordersState.orders.map((entry, index) => {
                const strikes = entry.order.strikes ?? (entry.order.strikePrice !== undefined ? [entry.order.strikePrice] : [])
                const strikeLabel = strikes.length > 0
                  ? strikes.map((strike) => `$${client ? client.utils.fromBigInt(strike, 8) : strike.toString()}`).join(' / ')
                  : 'Unavailable'
                const typeLabel = entry.order.optionType !== undefined ? OptionTypeEnum[entry.order.optionType] ?? 'Unknown' : 'Unknown'
                const isSelected = selectedOrder === entry
                return (
                  <tr key={`${entry.order.nonce}-${index}`} style={isSelected ? styles.trSelected : undefined}>
                    <td style={styles.td}>{strikeLabel}</td>
                    <td style={styles.td}>{formatExpiry(entry.order.expiry)}</td>
                    <td style={styles.td}>{typeLabel}</td>
                    <td style={styles.td}>
                      <button style={styles.linkButton} onClick={() => selectOrder(entry)}>{isSelected ? 'Selected' : 'Select'}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {selectedOrder && client && (
        <section style={styles.section}>
          <h3 style={styles.subheading}>Preview fill</h3>
          <label style={styles.label}>
            Amount to spend (USDC)
            <input
              style={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
            />
          </label>
          <button style={styles.secondaryButton} onClick={runPreview}>Preview fill</button>
          {previewError && <p style={styles.error}>{previewError}</p>}

          {previewState && (
            <div style={styles.previewBox}>
              <div><strong>Contracts:</strong> {client.utils.fromBigInt(previewState.preview.numContracts, 6)}</div>
              <div><strong>Price per contract:</strong> {client.utils.fromBigInt(previewState.preview.pricePerContract, 8)} USDC</div>
              <div><strong>Total collateral:</strong> {client.utils.fromBigInt(previewState.preview.totalCollateral, 6)} USDC</div>
              <div><strong>Collateral token:</strong> {tokenSymbolFor(client, previewState.preview.collateralToken)}</div>

              <div style={styles.actions}>
                <button
                  style={styles.primaryButton}
                  disabled={txState.phase === 'approving' || txState.phase === 'approved' || txState.phase === 'awaiting-signature' || txState.phase === 'confirming'}
                  onClick={() => void handleApprove()}
                >
                  {txState.phase === 'approving' ? 'Confirm approval in MetaMask…' : txState.phase === 'approved' ? 'Approved' : '1. Approve USDC'}
                </button>
                <button
                  style={styles.primaryButton}
                  disabled={txState.phase !== 'approved'}
                  onClick={() => void handleFillOrder()}
                >
                  {txState.phase === 'awaiting-signature' ? 'Confirm in MetaMask…' : txState.phase === 'confirming' ? 'Confirming transaction…' : '2. Fill order'}
                </button>
              </div>

              {txState.phase === 'cancelled' && <p style={styles.muted}>Cancelled — nothing was sent.</p>}
              {txState.phase === 'error' && <p style={styles.error}>{txState.message}</p>}
              {txState.phase === 'success' && (
                <p style={styles.success}>
                  Filled! <a href={`https://basescan.org/tx/${txState.hash}`} target="_blank" rel="noreferrer">View on Basescan</a>
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { maxWidth: 640, margin: '0 auto', padding: 24, border: '1px solid #333', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 },
  heading: { margin: 0 },
  subheading: { margin: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  muted: { color: '#888', margin: 0 },
  error: { color: '#e5484d', margin: 0 },
  success: { color: '#2fa86e', margin: 0 },
  rowBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  primaryButton: { padding: '10px 16px', borderRadius: 8, border: 'none', background: '#5b6ee1', color: '#fff', cursor: 'pointer' },
  primaryButtonLink: { padding: '10px 16px', borderRadius: 8, background: '#5b6ee1', color: '#fff', textDecoration: 'none', width: 'fit-content' },
  secondaryButton: { padding: '8px 14px', borderRadius: 8, border: '1px solid #5b6ee1', background: 'transparent', color: '#5b6ee1', cursor: 'pointer', width: 'fit-content' },
  linkButton: { border: 'none', background: 'transparent', color: '#5b6ee1', cursor: 'pointer', padding: 0 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', borderBottom: '1px solid #333', padding: '6px 8px' },
  td: { borderBottom: '1px solid #222', padding: '6px 8px' },
  trSelected: { background: 'rgba(91, 110, 225, 0.12)' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 },
  input: { padding: 8, borderRadius: 6, border: '1px solid #333', background: 'transparent', color: 'inherit' },
  previewBox: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid #333', borderRadius: 8 },
  actions: { display: 'flex', gap: 8 },
}
