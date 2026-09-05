import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AIAnalyst from '../components/AIAnalyst'
import { buildAnalysisContext } from '../lib/analysisContext'
import { daysToExpiry, formatCompactExpiry, formatExpiry, formatNumber, formatUsd, parseOrderNumber, parseStrikeList } from '../lib/formatters'
import { buildPayoffFacts, isPremiumUsdSafe, isSupportedDebitSpread, type PayoffFacts } from '../lib/orderPayoff'
import * as payoff from '../lib/payoff'
import * as spreadPayoff from '../lib/spreadPayoff'
import { loadExplorerData, resolveAssetPrice, type ExplorerData, type ExplorerOrder } from '../lib/thetanuts'
import { useSavedStrategies } from '../hooks/useSavedStrategies'
import '../styles/analyze.css'
import '../styles/analyze-empty.css'

const SCENARIOS = [-20, -10, -5, 0, 5, 10, 20]

function Token({ asset }: { asset: string }) { const symbol = asset.toUpperCase(); const paths = symbol === 'ETH' ? <><path d="M12 2 6 12l6 3 6-3-6-10Z" /><path d="m12 16-6-3 6 9 6-9-6 3Z" opacity=".7" /></> : symbol === 'SOL' ? <><path d="M6 5h12l-3 3H3l3-3Z" /><path d="M18 11H6l3-3h12l-3 3Z" opacity=".8" /><path d="M6 17h12l-3 3H3l3-3Z" /></> : symbol === 'BNB' ? <><path d="m12 3 3 3-3 3-3-3 3-3Zm-5 5 3 3-3 3-3-3 3-3Zm10 0 3 3-3 3-3-3 3-3Zm-5 5 3 3-3 3-3-3 3-3Z" /><path d="m12 8 4 4-4 4-4-4 4-4Z" opacity=".8" /></> : symbol === 'XRP' ? <><path d="M5 6h3l3 3c.6.6 1.5.6 2.1 0l3-3h3l-4.3 4.3a3.8 3.8 0 0 1-5.4 0L5 6Z" /><path d="M5 18h3l3-3c.6-.6 1.5-.6 2.1 0l3 3h3l-4.3-4.3a3.8 3.8 0 0 0-5.4 0L5 18Z" /></> : symbol === 'AVAX' ? <><path d="M12 3 20 8v8l-8 5-8-5V8l8-5Z" opacity=".35" /><path d="m12 6-4 8h3l1-2 1 2h3l-4-8Z" /></> : <><path d="M9 4h5c3 0 4 1 4 3 0 1-.6 2-1.7 2.5 1.5.4 2.4 1.5 2.4 3.2 0 2-1.8 3.4-4.7 3.4H9V4Zm3 2v2.4h1.7c.8 0 1.3-.4 1.3-1.2S14.5 6 13.7 6H12Zm0 4.5v3h2c1 0 1.6-.5 1.6-1.5s-.6-1.5-1.6-1.5H12Z" /><path d="M10 2v17M14 2v17" fill="none" stroke="currentColor" strokeWidth="1" /></>; return <svg className="analyze-token-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{paths}</svg> }

export default function AnalyzePage() {
  const navigate = useNavigate(), [params] = useSearchParams(), [data, setData] = useState<ExplorerData | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null), applied = useRef(false), lastRequestedId = useRef<string | null>(null)
  useEffect(() => { let live = true; loadExplorerData().then(result => { if (live) setData(result) }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'Unable to load live analysis data.') }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [])
  const orders = data?.orders ?? []
  // Same-route navigations reuse this component instance rather than remounting it, so later
  // ?order= changes must update the in-memory selection without restoring cached orders.
  useEffect(() => {
    if (!orders.length) return
    const requestedId = params.get('order')
    if (!applied.current) {
      applied.current = true
      lastRequestedId.current = requestedId
      if (requestedId && orders.some(order => order.id === requestedId)) { setSelected(requestedId); sessionStorage.setItem('nutscope:last-analyzed-order', requestedId) }
      return
    }
    if (requestedId !== lastRequestedId.current) {
      lastRequestedId.current = requestedId
      if (requestedId && orders.some(order => order.id === requestedId)) { setSelected(requestedId); sessionStorage.setItem('nutscope:last-analyzed-order', requestedId) }
      else setSelected(null)
    }
  }, [orders, params])
  const order = orders.find(item => item.id === selected) ?? null
  const analystContext = useMemo(() => order ? buildAnalysisContext(order, data?.marketData) : null, [data?.marketData, order])
  return <main className="analyze-page"><div className="analyze-shell">
    {!order && error && <div className="analyze-notice" role="alert">Live OptionBook orders are temporarily unavailable. Please try again or browse all live markets.</div>}
    {!order && data?.errors.length ? <div className="analyze-notice" role="status">Some live orders could not be loaded. Browse all live markets to see the latest available opportunities.</div> : null}
    {order && error && <div className="analyze-notice" role="alert">{error}</div>}
    {order && data?.errors.map(message => <div className="analyze-notice" role="status" key={message}>{message}</div>)}
    {!order ? <AnalyzeEmpty orders={orders} onAnalyze={id => navigate(`/analyze?order=${encodeURIComponent(id)}`)} onBrowse={() => navigate('/markets')} loading={loading} />
      : <TradeAnalysis order={order} marketData={data?.marketData} analystContext={analystContext} />}
    {order && <StrategyLabHandoff />}
  </div></main>
}

