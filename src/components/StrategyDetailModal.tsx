import { useEffect, useId, useMemo, useRef } from 'react'
import { formatExpiry, formatUsd, parseOrderNumber, parseStrikeList } from '../lib/formatters'
import type { ExplorerOrder } from '../lib/thetanuts'
import '../styles/strategy-detail-modal.css'

export type StrategyDetailKind = 'long-call' | 'long-put' | 'bull-call-spread' | 'bear-put-spread' | 'iron-condor' | 'butterfly'
interface DetailLeg { action: 'BUY' | 'SELL'; quantity: number; type: 'CALL' | 'PUT'; label: string }
interface StrategyDetail { name: string; category: string; outlook: string; explanation: string; bestOutcome: string; risk: string; legs: DetailLeg[] }

const STRATEGIES: Record<StrategyDetailKind, StrategyDetail> = {
  'long-call': {
    name: 'Long Call', category: 'Directional upside',
    outlook: 'Bullish — expect the underlying asset to rise.',
    explanation: 'Buy a call for the right to buy the underlying asset at the strike price.',
    bestOutcome: 'The underlying price rises significantly above the strike price.',
    risk: 'Loss is limited to the premium paid.',
    legs: [{ action: 'BUY', quantity: 1, type: 'CALL', label: 'Strike price' }],
  },
  'long-put': {
    name: 'Long Put', category: 'Directional downside',
    outlook: 'Bearish — expect the underlying asset to fall.',
    explanation: 'Buy a put for the right to sell the underlying asset at the strike price.',
    bestOutcome: 'The underlying price falls significantly below the strike price.',
    risk: 'Loss is limited to the premium paid.',
    legs: [{ action: 'BUY', quantity: 1, type: 'PUT', label: 'Strike price' }],
  },
  'bull-call-spread': {
    name: 'Bull Call Spread', category: 'Bullish strategy',
    outlook: 'Bullish — expects the underlying price to rise moderately.',
    explanation: 'Buy a lower-strike call and sell a higher-strike call to reduce upfront cost while capping the upside.',
    bestOutcome: 'Underlying finishes above the higher strike at expiry.',
    risk: 'Defined loss. For a debit spread, loss is limited to the net premium paid; profit is capped.',
    legs: [{ action: 'BUY', quantity: 1, type: 'CALL', label: 'Lower strike' }, { action: 'SELL', quantity: 1, type: 'CALL', label: 'Higher strike' }],
  },
  'bear-put-spread': {
    name: 'Bear Put Spread', category: 'Bearish strategy',
    outlook: 'Bearish — expects the underlying price to fall moderately.',
    explanation: 'Buy a higher-strike put and sell a lower-strike put to reduce upfront cost while capping the downside profit.',
    bestOutcome: 'Underlying finishes below the lower strike at expiry.',
    risk: 'Defined loss. For a debit spread, loss is limited to the net premium paid; profit is capped.',
    legs: [{ action: 'BUY', quantity: 1, type: 'PUT', label: 'Higher strike' }, { action: 'SELL', quantity: 1, type: 'PUT', label: 'Lower strike' }],
  },
  'butterfly': {
    name: 'Butterfly', category: 'Target-price strategy',
    outlook: 'Neutral — expects the underlying price to finish near the middle strike.',
    explanation: 'Buy calls at the outer strikes and sell two calls at the middle strike to focus the payoff around a target price.',
    bestOutcome: 'Underlying finishes near the middle strike at expiry.',
    risk: 'Defined loss. Risk depends on the strike spacing and net premium; unequal wings can add loss beyond the premium paid.',
    legs: [{ action: 'BUY', quantity: 1, type: 'CALL', label: 'Lower strike' }, { action: 'SELL', quantity: 2, type: 'CALL', label: 'Middle strike' }, { action: 'BUY', quantity: 1, type: 'CALL', label: 'Higher strike' }],
  },
  'iron-condor': {
    name: 'Iron Condor', category: 'Range-bound strategy',
    outlook: 'Neutral — expects the underlying to remain within a price range.',
    explanation: 'Sell an inner put and call, then buy a further-out put and call to limit risk on both sides.',
    bestOutcome: 'Underlying expires between the two short strikes.',
    risk: 'Defined loss. The outer options cap expiry losses; the amount depends on wing widths and net premium.',
    legs: [{ action: 'BUY', quantity: 1, type: 'PUT', label: 'Lowest strike' }, { action: 'SELL', quantity: 1, type: 'PUT', label: 'Lower-middle strike' }, { action: 'SELL', quantity: 1, type: 'CALL', label: 'Upper-middle strike' }, { action: 'BUY', quantity: 1, type: 'CALL', label: 'Highest strike' }],
  },
}

interface LiveExample { asset: string; expiry: string; strikes: number[] }

