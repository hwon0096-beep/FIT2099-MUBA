import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCompactExpiry, formatNumber, formatUsd } from '../lib/formatters'
import { isPremiumUsdSafe } from '../lib/orderPayoff'
import { buildStrategyCandidates, type Outlook, type StrategyRecommendation } from '../lib/strategyRecommendations'
import { resolveAssetPrice, type ExplorerData, type ExplorerOrder } from '../lib/thetanuts'
import { useSavedStrategies } from '../hooks/useSavedStrategies'
import '../styles/strategy-recommendations.css'

const OUTLOOKS: { value: Outlook; label: string }[] = [
  { value: 'BULLISH', label: 'Bullish' },
  { value: 'BEARISH', label: 'Bearish' },
  { value: 'NEUTRAL', label: 'Neutral' },
]

export default function StrategyRecommendations({ orders, marketData }: { orders: ExplorerOrder[]; marketData: ExplorerData['marketData'] }) {
  const assets = useMemo(() => Array.from(new Set(orders.map((order) => order.asset))).filter((asset) => asset !== 'Unknown').sort(), [orders])
  const defaultAsset = useMemo(() => assets.find((a) => resolveAssetPrice(a, marketData?.prices) !== undefined) ?? assets[0], [assets, marketData])
  const [asset, setAsset] = useState<string | null>(null)
  const [outlook, setOutlook] = useState<Outlook>('BULLISH')
  const navigate = useNavigate()

  const activeAsset = asset ?? defaultAsset
  const spot = activeAsset ? resolveAssetPrice(activeAsset, marketData?.prices) : undefined
  const candidates = useMemo(
    () => (activeAsset ? buildStrategyCandidates(orders, marketData, activeAsset, outlook) : []),
    [orders, marketData, activeAsset, outlook],
  )

  if (!assets.length) return null

  return (
    <section className="analyze-card strategy-recs">
      <header>
        <div>
          <h2>Strategy Ideas</h2>
          <p>Live-order matches for a market outlook, built from the same OptionBook data as the rest of this app — not a recommendation to trade.</p>
        </div>
      </header>
      <div className="strategy-controls">
        <div className="strategy-pill-group" role="group" aria-label="Asset">
          {assets.map((a) => (
            <button key={a} type="button" className={a === activeAsset ? 'active' : ''} onClick={() => setAsset(a)}>{a}</button>
          ))}
        </div>
        <div className="strategy-pill-group" role="group" aria-label="Market outlook">
          {OUTLOOKS.map((o) => (
            <button key={o.value} type="button" className={o.value === outlook ? `active ${o.value.toLowerCase()}` : ''} onClick={() => setOutlook(o.value)}>{o.label}</button>
          ))}
        </div>
      </div>
      {outlook === 'NEUTRAL' && (
        <p className="strategy-note">
          Only butterflies are shown for a neutral outlook. Condor / iron-condor orders exist in the live book, but buying an iron condor is
          actually a directional breakout bet, not a range-bound one — and this app can't yet reliably tell a same-type condor apart from an
          iron condor from the order data alone, so neither is shown here to avoid mislabeling a directional trade as neutral.
        </p>
      )}
      <div className="strategy-grid">
        {candidates.map((candidate) => (
          candidate.recommendation
            ? <StrategyCard key={candidate.kind} rec={candidate.recommendation} onAnalyze={() => navigate(`/analyze?order=${encodeURIComponent(candidate.recommendation!.order.id)}`)} />
            : <div className="strategy-card unavailable" key={candidate.kind}><h3>{candidate.name}</h3><p>{candidate.unavailableReason}</p></div>
        ))}
      </div>
      {spot === undefined && <small className="strategy-spot-note">Live spot price for {activeAsset} is currently unavailable.</small>}
    </section>
  )
}

function StrategyCard({ rec, onAnalyze }: { rec: StrategyRecommendation; onAnalyze: () => void }) {
  const { items, save, remove } = useSavedStrategies()
  const existing = items.find((item) => item.source === 'recommendation' && item.orderId === rec.order.id && item.kind === rec.kind)
  const handleSave = () => {
    if (existing) { remove(existing.id); return }
    save({
      id: crypto.randomUUID(),
      savedAt: Date.now(),
      source: 'recommendation',
      kind: rec.kind,
      name: rec.name,
      asset: rec.asset,
      optionType: rec.legs.length === 1 ? rec.legs[0].optionType : 'UNKNOWN',
      strikes: rec.legs.map((leg) => `$${formatNumber(leg.strike, 2)}`).join(' / '),
      expiry: rec.expiry,
      collateral: rec.order.collateral,
      orderId: rec.order.id,
      isUsdSafe: isPremiumUsdSafe(rec.order),
      premium: rec.premium,
      maxProfit: rec.maxProfit,
      maxLoss: rec.maxLoss,
      breakevens: rec.breakevens,
    })
  }
  return (
    <article className="strategy-card">
      <header>
        <h3>{rec.name}</h3>
        <span className={`outlook-tag ${rec.outlook.toLowerCase()}`}>{rec.outlook[0] + rec.outlook.slice(1).toLowerCase()}</span>
      </header>
      <ul className="strategy-legs">
        {rec.legs.map((leg, index) => (
          <li key={index}>
            <span className={leg.action === 'BUY' ? 'buy' : 'sell'}>{leg.action}{leg.quantity > 1 ? ` ${leg.quantity}x` : ''}</span>
            {' '}{rec.asset} {leg.optionType} ${formatNumber(leg.strike, 2)}
          </li>
        ))}
      </ul>
      <p className="strategy-expiry">Expires {formatCompactExpiry(rec.expiry)}</p>
      <dl className="strategy-metrics">
        <div><dt>Premium</dt><dd>{formatNumber(rec.premium, 6)} USDC</dd></div>
        <div><dt>Max profit</dt><dd>{rec.maxProfit === undefined ? 'Unlimited' : formatUsd(rec.maxProfit)}</dd></div>
        <div><dt>Max loss</dt><dd>{formatUsd(rec.maxLoss)}</dd></div>
        <div><dt>Breakeven</dt><dd>{rec.breakevens.map((value) => formatUsd(value)).join(' – ')}</dd></div>
      </dl>
      <p className="strategy-reason">{rec.reason}</p>
      <div className="strategy-actions">
        <button type="button" className="strategy-analyze" onClick={onAnalyze}>Analyze this order →</button>
        <button type="button" className="strategy-save" onClick={handleSave}>{existing ? 'Saved ✓ — Remove' : 'Save Idea'}</button>
      </div>
    </article>
  )
}
