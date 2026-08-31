import { useCallback, useEffect, useState } from 'react'
import { formatAmount } from '@thetanuts-finance/thetanuts-client'
import { formatExpiry } from '../lib/formatters'
import { truncateAddress, useWallet } from '../lib/WalletContext'
import { fetchTakerFills, type TakerFill } from '../lib/orderFillEvents'

// Loosely typed on purpose: client.api.getBookOption()'s real response (verified directly
// against a live position) has far more fields than the SDK's own BookOptionDetail type
// declares (that type is `{ optionAddress, optionStatus, settlement, pnl, [key: string]: unknown }`).
// Every field read here is optional and falls back to a placeholder rather than guessed data.
interface BookOptionDetail {
  optionStatus?: string
  underlyingAsset?: string
  implementationName?: string
  implementationType?: string
  strikes?: string[]
  expiryTimestamp?: number
  entryPrice?: string
  entryPremium?: string
  numContracts?: string
  amount?: string
  collateralSymbol?: string
  collateralDecimals?: number
}

type DetailState =
  | { status: 'loading' }
  | { status: 'loaded'; detail: BookOptionDetail }
  | { status: 'error'; message: string }

interface PositionRow {
  fill: TakerFill
  detail: DetailState
}

type PositionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; rows: PositionRow[]; searchedFromBlock: number; reachedDeploymentBlock: boolean }
  | { status: 'error'; message: string }

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  closed: 'Closed',
  'expired-awaiting-settlement': 'Awaiting settlement',
  'settled-itm': 'Settled (ITM)',
  'settled-otm': 'Settled (OTM)',
}

async function fetchOptionDetail(optionAddress: string): Promise<BookOptionDetail> {
  const response = await fetch(`/api/portfolio/option/${optionAddress}`, { headers: { Accept: 'application/json' } })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : `Request failed with status ${response.status}`
    throw new Error(message)
  }
  return (body ?? {}) as BookOptionDetail
}

async function loadDetailsFor(fills: TakerFill[]): Promise<PositionRow[]> {
  const results = await Promise.allSettled(fills.map((fill) => fetchOptionDetail(fill.optionAddress)))
  return fills.map((fill, index) => {
    const result = results[index]
    const detail: DetailState = result.status === 'fulfilled'
      ? { status: 'loaded', detail: result.value }
      : { status: 'error', message: result.reason instanceof Error ? result.reason.message : 'Could not load this position\'s details.' }
    return { fill, detail }
  })
}

