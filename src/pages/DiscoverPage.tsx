import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NutIcon } from '../components/VisualSystem'
import { formatCompactExpiry, formatNumber, formatUsd, parseOrderNumber, parseStrikeList } from '../lib/formatters'
import { loadExplorerData, type ExplorerData, type ExplorerOrder } from '../lib/thetanuts'
import '../styles/discover.css'

export interface DiscoverPageProps { onConnectWallet?: () => void; onExplore?: () => void }
type Asset = 'BTC' | 'ETH' | 'SOL'
const assets: Asset[] = ['BTC', 'ETH', 'SOL']

export default function DiscoverPage({ onExplore }: DiscoverPageProps) {
  const navigate = useNavigate(), [data, setData] = useState<ExplorerData | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => { setLoading(true); setError(null); try { setData(await loadExplorerData()) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Live market data is unavailable.') } finally { setLoading(false) } }, [])
  useEffect(() => { void refresh() }, [refresh])
  const orders = data?.orders ?? [], stats = data?.protocolStats?.stats
  const toMarkets = onExplore ?? (() => navigate('/markets'))
  const nearestExpiry = useMemo(() => orders.map(order => order.expiry).sort((a, b) => Number(a) - Number(b))[0], [orders])
  const opportunities = useMemo(() => selectStrategyOpportunities(orders), [orders])
  const assetRows = useMemo(() => assets.map(asset => ({ asset, price: data?.marketData?.prices[asset], orders: orders.filter(order => order.asset.toUpperCase().includes(asset)), })).filter(row => row.price !== undefined || row.orders.length), [data?.marketData?.prices, orders])
  return <main className="discover-page"><div className="discover-shell">
    <section className="discover-hero">
      <div className="discover-copy"><div className="discover-eyebrow"><i />LIVE ON-CHAIN</div><h1>Live crypto options.<br /><strong>Powered by <em>Thetanuts OptionBook.</em></strong></h1><p>NUTSCOPE brings live options data and analysis on-chain.<br />Discover opportunities, analyze risk, and trade with confidence.</p><div className="hero-actions"><button type="button" onClick={toMarkets}>Browse Live Markets <NutIcon name="arrow" /></button><button className="how-button" type="button" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}><NutIcon name="radar" />How it works</button></div></div>
      <div className="market-cards" aria-label="Live crypto market cards">{assets.map(asset => <MarketCard key={asset} asset={asset} price={data?.marketData?.prices[asset]} loading={loading} />)}</div>
    </section>
    {error && <div className="discover-notice" role="alert">Unable to refresh the live dashboard: {error}</div>}
    <section className="summary-strip" aria-label="Live market summary"><Summary icon="radar" label="Live orders" value={loading ? 'Loading…' : formatNumber(orders.length)} hint="Current OptionBook orders" /><Summary icon="volume" label="Total volume" value={compactUsd(stats?.totalVolumeUsd)} hint="Live protocol total" /><Summary icon="interest" label="Open interest" value={stats ? formatNumber(stats.totalPositions) : 'Unavailable'} hint="Tracked positions" /><Summary icon="calendar" label="Nearest expiry" value={nearestExpiry ? formatCompactExpiry(nearestExpiry) : 'Unavailable'} hint={nearestExpiry ? 'Earliest live order' : 'Awaiting live orders'} /></section>
    <section className="strategy-section" aria-labelledby="strategy-opportunities-title"><header className="section-heading"><div><h2 id="strategy-opportunities-title"><NutIcon name="spark" />Strategy Opportunities</h2><p>Live opportunities built from current Thetanuts OptionBook orders.</p></div><button type="button" onClick={() => navigate('/portfolio')}>View all strategies <NutIcon name="arrow" /></button></header><div className="strategy-grid">{loading ? <Empty text="Loading live opportunities…" /> : !opportunities.length ? <Empty text="No supported live opportunities are currently available." /> : opportunities.map(order => <StrategyCard key={order.id} order={order} onAnalyze={() => navigate(`/analyze?order=${encodeURIComponent(order.id)}`)} />)}</div></section>
    <section className="discover-lower"><section id="how-it-works" className="how-it-works"><header><h2><NutIcon name="board" />How it works</h2><p>From discovery to execution in four simple steps.</p></header><div className="steps">{[['radar','Discover','Explore live markets and strategy ideas.'],['board','Markets','Browse Thetanuts OptionBook orders.'],['lens','Analyze','Understand payoff, risk and scenarios.'],['wallet','Trade','Review, connect wallet and execute on-chain.']].map(([icon, title, copy], index) => <article key={title}><NutIcon name={icon as 'radar' | 'board' | 'lens' | 'wallet'} /><span>{index < 3 && <NutIcon name="arrow" />}</span><b>{title}</b><p>{copy}</p></article>)}</div></section>
      <section className="live-preview"><header><div><h2>Live markets preview</h2><p>Assets currently represented by loaded live data.</p></div><button type="button" onClick={toMarkets}>View all markets <NutIcon name="arrow" /></button></header>{assetRows.length ? <table><thead><tr><th>Asset</th><th>Live price</th><th>Live orders</th><th>Nearest expiry</th></tr></thead><tbody>{assetRows.map(row => <tr key={row.asset}><td><AssetBadge asset={row.asset} />{row.asset}</td><td>{formatUsd(row.price)}</td><td>{formatNumber(row.orders.length)}</td><td>{row.orders.length ? formatCompactExpiry(row.orders.map(order => order.expiry).sort((a, b) => Number(a) - Number(b))[0]) : '—'}</td></tr>)}</tbody></table> : <Empty text="Waiting for live market data…" />}</section>
    </section>
    {!!data?.errors.length && <p className="discover-source-note">Some live sources are unavailable; no synthetic market figures are displayed.</p>}
    <footer className="discover-footer"><div><NutIcon name="shield" /><span><b>Secure. Transparent. On-chain.</b><small>Live market data sourced from Thetanuts OptionBook.</small></span></div><dl><div><dt>Network</dt><dd>Base</dd></div><div><dt>Data source</dt><dd>Thetanuts OptionBook</dd></div></dl><button type="button" onClick={toMarkets}>Explore live markets <NutIcon name="arrow" /></button></footer>
  </div></main>
}

function compactUsd(value: number | string | undefined) { if (value === undefined) return 'Unavailable'; const numeric = Number(value); return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(numeric) : 'Unavailable' }
function MarketCard({ asset, price, loading }: { asset: Asset; price?: number; loading: boolean }) { return <article className={`market-card ${asset.toLowerCase()}`}><header><AssetBadge asset={asset} /><b>{asset} <small>/ USD</small></b><i className="live-dot" /></header><strong>{loading ? 'Loading…' : formatUsd(price)}</strong><p>{price === undefined ? 'Live spot price unavailable' : 'Live spot price'}</p><div className="spot-rail" aria-hidden="true"><span /></div></article> }
function AssetBadge({ asset }: { asset: Asset }) { return <i className={`asset-badge ${asset.toLowerCase()}`} aria-label={asset}>{asset === 'BTC' ? '₿' : asset === 'ETH' ? '◆' : '≋'}</i> }
function Summary({ icon, label, value, hint }: { icon: 'radar' | 'volume' | 'interest' | 'calendar'; label: string; value: string; hint: string }) { return <article><NutIcon name={icon} /><div><small>{label}</small><b>{value}</b><span>{hint}</span></div></article> }
function selectStrategyOpportunities(orders: ExplorerOrder[]) {
  const candidates = orders.filter(isSupportedStrategyOrder).sort(compareStrategyOrders)
  const selected: ExplorerOrder[] = []
  const pick = (predicate: (order: ExplorerOrder) => boolean) => {
    const order = candidates.find(candidate => !selected.includes(candidate) && predicate(candidate))
    if (order) selected.push(order)
  }

  pick(order => order.optionType === 'CALL')
  pick(order => order.optionType === 'PUT')
  while (selected.length < 4) {
    const remaining = candidates.filter(order => !selected.includes(order))
    if (!remaining.length) break
    remaining.sort((a, b) => diversityScore(b, selected) - diversityScore(a, selected) || compareStrategyOrders(a, b))
    selected.push(remaining[0])
  }
  return selected
}

function isSupportedStrategyOrder(order: ExplorerOrder) {
  return (order.optionType === 'CALL' || order.optionType === 'PUT')
    && parseStrikeList(order.strikes).length === 1
    && Boolean(order.asset.trim())
    && Number(order.expiry) * 1000 > Date.now()
    && parseOrderNumber(order.pricePerContract) > 0
}

function compareStrategyOrders(a: ExplorerOrder, b: ExplorerOrder) {
  return Number(a.expiry) - Number(b.expiry) || a.asset.localeCompare(b.asset) || a.id.localeCompare(b.id)
}

function diversityScore(order: ExplorerOrder, selected: ExplorerOrder[]) {
  const selectedAssets = new Set(selected.map(item => item.asset.trim().toUpperCase()))
  const selectedExpiries = new Set(selected.map(item => item.expiry))
  const selectedStrikes = new Set(selected.map(item => item.strikes))
  return (selected.some(item => item.optionType === order.optionType) ? 0 : 6)
    + (selectedAssets.has(order.asset.trim().toUpperCase()) ? 0 : 4)
    + (selectedExpiries.has(order.expiry) ? 0 : 2)
    + (selectedStrikes.has(order.strikes) ? 0 : 1)
}

function strategyFor(order: ExplorerOrder) { return { outlook: order.optionType === 'CALL' ? 'Bullish' : 'Bearish', title: order.optionType === 'CALL' ? 'Long Call' : 'Long Put' } }
function StrategyCard({ order, onAnalyze }: { order: ExplorerOrder; onAnalyze: () => void }) { const strategy = strategyFor(order); return <article className="strategy-card"><header><span className={strategy.outlook.toLowerCase()}>{strategy.outlook}</span></header><h3>{strategy.title}</h3><dl><div><dt>Asset</dt><dd>{order.asset.trim().toUpperCase()}</dd></div><div><dt>Strike</dt><dd>{order.strikes}</dd></div><div><dt>Expiry</dt><dd>{formatCompactExpiry(order.expiry)}</dd></div><div><dt>Premium</dt><dd>{formatNumber(order.pricePerContract, 4)} <small>{order.collateral}</small></dd></div></dl><button type="button" onClick={onAnalyze}>Analyze <NutIcon name="arrow" /></button></article> }
function Empty({ text }: { text: string }) { return <div className="discover-empty">{text}</div> }