function StrategyLabHandoff() {
  const navigate = useNavigate()
  return <section className="analyze-strategy-handoff" aria-labelledby="analyze-strategy-handoff-title">
    <div className="analyze-strategy-handoff-copy">
      <h2 id="analyze-strategy-handoff-title">Looking for a strategy instead?</h2>
      <p>Compare bullish, bearish and neutral approaches<br />using live OptionBook opportunities.</p>
    </div>
    <button type="button" onClick={() => navigate('/portfolio')}>Open Strategy Lab <span aria-hidden="true">→</span></button>
  </section>
}

function AnalyzeEmpty({ orders, onAnalyze, onBrowse, loading }: { orders: ExplorerOrder[]; onAnalyze: (id: string) => void; onBrowse: () => void; loading: boolean }) {
  const featuredOrders = useMemo(() => pickFeaturedOrders(orders), [orders])
  const features = [
    ['payoff', 'Payoff at Expiry', 'Visualize profit and loss across possible expiry prices.'],
    ['risk', 'Risk Summary', 'See max loss, break-even, premium and potential upside.'],
    ['scenario', 'Scenario Analysis', 'Compare outcomes across different underlying prices.'],
    ['explanation', 'Plain-English Explanation', 'Understand what the option means without advanced options knowledge.'],
  ] as const

  return <section className="analyze-empty-state">
    <div className="analyze-empty-hero">
      <div className="analyze-empty-hero-copy">
        <p className="analyze-kicker">ANALYZE LIVE OPTIONS</p>
        <h1>Analyze <em>Trade</em></h1>
        <p className="analyze-empty-subtitle">Understand the risk and payoff of a live OptionBook order.</p>
        <p className="analyze-empty-supporting">Select a live order below to get started, or browse all markets.</p>
      </div>
      <div className="analyze-empty-hero-visual" aria-hidden="true">
        <div className="analyze-empty-orbit analyze-empty-orbit-one" />
        <div className="analyze-empty-orbit analyze-empty-orbit-two" />
        <div className="analyze-empty-signal-card"><span>LIVE ORDER</span><strong>Payoff ready</strong><i><b /><b /><b /><b /><b /></i></div>
      </div>
    </div>

    <section className="analyze-order-picker" aria-labelledby="featured-live-orders-title">
      <header className="analyze-orders-heading">
        <div><p className="analyze-section-kicker">START WITH A REAL ORDER</p><h2 id="featured-live-orders-title">Featured Live Orders</h2><p>Choose an active Thetanuts order to open the full analysis workspace.</p></div>
        <span className="analyze-orders-live"><i />Live data</span>
      </header>
      {loading ? <div className="analyze-order-status" role="status"><span className="analyze-loading-dot" /><div><strong>Loading live OptionBook orders...</strong><small>Finding currently available orders to analyze.</small></div></div>
        : featuredOrders.length ? <div className="analyze-order-list">{featuredOrders.map(order => <AnalyzeOrderRow key={order.id} order={order} onAnalyze={onAnalyze} />)}</div>
        : <div className="analyze-order-status" role="status"><span className="analyze-empty-status-icon">—</span><div><strong>No live orders are currently available.</strong><small>Check all live markets for the latest order activity.</small></div></div>}
      <button type="button" className="analyze-browse-button" onClick={onBrowse}>Browse All Live Markets <span aria-hidden="true">→</span></button>
    </section>

    <section className="analyze-feature-summary" aria-labelledby="analyze-feature-summary-title">
      <header><p className="analyze-section-kicker">WHY ANALYZE?</p><h2 id="analyze-feature-summary-title">Clarity before you trade</h2></header>
      <div className="analyze-feature-grid">{features.map(([icon, title, description]) => <article key={title}><i className="analyze-feature-glyph"><FeatureIcon kind={icon} /></i><div><strong>{title}</strong><span>{description}</span></div></article>)}</div>
    </section>
  </section>
}

