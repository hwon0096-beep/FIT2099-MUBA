import { useEffect, useMemo, useState } from 'react'
import { formatExpiry, formatUsd, parseOrderNumber, parseStrikeList } from '../lib/formatters'
import type { PayoffInputs } from '../lib/payoff'
import { resolveAssetPrice, type ExplorerData, type ExplorerOrder } from '../lib/thetanuts'
import PayoffChart from './PayoffChart'
import RiskSummary from './RiskSummary'

interface TradePreviewModalProps {
  order: ExplorerOrder
  marketData: ExplorerData['marketData']
  onClose: () => void
}

export default function TradePreviewModal({ order, marketData, onClose }: TradePreviewModalProps) {
  const optionType = order.optionType === 'PUT' ? 'PUT' : 'CALL'
  const strike = parseStrikeList(order.strikes)[0] ?? 0
  const premium = parseOrderNumber(order.pricePerContract)
  const currentPrice = resolveAssetPrice(order.asset, marketData?.prices) ?? strike

  const [positionSize, setPositionSize] = useState(1)
  const [hypotheticalPrice, setHypotheticalPrice] = useState(currentPrice)

  useEffect(() => { setHypotheticalPrice(currentPrice) }, [currentPrice])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const inputs: PayoffInputs = useMemo(() => ({ optionType, strike, premium, positionSize, currentPrice }),
    [optionType, strike, premium, positionSize, currentPrice])

  const sliderMin = currentPrice * 0.7
  const sliderMax = currentPrice * 1.3

  return <div className="modal-backdrop" role="presentation" onClick={onClose}>
    <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="trade-preview-heading"
      onClick={(event) => event.stopPropagation()}>
      <header className="modal-header">
        <div>
          <p className="eyebrow">TRADE PREVIEW · SETTLES AT EXPIRY</p>
          <h2 id="trade-preview-heading">{order.asset} <span className={`option-type ${optionType.toLowerCase()}`}>{optionType}</span></h2>
          <p className="modal-subtext">Strike {formatUsd(strike)} · Expiry {formatExpiry(order.expiry)}</p>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close trade preview">×</button>
      </header>

      <div className="modal-controls">
        <label className="modal-field">
          <span>Position size (contracts)</span>
          <input type="number" min={0} step="any" value={positionSize}
            onChange={(event) => setPositionSize(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <label className="modal-field modal-field-wide">
          <span>Hypothetical price at expiry: {formatUsd(hypotheticalPrice)}</span>
          <input type="range" min={sliderMin} max={sliderMax} step={(sliderMax - sliderMin) / 200 || 1}
            value={hypotheticalPrice} onChange={(event) => setHypotheticalPrice(Number(event.target.value))} />
        </label>
      </div>

      <PayoffChart inputs={inputs} hypotheticalPrice={hypotheticalPrice} />
      <RiskSummary inputs={inputs} />

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
