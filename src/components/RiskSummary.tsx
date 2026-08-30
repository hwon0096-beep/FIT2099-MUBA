import { formatUsd } from '../lib/formatters'
import { breakevenPrice, buildScenarios, maxLossTotal, type PayoffInputs } from '../lib/payoff'

interface RiskSummaryProps {
  inputs: PayoffInputs
}

export default function RiskSummary({ inputs }: RiskSummaryProps) {
  const breakeven = breakevenPrice(inputs.optionType, inputs.strike, inputs.premium)
  const maxLoss = maxLossTotal(inputs.premium, inputs.positionSize)
  const costTotal = inputs.premium * inputs.positionSize
  const scenarios = buildScenarios(inputs)

  return <div className="risk-summary">
    <div className="risk-stat-grid">
      <RiskStat label="Max loss" value={formatUsd(maxLoss)} hint="Capped at premium paid" />
      <RiskStat label="Breakeven price" value={formatUsd(breakeven)} hint="Settlement price at expiry" />
      <RiskStat label="Cost / premium" value={formatUsd(costTotal)} hint={`${formatUsd(inputs.premium)} per contract`} />
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
