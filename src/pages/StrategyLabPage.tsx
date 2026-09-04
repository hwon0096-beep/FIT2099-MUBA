import { useMemo, useState } from 'react'
import { NutIcon } from '../components/VisualSystem'
import { defaultPaperContract, optionChainRows, paperPositions, paperSummary, recentPaperTrades, type PaperContract, type PaperOptionSide } from '../data/paperTradingMockData'
import '../styles/strategy-lab.css'

const formatUsdc = (value: number) => `${value.toLocaleString('en-US')} USDC`

export default function StrategyLabPage() {
  const [selected, setSelected] = useState<PaperContract>(defaultPaperContract)
  const [quantity, setQuantity] = useState(1)
  const [search, setSearch] = useState('')
  const visibleRows = useMemo(() => optionChainRows.filter((row) => String(row.strike).includes(search.replaceAll(',', '').trim())), [search])

  const selectContract = (strike: number, side: PaperOptionSide) => {
    const row = optionChainRows.find((item) => item.strike === strike)
    if (!row) return
    const values = row[side]
    setSelected({ asset: 'BTC', type: side === 'call' ? 'Call' : 'Put', strike, expiry: 'Sep 11', last: values[2], ask: values[1] })
  }

  return <main className="app-shell strategy-lab">
    <header className="strategy-lab__hero">
      <div><p className="eyebrow">THETANUTS FINANCE × BASE</p><h1>Strategy Lab</h1><p className="intro">Test options strategies with virtual funds using live Thetanuts market data before trading for real.</p></div>
      <div className="strategy-lab__mode"><NutIcon name="shield" /><div><strong>PAPER TRADING</strong><span>Simulated with virtual USDC</span></div></div>
    </header>

    <nav className="strategy-lab__tabs" aria-label="Strategy Lab sections">{['Overview', 'Paper Trading', 'Saved Strategies', 'Compare'].map((label) => <button type="button" key={label} className={label === 'Paper Trading' ? 'active' : ''}>{label}</button>)}</nav>

    <section className="paper-summary" aria-label="Simulated account summary">{paperSummary.map((item) => <article key={item.label}><span>{item.label}</span><strong className={'tone' in item && item.tone === 'positive' ? 'pnl-positive' : ''}>{item.value}</strong><small className={'tone' in item && item.tone === 'positive' ? 'pnl-positive' : ''}>{item.detail}</small></article>)}</section>

    <div className="strategy-lab__layout">
      <OptionsChain rows={visibleRows} search={search} onSearch={setSearch} onSelect={selectContract} />
      <PaperOrderTicket contract={selected} quantity={quantity} onQuantityChange={setQuantity} />
      <OpenPaperPositions />
      <aside className="strategy-lab__lower-side"><RecentPaperTrades /><PaperTradingInfo /></aside>
    </div>
  </main>
}

function OptionsChain({ rows, search, onSearch, onSelect }: { rows: readonly (typeof optionChainRows)[number][]; search: string; onSearch: (value: string) => void; onSelect: (strike: number, side: PaperOptionSide) => void }) {
  return <section className="strategy-card strategy-card--chain"><div className="strategy-card__head"><div><h2>Options Chain</h2><p>Browse Thetanuts options and place simulated trades.</p></div><span className="demo-label"><i />Demo data</span></div><div className="chain-filters"><label>Asset<select defaultValue="BTC"><option>BTC</option><option>ETH</option></select></label><label>Expiry<select defaultValue="Sep 11"><option>Sep 11</option></select></label><label>Type<select defaultValue="All"><option>All</option><option>Call</option><option>Put</option></select></label><label className="chain-filters__search">Search<input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Strike or order ID" /></label></div><div className="strategy-table-wrap"><table className="options-chain-table"><thead><tr><th colSpan={4} className="call-heading">Calls (Buy)</th><th rowSpan={2}>Strike</th><th colSpan={4} className="put-heading">Puts (Buy)</th></tr><tr><th>Bid</th><th>Ask</th><th>Last</th><th aria-label="Call action" /><th>Bid</th><th>Ask</th><th>Last</th><th aria-label="Put action" /></tr></thead><tbody>{rows.map((row) => <tr key={row.strike}><td>{formatUsdc(row.call[0])}</td><td>{formatUsdc(row.call[1])}</td><td>{formatUsdc(row.call[2])}</td><td><button type="button" className="paper-buy paper-buy--call" onClick={() => onSelect(row.strike, 'call')}>Paper Buy</button></td><td className="strike">{row.strike.toLocaleString()}</td><td>{formatUsdc(row.put[0])}</td><td>{formatUsdc(row.put[1])}</td><td>{formatUsdc(row.put[2])}</td><td><button type="button" className="paper-buy paper-buy--put" onClick={() => onSelect(row.strike, 'put')}>Paper Buy</button></td></tr>)}</tbody></table></div></section>
}