function FeatureIcon({ kind }: { kind: 'payoff' | 'risk' | 'scenario' | 'explanation' }) {
  return <svg className="analyze-feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'payoff' && <><path d="M4 18 9 12l4 3 7-9" /><path d="M16 6h4v4" /><path d="M4 20h16" /></>}
    {kind === 'risk' && <><path d="M12 3 19 6v5c0 4.7-2.9 8.2-7 10-4.1-1.8-7-5.3-7-10V6l7-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>}
    {kind === 'scenario' && <><path d="M8 6h11M8 12h11M8 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="2.5" /></>}
    {kind === 'explanation' && <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h4M9 12h6M9 16h6" /></>}
  </svg>
}

function AnalyzeOrderRow({ order, onAnalyze }: { order: ExplorerOrder; onAnalyze: (id: string) => void }) {
  const type = order.optionType === 'CALL' ? 'Call' : 'Put'
  return <article className="analyze-order-row">
    <div className="analyze-order-asset"><i className={'analyze-empty-token ' + order.asset.toLowerCase()}><Token asset={order.asset} /></i><strong>{order.asset}</strong></div>
    <div className="analyze-order-field analyze-order-type-field"><span>Position</span><strong className={'analyze-empty-type analyze-empty-type-' + order.optionType.toLowerCase()}>{type}</strong></div>
    <div className="analyze-order-field"><span>Strike</span><strong>{order.strikes}</strong></div>
    <div className="analyze-order-field"><span>Expiry (DTE)</span><strong>{featuredExpiry(order.expiry)} <small>({daysToExpiry(order.expiry)}d)</small></strong></div>
    <div className="analyze-order-field"><span>Premium</span><strong>{formatNumber(order.pricePerContract, 6)} <small>{order.collateral}</small></strong></div>
    <button type="button" className="analyze-order-button" onClick={() => onAnalyze(order.id)}>Analyze <span aria-hidden="true">→</span></button>
  </article>
}

function pickFeaturedOrders(orders: ExplorerOrder[]) {
  const usable = orders.filter(isUsableFeaturedOrder).sort((a, b) => Number(a.expiry) - Number(b.expiry) || a.asset.localeCompare(b.asset))
  const selected: ExplorerOrder[] = []
  const assets = new Set<string>(), types = new Set<string>()
  const addMatching = (predicate: (order: ExplorerOrder) => boolean) => {
    for (const order of usable) {
      if (selected.length >= 5) break
      if (!selected.includes(order) && predicate(order)) {
        selected.push(order)
        assets.add(order.asset.trim().toUpperCase())
        types.add(order.optionType)
      }
    }
  }
  addMatching(order => !assets.has(order.asset.trim().toUpperCase()) && !types.has(order.optionType))
  addMatching(order => !assets.has(order.asset.trim().toUpperCase()))
  addMatching(order => !types.has(order.optionType))
  addMatching(() => true)
  return selected.sort((a, b) => Number(a.expiry) - Number(b.expiry))
}

function isUsableFeaturedOrder(order: ExplorerOrder) {
  const expiry = Number(order.expiry)
  return Boolean(order.id && order.asset && (order.optionType === 'CALL' || order.optionType === 'PUT') && order.strikes && parseStrikeList(order.strikes).length && order.pricePerContract && order.collateral && Number.isFinite(expiry) && expiry * 1000 > Date.now())
}

function featuredExpiry(timestamp: string) {
  const date = new Date(Number(timestamp) * 1000)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }).format(date)
}


type Calculation = ReturnType<typeof compute>

function TradeAnalysis({ order, marketData, analystContext }: { order: ExplorerOrder; marketData: ExplorerData['marketData']; analystContext: ReturnType<typeof buildAnalysisContext> | null }) {
  const navigate = useNavigate()
  const spot = resolveAssetPrice(order.asset, marketData?.prices)
  const facts = useMemo(() => buildPayoffFacts(order, marketData), [order, marketData])
  const supported = facts?.kind === 'vanilla' || (facts?.kind === 'spread' && isSupportedDebitSpread(facts))
  const safe = supported && spot !== undefined
  const calc = useMemo(() => safe && facts ? compute(facts) : null, [facts, safe])
  return <div className="analyze-dashboard">
    <div className="ad-main">
      <header className="ad-heading"><button type="button" className="ad-back" onClick={() => navigate('/markets')}>← Back to Markets</button><h1>Analyze Live Order</h1><p>Understand the risk and payoff before you trade.</p></header>
      <OrderSummary order={order} spot={spot} />
      <section className="ad-panel ad-payoff" aria-labelledby="ad-payoff-title">
        <header className="ad-panel-heading"><h2 id="ad-payoff-title">Payoff at Expiry <span className="ad-info" title="Illustrative net payoff for one unit on the buyer side at expiry.">ⓘ</span></h2><div className="ad-chart-mode" aria-label="Chart mode"><button type="button" aria-pressed="true">At expiry</button><button type="button" disabled title="Time-based pricing is unavailable">P/L over time <small>Coming soon</small></button></div></header>
        {calc && facts ? <Diagram asset={order.asset} calc={calc} facts={facts} /> : <div className="ad-chart-unavailable"><span aria-hidden="true">⌁</span><h3>Payoff analysis unavailable</h3><p>{unavailableReason(order, spot)}</p></div>}
        <Metrics order={order} spot={spot} calc={calc} />
      </section>
      <div className="ad-lower"><Meaning order={order} calc={calc} /><ScenarioTable order={order} calc={calc} facts={facts} /></div>
      {calc && <div className="ad-save-row"><span>Keep this analysis in your saved ideas.</span><SaveAction order={order} calc={calc} /></div>}
    </div>
    <aside className="ad-sidebar" aria-label="Order risk and details">
      <RiskSummary calc={calc} /><ContractDetails order={order} calc={calc} />
      <div className="ad-ai">{analystContext && <AIAnalyst key={order.id} context={analystContext} />}</div>
      <button className="ad-continue" type="button" onClick={() => navigate(`/trade?order=${encodeURIComponent(order.id)}`)}><strong>Continue to Trade <span aria-hidden="true">→</span></strong><small>Continue with this selected Thetanuts order.</small></button>
    </aside>
  </div>
}

function unavailableReason(order: ExplorerOrder, spot?: number) {
  if (!isPremiumUsdSafe(order)) return 'Premium is denominated in ' + order.collateral + '. A compatible USD conversion is unavailable, so USD payoff and breakeven are withheld.'
  if (spot === undefined) return 'Live spot data is unavailable for this asset. No substitute spot price is used for this analysis.'
  return 'Detailed payoff is available for single-leg calls and puts and safely ordered vertical debit spreads. This order is not a supported structure.'
}
function orderType(order: ExplorerOrder) {
  const count = parseStrikeList(order.strikes).length
  if (order.optionType === 'UNKNOWN') return 'Unknown'
  const type = order.optionType === 'CALL' ? 'Call' : 'Put'
  return count === 1 ? type : count === 2 ? type + ' spread' : 'Multi-leg'
}
function OrderSummary({ order, spot }: { order: ExplorerOrder; spot?: number }) {
  const navigate = useNavigate()
  return <section className="ad-panel ad-order-summary" aria-label="Selected live order">
    <div className="ad-asset"><i className={order.asset.toLowerCase()}><Token asset={order.asset} /></i><div><strong>{order.asset}</strong><small>{formatUsd(spot)}</small></div></div>
    <span className={'ad-type ad-type-' + order.optionType.toLowerCase()}>{orderType(order)}</span>
    <dl><Detail label="Strike" value={order.strikes} /><Detail label="Expiry (DTE)" value={formatCompactExpiry(order.expiry) + ' (' + daysToExpiry(order.expiry) + 'd)'} /><Detail label="Spot price" value={formatUsd(spot)} /><Detail label="Premium" value={formatNumber(order.pricePerContract, 6) + ' ' + order.collateral} /><Detail label="Available size" value={formatNumber(order.availableAmount, 4) + ' ' + order.collateral} /></dl>
    <button type="button" className="ad-market-button" onClick={() => navigate('/markets')}>View Markets <span aria-hidden="true">↗</span></button>
  </section>
}

function Diagram({ asset, calc, facts }: { asset: string; calc: Calculation; facts: PayoffFacts }) {
  const gradientId = useId().replace(/:/g, '')
  // Keep existing samples and calculate exact landmarks using the same utilities,
  // preserving sharp strike corners and an accurate zero crossing.
  const prices = [...new Set([...calc.curve.map(point => point.price), calc.strike, calc.breakeven, calc.spot, ...(facts.kind === 'spread' ? [facts.farStrike] : [])])].sort((a, b) => a - b)
  const curve = prices.map(price => ({ price, pnl: facts.kind === 'spread'
    ? spreadPayoff.netPnlAtExpiry({ ...facts, positionSize: 1 }, price)
    : payoff.netPnlAtExpiry({ ...facts, positionSize: 1 }, price) }))
  const low = Math.min(0, ...curve.map(point => point.pnl)), high = Math.max(0, ...curve.map(point => point.pnl))
  const padding = Math.max((high - low) * .12, .01)
  const min = low - padding, max = high + padding
  // Gradients use the area's own bounding box, from zero to the extrema.
  const zero = high === low ? 50 : high / (high - low) * 100
  const markers = [{ name: 'Breakeven', value: calc.breakeven, color: '#00dfce' }, { name: 'Current spot', value: calc.spot, color: '#bfccda' }, { name: 'Strike', value: calc.strike, color: '#e9c63c' }, ...(facts.kind === 'spread' ? [{ name: 'Far strike', value: facts.farStrike, color: '#e9c63c' }] : [])]
  return <>
    <div className="ad-legend" aria-label="Chart legend"><span><i className="ad-legend-profit" />Profit</span><span><i className="ad-legend-loss" />Loss</span>{markers.map(marker => <span key={marker.name}><i style={{ borderColor: marker.color, borderTopStyle: 'dashed' }} />{marker.name}</span>)}</div>
    <div className="ad-chart" role="img" aria-label={asset + ' buyer payoff at expiry. Breakeven ' + formatUsd(calc.breakeven) + ', current spot ' + formatUsd(calc.spot) + ', strike ' + formatUsd(calc.strike)}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={curve} margin={{ top: 72, right: 22, bottom: 25, left: 0 }}>
        <defs><linearGradient id={gradientId + '-line'} x1="0" y1="0" x2="0" y2="1"><stop offset={zero + '%'} stopColor="#00dfce" /><stop offset={zero + '%'} stopColor="#ff5266" /></linearGradient><linearGradient id={gradientId + '-area'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00cdbb" stopOpacity={.32} /><stop offset={zero + '%'} stopColor="#00cdbb" stopOpacity={.08} /><stop offset={zero + '%'} stopColor="#ed425c" stopOpacity={.08} /><stop offset="100%" stopColor="#ed425c" stopOpacity={.3} /></linearGradient></defs>
        <CartesianGrid stroke="#173043" vertical={false} />
        <XAxis dataKey="price" type="number" domain={['dataMin', 'dataMax']} tickFormatter={value => formatUsd(value, 0)} tick={{ fill: '#8da4b7', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#344b5d' }} minTickGap={35} label={{ value: asset + ' price at expiry (USD)', position: 'insideBottom', offset: -18, fill: '#8da4b7', fontSize: 10 }} />
        <YAxis domain={[min, max]} tickFormatter={value => formatUsd(value, Math.abs(value) < 1 ? 4 : 2)} tick={{ fill: '#8da4b7', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#344b5d' }} width={70} label={{ value: 'Net P/L (USD)', position: 'top', offset: 12, fill: '#8da4b7', fontSize: 10 }} />
        <Tooltip labelFormatter={value => 'Expiry price: ' + formatUsd(Number(value))} formatter={value => [formatUsd(Number(value), 6), 'Net P/L · one unit']} contentStyle={{ background: '#081c2b', border: '1px solid #29475c', borderRadius: 8, color: '#e4edf5', fontSize: 12 }} />
        <ReferenceLine y={0} stroke="#9fb0c3" strokeDasharray="5 5" />
        {markers.map((marker, index) => <ReferenceLine key={marker.name} x={marker.value} stroke={marker.color} strokeDasharray="5 5" label={({ viewBox }) => {
          const box = viewBox as { x?: number; y?: number }
          return <text x={box.x} y={(box.y ?? 0) - 12 - index * 15} fill={marker.color} fontSize={10} textAnchor={marker.value > (prices[0] + prices[prices.length - 1]) / 2 ? 'end' : 'start'}>{marker.name} {formatUsd(marker.value)}</text>
        }} />)}
        <Area type="linear" dataKey="pnl" baseValue={0} stroke={'url(#' + gradientId + '-line)'} fill={'url(#' + gradientId + '-area)'} strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </ComposedChart></ResponsiveContainer>
    </div>
    <p className="ad-chart-note">Illustrative buyer payoff for one unit at expiry · excludes execution fees.</p>
  </>
}

function Metrics({ order, spot, calc }: { order: ExplorerOrder; spot?: number; calc: Calculation | null }) {
  const strikes = parseStrikeList(order.strikes)
  const money = calc ? payoff.moneyness(calc.type, calc.strike, calc.spot) : strikes.length === 1 && spot !== undefined && order.optionType !== 'UNKNOWN' ? payoff.moneyness(order.optionType, strikes[0], spot) : null
  const strike = calc?.strike ?? strikes[0]
  const distance = spot !== undefined && strike > 0 ? Math.abs((spot - strike) / strike * 100) : null
  return <div className="ad-metrics">
    <Metric icon="↓" label="Max Loss" value={calc ? formatNumber(calc.maxLoss, 6) + ' USDC' : 'Unavailable'} hint="The most you can lose under this buyer assumption." loss />
    <Metric icon="↔" label="Breakeven" value={calc ? formatUsd(calc.breakeven) : 'Unavailable'} hint={calc ? order.asset + ' must be ' + (calc.type === 'CALL' ? 'above' : 'below') + ' this price at expiry to profit.' : 'Requires supported USD payoff data.'} />
    <Metric icon="↗" label="Max Profit" value={profitValue(calc)} hint={calc?.isSpread ? 'Capped at spread width minus premium.' : calc?.type === 'CALL' ? 'Profit increases as the asset moves higher.' : calc ? 'Maximum if the asset reaches zero.' : 'Requires supported USD payoff data.'} />
    <Metric icon="▦" label="DTE" value={daysToExpiry(order.expiry) + ' days'} hint={'Expires ' + formatCompactExpiry(order.expiry) + ' · ' + timeLeft(Number(order.expiry) * 1000 - Date.now()) + '.'} />
    <Metric icon="◎" label="Moneyness" value={money ? money + (distance !== null ? ' ' + formatNumber(distance, 1) + '%' : '') : 'Unavailable'} hint={money && spot !== undefined ? order.asset + ' is ' + formatNumber(distance ?? 0, 1) + '% ' + (spot >= strike ? 'above' : 'below') + (calc?.isSpread ? ' the long-leg strike.' : ' the strike.') : 'Requires a supported strike and live spot.'} />
    <Metric icon="$" label="Premium" value={formatNumber(order.pricePerContract, 6) + ' ' + order.collateral} hint="Illustrative premium for one analyzed unit." />
  </div>
}
function Metric({ icon, label, value, hint, loss = false }: { icon: string; label: string; value: string; hint: string; loss?: boolean }) {
  return <article className={'ad-metric' + (loss ? ' ad-metric-loss' : '')}><header><i aria-hidden="true">{icon}</i><span>{label}</span></header><strong>{value}</strong><p>{hint}</p></article>
}
function profitValue(calc: Calculation | null) { return !calc ? 'Unavailable' : calc.maxProfit === undefined ? 'Unlimited' : formatNumber(calc.maxProfit, 6) + ' USDC' }

function Meaning({ order, calc }: { order: ExplorerOrder; calc: Calculation | null }) {
  return <section className="ad-panel ad-meaning"><h2>What does this option mean?</h2><p>You are viewing an {order.asset} {orderType(order).toLowerCase()} order with {parseStrikeList(order.strikes).length === 1 ? 'a strike of' : 'strikes of'} {order.strikes}, expiring {formatExpiry(order.expiry)}.</p>
    {calc ? <ul>
      <li><i aria-hidden="true">◇</i><span>{calc.isSpread ? 'The long ' + calc.type.toLowerCase() + ' creates directional exposure; the short leg caps the gain.' : 'This models the buyer side of one ' + calc.type.toLowerCase() + '; the premium is paid upfront.'}</span></li>
      <li><i aria-hidden="true">↗</i><span>You profit if {order.asset} is {calc.type === 'CALL' ? 'above' : 'below'} {formatUsd(calc.breakeven)} at expiry.</span></li>
      <li><i className="ad-negative" aria-hidden="true">↓</i><span>Maximum loss is limited to the {formatNumber(calc.maxLoss, 6)} USDC premium {calc.isSpread ? 'debit' : 'paid'}.</span></li>
      <li><i aria-hidden="true">✧</i><span>{calc.maxProfit === undefined ? 'Profit is unlimited as ' + order.asset + ' moves higher.' : 'Maximum profit is ' + formatNumber(calc.maxProfit, 6) + ' USDC per ' + (calc.isSpread ? 'spread.' : 'unit.')}</span></li>
    </ul> : <p>Premium is quoted in {order.collateral}. Detailed profit and loss explanations are unavailable until supported deterministic data is available.</p>}
    <small>Illustrative buyer analysis, not your wallet position.</small>
  </section>
}
function ScenarioTable({ order, calc, facts }: { order: ExplorerOrder; calc: Calculation | null; facts: PayoffFacts | null }) {
  return <section className="ad-panel ad-scenarios"><h2>Scenario Analysis at Expiry</h2><div className="ad-table-wrap"><table><thead><tr><th>{order.asset} price</th><th>Intrinsic value</th><th>P/L</th><th>Return on premium</th></tr></thead><tbody>
    {calc && facts ? calc.rows.map(row => <tr key={row.change} className={row.change === 0 ? 'ad-current-row' : undefined}>
      <td>{formatUsd(row.price)}<small>{row.change === 0 ? 'Current spot' : (row.change > 0 ? '+' : '') + row.change + '%'}</small></td>
      <td>{formatUsd(facts.kind === 'spread' ? spreadPayoff.intrinsicValueAtExpiry(facts.spreadType, facts.nearStrike, facts.farStrike, row.price) : payoff.intrinsicValueAtExpiry(facts.optionType, facts.strike, row.price), 6)}</td>
      <td className={row.pnl >= 0 ? 'ad-positive' : 'ad-negative'}>{row.pnl > 0 ? '+' : ''}{formatUsd(row.pnl, 6)}</td>
      <td className={row.returnPct >= 0 ? 'ad-positive' : 'ad-negative'}>{calc.premium > 0 ? (row.returnPct > 0 ? '+' : '') + formatNumber(row.returnPct, 1) + '%' : 'Unavailable'}</td>
    </tr>) : <tr><td colSpan={4} className="ad-table-empty">Scenario data unavailable for this order.</td></tr>}
  </tbody></table></div><small className="ad-footnote">Per analyzed unit · expiry outcomes, not forecasts.</small></section>
}
function RiskSummary({ calc }: { calc: Calculation | null }) {
  return <section className="ad-panel ad-risk-summary"><header className="ad-panel-heading"><h2><span className="ad-shield" aria-hidden="true">♢</span> Risk Summary</h2><span className="ad-status">{calc ? 'Defined loss' : 'Unavailable'}</span></header><dl>
    <Detail label="Risk profile" value={calc ? 'Defined loss' : 'Unavailable'} /><Detail label="Loss is capped" value={calc ? 'Yes · buyer assumption' : 'Unavailable'} />
    <Detail label="Max loss" value={calc ? formatNumber(calc.maxLoss, 6) + ' USDC' : 'Unavailable'} /><Detail label="Max profit" value={profitValue(calc)} /><Detail label="Breakeven" value={calc ? formatUsd(calc.breakeven) : 'Unavailable'} /><Detail label="Probability of profit" value="Unavailable" /><Detail label="Volatility" value="Unavailable" />
  </dl><details className="ad-risk-explanation"><summary>How is this calculated?</summary><p>Expiry intrinsic value minus the quoted premium, for one unit on the buyer side. Supported debit spreads cap the payout at the strike width. No probability or volatility model is used.</p></details></section>
}
function ContractDetails({ order, calc }: { order: ExplorerOrder; calc: Calculation | null }) {
  const navigate = useNavigate()
  return <section className="ad-panel ad-contract"><h2>Contract Details <span className="ad-info" title="Live order terms and illustrative analysis assumptions.">ⓘ</span></h2><dl>
    <Detail label="Option type" value={orderType(order)} /><Detail label="Position" value="Illustrative buyer · one unit" /><Detail label="Strike price / structure" value={order.strikes} /><Detail label="Expiry date" value={formatExpiry(order.expiry)} /><Detail label="Days to expiry" value={daysToExpiry(order.expiry) + ' days'} /><Detail label="Premium" value={formatNumber(order.pricePerContract, 6)} /><Detail label="Denomination" value={order.collateral} /><Detail label="Illustrative cost" value={calc ? formatNumber(calc.premium, 6) + ' USDC' : 'Unavailable'} /><Detail label="Available size" value={formatNumber(order.availableAmount, 4) + ' ' + order.collateral} /><Detail label="Settlement" value="Unavailable" /><Detail label="Exercise style" value="Unavailable" /><Detail label="Underlying" value={order.asset} />
    <div><dt>Order ID</dt><dd className="ad-order-id" title={order.id}>{order.id}</dd></div>
  </dl><button type="button" className="ad-market-button" onClick={() => navigate('/markets')}>View live Markets <span aria-hidden="true">→</span></button></section>
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function SaveAction({ order, calc }: { order: ExplorerOrder; calc: ReturnType<typeof compute> }) {
  const { items, save, remove } = useSavedStrategies()
  const existing = items.find((item) => item.source === 'analyze' && item.orderId === order.id)
  const handleClick = () => {
    if (existing) { remove(existing.id); return }
    save({
      id: crypto.randomUUID(),
      savedAt: Date.now(),
      source: 'analyze',
      name: calc.isSpread ? `${order.asset} ${calc.type === 'CALL' ? 'Bull Call' : 'Bear Put'} Spread` : `${order.asset} ${calc.type === 'CALL' ? 'Call' : 'Put'} $${formatNumber(calc.strike, 2)}`,
      asset: order.asset,
      optionType: order.optionType,
      strikes: order.strikes,
      expiry: order.expiry,
      collateral: order.collateral,
      orderId: order.id,
      isUsdSafe: isPremiumUsdSafe(order),
      premium: calc.premium,
      maxProfit: calc.maxProfit,
      maxLoss: calc.maxLoss,
      breakevens: [calc.breakeven],
    })
  }
  return <button type="button" className="preview-button analyze-save" onClick={handleClick}>{existing ? 'Saved ✓ — Remove' : 'Save Idea'}</button>
}
function compute(facts: PayoffFacts) { if (facts.kind === 'spread') { const inputs: spreadPayoff.SpreadPayoffInputs = { ...facts, positionSize: 1 }, curve = spreadPayoff.buildPayoffCurve(inputs, .35, 71), breakeven = spreadPayoff.breakevenPrice(facts.spreadType, facts.nearStrike, facts.premium), scenarios = spreadPayoff.buildScenarios(inputs, SCENARIOS); return { type: facts.spreadType === 'CALL_SPREAD' ? 'CALL' as const : 'PUT' as const, strike: facts.nearStrike, premium: facts.premium, spot: facts.currentPrice, curve, breakeven, maxLoss: spreadPayoff.maxLossTotal(facts.premium, 1), maxProfit: spreadPayoff.maxGainTotal(facts.nearStrike, facts.farStrike, facts.premium, 1), isSpread: true, rows: scenarios.map(({ changePercent: change, price, pnl }) => ({ change, price, pnl, returnPct: facts.premium ? pnl / facts.premium * 100 : 0 })) } } const inputs: payoff.PayoffInputs = { optionType: facts.optionType, strike: facts.strike, premium: facts.premium, positionSize: 1, currentPrice: facts.currentPrice }, curve = payoff.buildPayoffCurve(inputs, .35, 71), breakeven = payoff.breakevenPrice(facts.optionType, facts.strike, facts.premium), scenarios = payoff.buildScenarios(inputs, SCENARIOS); return { type: facts.optionType, strike: facts.strike, premium: facts.premium, spot: facts.currentPrice, curve, breakeven, maxLoss: payoff.maxLossTotal(facts.premium, 1), maxProfit: facts.optionType === 'CALL' ? undefined : payoff.maxPutGainTotal(facts.strike, facts.premium, 1), isSpread: false, rows: scenarios.map(({ changePercent: change, price, pnl }) => ({ change, price, pnl, returnPct: facts.premium ? pnl / facts.premium * 100 : 0 })) } }
function timeLeft(value: number) { if (value <= 0) return 'Expired'; const hours = Math.floor(value / 3_600_000), days = Math.floor(hours / 24); return days ? `${days}d ${hours % 24}h` : `${hours}h ${Math.floor(value / 60_000) % 60}m` }
