import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatExpiry, formatNumber, formatUsd, parseStrikeList } from '../lib/formatters'
import { buildPayoffFacts } from '../lib/orderPayoff'
import * as vanillaPayoff from '../lib/payoff'
import * as spreadPayoff from '../lib/spreadPayoff'
import { loadExplorerData, resolveAssetPrice, type ExplorerData, type ExplorerOrder } from '../lib/thetanuts'
import PayoffPreviewBody, { type PayoffFacts } from '../components/PayoffPreviewBody'

/** Same eligibility rule as buildPayoffFacts (1 or 2 strikes, a known CALL/PUT side) — see orderPayoff.ts's comment on why 3+ strike structures have no payoff math yet. */
function isEligible(order: ExplorerOrder): boolean {
  if (order.optionType === 'UNKNOWN') return false
  const strikeCount = parseStrikeList(order.strikes).length
  return strikeCount === 1 || strikeCount === 2
}

/** Plain-English readout of the same payoff math PayoffPreviewBody/RiskSummary use — calls the same lib/payoff.ts and lib/spreadPayoff.ts functions rather than re-deriving breakeven/max-loss/max-gain. Figures are per contract (position size 1), matching PayoffPreviewBody's own initial position size. */
function explainerLines(order: ExplorerOrder, payoff: PayoffFacts): string[] {
  if (payoff.kind === 'vanilla') {
    const breakeven = vanillaPayoff.breakevenPrice(payoff.optionType, payoff.strike, payoff.premium)
    const maxLoss = vanillaPayoff.maxLossTotal(payoff.premium, 1)
    const action = payoff.optionType === 'CALL' ? 'buy' : 'sell'
    const direction = payoff.optionType === 'CALL' ? 'above' : 'below'

    return [
      `This ${payoff.optionType} gives the holder the right — not the obligation — to ${action} ${order.asset} at ${formatUsd(payoff.strike)} at expiry.`,
      `It breaks even if ${order.asset} settles at ${formatUsd(breakeven)} at expiry — ${direction} that price, the position is profitable.`,
      `Because this is a long position, the most it can lose is the ${formatUsd(maxLoss)} premium paid per contract, no matter how far the price moves against it.`,
    ]
  }

  const breakeven = spreadPayoff.breakevenPrice(payoff.spreadType, payoff.nearStrike, payoff.premium)
  const maxLoss = spreadPayoff.maxLossTotal(payoff.premium, 1)
  const maxGain = spreadPayoff.maxGainTotal(payoff.nearStrike, payoff.farStrike, payoff.premium, 1)
  const isCallSpread = payoff.spreadType === 'CALL_SPREAD'
  const action = isCallSpread ? 'buy' : 'sell'
  const direction = isCallSpread ? 'above' : 'below'
  const capDirection = isCallSpread ? 'rises to' : 'falls to'

  return [
    `This ${order.optionType} SPREAD gives the holder the right — not the obligation — to ${action} ${order.asset} at ${formatUsd(payoff.nearStrike)} at expiry, with gains capped once the price ${capDirection} ${formatUsd(payoff.farStrike)}.`,
    `It breaks even if ${order.asset} settles at ${formatUsd(breakeven)} at expiry — ${direction} that price (up to the cap), the position is profitable.`,
    `The most it can lose is the ${formatUsd(maxLoss)} premium paid per contract; the most it can gain is capped at ${formatUsd(maxGain)} per contract.`,
  ]
}

