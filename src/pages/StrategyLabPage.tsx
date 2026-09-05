import { useCallback, useEffect, useMemo, useState } from 'react'
import { NutIcon } from '../components/VisualSystem'
import PremiumUnlockModal from '../components/PremiumUnlockModal'
import SavedStrategiesSection from '../components/SavedStrategiesSection'
import { useAccount } from '../context/AccountContext'
import { formatCompactExpiry, parseOrderNumber, parseStrikeList } from '../lib/formatters'
import { loadExplorerData, type ExplorerData, type ExplorerOrder } from '../lib/thetanuts'
import { defaultPaperContract, paperPositions, paperSummary, recentPaperTrades, type PaperContract, type PaperOptionSide } from '../data/paperTradingMockData'
import '../styles/strategy-lab.css'
import '../styles/strategy-lab-compact.css'

const formatUsdc = (value: number) => `${value.toLocaleString('en-US')} USDC`

type StrategyLabTab = 'overview' | 'paper-trading' | 'saved-strategies' | 'compare'
// Static: identifies each tab (used for both the activeTab check and the button's key) alongside
// its icon and display label, replacing the old label-string comparison the nav used to derive
// (incorrectly) which single tab could ever be "active".
const STRATEGY_LAB_TABS: { value: StrategyLabTab; icon: 'radar' | 'board' | 'contract' | 'trend'; label: string }[] = [
  { value: 'overview', icon: 'radar', label: 'Overview' },
  { value: 'paper-trading', icon: 'board', label: 'Paper Trading' },
  { value: 'saved-strategies', icon: 'contract', label: 'Saved Strategies' },
  { value: 'compare', icon: 'trend', label: 'Compare' },
]

type TypeFilter = 'ALL' | 'CALL' | 'PUT' | 'Call Spread' | 'Put Spread' | 'Butterfly' | '4-leg structure'
interface ChainLeg { bid?: number; ask?: number }
interface ChainRow { strike: number; expiry: string; asset: string; call: ChainLeg; put: ChainLeg }
const CHAIN_PAGE_SIZE = 25

function orderAsset(order: ExplorerOrder): string { return order.asset.trim().toUpperCase() || 'UNKNOWN' }

/** The four spread-structure Type values switch the chain into the flat Spreads table layout instead of the vanilla strike-grouped one. */
function isSpreadType(type: TypeFilter): boolean { return type !== 'ALL' && type !== 'CALL' && type !== 'PUT' }
function isPremiumChainType(type: TypeFilter): boolean { return isSpreadType(type) }

/**
 * Labels a multi-leg order and describes its legs, reusing the same leg conventions already coded
 * in orderPayoff.ts (2-leg: near strike = long/buy, far strike = short/sell) and
 * strategyRecommendations.ts's findButterfly (3-leg, sorted ascending: low/high = buy, mid = sell x2).
 * 4+-leg orders (condor/iron_condor/ranger) are deliberately left generic — see
 * strategyRecommendations.ts's comment on findButterfly excluding 4-strike orders: optionType is a
 * single field on the whole order, so which legs are calls vs puts can't be reliably told apart.
 */
function describeSpread(order: ExplorerOrder): { label: string; legs: string } {
  const strikes = parseStrikeList(order.strikes)
  if (strikes.length === 2) {
    const [near, far] = strikes
    const label = order.optionType === 'CALL' ? 'Call Spread' : order.optionType === 'PUT' ? 'Put Spread' : 'Spread'
    return { label, legs: `Buy $${near.toLocaleString()} / Sell $${far.toLocaleString()}` }
  }
  if (strikes.length === 3) {
    const [low, mid, high] = strikes.slice().sort((a, b) => a - b)
    return { label: 'Butterfly', legs: `Buy $${low.toLocaleString()} / Sell $${mid.toLocaleString()} x2 / Buy $${high.toLocaleString()}` }
  }
  return { label: `${strikes.length}-leg structure`, legs: strikes.map((strike) => `$${strike.toLocaleString()}`).join(' / ') }
}