export default function PortfolioPage() {
  const { connection, chain, client, connectWallet, switchToBase } = useWallet()
  const [positions, setPositions] = useState<PositionsState>({ status: 'idle' })

  const runSearch = useCallback(async (untilBlock: number, append: boolean) => {
    if (connection.status !== 'connected' || !client) return
    const optionBookAddress = client.chainConfig.contracts.optionBook
    if (!optionBookAddress) {
      setPositions({ status: 'error', message: 'OptionBook is not deployed on this chain.' })
      return
    }
    setPositions((current) => (append && current.status === 'loaded' ? current : { status: 'loading' }))
    try {
      const result = await fetchTakerFills(connection.provider, optionBookAddress, connection.address, untilBlock, client.chainConfig.deploymentBlock)
      const newRows = await loadDetailsFor(result.fills)
      setPositions((current) => {
        const priorRows = append && current.status === 'loaded' ? current.rows : []
        return {
          status: 'loaded',
          rows: [...priorRows, ...newRows],
          searchedFromBlock: result.searchedFromBlock,
          reachedDeploymentBlock: result.reachedDeploymentBlock,
        }
      })
    } catch (error) {
      setPositions({ status: 'error', message: error instanceof Error ? error.message : 'Could not load your positions.' })
    }
  }, [connection, client])

  // Kicks off the initial search whenever a fresh client appears (wallet connects, or
  // reconnects on a new address/chain). Deliberately keyed on `client`'s identity alone,
  // not `runSearch` — WalletContext rebuilds the client on every connection/chain change,
  // so this already reruns exactly when it should.
  useEffect(() => {
    if (connection.status !== 'connected' || chain.status !== 'correct' || !client) return
    void connection.provider.getBlockNumber().then((latest) => runSearch(latest, false))
  }, [client])

  const searchFurtherBack = () => {
    if (positions.status === 'loaded') void runSearch(positions.searchedFromBlock - 1, true)
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">THETANUTS FINANCE × BASE</p>
          <h1>Portfolio</h1>
          <p className="intro">Your real, on-chain OptionBook fills on Base — read-only, resolved directly from the connected wallet and Thetanuts' indexer.</p>
        </div>
      </header>

      {connection.status === 'no-wallet' && (
        <section className="section order-section" aria-labelledby="portfolio-heading">
          <div className="section-heading"><div><p className="eyebrow">WALLET</p><h2 id="portfolio-heading">Connect your wallet to see your positions</h2></div></div>
          <div className="empty-state">
            No wallet extension was found in this browser.{' '}
            <a href="https://metamask.io" target="_blank" rel="noreferrer">Install MetaMask</a> to continue.
          </div>
        </section>
      )}

      {(connection.status === 'disconnected' || connection.status === 'connecting' || connection.status === 'cancelled') && (
        <section className="section order-section" aria-labelledby="portfolio-heading">
          <div className="section-heading"><div><p className="eyebrow">WALLET</p><h2 id="portfolio-heading">Connect your wallet to see your positions</h2></div></div>
          {connection.status === 'cancelled' && <p className="modal-subtext">Connection cancelled — try again whenever you're ready.</p>}
          {connection.status === 'disconnected' && connection.error && <p className="modal-subtext">{connection.error}</p>}
          <button type="button" className="modal-primary" disabled={connection.status === 'connecting'} onClick={() => void connectWallet()}>
            {connection.status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </section>
      )}

      {connection.status === 'connected' && chain.status !== 'correct' && (
        <section className="section order-section" aria-labelledby="portfolio-heading">
          <div className="section-heading"><div><p className="eyebrow">WALLET</p><h2 id="portfolio-heading">Switch to Base to see your positions</h2></div></div>
          <p className="modal-subtext">Connected as {truncateAddress(connection.address)}. This page only reads positions on Base mainnet.</p>
          {chain.status === 'wrong' && chain.message && <p className="modal-subtext">{chain.message}</p>}
          <button type="button" className="modal-primary" disabled={chain.status === 'switching'} onClick={() => void switchToBase()}>
            {chain.status === 'switching' ? 'Switching…' : 'Switch to Base'}
          </button>
        </section>
      )}

      {connection.status === 'connected' && chain.status === 'correct' && (
        <section className="section order-section" aria-labelledby="portfolio-heading">
          <div className="section-heading">
            <div><p className="eyebrow">YOUR POSITIONS</p><h2 id="portfolio-heading">{truncateAddress(connection.address)} on Base</h2></div>
          </div>

          {(positions.status === 'idle' || positions.status === 'loading') && (
            <div className="empty-state"><span className="loader" />Loading your on-chain fills…</div>
          )}

          {positions.status === 'error' && <p className="modal-subtext pnl-negative">{positions.message}</p>}

          {positions.status === 'loaded' && positions.rows.length === 0 && (
            <div className="empty-state">No positions yet — fills you take on the OptionBook will show up here.</div>
          )}

          {positions.status === 'loaded' && positions.rows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th><th>Type</th><th>Strike(s)</th><th>Expiry (UTC)</th>
                    <th>Entry price paid</th><th>Contracts</th><th>Status</th><th aria-label="Transaction" />
                  </tr>
                </thead>
                <tbody>
                  {positions.rows.map((row) => <PositionTableRow key={row.fill.transactionHash + row.fill.logIndex} row={row} />)}
                </tbody>
              </table>
            </div>
          )}

          {positions.status === 'loaded' && (
            <p className="modal-subtext">
              {positions.reachedDeploymentBlock
                ? 'Searched the full OptionBook history on Base.'
                : `Searched back to block ${positions.searchedFromBlock.toLocaleString()}.`}
            </p>
          )}
          {positions.status === 'loaded' && !positions.reachedDeploymentBlock && (
            <button type="button" className="preview-button" onClick={searchFurtherBack}>Search further back</button>
          )}
        </section>
      )}
    </main>
  )
}

function PositionTableRow({ row }: { row: PositionRow }) {
  const { fill, detail } = row

  if (detail.status === 'loading') {
    return <tr><td colSpan={8}><span className="loader" />Loading position details…</td></tr>
  }
  if (detail.status === 'error') {
    return <tr>
      <td colSpan={7} className="numeric">{detail.message}</td>
      <td><a href={`https://basescan.org/tx/${fill.transactionHash}`} target="_blank" rel="noreferrer">Tx ↗</a></td>
    </tr>
  }

  const info = detail.detail
  const typeLabel = info.implementationType === 'SPREAD' ? `${info.implementationName ?? 'SPREAD'}` : (info.implementationName ?? 'Unknown')
  const collateralDecimals = info.collateralDecimals ?? 6
  const entryPriceRaw = info.entryPrice ?? info.entryPremium
  const numContractsRaw = info.numContracts ?? info.amount
  const statusRaw = info.optionStatus
  const statusLabel = statusRaw ? (STATUS_LABELS[statusRaw] ?? statusRaw) : 'Unknown'

  return <tr>
    <td><strong className="asset-name">{info.underlyingAsset ?? 'Unavailable'}</strong></td>
    <td><span className={`option-type ${(info.implementationName ?? '').toLowerCase().includes('put') ? 'put' : 'call'}`}>{typeLabel}</span></td>
    <td className="numeric">{info.strikes?.length ? info.strikes.map((strike) => `$${formatAmount(BigInt(strike), 8, 2)}`).join(' / ') : 'Unavailable'}</td>
    <td>{info.expiryTimestamp !== undefined ? formatExpiry(String(info.expiryTimestamp)) : 'Unavailable'}</td>
    <td className="numeric">{entryPriceRaw !== undefined ? `${formatAmount(BigInt(entryPriceRaw), collateralDecimals, 6)} ${info.collateralSymbol ?? ''}` : 'Unavailable'}</td>
    <td className="numeric">{numContractsRaw !== undefined ? formatAmount(BigInt(numContractsRaw), 6, 4) : 'Unavailable'}</td>
    <td>{statusLabel}</td>
    <td><a href={`https://basescan.org/tx/${fill.transactionHash}`} target="_blank" rel="noreferrer">Tx ↗</a></td>
  </tr>
}
