import { useMemo, useState } from 'react'
import { defaultPaperContract, optionRows, paperPositions, paperSummary, recentPaperTrades, type OptionSide, type PaperContract } from '../data/paperTradingMockData'
import '../styles/strategy-lab.css'

const money = (value: number) => `${value.toLocaleString('en-US')} USDC`

export default function StrategyLabPage() {
  const [contract, setContract] = useState<PaperContract>(defaultPaperContract)
  const [quantity, setQuantity] = useState(1)
  const [search, setSearch] = useState('')
  const rows = useMemo(() => optionRows.filter((row) => String(row.strike).includes(search.replaceAll(',', '').trim())), [search])
  const selectContract = (strike: number, side: OptionSide) => {
    const row = optionRows.find((item) => item.strike === strike)
    if (!row) return
    const premium = row[side]
    setContract({ asset: 'BTC', type: side === 'call' ? 'Call' : 'Put', strike, expiry: 'Sep 11', last: premium.last, ask: premium.ask })
  }

  return <main className="strategy-lab app-shell">
    <header className="strategy-lab__hero">
      <div>
        <p className="eyebrow">THETANUTS FINANCE × BASE</p>
        <h1>Strategy Lab</h1>
        <p className="intro">Test options strategies with virtual funds using live Thetanuts market data before trading for real.</p>
      </div>
      <div className="strategy-lab__simulated-card"><span className="strategy-lab__beaker">⌬</span><div><strong>PAPER TRADING</strong><p>Simulated with virtual USDC</p></div></div>
    </header>

    <nav className="strategy-tabs" aria-label="Strategy Lab sections">
      {['Overview', 'Paper Trading', 'Saved Strategies', 'Compare'].map((tab) => <button type="button" key={tab} className={tab === 'Paper Trading' ? 'active' : ''}>{tab}</button>)}
    </nav>

    <section className="paper-summary" aria-label="Paper trading summary">
      {paperSummary.map((item) => <article className="paper-summary__card" key={item.label}><span>{item.label}</span><strong className={item.tone === 'positive' ? 'pnl-positive' : ''}>{item.value}</strong><small className={item.tone === 'positive' ? 'pnl-positive' : ''}>{item.detail}</small></article>)}
    </section>

    <div className="strategy-lab__grid">
      <section className="strategy-card options-chain">
        <div className="strategy-card__heading"><div><h2>Options Chain</h2><p>Browse Thetanuts options and place simulated trades.</p></div><span className="strategy-live"><i />Demo data</span></div>
        <div className="chain-filters"><label>Asset<select defaultValue="BTC"><option>BTC</option><option>ETH</option></select></label><label>Expiry<select defaultValue="Sep 11"><option>Sep 11</option></select></label><label>Type<select defaultValue="All"><option>All</option><option>Call</option><option>Put</option></select></label><label className="chain-search"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Strike or order ID" /></label></div>
        <div className="strategy-table-wrap"><table className="chain-table"><thead><tr><th colSpan={4} className="calls-heading">Calls (Buy)</th><th rowSpan={2}>Strike</th><th colSpan={4} className="puts-heading">Puts (Buy)</th></tr><tr><th>Bid</th><th>Ask</th><th>Last</th><th aria-label="Call action" /><th>Bid</th><th>Ask</th><th>Last</th><th aria-label="Put action" /></tr></thead><tbody>{rows.map((row) => <tr key={row.strike}><td>{money(row.call.bid)}</td><td>{money(row.call.ask)}</td><td>{money(row.call.last)}</td><td><button type="button" className="paper-buy call" onClick={() => selectContract(row.strike, 'call')}>Paper Buy</button></td><td className="chain-strike">{row.strike.toLocaleString()}</td><td>{money(row.put.bid)}</td><td>{money(row.put.ask)}</td><td>{money(row.put.last)}</td><td><button type="button" className="paper-buy put" onClick={() => selectContract(row.strike, 'put')}>Paper Buy</button></td></tr>)}</tbody></table></div>
      </section>
      <PaperOrderTicket contract={contract} quantity={quantity} onQuantityChange={setQuantity} />
      <OpenPaperPositions />
      <aside className="strategy-lab__side"><RecentPaperTrades /><PaperTradingInfo /></aside>
    </div>
  </main>
}

