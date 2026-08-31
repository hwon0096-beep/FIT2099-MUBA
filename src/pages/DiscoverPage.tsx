import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatExpiry, formatNumber, formatUsd, parseOrderNumber, parseStrikeList } from '../lib/formatters'
import { loadExplorerData, resolveAssetPrice, type ExplorerData, type ExplorerOrder } from '../lib/thetanuts'
import { buildPayoffCurve as buildVanillaCurve } from '../lib/payoff'
import { buildPayoffCurve as buildSpreadCurve } from '../lib/spreadPayoff'
import '../styles/discover.css'

export interface DiscoverPageProps {
  onConnectWallet?: () => void
  onExplore?: () => void
  onViewAll?: () => void
}

const icons = {
  wallet: '▣', chart: '⌁', list: '▤', arrow: '›', shield: '♢', sparkle: '✳', rocket: '➤', bars: '▥', premium: '$', positions: '▣', orders: '☷', trend: '⌁', logo: '◇', eth: '♦', btc: '₿', sol: '≋', unavailable: '—',
}

export default function DiscoverPage({ onExplore, onViewAll }: DiscoverPageProps) {
  const navigate = useNavigate()
  const [data, setData] = useState<ExplorerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await loadExplorerData()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Live market data is unavailable.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const orders = data?.orders ?? []
  const stats = data?.protocolStats?.stats
  const goToMarkets = onExplore ?? (() => navigate('/markets'))
  const goToAnalyze = onViewAll ?? (() => navigate('/analyze'))
  return <main className="discover-page"><div className="discover-shell">
      <section className="discover-hero">
        <div className="hero-orbit" aria-hidden="true" />
        <div className="discover-copy">
          <div className="discover-eyebrow"><span>{icons.sparkle}</span> OPTIONS MADE CLEARER</div>
          <h1>Crypto options<br />without the <em>headache.</em></h1>
          <p>Explore live crypto markets, understand risk with clarity,<br className="desktop-break" /> and trade options with confidence.</p>
        </div>
        <div className="market-cards" aria-label="Live crypto market cards">
          <MarketCard asset="ETH" name="Ethereum" price={data?.marketData?.prices.ETH} loading={loading} />
          <MarketCard asset="BTC" name="Bitcoin" price={data?.marketData?.prices.BTC} loading={loading} />
          <MarketCard asset="SOL" name="Solana" price={undefined} loading={loading} />
        </div>
      </section>

      {error && <div className="discover-notice" role="alert">Unable to refresh the live dashboard: {error}</div>}
      <div className="discover-dashboard">
        <section className="discover-panel overview-panel">
          <PanelTitle icon={icons.chart} title="Market Overview" meta={<><span>All metrics are live</span><i /></>} />
          <div className="overview-grid">
            <Metric icon={icons.bars} tone="teal" label="Total OptionBook Volume" value={formatUsd(stats?.totalVolumeUsd)} hint="Live protocol total" />
            <Metric icon={icons.premium} tone="violet" label="Total Premium" value={formatUsd(stats?.totalPremiumUsd)} hint="Live protocol total" />
            <Metric icon={icons.positions} tone="blue" label="Tracked Positions" value={formatNumber(stats?.totalPositions)} hint={stats ? `${formatNumber(stats['24h'].positions)} in the last 24h` : 'Awaiting protocol data'} />
            <Metric icon={icons.orders} tone="amber" label="Live Orders" value={loading ? '…' : formatNumber(orders.length)} hint={orders.length ? 'Current OptionBook orders' : 'No orders currently available'} />
          </div>
        </section>
        <PayoffShowcase orders={orders} prices={data?.marketData?.prices} onViewAll={goToAnalyze} />
        <OrdersPreview orders={orders} loading={loading} onViewAll={goToMarkets} />
        <ExploreCTA onExplore={goToMarkets} />
      </div>
      {!!data?.errors.length && <p className="discover-source-note">Some live sources are currently unavailable; no synthetic market figures are shown.</p>}
      <footer className="discover-footer"><span>{icons.shield}</span> Built on <b>Base</b>. Secured by <strong>Thetanuts</strong>.</footer>
    </div>
  </main>
}