export default function StrategyLabPage() {
  const { tier } = useAccount()
  const [selected, setSelected] = useState<PaperContract>(defaultPaperContract)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [search, setSearch] = useState('')
  const [data, setData] = useState<ExplorerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assetFilter, setAssetFilter] = useState('ALL')
  const [expiryFilter, setExpiryFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [visibleCount, setVisibleCount] = useState(CHAIN_PAGE_SIZE)
  const [showUnlock, setShowUnlock] = useState(false)
  const [activeTab, setActiveTab] = useState<StrategyLabTab>('paper-trading')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loadExplorerData())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Live market data is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const orders = data?.orders ?? []
  // This chain only has one column per strike, so multi-leg spread orders (2+ strikes) don't fit its
  // vanilla call/put layout and are left out, matching how OptionsExplorer's orderType() treats them
  // as a distinct 'SPREAD' product rather than a plain CALL/PUT.
  const vanillaOrders = useMemo(() => orders.filter((order) => order.optionType !== 'UNKNOWN' && parseStrikeList(order.strikes).length === 1), [orders])
  const spreadOrders = useMemo(() => orders.filter((order) => parseStrikeList(order.strikes).length >= 2), [orders])
  const isSpreadMode = isSpreadType(typeFilter)

  // Coarse asset/expiry lists: vanilla orders share one candidate set (used for All/Call/Put), all
  // spread orders share another (used for any of the four spread structures) — switching between the
  // four spread values themselves doesn't change this second set, only crossing the vanilla/spread
  // boundary does.
  const vanillaAssets = useMemo(() => [...new Set(vanillaOrders.map(orderAsset))].sort(), [vanillaOrders])
  const spreadAssets = useMemo(() => [...new Set(spreadOrders.map(orderAsset))].sort(), [spreadOrders])
  const assets = isSpreadMode ? spreadAssets : vanillaAssets
  const vanillaExpiries = useMemo(() => [...new Set(vanillaOrders.map((order) => order.expiry))].sort((a, b) => Number(a) - Number(b)), [vanillaOrders])
  const spreadExpiries = useMemo(() => [...new Set(spreadOrders.map((order) => order.expiry))].sort((a, b) => Number(a) - Number(b)), [spreadOrders])
  const expiries = isSpreadMode ? spreadExpiries : vanillaExpiries

  // A selected Asset/Expiry that doesn't exist in the newly-active list (e.g. an asset with vanilla
  // orders but no spreads) is stale once that boundary is crossed — reset rather than silently filter
  // to a permanently empty table.
  useEffect(() => { if (assetFilter !== 'ALL' && !assets.includes(assetFilter)) setAssetFilter('ALL') }, [assets, assetFilter])
  useEffect(() => { if (expiryFilter !== 'ALL' && !expiries.includes(expiryFilter)) setExpiryFilter('ALL') }, [expiries, expiryFilter])

  const chainOrders = useMemo(() => vanillaOrders
    .filter((order) => assetFilter === 'ALL' || orderAsset(order) === assetFilter)
    .filter((order) => expiryFilter === 'ALL' || order.expiry === expiryFilter)
    .filter((order) => typeFilter === 'ALL' || order.optionType === typeFilter),
  [vanillaOrders, assetFilter, expiryFilter, typeFilter])

  // Grouped by strike+expiry (each is a distinct contract); optionType picks call vs put within a row.
  // side='BUY' (maker is buying) is a resting bid, so the best bid is the highest such price; side='SELL'
  // (maker is selling) is a resting ask, so the best ask is the lowest such price.
  const chainRows = useMemo(() => {
    const byKey = new Map<string, ChainRow>()
    for (const order of chainOrders) {
      const strike = parseStrikeList(order.strikes)[0]
      if (strike === undefined) continue
      const key = `${strike}-${order.expiry}`
      let row = byKey.get(key)
      if (!row) { row = { strike, expiry: order.expiry, asset: orderAsset(order), call: {}, put: {} }; byKey.set(key, row) }
      const leg = order.optionType === 'PUT' ? row.put : row.call
      const price = parseOrderNumber(order.pricePerContract)
      if (order.side === 'BUY') leg.bid = leg.bid === undefined ? price : Math.max(leg.bid, price)
      else if (order.side === 'SELL') leg.ask = leg.ask === undefined ? price : Math.min(leg.ask, price)
    }
    return [...byKey.values()].sort((a, b) => a.strike - b.strike || Number(a.expiry) - Number(b.expiry))
  }, [chainOrders])

  const visibleRows = useMemo(() => chainRows.filter((row) => String(row.strike).includes(search.replaceAll(',', '').trim())), [chainRows, search])

  const spreadTableOrders = useMemo(() => spreadOrders
    .filter((order) => assetFilter === 'ALL' || orderAsset(order) === assetFilter)
    .filter((order) => expiryFilter === 'ALL' || order.expiry === expiryFilter)
    .filter((order) => describeSpread(order).label === typeFilter),
  [spreadOrders, assetFilter, expiryFilter, typeFilter])

  useEffect(() => { setVisibleCount(CHAIN_PAGE_SIZE) }, [assetFilter, expiryFilter, typeFilter, search])
  const pagedRows = useMemo(() => visibleRows.slice(0, visibleCount), [visibleRows, visibleCount])
  const pagedSpreadTableOrders = useMemo(() => spreadTableOrders.slice(0, visibleCount), [spreadTableOrders, visibleCount])
  const totalRows = isSpreadMode ? spreadTableOrders.length : visibleRows.length

  const selectContract = (row: ChainRow, side: PaperOptionSide) => {
    const leg = side === 'call' ? row.call : row.put
    if (leg.ask === undefined) return
    setSelectedKey(`${row.strike}-${row.expiry}`)
    // No trade-history endpoint backs a "last traded price" for a live order, so the ask (what a
    // paper buy would actually fill at) stands in for it here.
    setSelected({ asset: row.asset, type: side === 'call' ? 'Call' : 'Put', strike: row.strike, expiry: formatCompactExpiry(row.expiry), last: leg.ask, ask: leg.ask })
  }

  return <main className="app-shell strategy-lab">
    <header className="strategy-lab__hero">
      <div className="strategy-lab__intro"><p className="eyebrow">STRATEGY LAB</p><h1>Paper Trading</h1><p>Practice trading real Thetanuts options with virtual funds before going live. Test strategies, compare scenarios, and build confidence.</p></div>
      <div className="strategy-lab__art" aria-hidden="true"><i /><i /><i /></div>
      <section className="strategy-lab__safety"><NutIcon name="shield" /><div><h2>No real funds at risk</h2><p>All trades are simulated with virtual USDC using live Thetanuts market data. Nothing you do here affects your wallet.</p><button type="button">Learn more →</button></div></section>
    </header>
    <nav className="strategy-lab__tabs" aria-label="Strategy Lab sections">{STRATEGY_LAB_TABS.map(({ value, icon, label }) => <button type="button" key={value} className={activeTab === value ? 'active' : ''} onClick={() => setActiveTab(value)}><NutIcon name={icon} />{label}</button>)}</nav>
    {activeTab === 'paper-trading' && <div className="strategy-lab__workspace">
      <div className="strategy-lab__main">
        <section className="paper-summary" aria-label="Simulated account summary">{paperSummary.slice(0, 3).map((item, index) => <article key={item.label}><span className="summary-icon"><NutIcon name={index === 0 ? 'wallet' : index === 1 ? 'trend' : 'contract'} /></span><div><small>{item.label}</small><strong className={'tone' in item && item.tone === 'positive' ? 'pnl-positive' : ''}>{item.value}</strong><em className={'tone' in item && item.tone === 'positive' ? 'pnl-positive' : ''}>{index === 2 ? 'positions' : item.detail}</em></div></article>)}</section>
        <OptionsChain rows={pagedRows} spreadRows={pagedSpreadTableOrders} totalRows={totalRows} assets={assets} expiries={expiries} assetFilter={assetFilter} expiryFilter={expiryFilter} typeFilter={typeFilter} search={search} selectedKey={selectedKey} loading={loading} error={error} premium={tier === 'premium'} onAsset={setAssetFilter} onExpiry={setExpiryFilter} onType={(next) => { if (isPremiumChainType(next) && tier !== 'premium') setShowUnlock(true); else setTypeFilter(next) }} onSearch={setSearch} onSelect={selectContract} onLoadMore={() => setVisibleCount((count) => count + CHAIN_PAGE_SIZE)} />
        <OpenPaperPositions />
      </div>
      <aside className="strategy-lab__side"><PaperOrderTicket contract={selected} quantity={quantity} onQuantityChange={setQuantity} /><RecentPaperTrades /></aside>
    </div>}
    {activeTab === 'saved-strategies' && <SavedStrategiesSection orders={data ? orders : null} />}
    {activeTab === 'overview' && <section className="strategy-card"><div className="empty-state">Overview coming soon.</div></section>}
    {activeTab === 'compare' && <section className="strategy-card"><div className="empty-state">Compare coming soon.</div></section>}
    {showUnlock && <PremiumUnlockModal onClose={() => setShowUnlock(false)} />}
  </main>
}