function PaperOrderTicket({ contract, quantity, onQuantityChange }: { contract: PaperContract; quantity: number; onQuantityChange: (quantity: number) => void }) {
  const total = contract.ask * quantity
  return <aside className="strategy-card strategy-card--ticket"><div className="strategy-card__head"><h2>Paper Order Ticket <em>Simulated</em></h2><button type="button" className="text-action">Clear</button></div><div className="ticket-contract"><strong>{contract.asset} ${contract.strike.toLocaleString()} {contract.type}</strong><span className={`option-type ${contract.type === 'Call' ? 'call' : 'put'}`}>{contract.type}</span></div><dl className="ticket-details"><div><dt>Asset</dt><dd>{contract.asset}</dd></div><div><dt>Type</dt><dd>{contract.type}</dd></div><div><dt>Strike</dt><dd>${contract.strike.toLocaleString()}</dd></div><div><dt>Expiry</dt><dd>{contract.expiry}</dd></div><div><dt>Last Price</dt><dd>{formatUsdc(contract.last)}</dd></div><div><dt>Ask Price</dt><dd>{formatUsdc(contract.ask)}</dd></div></dl><div className="quantity"><span>Quantity / Contracts</span><div><button type="button" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button><output>{quantity}</output><button type="button" onClick={() => onQuantityChange(quantity + 1)}>+</button></div><small>1 contract = 1 option</small></div><div className="ticket-totals"><p>Estimated Cost<strong>{formatUsdc(total)}</strong></p><p>Virtual Balance After Trade<strong>{formatUsdc(10000 - total)}</strong></p></div><button type="button" className="simulate-trade">Simulate Trade <NutIcon name="arrow" /></button><p className="ticket-disclaimer">This is a simulated paper trade using virtual USDC. No real funds will be spent.</p></aside>
}

function OpenPaperPositions() { return <section className="strategy-card strategy-card--positions"><div className="strategy-card__head"><h2>Open Paper Positions <small>(3)</small></h2><button type="button" className="text-action">View all →</button></div><div className="strategy-table-wrap"><table><thead><tr><th>Asset</th><th>Strategy</th><th>Entry Date</th><th>Days to Expiry</th><th>Entry Cost</th><th>Current Value</th><th>Paper P&amp;L</th><th>Status</th><th>Action</th></tr></thead><tbody>{paperPositions.map((position) => <tr key={position.strategy}><td><strong>{position.asset}</strong></td><td><strong>{position.strategy}</strong><small>{position.detail}</small></td><td>{position.entry}</td><td>{position.days}</td><td>{position.cost}</td><td>{position.value}</td><td className={position.positive ? 'pnl-positive' : 'pnl-negative'}>{position.pnl}<small>{position.change}</small></td><td><span className="open-status">Open</span></td><td><button type="button" className="view-position">View</button></td></tr>)}</tbody></table></div></section> }

function RecentPaperTrades() { return <section className="strategy-card"><div className="strategy-card__head"><h2>Recent Paper Trades</h2><button type="button" className="text-action">View all →</button></div>{recentPaperTrades.map((trade) => <article className="recent-paper-trade" key={trade.strategy}><div><strong>{trade.strategy}</strong><small>{trade.date}</small></div><span className={trade.positive ? 'pnl-positive' : 'pnl-negative'}>{trade.amount}</span><em>{trade.status}</em></article>)}</section> }

function PaperTradingInfo() { return <section className="strategy-card paper-info"><p className="eyebrow">LEARN SAFELY</p><h2>Why paper trade?</h2><ul><li><strong>No real funds at risk</strong>Trades use virtual USDC.</li><li><strong>No signature required</strong>Paper trades do not create blockchain transactions.</li><li><strong>Test strategies safely</strong>Experiment with options before trading for real.</li><li><strong>Build confidence</strong>Understand payoff and risk before moving to live trading.</li></ul><button type="button" className="text-action">Continue to Live Trade →</button></section> }