/** Listed strikes only: this does not establish executable bid/ask quotes or price a strategy. */
export function findLiveStrategyExample(strategy: StrategyDetailKind, orders: ExplorerOrder[], now = Date.now()): LiveExample | null {
  const groups = new Map<string, { asset: string; expiry: string; CALL: Set<number>; PUT: Set<number> }>()
  for (const order of orders) {
    const strikes = parseStrikeList(order.strikes)
    const expiry = Number(order.expiry)
    const asset = order.asset.trim().toUpperCase()
    if (!asset || asset === 'UNKNOWN' || order.optionType === 'UNKNOWN' || strikes.length !== 1 || strikes[0] <= 0 || !Number.isFinite(expiry) || expiry * 1000 <= now || parseOrderNumber(order.availableAmount) <= 0) continue
    // Keep collateral families separate too; physical and cash-settled options are not interchangeable.
    const key = JSON.stringify([asset, expiry, order.collateral])
    let group = groups.get(key)
    if (!group) {
      group = { asset, expiry: String(expiry), CALL: new Set(), PUT: new Set() }
      groups.set(key, group)
    }
    group[order.optionType].add(strikes[0])
  }

  // Prefer the earliest expiry with a full structure, then nearby, distinct strikes.
  for (const group of [...groups.values()].sort((a, b) => Number(a.expiry) - Number(b.expiry) || a.asset.localeCompare(b.asset))) {
    const calls = [...group.CALL].sort((a, b) => a - b)
    const puts = [...group.PUT].sort((a, b) => a - b)
    let candidates: number[][] = []
    if (strategy === 'iron-condor') {
      for (let i = 0; i < puts.length - 1; i++) {
        const j = calls.findIndex(strike => strike > puts[i + 1])
        if (j >= 0 && j + 1 < calls.length) candidates.push([puts[i], puts[i + 1], calls[j], calls[j + 1]])
      }
    } else {
      const strikes = strategy === 'bear-put-spread' || strategy === 'long-put' ? puts : calls
      const count = strategy === 'long-call' || strategy === 'long-put' ? 1 : strategy === 'butterfly' ? 3 : 2
      candidates = strikes.slice(0, Math.max(0, strikes.length - count + 1)).map((_, i) => strikes.slice(i, i + count))
    }
    candidates.sort((a, b) => (a.at(-1)! - a[0]) - (b.at(-1)! - b[0]))
    const strikes = candidates[0]
    if (strikes) return { asset: group.asset, expiry: group.expiry, strikes: strategy === 'bear-put-spread' ? strikes.slice().reverse() : strikes }
  }
  return null
}

export default function StrategyDetailModal({ strategy, orders, loading = false, onClose }: {
  strategy: StrategyDetailKind; orders: ExplorerOrder[]; loading?: boolean; onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const detail = STRATEGIES[strategy]
  const example = useMemo(() => findLiveStrategyExample(strategy, orders), [strategy, orders])

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])

  const close = () => {
    dialogRef.current?.close() // Restore focus to Explore before the modal unmounts.
    onClose()
  }

  return <dialog ref={dialogRef} className="modal-panel strategy-detail-modal" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close() }}>
    <header className="modal-header">
      <div><p className="eyebrow">{detail.category}</p><h2 id={titleId}>{detail.name}</h2></div>
      <button type="button" className="modal-close" aria-label="Close strategy details" onClick={close}>×</button>
    </header>
    <p className="strategy-detail-modal__explanation">{detail.explanation}</p>
    <section><h3>Market View</h3><p>{detail.outlook}</p></section>
    <section>
      <h3>Strategy Legs</h3>
      {example ? <p className="strategy-detail-modal__market">{example.asset} · {formatExpiry(example.expiry)}</p> : <p role="status">{loading ? 'Loading live Thetanuts orders…' : 'No suitable live Thetanuts combination is currently available.'}</p>}
      <ul className="strategy-detail-modal__legs">
        {detail.legs.map((leg, index) => <li key={leg.label} className={strategy === 'butterfly' && index === 1 ? 'is-target' : undefined}>
          <span className={`strategy-detail-modal__action strategy-detail-modal__action--${leg.action.toLowerCase()}`}>{leg.action}</span>
          <span>{leg.quantity}× {leg.type}</span>
          <strong>{example ? formatUsd(example.strikes[index], 6) : leg.label}</strong>
        </li>)}
      </ul>
      {example && <p className="strategy-detail-modal__note">Example structure using live listed strikes. Executable bid/ask availability is not verified; no premium is quoted.</p>}
    </section>
    {strategy === 'butterfly' && <section className="strategy-detail-modal__target"><h3>Target Price</h3><strong>{example ? formatUsd(example.strikes[1], 6) : 'Middle strike'}</strong></section>}
    <div className="strategy-detail-modal__outcomes">
      <section><h3>Best Outcome</h3><p>{detail.bestOutcome}</p></section>
      <section><h3>Risk</h3><p>{detail.risk}</p></section>
    </div>
    <footer className="modal-footer"><button type="button" className="modal-cancel" onClick={close}>Close</button></footer>
  </dialog>
}