function OptionsChain({ rows, spreadRows, totalRows, assets, expiries, assetFilter, expiryFilter, typeFilter, search, selectedKey, loading, error, premium, onAsset, onExpiry, onType, onSearch, onSelect, onLoadMore }: { rows: ChainRow[]; spreadRows: ExplorerOrder[]; totalRows: number; assets: string[]; expiries: string[]; assetFilter: string; expiryFilter: string; typeFilter: TypeFilter; search: string; selectedKey: string | null; loading: boolean; error: string | null; premium: boolean; onAsset: (value: string) => void; onExpiry: (value: string) => void; onType: (value: TypeFilter) => void; onSearch: (value: string) => void; onSelect: (row: ChainRow, side: PaperOptionSide) => void; onLoadMore: () => void }) {
  const isSpreadMode = isSpreadType(typeFilter)
  // With no dedicated Expiry column, a strike shown under more than one expiry needs the expiry
  // spelled out inline so two different contracts don't read as the same row.
  const showExpiryHint = useMemo(() => new Set(rows.map((row) => row.expiry)).size > 1, [rows])
  const showCalls = !isSpreadMode && typeFilter !== 'PUT'
  const showPuts = !isSpreadMode && typeFilter !== 'CALL'
  const shownCount = isSpreadMode ? spreadRows.length : rows.length
  return <section className="strategy-card strategy-card--chain"><div className="strategy-card__head"><div><h2>Options Chain</h2><p>Browse Thetanuts options and place simulated trades.</p></div><span className="demo-label"><i />Live data</span></div><div className="chain-filters"><label>Asset<select value={assetFilter} onChange={(event) => onAsset(event.target.value)}><option value="ALL">All assets</option>{assets.map((asset) => <option key={asset} value={asset}>{asset}</option>)}</select></label><label>Expiry<select value={expiryFilter} onChange={(event) => onExpiry(event.target.value)}><option value="ALL">All expiries</option>{expiries.map((expiry) => <option key={expiry} value={expiry}>{formatCompactExpiry(expiry)}</option>)}</select></label><label>Type<select value={typeFilter} onChange={(event) => onType(event.target.value as TypeFilter)}><optgroup label="Option Type"><option value="ALL">All</option><option value="CALL">Call</option><option value="PUT">Put</option></optgroup><optgroup label="Strategies"><option value="Call Spread">{premium ? 'Call Spread' : '🔒 Call Spread'}</option><option value="Put Spread">{premium ? 'Put Spread' : '🔒 Put Spread'}</option><option value="Butterfly">{premium ? 'Butterfly' : '🔒 Butterfly'}</option><option value="4-leg structure">{premium ? '4-leg structure' : '🔒 4-leg structure'}</option></optgroup></select></label>{!isSpreadMode && <label className="chain-filters__search">Search<input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search strike or order ID..." /></label>}</div><div className="strategy-table-wrap">{loading && !shownCount ? <p>Loading live OptionBook orders…</p> : error ? <p role="alert">Unable to load live options data: {error}</p> : !shownCount ? <p>No live orders match the current filters.</p> : isSpreadMode ? <table><thead><tr><th>Asset</th><th>Structure</th><th>Expiry</th><th>Legs</th><th>Combined Premium</th><th>Side</th><th>Available Size</th></tr></thead><tbody>{spreadRows.map((order) => { const { label, legs } = describeSpread(order); return <tr key={order.id}><td><strong>{orderAsset(order)}</strong></td><td>{label}</td><td>{formatCompactExpiry(order.expiry)}</td><td>{legs}</td><td>{parseOrderNumber(order.pricePerContract).toLocaleString()} <small>{order.collateral}</small></td><td>{order.side === 'BUY' ? 'Buy' : order.side === 'SELL' ? 'Sell' : '—'}</td><td>{order.availableAmount}</td></tr> })}</tbody></table> : <table className="options-chain-table"><thead><tr>{showCalls && <th colSpan={3} className="call-heading">Calls (Buy)</th>}<th rowSpan={2}>Strike</th>{showPuts && <th colSpan={3} className="put-heading">Puts (Buy)</th>}</tr><tr>{showCalls && <><th>Bid</th><th>Ask</th><th aria-label="Call action" /></>}{showPuts && <><th>Bid</th><th>Ask</th><th aria-label="Put action" /></>}</tr></thead><tbody>{rows.map((row) => { const key = `${row.strike}-${row.expiry}`; return <tr key={key} className={key === selectedKey ? 'selected' : ''}>{showCalls && <><td>{row.call.bid !== undefined ? row.call.bid.toLocaleString() : '—'}</td><td>{row.call.ask !== undefined ? row.call.ask.toLocaleString() : '—'}</td><td><button type="button" className="paper-buy paper-buy--call" disabled={row.call.ask === undefined} onClick={() => onSelect(row, 'call')}>Paper Buy</button></td></>}<td className="strike">{row.strike.toLocaleString()}{showExpiryHint && <small>{formatCompactExpiry(row.expiry)}</small>}</td>{showPuts && <><td>{row.put.bid !== undefined ? row.put.bid.toLocaleString() : '—'}</td><td>{row.put.ask !== undefined ? row.put.ask.toLocaleString() : '—'}</td><td><button type="button" className="paper-buy paper-buy--put" disabled={row.put.ask === undefined} onClick={() => onSelect(row, 'put')}>Paper Buy</button></td></>}</tr> })}</tbody></table>}</div>{shownCount < totalRows && <button type="button" className="text-action chain-load-more" onClick={onLoadMore}>Load more ({totalRows - shownCount} remaining)</button>}</section>
}

function PaperOrderTicket({ contract, quantity, onQuantityChange }: { contract: PaperContract; quantity: number; onQuantityChange: (quantity: number) => void }) {
  const total = contract.ask * quantity
  return <aside className="strategy-card strategy-card--ticket"><div className="strategy-card__head"><h2>Paper Order Ticket <em>Simulated</em></h2><button type="button" className="text-action">Clear</button></div><div className="ticket-contract"><strong>{contract.asset} ${contract.strike.toLocaleString()} {contract.type}</strong><span className={`option-type ${contract.type === 'Call' ? 'call' : 'put'}`}>{contract.type}</span></div><dl className="ticket-details"><div><dt>Asset</dt><dd>{contract.asset}</dd></div><div><dt>Type</dt><dd>{contract.type}</dd></div><div><dt>Strike</dt><dd>${contract.strike.toLocaleString()}</dd></div><div><dt>Expiry</dt><dd>{contract.expiry}</dd></div><div><dt>Ask Price</dt><dd>{formatUsdc(contract.ask)}</dd></div></dl><div className="quantity"><span>Quantity / Contracts</span><div><button type="button" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button><output>{quantity}</output><button type="button" onClick={() => onQuantityChange(quantity + 1)}>+</button></div><small>1 contract = 1 option</small></div><div className="ticket-totals"><p>Estimated Cost<strong>{formatUsdc(total)}</strong></p><p>Virtual Balance After Trade<strong>{formatUsdc(10000 - total)}</strong></p></div><button type="button" className="simulate-trade">Simulate Trade <NutIcon name="arrow" /></button><p className="ticket-disclaimer">This is a simulated paper trade using virtual USDC. No real funds will be spent.</p></aside>
}

function OpenPaperPositions() { return <section className="strategy-card strategy-card--positions"><div className="strategy-card__head"><h2>Open Paper Positions <small>(3)</small></h2><button type="button" className="text-action">View all →</button></div><div className="strategy-table-wrap"><table><thead><tr><th>Asset</th><th>Strategy</th><th>Entry Date</th><th>Days to Expiry</th><th>Entry Cost</th><th>Current Value</th><th>Paper P&amp;L</th><th>Status</th><th>Action</th></tr></thead><tbody>{paperPositions.map((position) => <tr key={position.strategy}><td><strong>{position.asset}</strong></td><td><strong>{position.strategy}</strong><small>{position.detail}</small></td><td>{position.entry}</td><td>{position.days}</td><td>{position.cost}</td><td>{position.value}</td><td className={position.positive ? 'pnl-positive' : 'pnl-negative'}>{position.pnl}<small>{position.change}</small></td><td><span className="open-status">Open</span></td><td><button type="button" className="view-position">View</button></td></tr>)}</tbody></table></div></section> }

function RecentPaperTrades() { return <section className="strategy-card"><div className="strategy-card__head"><h2>Recent Paper Trades</h2><button type="button" className="text-action">View all →</button></div>{recentPaperTrades.map((trade) => <article className="recent-paper-trade" key={trade.strategy}><div><strong>{trade.strategy}</strong><small>{trade.date}</small></div><span className={trade.positive ? 'pnl-positive' : 'pnl-negative'}>{trade.amount}</span><em>{trade.status}</em></article>)}</section> }
