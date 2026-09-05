import { useNavigate } from 'react-router-dom'
import { formatExpiry, formatNumber, formatTimestamp, formatUsd } from '../lib/formatters'
import type { ExplorerOrder } from '../lib/thetanuts'
import { useSavedStrategies } from '../hooks/useSavedStrategies'
import type { SavedStrategy } from '../lib/savedStrategies'

// Shared by PortfolioPage.tsx (its original home) and StrategyLabPage.tsx's Saved Strategies tab.
// Reads/writes go through useSavedStrategies(), which is just a thin wrapper over the
// nutscope:saved-strategies localStorage key — every mounted instance reads that same key on
// mount and re-reads it before writing (see useSavedStrategies.ts), so two instances active in
// the same session (e.g. this page and PortfolioPage.tsx, if it were ever reachable again) stay
// consistent with each other rather than diverging or overwriting one another's saves.
export default function SavedStrategiesSection({ orders }: { orders: ExplorerOrder[] | null }) {
  const { items, remove } = useSavedStrategies()
  const navigate = useNavigate()

  return (
    <section className="section order-section" aria-labelledby="saved-strategies-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAVED (NOT EXECUTED)</p>
          <h2 id="saved-strategies-heading">Saved Strategies</h2>
        </div>
      </div>
      <p className="modal-subtext">Ideas you've saved from Analyze or Strategy Ideas, kept only in this browser. These are not on-chain positions and no trade has been placed.</p>

      {items.length === 0 && (
        <div className="empty-state">No saved strategies yet — use "Save Idea" on Analyze or a Strategy Idea card to keep one here without trading it.</div>
      )}

      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th><th>Strategy</th><th>Strike(s)</th><th>Expiry (UTC)</th>
                <th>Premium</th><th>Breakeven</th><th>Max profit</th><th>Max loss</th>
                <th>Saved</th><th>Status</th><th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <SavedStrategyRow
                  key={item.id}
                  item={item}
                  orders={orders}
                  onRemove={() => remove(item.id)}
                  onView={() => navigate(`/analyze?order=${encodeURIComponent(item.orderId)}`)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function SavedStrategyRow({ item, orders, onRemove, onView }: { item: SavedStrategy; orders: ExplorerOrder[] | null; onRemove: () => void; onView: () => void }) {
  const liveOrder = orders?.find((order) => order.id === item.orderId)
  const status = orders === null ? 'checking' : liveOrder ? 'live' : 'stale'

  return (
    <tr>
      <td><strong className="asset-name">{item.asset}</strong></td>
      <td>{item.name}</td>
      <td className="numeric">{item.strikes}</td>
      <td>{formatExpiry(item.expiry)}</td>
      <td className="numeric">{item.isUsdSafe ? `${formatNumber(item.premium, 6)} USDC` : `${formatNumber(item.premium, 6)} ${item.collateral}`}</td>
      <td className="numeric">{item.isUsdSafe ? item.breakevens.map((value) => formatUsd(value)).join(' – ') : 'Non-USDC'}</td>
      <td className="numeric">{item.isUsdSafe ? (item.maxProfit === undefined ? 'Unlimited' : formatUsd(item.maxProfit)) : 'Non-USDC'}</td>
      <td className="numeric">{item.isUsdSafe ? formatUsd(item.maxLoss) : 'Non-USDC'}</td>
      <td>{formatTimestamp(item.savedAt)}</td>
      <td>
        {status === 'checking' && <span>Checking…</span>}
        {status === 'live' && <span className="pnl-positive">Live</span>}
        {status === 'stale' && <span className="pnl-negative" title="This order no longer exists in the live OptionBook">Stale (historical)</span>}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {status === 'live' && <button type="button" className="preview-button" onClick={onView}>View Live →</button>}
          <button type="button" className="preview-button" onClick={onRemove}>Remove</button>
        </div>
      </td>
    </tr>
  )
}
