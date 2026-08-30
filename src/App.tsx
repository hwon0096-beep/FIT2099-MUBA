import { useCallback, useEffect, useState } from 'react'
import { formatExpiry, formatTimestamp, formatUsd } from './lib/formatters'
import { loadExplorerData, type ExplorerData } from './lib/thetanuts'

function App() {
  const [data, setData] = useState<ExplorerData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setData(await loadExplorerData())
    } catch (error) {
      console.error('[Thetanuts Explorer] Explorer data loading failed', error)
      const message = error instanceof Error ? error.message : String(error)
      setData({
        errors: [`Thetanuts explorer data loading failed: ${message}`],
        fetchedAt: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const orders = data?.orders
  const stats = data?.protocolStats?.stats

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">THETANUTS FINANCE × BASE</p>
          <h1>Options Explorer</h1>
          <p className="intro">
            A read-only window into live Thetanuts OptionBook markets. No wallet, signer, approvals, or transactions are used.
          </p>
        </div>
        <div className="connection-card">
          <span className="status-dot" />
          <div>
            <strong>Base mainnet</strong>
            <span>Chain ID 8453 · SDK-powered reads</span>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh live data'}
          </button>
        </div>
      </header>

      {data?.errors.length ? (
        <section className="notice error-notice" aria-live="polite">
          <strong>Some live sources are unavailable.</strong>
          <p>No synthetic trading data is shown. Technical details:</p>
          <ul>
            {data.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </section>
      ) : null}

      <section className="section" aria-labelledby="market-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LIVE MARKET SNAPSHOT</p>
            <h2 id="market-heading">Underlying prices</h2>
          </div>
          <span className="updated">{data ? `Updated ${formatTimestamp(data.marketData?.metadata.lastUpdated)}` : 'Connecting to Thetanuts…'}</span>
        </div>
        <div className="metric-grid">
          <Metric label="ETH / USD" value={formatUsd(data?.marketData?.prices.ETH)} hint="Thetanuts market data" />
          <Metric label="BTC / USD" value={formatUsd(data?.marketData?.prices.BTC)} hint="Thetanuts market data" />
          <Metric label="Total OptionBook volume" value={formatUsd(stats?.totalVolumeUsd)} hint="Protocol statistics" />
          <Metric label="Total premium" value={formatUsd(stats?.totalPremiumUsd)} hint="Protocol statistics" />
          <Metric label="Tracked positions" value={stats ? stats.totalPositions.toLocaleString() : 'Unavailable'} hint="Protocol statistics" />
          <Metric label="24h positions" value={stats ? stats['24h'].positions.toLocaleString() : 'Unavailable'} hint="Protocol statistics" />
        </div>
      </section>

      <section className="section order-section" aria-labelledby="orders-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LIVE OPTIONBOOK</p>
            <h2 id="orders-heading">Available option orders</h2>
          </div>
          <span className="updated">{orders ? `${orders.length} live orders returned by Thetanuts` : 'Order feed unavailable'}</span>
        </div>

        {loading && !data ? <div className="empty-state">Loading live OptionBook and market data…</div> : null}
        {!loading && orders?.length === 0 ? <div className="empty-state">Thetanuts returned no available OptionBook orders at this time.</div> : null}
        {orders?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Strike price</th>
                  <th>Expiry (UTC)</th>
                  <th>Premium / contract</th>
                  <th>Contracts</th>
                  <th>Collateral</th>
                  <th>Available amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{order.asset}</strong></td>
                    <td><span className={`option-type ${order.optionType.toLowerCase()}`}>{order.optionType}</span></td>
                    <td>{order.strikes}</td>
                    <td>{formatExpiry(order.expiry)}</td>
                    <td>{order.pricePerContract} {order.collateral}</td>
                    <td>{order.contracts}</td>
                    <td>{order.collateral}</td>
                    <td>{order.availableAmount} {order.collateral}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <footer>
        Data source: Thetanuts Finance OptionBook/indexer via <code>@thetanuts-finance/thetanuts-client</code>. This demo is read-only.
      </footer>
    </main>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  )
}

export default App
