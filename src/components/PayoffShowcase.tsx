import { useMemo, useState } from 'react'
import { formatExpiry, parseStrikeList } from '../lib/formatters'
import { buildPayoffFacts } from '../lib/orderPayoff'
import type { ExplorerData, ExplorerOrder } from '../lib/thetanuts'
import PayoffPreviewBody from './PayoffPreviewBody'

interface PayoffShowcaseProps {
  orders: ExplorerOrder[] | undefined
  marketData: ExplorerData['marketData']
}

/** One real vanilla order and one real spread order from the live book, so the showcase demonstrates both payoff shapes. */
function pickPresets(orders: ExplorerOrder[]): ExplorerOrder[] {
  const eligible = orders.filter((order) => order.optionType !== 'UNKNOWN')
  const vanilla = eligible.find((order) => parseStrikeList(order.strikes).length === 1)
  const spread = eligible.find((order) => parseStrikeList(order.strikes).length === 2)
  return [vanilla, spread].filter((order): order is ExplorerOrder => order !== undefined)
}

function presetLabel(order: ExplorerOrder): string {
  const isSpread = parseStrikeList(order.strikes).length === 2
  return `${order.asset} ${isSpread ? `${order.optionType} SPREAD` : order.optionType}`
}

export default function PayoffShowcase({ orders, marketData }: PayoffShowcaseProps) {
  const presets = useMemo(() => pickPresets(orders ?? []), [orders])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = presets.find((order) => order.id === selectedId) ?? presets[0]
  const payoff = selected ? buildPayoffFacts(selected, marketData) : null

  return <section className="section order-section" aria-labelledby="showcase-heading">
    <div className="section-heading">
      <div><p className="eyebrow">PAYOFF SHOWCASE</p><h2 id="showcase-heading">See a payoff before you trade</h2></div>
    </div>
    {!orders && <div className="empty-state"><span className="loader" />Loading a live order to showcase…</div>}
    {orders && presets.length === 0 && <div className="empty-state">No vanilla or spread orders are available to showcase right now.</div>}
    {selected && payoff && <>
      <div className="filters" aria-label="Showcase preset">
        <fieldset className="filter-group"><legend>Example</legend>
          <div className="segmented-control">
            {presets.map((order) => <button key={order.id} type="button" className={order.id === selected.id ? 'active' : ''}
              onClick={() => setSelectedId(order.id)} aria-pressed={order.id === selected.id}>
              {presetLabel(order)}
            </button>)}
          </div>
        </fieldset>
      </div>
      <p className="modal-subtext">
        {selected.asset} <span className={`option-type ${selected.optionType.toLowerCase()}`}>{payoff.kind === 'spread' ? `${selected.optionType} SPREAD` : selected.optionType}</span>
        {' '}· Strikes {selected.strikes} · Expiry {formatExpiry(selected.expiry)}
      </p>
      <PayoffPreviewBody payoff={payoff} />
    </>}
  </section>
}
