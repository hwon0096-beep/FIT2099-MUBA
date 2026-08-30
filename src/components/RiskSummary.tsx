import { formatUsd } from '../lib/formatters'

interface RiskSummaryProps {
  maxLoss: number
  breakeven: number
  costTotal: number
  premiumPerContract: number
  scenarios: { changePercent: number; price: number; pnl: number }[]
  /** Only capped-upside products (e.g. vertical spreads) provide this; a vanilla long call's gain is uncapped. */
  maxGain?: number
}

export default function RiskSummary({ maxLoss, breakeven, costTotal, premiumPerContract, scenarios, maxGain }: RiskSummaryProps) {
  return <div className="risk-summary">
    <div className="risk-stat-grid">
      <RiskStat label="Max loss" value={formatUsd(maxLoss)} hint="Capped at premium paid" />
      <RiskStat label="Breakeven price" value={formatUsd(breakeven)} hint="Settlement price at expiry" />
      <RiskStat label="Cost / premium" value={formatUsd(costTotal)} hint={`${formatUsd(premiumPerContract)} per contract`} />
      {maxGain !== undefined && <RiskStat label="Max gain" value={formatUsd(maxGain)} hint="Capped at the strike width" />}
    </div>
    <div className="table-wrap">
      <table className="scenario-table">
        <thead><tr><th>Price move</th><th>Price at expiry</th><th>Net P&L</th></tr></thead>
        <tbody>
          {scenarios.map((scenario) => <tr key={scenario.changePercent} className={scenario.changePercent === 0 ? 'scenario-current' : undefined}>
            <td>{scenario.changePercent === 0 ? 'Current' : `${scenario.changePercent > 0 ? '+' : ''}${scenario.changePercent}%`}</td>
            <td className="numeric">{formatUsd(scenario.price)}</td>
            <td className={`numeric ${scenario.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>{scenario.pnl >= 0 ? '+' : ''}{formatUsd(scenario.pnl)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>
}

function RiskStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <article className="risk-stat"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>
}
