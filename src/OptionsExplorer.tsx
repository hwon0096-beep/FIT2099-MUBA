import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatExpiry, formatNumber, formatTimestamp, formatUsd, parseOrderNumber, parseStrikeList } from './lib/formatters'
import { loadExplorerData, type ExplorerData, type ExplorerOrder } from './lib/thetanuts'
import TradePreviewModal from './components/TradePreviewModal'
import PayoffShowcase from './components/PayoffShowcase'

type AssetFilter = 'ALL' | 'ETH' | 'BTC'
type TypeFilter = 'ALL' | 'CALL' | 'PUT'
type SortKey = 'strike' | 'expiry' | 'premium'
type SortDirection = 'asc' | 'desc'
interface SortState { key: SortKey; direction: SortDirection }

const numericValue = parseOrderNumber

// The Thetanuts SDK resolves Base price feeds to wrapped/bridged token symbols
// (e.g. 'WETH', 'cbBTC') rather than the bare ticker, so match by substring.
const matchesAssetFilter = (asset: string, filter: AssetFilter): boolean => {
  if (filter === 'ALL') return true
  return asset.trim().toUpperCase().includes(filter)
}

export default function OptionsExplorer() {
  const [data, setData] = useState<ExplorerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [sort, setSort] = useState<SortState>({ key: 'expiry', direction: 'asc' })
  const [previewOrder, setPreviewOrder] = useState<ExplorerOrder | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setRequestError(null)
    try { setData(await loadExplorerData()) }
    catch (error) {
      console.error('[Thetanuts Explorer] Explorer data loading failed', error)
      setRequestError(error instanceof Error ? error.message : 'The live data request failed unexpectedly.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const orders = data?.orders

  useEffect(() => {
    if (orders) console.log('Unique Option Types:', Array.from(new Set(orders.map((o) => o.optionType))))
  }, [orders])

  const visibleOrders = useMemo(() => (orders ?? [])
    .filter((order) => matchesAssetFilter(order.asset, assetFilter))
    .filter((order) => typeFilter === 'ALL' || order.optionType.trim().toUpperCase() === typeFilter)
    .sort((a, b) => {
      const values: Record<SortKey, [number, number]> = {
        strike: [numericValue(a.strikes), numericValue(b.strikes)],
        expiry: [Number(a.expiry), Number(b.expiry)],
        premium: [numericValue(a.pricePerContract), numericValue(b.pricePerContract)],
      }
      const comparison = values[sort.key][0] - values[sort.key][1]
      return sort.direction === 'asc' ? comparison : -comparison
    }), [assetFilter, orders, sort, typeFilter])

  const toggleSort = (key: SortKey) => setSort((current) => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }))

  return (
    <main className="app-shell">
      <Header loading={loading} onRefresh={() => void refresh()} />
      {requestError && <Notice title="We couldn’t refresh the live data." messages={[`${requestError} Please check the server connection and try again.`]} />}
      {!!data?.errors.length && <Notice title="Some live sources are temporarily unavailable." messages={data.errors} />}
      <MarketSnapshot data={data} loading={loading} />
      <PayoffShowcase orders={orders} marketData={data?.marketData} />
      <OrdersPanel assetFilter={assetFilter} loading={loading} orders={orders} sort={sort} typeFilter={typeFilter}
        visibleOrders={visibleOrders} onAssetChange={setAssetFilter} onSort={toggleSort} onTypeChange={setTypeFilter}
        onPreview={setPreviewOrder} />
      <footer>Data source: Thetanuts Finance OptionBook/indexer via <code>@thetanuts-finance/thetanuts-client</code>. This dashboard is read-only.</footer>
      {previewOrder && <TradePreviewModal order={previewOrder} marketData={data?.marketData} onClose={() => setPreviewOrder(null)} />}
    </main>
  )
}

