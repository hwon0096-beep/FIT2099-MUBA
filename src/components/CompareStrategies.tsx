import { useState } from 'react'
import { useSavedStrategies } from '../hooks/useSavedStrategies'
import { buildComparisonRows, canCompare, MAX_COMPARE_ITEMS, MIN_COMPARE_ITEMS } from '../lib/strategyCompare'
import { formatExpiry } from '../lib/formatters'
import type { SavedStrategy } from '../lib/savedStrategies'
import '../styles/strategy-compare.css'

// Reads through the same useSavedStrategies() hook SavedStrategiesSection already uses — self
// contained, no props, same localStorage-backed source of truth (see useSavedStrategies.ts's own
// comment on why it re-reads before writing rather than trusting stale in-memory state).
export default function CompareStrategies() {
  const { items } = useSavedStrategies()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggle = (id: string) => setSelectedIds((current) => {
    if (current.includes(id)) return current.filter((existing) => existing !== id)
    if (current.length >= MAX_COMPARE_ITEMS) return current
    return [...current, id]
  })

  // Ordered by selection order (not the underlying saved-items list order), so picking item B
  // then item A shows B's column before A's — matching the order the picker was actually clicked in.
  const selected = selectedIds.map((id) => items.find((item) => item.id === id)).filter((item): item is SavedStrategy => !!item)
  const rows = canCompare(selectedIds) ? buildComparisonRows(selected) : []

  if (items.length === 0) {
    return <section className="strategy-card compare-strategies">
      <h2>Compare Strategies</h2>
      <div className="empty-state">No saved strategies yet — use "Save Idea" on Analyze or a Strategy Idea card, then come back here to compare them.</div>
    </section>
  }

  return <section className="strategy-card compare-strategies">
    <h2>Compare Strategies</h2>
    <p>Select {MIN_COMPARE_ITEMS} to {MAX_COMPARE_ITEMS} saved strategies to compare side by side.</p>
    <div className="compare-picker">
      {items.map((item) => {
        const checked = selectedIds.includes(item.id)
        const disabled = !checked && selectedIds.length >= MAX_COMPARE_ITEMS
        return <label key={item.id} className={`compare-picker__item${checked ? ' selected' : ''}${disabled ? ' disabled' : ''}`}>
          <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(item.id)} />
          <span>{item.asset} {item.name}</span>
        </label>
      })}
    </div>
    {!canCompare(selectedIds)
      ? <div className="empty-state">Select at least {MIN_COMPARE_ITEMS} saved strategies above to see a comparison.</div>
      : <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Metric</th>
                {selected.map((item) => <th key={item.id}>
                  <div className="compare-table__head-asset">{item.asset}</div>
                  <div className="compare-table__head-name">{item.name}</div>
                  <div className="compare-table__head-meta">{item.strikes} · {formatExpiry(item.expiry)}</div>
                </th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => <tr key={row.label}>
                <td>{row.label}</td>
                {row.values.map((value, index) => <td key={index} className={row.bestIndex === index ? 'winner' : ''}>
                  {value}{row.bestIndex === index && <span className="compare-winner-badge">✓ Best</span>}
                </td>)}
              </tr>)}
            </tbody>
          </table>
        </div>}
  </section>
}