export default function AnalyzePage() {
  const [data, setData] = useState<ExplorerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deepLinkMissing, setDeepLinkMissing] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadExplorerData()
      .then((result) => { if (!cancelled) setData(result) })
      .catch((reason: unknown) => {
        console.error('[Thetanuts Analyze] Explorer data loading failed', reason)
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load live analysis data.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const eligibleOrders = useMemo(() => (data?.orders ?? []).filter(isEligible), [data?.orders])

  // Pre-select ?order=<id> once orders load, tried exactly once — later manual
  // selections (which also update the URL, see handleSelect) must not be
  // overwritten by this running again.
  const appliedDeepLink = useRef(false)
  useEffect(() => {
    if (appliedDeepLink.current || !data?.orders) return
    appliedDeepLink.current = true
    const requestedId = searchParams.get('order')
    if (!requestedId) return
    const match = eligibleOrders.find((order) => order.id === requestedId)
    if (match) setSelectedId(match.id)
    else setDeepLinkMissing(true)
  }, [data?.orders, eligibleOrders, searchParams])

  const selectedOrder = eligibleOrders.find((order) => order.id === selectedId) ?? null
  const payoff: PayoffFacts | null = selectedOrder ? buildPayoffFacts(selectedOrder, data?.marketData) : null
  const spotPrice = selectedOrder ? resolveAssetPrice(selectedOrder.asset, data?.marketData?.prices) : undefined

  const handleSelect = (id: string) => {
    setDeepLinkMissing(false)
    setSelectedId(id || null)
    setSearchParams(id ? { order: id } : {}, { replace: true })
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">THETANUTS FINANCE × BASE</p>
          <h1>Analyze a trade</h1>
          <p className="intro">Pick a live OptionBook order and see its full payoff chart, breakeven, and risk before you trade.</p>
        </div>
      </header>

      {error && <section className="notice error-notice" role="alert">
        <strong>We couldn't load live analysis data.</strong>
        <p>{error} Please check the server connection and try again.</p>
      </section>}

      <section className="section order-section" aria-labelledby="picker-heading">
        <div className="section-heading">
          <div><p className="eyebrow">PICK AN ORDER</p><h2 id="picker-heading">Choose a trade to analyze</h2></div>
        </div>

        {loading && !data && <div className="empty-state"><span className="loader" />Loading a live order…</div>}
        {!loading && eligibleOrders.length === 0 && <div className="empty-state">No orders available to analyze right now.</div>}
        {deepLinkMissing && <div className="empty-state">The linked order isn't available in the live book right now — pick another one below.</div>}

        {eligibleOrders.length > 0 && (
          <label className="modal-field modal-field-wide">
            <span>Order</span>
            <select value={selectedId ?? ''} onChange={(event) => handleSelect(event.target.value)}>
              <option value="" disabled>Select an order…</option>
              {eligibleOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.asset} {order.optionType}{parseStrikeList(order.strikes).length === 2 ? ' SPREAD' : ''} · {order.strikes} · {formatExpiry(order.expiry)}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {selectedOrder && payoff && <>
        <SelectedTradeCard order={selectedOrder} payoff={payoff} spotPrice={spotPrice} />
        <ExplainerBox order={selectedOrder} payoff={payoff} />
        <section className="section order-section" aria-labelledby="payoff-heading">
          <div className="section-heading">
            <div><p className="eyebrow">PAYOFF ANALYSIS</p><h2 id="payoff-heading">Chart, risk, and scenarios</h2></div>
          </div>
          <PayoffPreviewBody payoff={payoff} />
        </section>
      </>}
    </main>
  )
}

function SelectedTradeCard({ order, payoff, spotPrice }: { order: ExplorerOrder; payoff: PayoffFacts; spotPrice: number | undefined }) {
  const badgeLabel = payoff.kind === 'spread' ? `${order.optionType} SPREAD` : order.optionType

  return <section className="section order-section" aria-labelledby="selected-trade-heading">
    <div className="section-heading">
      <div><p className="eyebrow">SELECTED TRADE</p><h2 id="selected-trade-heading">{order.asset} {badgeLabel}</h2></div>
    </div>
    <div className="metric-grid">
      <Metric label="Asset" value={order.asset} hint="Underlying" />
      <Metric label="Option type" value={<span className={`option-type ${order.optionType.toLowerCase()}`}>{badgeLabel}</span>} hint={payoff.kind === 'spread' ? 'Vertical spread' : 'Vanilla'} />
      <Metric label="Strike(s)" value={order.strikes} hint="8-decimal strike price" />
      <Metric label="Expiry" value={formatExpiry(order.expiry)} hint="Settlement time" />
      <Metric label="Current spot" value={formatUsd(spotPrice)} hint="Thetanuts market data" />
      <Metric label="Premium" value={<>{formatNumber(order.pricePerContract, 6)} <span className="unit">{order.collateral}</span></>} hint="Per contract" />
      <Metric label="Order type" value="Buy to Open" hint="Taker fills the maker's order" />
    </div>
  </section>
}

function ExplainerBox({ order, payoff }: { order: ExplorerOrder; payoff: PayoffFacts }) {
  const lines = explainerLines(order, payoff)
  return <section className="section order-section" aria-labelledby="explainer-heading">
    <div className="section-heading">
      <div><p className="eyebrow">WHAT THIS MEANS</p><h2 id="explainer-heading">In plain English</h2></div>
    </div>
    <ul className="explainer-list">
      {lines.map((line) => <li key={line}>{line}</li>)}
    </ul>
  </section>
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>
}