function MarketCard({ asset, name, price, loading }: { asset: 'ETH' | 'BTC' | 'SOL'; name: string; price?: number; loading: boolean }) {
  const available = price !== undefined
  return <article className={`market-card ${asset.toLowerCase()}`}><div className="market-card-head"><span className="coin">{icons[asset.toLowerCase() as 'eth' | 'btc' | 'sol']}</span><div><b>{asset}</b><small>{name}</small></div><span className="asset-glyph">{icons[asset.toLowerCase() as 'eth' | 'btc' | 'sol']}</span></div>
    <strong className="market-price">{loading ? 'Loading…' : available ? formatUsd(price) : 'Unavailable'}</strong>
    <div className="market-sub">{available ? <><b>Live price</b><span> via Thetanuts</span></> : <span>Not available via Thetanuts</span>}</div>
    <Sparkline asset={asset} muted={!available} />
  </article>
}

function Sparkline({ asset, muted }: { asset: string; muted: boolean }) { const points = asset === 'BTC' ? '2,55 14,37 24,43 35,29 48,38 59,25 70,34 82,18 94,28 106,17 118,23 132,8' : asset === 'ETH' ? '2,56 14,41 24,44 36,31 49,38 61,20 74,33 86,24 99,37 112,28 124,16 132,11' : '2,52 17,48 29,38 44,43 57,31 70,38 83,22 97,35 110,20 122,27 132,13'; return <svg className={`sparkline ${muted ? 'muted' : ''}`} viewBox="0 0 134 64" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`fade-${asset}`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="currentColor" stopOpacity=".25"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path d={`M${points} L132,64 L2,64 Z`} fill={`url(#fade-${asset})`} /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" /></svg> }

function PanelTitle({ icon, title, meta, action }: { icon: string; title: string; meta?: ReactNode; action?: () => void }) { return <div className="panel-title"><h2><span>{icon}</span>{title}</h2>{action ? <button type="button" onClick={action}>View all <b>{icons.arrow}</b></button> : <div className="panel-meta">{meta}</div>}</div> }
function Metric({ icon, tone, label, value, hint }: { icon: string; tone: string; label: string; value: string; hint: string }) { return <article className="overview-card"><span className={`metric-icon ${tone}`}>{icon}</span><small>{label}</small><strong>{value}</strong><em>{hint}</em></article> }

function PayoffShowcase({ orders, prices, onViewAll }: { orders: ExplorerOrder[]; prices: { ETH: number; BTC: number } | undefined; onViewAll?: () => void }) {
  const order = orders.find((item) => item.optionType !== 'UNKNOWN' && parseStrikeList(item.strikes).length <= 2)
  const curve = useMemo(() => {
    if (!order) return []
    const strikes = parseStrikeList(order.strikes); const currentPrice = resolveAssetPrice(order.asset, prices) ?? strikes[0]
    const premium = parseOrderNumber(order.pricePerContract); const positionSize = 1
    if (!currentPrice || !strikes.length) return []
    return strikes.length === 2 ? buildSpreadCurve({ spreadType: order.optionType === 'CALL' ? 'CALL_SPREAD' : 'PUT_SPREAD', nearStrike: strikes[0], farStrike: strikes[1], premium, positionSize, currentPrice }, .28, 31) : buildVanillaCurve({ optionType: order.optionType === 'CALL' ? 'CALL' : 'PUT', strike: strikes[0], premium, positionSize, currentPrice }, .28, 31)
  }, [order, prices])
  const displayAsset = order?.asset.includes('BTC') ? 'BTC' : 'ETH'
  return <section className="discover-panel payoff-panel"><PanelTitle icon={icons.trend} title="Payoff Showcase" action={onViewAll} />
    <div className="trade-caption"><span className={`tiny-asset ${displayAsset.toLowerCase()}`}>{displayAsset === 'BTC' ? icons.btc : icons.eth} {displayAsset}</span><b>{order ? parseStrikeList(order.strikes).length === 2 ? `${order.optionType === 'CALL' ? 'Bull Call' : 'Bear Put'} Spread` : `${order.optionType === 'CALL' ? 'Long Call' : 'Long Put'}` : 'No live payoff available'}</b>{order && <small>Expiry: {formatExpiry(order.expiry)}</small>}</div>
    {curve.length ? <PayoffGraph curve={curve} /> : <div className="payoff-empty">A valid live option order will appear here when available.</div>}</section>
}

function PayoffGraph({ curve }: { curve: { price: number; pnl: number }[] }) { const minX = curve[0].price, maxX = curve.at(-1)?.price ?? minX, values = curve.map(p => p.pnl), minY = Math.min(0, ...values), maxY = Math.max(0, ...values), scaleX = (n: number) => 36 + ((n - minX) / (maxX - minX || 1)) * 400, scaleY = (n: number) => 18 + (1 - (n - minY) / (maxY - minY || 1)) * 112, d = curve.map((p, i) => `${i ? 'L' : 'M'}${scaleX(p.price)},${scaleY(p.pnl)}`).join(' '), zero = scaleY(0); return <><svg className="payoff-graph" viewBox="0 0 450 160" aria-label="Live option payoff at expiry"><g className="graph-grid"><path d="M36 18H436M36 55H436M36 93H436M36 130H436M36 18V130M136 18V130M236 18V130M336 18V130M436 18V130" /></g><path className="loss-fill" d={`${d} L${scaleX(maxX)},${zero} L${scaleX(minX)},${zero} Z`} /><path className="payoff-line" d={d} /><path className="zero-line" d={`M36 ${zero}H436`} /></svg><div className="graph-axis"><span>{formatUsd(minX, 0)}</span><span>ETH Price at Expiry (USD)</span><span>{formatUsd(maxX, 0)}</span></div><div className="legend"><span><i className="loss" />Max Loss</span><span><i className="gain" />Max Profit</span></div></> }

function OrdersPreview({ orders, loading, onViewAll }: { orders: ExplorerOrder[]; loading: boolean; onViewAll?: () => void }) { const preview = orders.slice(0, 4); return <section className="discover-panel orders-panel"><PanelTitle icon={icons.list} title="Available Option Orders" action={onViewAll} />{loading ? <div className="orders-empty">Loading live OptionBook orders…</div> : !preview.length ? <div className="orders-empty">No live OptionBook orders available.</div> : <div className="orders-table-wrap"><table className="discover-orders"><thead><tr><th>Asset</th><th>Type</th><th>Strike</th><th>Expiry</th><th>Premium</th><th>Status</th></tr></thead><tbody>{preview.map(order => <tr key={order.id}><td><b className="order-asset">{order.asset}</b></td><td><span className={`order-type ${order.optionType.toLowerCase()}`}>{order.optionType === 'UNKNOWN' ? 'Order' : order.optionType[0] + order.optionType.slice(1).toLowerCase()}</span></td><td>{order.strikes}</td><td>{formatExpiry(order.expiry)}</td><td>{formatNumber(order.pricePerContract, 4)}</td><td><span className="live-status">● Live</span></td></tr>)}</tbody></table></div>}</section> }
function ExploreCTA({ onExplore }: { onExplore?: () => void }) { return <section className="explore-cta"><div className="cta-orbits" aria-hidden="true"><span>{icons.rocket}</span></div><div><h2>Ready to explore?</h2><p>Dive into on-chain options markets<br />designed to be simple, transparent,<br />and powerful.</p><button type="button" onClick={onExplore}>Start Exploring <b>{icons.arrow}</b></button></div></section> }
