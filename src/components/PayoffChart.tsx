import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatUsd } from '../lib/formatters'
import { breakevenPrice, buildPayoffCurve, maxLossTotal, type PayoffInputs } from '../lib/payoff'

interface PayoffChartProps {
  inputs: PayoffInputs
  hypotheticalPrice: number
}

export default function PayoffChart({ inputs, hypotheticalPrice }: PayoffChartProps) {
  const curve = buildPayoffCurve(inputs)
  const breakeven = breakevenPrice(inputs.optionType, inputs.strike, inputs.premium)
  const maxLoss = maxLossTotal(inputs.premium, inputs.positionSize)
  const hypotheticalPnl = curve.length
    ? curve.reduce((closest, point) => Math.abs(point.price - hypotheticalPrice) < Math.abs(closest.price - hypotheticalPrice) ? point : closest).pnl
    : 0

  return <div className="payoff-chart">
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={curve} margin={{ top: 12, right: 18, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="#202b43" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="price" stroke="#7f8ca7" fontSize={12} tickFormatter={(value: number) => formatUsd(value, 0)}
          tick={{ fill: '#7f8ca7' }} tickLine={false} axisLine={{ stroke: '#202b43' }} />
        <YAxis stroke="#7f8ca7" fontSize={12} tickFormatter={(value: number) => formatUsd(value, 0)}
          tick={{ fill: '#7f8ca7' }} tickLine={false} axisLine={{ stroke: '#202b43' }} width={78} />
        <Tooltip
          contentStyle={{ background: '#0e1526', border: '1px solid #202b43', borderRadius: 10, color: '#e8edf8' }}
          labelFormatter={(value) => `Expiry price: ${formatUsd(Number(value))}`}
          formatter={(value) => [formatUsd(Number(value)), 'Net P&L']} />
        <ReferenceLine y={0} stroke="#4a5a7a" />
        <ReferenceLine x={inputs.currentPrice} stroke="#5ee6ad" strokeDasharray="4 4"
          label={{ value: 'Spot', position: 'insideTopRight', fill: '#5ee6ad', fontSize: 11 }} />
        <ReferenceLine x={breakeven} stroke="#75e6c1"
          label={{ value: 'Breakeven', position: 'insideBottomRight', fill: '#75e6c1', fontSize: 11 }} />
        <ReferenceDot x={hypotheticalPrice} y={hypotheticalPnl} r={5} fill="#f3f6fc" stroke="#5ee6ad" strokeWidth={2} />
        <Line type="monotone" dataKey="pnl" stroke="#5ee6ad" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
    <p className="payoff-chart-footnote">Max loss is capped at the premium paid ({formatUsd(maxLoss)}), since this is a long option position with no early exercise.</p>
  </div>
}