function Header({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return <header className="hero">
    <div className="hero-copy"><p className="eyebrow">THETANUTS FINANCE × BASE</p><h1>Options Explorer</h1>
      <p className="intro">Explore live options markets on Base. Track market prices, protocol activity, and available Thetanuts OptionBook orders in real time.</p>
    </div>
    <aside className="connection-card" aria-label="Network connection"><span className="status-dot" aria-hidden="true" />
      <div className="connection-copy"><strong>Base mainnet</strong><span>Chain ID 8453 · SDK-powered reads</span></div>
      <button type="button" onClick={onRefresh} disabled={loading} aria-busy={loading}>
        <span className={loading ? 'refresh-icon spinning' : 'refresh-icon'} aria-hidden="true">↻</span>{loading ? 'Refreshing live data…' : 'Refresh live data'}
      </button>
    </aside>
  </header>
}

function Notice({ title, messages }: { title: string; messages: string[] }) {
  return <section className="notice error-notice" role="alert"><strong>{title}</strong>
    <p>Available live results remain visible; no synthetic data has been substituted.</p>
    <ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul>
  </section>
}

function MarketSnapshot({ data, loading }: { data: ExplorerData | null; loading: boolean }) {
  const stats = data?.protocolStats?.stats
  return <section className="section" aria-labelledby="market-heading">
    <SectionHeading eyebrow="LIVE MARKET SNAPSHOT" title="Market overview" id="market-heading"
      meta={data ? `Last updated ${formatTimestamp(data.marketData?.metadata.lastUpdated ?? data.fetchedAt)}` : loading ? 'Connecting to Thetanuts…' : 'Update unavailable'} />
    <div className="metric-grid">
      <Metric label="ETH / USD" value={formatUsd(data?.marketData?.prices.ETH)} hint="Thetanuts market data" />
      <Metric label="BTC / USD" value={formatUsd(data?.marketData?.prices.BTC)} hint="Thetanuts market data" />
      <Metric label="Total OptionBook volume" value={formatUsd(stats?.totalVolumeUsd)} hint="Protocol statistics" />
      <Metric label="Total premium" value={formatUsd(stats?.totalPremiumUsd)} hint="Protocol statistics" />
      <Metric label="Tracked positions" value={formatNumber(stats?.totalPositions)} hint="Protocol statistics" />
      <Metric label="24h positions" value={formatNumber(stats?.['24h'].positions)} hint="Protocol statistics" />
    </div>
  </section>
}

interface OrdersPanelProps {
  assetFilter: AssetFilter; loading: boolean; orders: ExplorerOrder[] | undefined; sort: SortState; typeFilter: TypeFilter
  visibleOrders: ExplorerOrder[]; onAssetChange: (value: AssetFilter) => void; onSort: (key: SortKey) => void
  onTypeChange: (value: TypeFilter) => void; onPreview: (order: ExplorerOrder) => void
}

function OrdersPanel(props: OrdersPanelProps) {
  const { assetFilter, loading, orders, sort, typeFilter, visibleOrders, onAssetChange, onSort, onTypeChange, onPreview } = props
  const total = orders?.length ?? 0
  return <section className="section order-section" aria-labelledby="orders-heading">
    <SectionHeading eyebrow="LIVE OPTIONBOOK" title="Available option orders" id="orders-heading"
      meta={`${visibleOrders.length} of ${total} ${total === 1 ? 'order' : 'orders'} displayed`} />
    <div className="filters" aria-label="Order filters">
      <FilterGroup label="Asset" value={assetFilter} options={['ALL', 'ETH', 'BTC']} onChange={(value) => onAssetChange(value as AssetFilter)} />
      <FilterGroup label="Type" value={typeFilter} options={['ALL', 'CALL', 'PUT']} onChange={(value) => onTypeChange(value as TypeFilter)} />
    </div>
    {loading && !orders && <div className="empty-state"><span className="loader" />Loading live OptionBook orders…</div>}
    {!loading && orders?.length === 0 && <div className="empty-state">No live OptionBook orders are available right now. Try refreshing again shortly.</div>}
    {!loading && total > 0 && !visibleOrders.length && <div className="empty-state">No orders match these filters. Try selecting All assets or types.</div>}
    {!!visibleOrders.length && <div className="table-wrap"><table><thead><tr>
      <th>Asset</th><th>Type</th>
      <SortableHeading label="Strike price" sortKey="strike" sort={sort} onSort={onSort} />
      <SortableHeading label="Expiry (UTC)" sortKey="expiry" sort={sort} onSort={onSort} />
      <SortableHeading label="Premium per contract" sortKey="premium" sort={sort} onSort={onSort} />
      <th>Contracts available</th><th aria-label="Actions" />
    </tr></thead><tbody>{visibleOrders.map((order) => <OrderRow key={order.id} order={order} onPreview={onPreview} />)}</tbody></table></div>}
  </section>
}

function OrderRow({ order, onPreview }: { order: ExplorerOrder; onPreview: (order: ExplorerOrder) => void }) {
  const navigate = useNavigate()
  return <tr><td><strong className="asset-name">{order.asset}</strong></td>
    <td><span className={`option-type ${order.optionType.toLowerCase()}`}>{order.optionType}</span></td>
    <td className="numeric">{order.strikes}</td><td>{formatExpiry(order.expiry)}</td>
    <td className="numeric">{formatNumber(order.pricePerContract, 6)} <span className="unit">{order.collateral}</span></td>
    <td className="numeric">{formatNumber(order.contracts, 4)}</td>
    {/*
      1 strike = vanilla call/put (src/lib/payoff.ts), 2 strikes = vertical spread
      (src/lib/spreadPayoff.ts) — both have payoff math and are eligible for the preview. 3+
      strikes (butterfly, condor/iron_condor/ranger — see server/thetanuts.ts's note on `strikes`)
      have no payoff math yet, so those rows stay hidden rather than showing a mispriced chart.
      Same eligibility gates the Trade button — AnalyzePage.tsx deep-links via ?order=<id> using
      this same ExplorerOrder shape, and can only build payoff facts for these same orders.
    */}
    <td>{(() => {
      const strikeCount = parseStrikeList(order.strikes).length
      return order.optionType !== 'UNKNOWN' && (strikeCount === 1 || strikeCount === 2) &&
        <div className="action-buttons">
          <button type="button" className="preview-button" onClick={() => onPreview(order)}>Preview payoff</button>
          <button type="button" className="preview-button" onClick={() => navigate(`/analyze?order=${order.id}`)}>Trade</button>
        </div>
    })()}</td>
  </tr>
}

function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <fieldset className="filter-group"><legend>{label}</legend><div className="segmented-control">{options.map((option) =>
    <button key={option} type="button" className={value === option ? 'active' : ''} onClick={() => onChange(option)} aria-pressed={value === option}>
      {option === 'ALL' ? 'All' : option[0] + option.slice(1).toLowerCase()}</button>)}</div></fieldset>
}

function SortableHeading({ label, sortKey, sort, onSort }: { label: string; sortKey: SortKey; sort: SortState; onSort: (key: SortKey) => void }) {
  const active = sort.key === sortKey
  return <th aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button className="sort-button" type="button" onClick={() => onSort(sortKey)}>{label}<span aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button>
  </th>
}

function SectionHeading({ eyebrow, title, id, meta }: { eyebrow: string; title: string; id: string; meta: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div><span className="updated">{meta}</span></div>
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>
}
