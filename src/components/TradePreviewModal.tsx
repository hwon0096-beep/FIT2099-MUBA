import { useEffect } from 'react'
import { formatExpiry, formatUsd } from '../lib/formatters'
import { buildPayoffFacts } from '../lib/orderPayoff'
import type { ExplorerData, ExplorerOrder } from '../lib/thetanuts'
import PayoffPreviewBody from './PayoffPreviewBody'

interface TradePreviewModalProps {
  order: ExplorerOrder
  marketData: ExplorerData['marketData']
  onClose: () => void
}

export default function TradePreviewModal({ order, marketData, onClose }: TradePreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const payoff = buildPayoffFacts(order, marketData)
  if (!payoff) return null

  const badgeLabel = payoff.kind === 'spread' ? `${order.optionType} SPREAD` : order.optionType
  const strikeLabel = payoff.kind === 'vanilla' ? `Strike ${formatUsd(payoff.strike)}` : `Strikes ${order.strikes}`

  return <div className="modal-backdrop" role="presentation" onClick={onClose}>
    <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="trade-preview-heading"
      onClick={(event) => event.stopPropagation()}>
      <header className="modal-header">
        <div>
          <p className="eyebrow">TRADE PREVIEW · SETTLES AT EXPIRY</p>
          <h2 id="trade-preview-heading">{order.asset} <span className={`option-type ${order.optionType.toLowerCase()}`}>{badgeLabel}</span></h2>
          <p className="modal-subtext">{strikeLabel} · Expiry {formatExpiry(order.expiry)}</p>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close trade preview">×</button>
      </header>

      <PayoffPreviewBody payoff={payoff} />

      <footer className="modal-footer">
        <button type="button" className="modal-cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="modal-confirm" disabled
          title="This explorer is read-only — trade execution isn't wired up yet.">
          Confirm Trade
        </button>
      </footer>
    </div>
  </div>
}
