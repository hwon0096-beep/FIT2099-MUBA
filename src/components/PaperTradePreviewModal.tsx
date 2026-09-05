import { breakevenPrice, maxLossTotal, type OptionType } from '../lib/payoff'
import { formatNumber, formatUsd } from '../lib/formatters'
import type { PaperContract } from '../data/paperTradingMockData'
import '../styles/paper-trade-preview.css'

// Reuses the app-wide .modal-backdrop/.modal-panel chrome (index.css, already used by
// PremiumUnlockModal/TradePreviewModal) and .modal-footer/.modal-cancel/.modal-primary for the
// action row, plus the existing .quantity stepper markup (styled in strategy-lab.css, loaded
// wherever this modal is mounted) — only the header/detail-grid/cost-box layout below is new CSS.
export default function PaperTradePreviewModal({ contract, quantity, onQuantityChange, onConfirm, onCancel }: {
  contract: PaperContract
  quantity: number
  onQuantityChange: (quantity: number) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const optionType: OptionType = contract.type === 'Call' ? 'CALL' : 'PUT'
  // Same tested functions FillFlow.tsx/AnalyzePage.tsx already use for this exact math — no new
  // duplicate calculation. Max loss for a long option is capped at the premium paid, so it's the
  // identical value as estimated cost, not a second computation.
  const estimatedCost = maxLossTotal(contract.ask, quantity)
  const maxLoss = estimatedCost
  const breakeven = breakevenPrice(optionType, contract.strike, contract.ask)
  // ChainRow has no single backing order id (it's a best-bid/ask aggregate across the live book,
  // not one order) — this reference is real, and matches exactly the same strike-expiryRaw key
  // StrategyLabPage's own selectedKey uses to track/highlight the selected row, just deliberately
  // not labeled "Order ID" since it isn't one.
  const reference = `${contract.strike}-${contract.expiryRaw}`

  return <div className="modal-backdrop">
    <section className="modal-panel paper-preview-modal">
      <header className="paper-preview-modal__header">
        <div className="paper-preview-modal__title">
          <span className={`paper-preview-modal__icon ${contract.type.toLowerCase()}`}>{contract.asset.slice(0, 1)}</span>
          <div>
            <strong>{contract.asset} {contract.type}</strong>
            <small>Reference {reference}</small>
          </div>
        </div>
        <span className="paper-preview-modal__badge">Paper Trade</span>
      </header>
      <div className="paper-preview-modal__grid">
        <dl>
          <div><dt>Asset</dt><dd>{contract.asset}</dd></div>
          <div><dt>Type</dt><dd>{contract.type}</dd></div>
          <div><dt>Strike</dt><dd>${contract.strike.toLocaleString()}</dd></div>
        </dl>
        <dl>
          <div><dt>Expiry</dt><dd>{contract.expiry}</dd></div>
          <div><dt>Ask Premium</dt><dd>{formatNumber(contract.ask, 2)} USDC</dd></div>
          <div className="paper-preview-modal__quantity-row">
            <dt>Quantity</dt>
            <dd>
              <div className="quantity"><div><button type="button" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button><output>{quantity}</output><button type="button" onClick={() => onQuantityChange(quantity + 1)}>+</button></div></div>
            </dd>
          </div>
        </dl>
      </div>
      <div className="paper-preview-modal__cost">
        <div><span>Estimated Cost</span><b>{formatNumber(estimatedCost, 2)} USDC</b></div>
        <div><span>Max Loss</span><b>{formatNumber(maxLoss, 2)} USDC</b></div>
        <div><span>Breakeven</span><b>{formatUsd(breakeven)}</b></div>
      </div>
      <div className="modal-footer">
        <button type="button" className="modal-cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="modal-primary" onClick={onConfirm}>Confirm Paper Buy</button>
      </div>
      <p className="paper-preview-modal__footnote">Paper trading uses virtual funds only.</p>
    </section>
  </div>
}
