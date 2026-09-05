import { useState } from 'react'
import { breakevenPrice, maxLossTotal, type OptionType } from '../lib/payoff'
import { formatNumber, formatUsd } from '../lib/formatters'
import type { PaperContract } from '../data/paperTradingMockData'
import '../styles/paper-trade-preview.css'

// Reuses the app-wide .modal-backdrop/.modal-panel chrome (index.css, already used by
// PremiumUnlockModal/TradePreviewModal) and .modal-footer/.modal-cancel/.modal-primary for the
// action row, plus the existing .quantity stepper markup (styled in strategy-lab.css, loaded
// wherever this modal is mounted) — only the header/detail-grid/cost-box layout below is new CSS.
export default function PaperTradePreviewModal({ contract, quantity, onQuantityChange, virtualBalance, onConfirm, onCancel, onViewPortfolio }: {
  contract: PaperContract
  quantity: number
  onQuantityChange: (quantity: number) => void
  virtualBalance: number
  onConfirm: () => void
  onCancel: () => void
  onViewPortfolio: () => void
}) {
  // Local to this component, not lifted to StrategyLabPage: StrategyLabPage only needs to know
  // "confirmed or not" to actually push the position (via onConfirm), never needs to know this
  // modal is now showing its own success view — and since {previewOpen && <PaperTradePreviewModal
  // .../>} unmounts this component whenever the modal closes, this always starts fresh at null
  // the next time it opens, with no explicit reset needed.
  //
  // Snapshotting a full result object (not just a confirmed:boolean flag) matters here: onConfirm
  // pushes the new position into StrategyLabPage's openPositions state, which recomputes its
  // virtualBalance and re-renders this component with an ALREADY-UPDATED virtualBalance prop in
  // the very same batched update that flips this to non-null. Reading the live virtualBalance prop
  // for "Virtual Balance Before" would show the post-trade balance, not the pre-trade one — this
  // snapshot is taken before onConfirm runs, so it's immune to that.
  const [confirmedResult, setConfirmedResult] = useState<{ quantity: number; askAtConfirm: number; estimatedCost: number; maxLoss: number; balanceBefore: number } | null>(null)
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
  // Same virtualBalance StrategyLabPage already derives (10,000 - sum of open positions' entry
  // costs) — not a separately maintained balance check.
  const insufficientBalance = estimatedCost > virtualBalance
  const maxAffordableQuantity = contract.ask > 0 ? Math.max(1, Math.floor(virtualBalance / contract.ask)) : 1
  // Snapshot first, then call onConfirm (which pushes the real position into StrategyLabPage's
  // state, unchanged from before) — order matters, see the comment on confirmedResult above.
  const handleConfirm = () => {
    setConfirmedResult({ quantity, askAtConfirm: contract.ask, estimatedCost, maxLoss, balanceBefore: virtualBalance })
    onConfirm()
  }

  if (confirmedResult) {
    const balanceAfter = confirmedResult.balanceBefore - confirmedResult.estimatedCost
    return <div className="modal-backdrop">
      <section className="modal-panel paper-preview-modal">
        <header className="paper-preview-modal__header">
          <div className="paper-preview-modal__title">
            <span className="paper-preview-modal__icon success">✓</span>
            <div>
              <strong>Paper Trade Created</strong>
              <small>Your simulated position has been added to your paper portfolio.</small>
            </div>
          </div>
        </header>
        <div className="paper-preview-modal__summary-row">
          <span className={`paper-preview-modal__icon ${contract.type.toLowerCase()}`}>{contract.asset.slice(0, 1)}</span>
          <div>
            <strong>{contract.asset} {contract.type}</strong>
            <small>Reference {reference}</small>
          </div>
          <span className="paper-preview-modal__badge">Paper Trade</span>
        </div>
        <dl className="paper-preview-modal__result">
          <div><dt>Quantity</dt><dd>{confirmedResult.quantity}</dd></div>
          <div><dt>Entry Premium</dt><dd>{formatNumber(confirmedResult.askAtConfirm, 2)} USDC</dd></div>
          <div><dt>Estimated Cost</dt><dd className="highlight">{formatNumber(confirmedResult.estimatedCost, 2)} USDC</dd></div>
          <div><dt>Max Loss</dt><dd>{formatNumber(confirmedResult.maxLoss, 2)} USDC</dd></div>
        </dl>
        <div className="paper-preview-modal__cost">
          <div><span>Virtual Balance Before</span><b>{formatNumber(confirmedResult.balanceBefore, 2)} USDC</b></div>
          <div><span>Virtual Balance After</span><b>{formatNumber(balanceAfter, 2)} USDC</b></div>
        </div>
        <div className="modal-footer">
          <button type="button" className="modal-cancel" onClick={onCancel}>Buy Another</button>
          <button type="button" className="modal-primary" onClick={() => { onCancel(); onViewPortfolio() }}>View Paper Portfolio</button>
        </div>
      </section>
    </div>
  }

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
      {insufficientBalance ? <>
        <div className="paper-preview-modal__balance-warning">
          <div><span>Available Virtual Balance</span><b>{formatNumber(virtualBalance, 2)} USDC</b></div>
          <div><span>Required</span><b className="warning">{formatNumber(estimatedCost, 2)} USDC</b></div>
        </div>
        <p className="paper-preview-modal__alert">⚠ This quantity costs more than your available virtual balance. Reduce the quantity to continue.</p>
        <div className="modal-footer">
          <button type="button" className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="modal-primary" onClick={() => onQuantityChange(maxAffordableQuantity)}>Reduce Quantity</button>
        </div>
      </> : <>
        <div className="paper-preview-modal__cost">
          <div><span>Estimated Cost</span><b>{formatNumber(estimatedCost, 2)} USDC</b></div>
          <div><span>Max Loss</span><b>{formatNumber(maxLoss, 2)} USDC</b></div>
          <div><span>Breakeven</span><b>{formatUsd(breakeven)}</b></div>
        </div>
        <div className="modal-footer">
          <button type="button" className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="modal-primary" onClick={handleConfirm}>Confirm Paper Buy</button>
        </div>
      </>}
      <p className="paper-preview-modal__footnote">Paper trading uses virtual funds only.</p>
    </section>
  </div>
}
