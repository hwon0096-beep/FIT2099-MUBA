import { useEffect, useMemo, useState } from 'react'
import { formatUsd } from '../lib/formatters'
import * as vanillaPayoff from '../lib/payoff'
import * as spreadPayoff from '../lib/spreadPayoff'
import PayoffChart from './PayoffChart'
import RiskSummary from './RiskSummary'

export type PayoffFacts =
  | { kind: 'vanilla'; optionType: vanillaPayoff.OptionType; strike: number; premium: number; currentPrice: number }
  | { kind: 'spread'; spreadType: spreadPayoff.SpreadType; nearStrike: number; farStrike: number; premium: number; currentPrice: number }

interface PayoffPreviewBodyProps {
  payoff: PayoffFacts
}

export default function PayoffPreviewBody({ payoff }: PayoffPreviewBodyProps) {
  const [positionSize, setPositionSize] = useState(1)
  const [hypotheticalPrice, setHypotheticalPrice] = useState(payoff.currentPrice)

  useEffect(() => { setHypotheticalPrice(payoff.currentPrice) }, [payoff.currentPrice])

  const computed = useMemo(() => {
    if (payoff.kind === 'vanilla') {
      const inputs: vanillaPayoff.PayoffInputs = { optionType: payoff.optionType, strike: payoff.strike, premium: payoff.premium, positionSize, currentPrice: payoff.currentPrice }
      const maxLoss = vanillaPayoff.maxLossTotal(inputs.premium, inputs.positionSize)
      return {
        curve: vanillaPayoff.buildPayoffCurve(inputs),
        breakeven: vanillaPayoff.breakevenPrice(inputs.optionType, inputs.strike, inputs.premium),
        maxLoss,
        maxGain: undefined as number | undefined,
        scenarios: vanillaPayoff.buildScenarios(inputs),
        costTotal: inputs.premium * inputs.positionSize,
        footnote: `Max loss is capped at the premium paid (${formatUsd(maxLoss)}), since this is a long option position with no early exercise.`,
      }
    }
    const inputs: spreadPayoff.SpreadPayoffInputs = { spreadType: payoff.spreadType, nearStrike: payoff.nearStrike, farStrike: payoff.farStrike, premium: payoff.premium, positionSize, currentPrice: payoff.currentPrice }
    const maxLoss = spreadPayoff.maxLossTotal(inputs.premium, inputs.positionSize)
    const maxGain = spreadPayoff.maxGainTotal(inputs.nearStrike, inputs.farStrike, inputs.premium, inputs.positionSize)
    return {
      curve: spreadPayoff.buildPayoffCurve(inputs),
      breakeven: spreadPayoff.breakevenPrice(inputs.spreadType, inputs.nearStrike, inputs.premium),
      maxLoss,
      maxGain,
      scenarios: spreadPayoff.buildScenarios(inputs),
      costTotal: inputs.premium * inputs.positionSize,
      footnote: `Max loss is capped at the premium paid (${formatUsd(maxLoss)}); max gain is capped at ${formatUsd(maxGain)} since this spread's payoff can't exceed its strike width.`,
    }
  }, [payoff, positionSize])

  const sliderMin = payoff.currentPrice * 0.7
  const sliderMax = payoff.currentPrice * 1.3

  return <>
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

    <PayoffChart curve={computed.curve} currentPrice={payoff.currentPrice} breakeven={computed.breakeven}
      hypotheticalPrice={hypotheticalPrice} footnote={computed.footnote} />
    <RiskSummary maxLoss={computed.maxLoss} breakeven={computed.breakeven} costTotal={computed.costTotal}
      premiumPerContract={payoff.premium} scenarios={computed.scenarios} maxGain={computed.maxGain} />
  </>
}