function PaperOrderTicket({ contract, quantity, onQuantityChange }: { contract: PaperContract; quantity: number; onQuantityChange: (value: number) => void }) {
  const cost = contract.ask * quantity
  return <aside className="strategy-card paper-ticket"><div className="strategy-card__heading"><h2>Paper Order Ticket <em>Simulated</em></h2><button type="button" className="quiet-button">Clear</button></div><div className="ticket-contract"><strong>{contract.asset} ${contract.strike.toLocaleString()} {contract.type}</strong><span className={contract.type === 'Call' ? 'option-type call' : 'option-type put'}>{contract.type}</span></div><dl className="ticket-details"><div><dt>Expiry</dt><dd>{contract.expiry}</dd></div><div><dt>Underlying</dt><dd>{contract.asset}</dd></div><div><dt>Last Price</dt><dd>{money(contract.last)}</dd></div><div><dt>Strike</dt><dd>${contract.strike.toLocaleString()}</dd></div><div><dt>Ask Price</dt><dd>{money(contract.ask)}</dd></div><div><dt>Type</dt><dd>{contract.type}</dd></div></dl><label className="quantity-label">Quantity (Contracts)<span className="quantity-control"><button type="button" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button><output>{quantity}</output><button type="button" onClick={() => onQuantityChange(quantity + 1)}>+</button></span><small>1 contract = 1 option</small></label><div className="ticket-totals"><p>Total Cost (Estimated)<strong>{money(cost)}</strong></p><p>Virtual Balance After Trade<strong>{money(10000 - cost)}</strong></p></div><button type="button" className="simulate-button">Simulate Trade →</button><p className="paper-disclaimer">This is a simulated paper trade using virtual USDC. No real funds will be spent.</p></aside>
}

function OpenPaperPositions() { return <section className="strategy-card paper-positions"><div className="strategy-card__heading"><h2>Open Paper Positions <small>(3)</small></h2><button type="button" className="text-button">View all →</button></div><div className="strategy-table-wrap"><table><thead><tr><th>Asset</th><th>Strategy</th><th>Entry Date</th><th>Days</th><th>Entry Cost</th><th>Current Value</th><th>Paper P&amp;L</th><th>Status</th><th>Action</th></tr></thead><tbody>{paperPositions.map((position) => <tr key={position.strategy}><td><strong>{position.asset}</strong></td><td><strong>{position.strategy}</strong><small>{position.detail}</small></td><td>{position.entry}</td><td>{position.days}</td><td>{position.cost}</td><td>{position.value}</td><td className={position.tone === 'positive' ? 'pnl-positive' : 'pnl-negative'}>{position.pnl}<small>{position.percent}</small></td><td><span className="status-badge">Open</span></td><td><button type="button" className="view-button">View</button></td></tr>)}</tbody></table></div></section> }

function RecentPaperTrades() { return <section className="strategy-card recent-trades"><div className="strategy-card__heading"><h2>Recent Paper Trades</h2><button type="button" className="text-button">View all →</button></div>{recentPaperTrades.map((trade) => <div className="recent-trade" key={trade.strategy}><div><strong>{trade.strategy}</strong><small>{trade.date}</small></div><span className={trade.tone === 'positive' ? 'pnl-positive' : 'pnl-negative'}>{trade.amount}</span><em>{trade.status}</em></div>)}</section> }

function PaperTradingInfo() { return <section className="strategy-card paper-info"><p className="eyebrow">LEARN SAFELY</p><h2>Why paper trade?</h2><ul><li><strong>No real funds at risk</strong>Trades use virtual USDC.</li><li><strong>No signature required</strong>Paper trades do not create blockchain transactions.</li><li><strong>Test strategies safely</strong>Experiment before trading for real.</li><li><strong>Build confidence</strong>Understand payoff and risk first.</li></ul><button type="button" className="text-button">Continue to Live Trade →</button></section> }
