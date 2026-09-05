import { useReducer } from 'react'
import { useAccount } from '../context/AccountContext'
import PremiumUnlockModal from './PremiumUnlockModal'
import { NutIcon } from './VisualSystem'
import type { StrategyDetailKind } from './StrategyDetailModal'
import '../styles/strategy-overview-landing.css'

export type OverviewModal = 'about' | 'premium' | null
export type OverviewModalAction = { type: 'open'; modal: Exclude<OverviewModal, null> } | { type: 'close' }
export function overviewModalReducer(_: OverviewModal, action: OverviewModalAction): OverviewModal { return action.type === 'open' ? action.modal : null }
export function showsPremiumLink(tier: 'normal' | 'premium' | null): boolean { return tier !== 'premium' }

type CatalogueOutlook = 'bullish' | 'bearish' | 'neutral'
type CatalogueAccess = 'Free' | 'Premium'
interface CatalogueStrategy { name: string; outlook: CatalogueOutlook; access: CatalogueAccess; profile: string; explanation: string; risk?: string[]; detailKind: StrategyDetailKind }

const FREE_STRATEGIES: CatalogueStrategy[] = [
  { name: 'Long Call', outlook: 'bullish', access: 'Free', profile: 'Directional upside', explanation: 'Buy a call when you expect the underlying asset to rise.', risk: ['Loss limited to premium paid', 'Upside increases as price rises'], detailKind: 'long-call' },
  { name: 'Long Put', outlook: 'bearish', access: 'Free', profile: 'Directional downside', explanation: 'Buy a put when you expect the underlying asset to fall.', risk: ['Loss limited to premium paid', 'Value increases as price falls'], detailKind: 'long-put' },
]

const ADVANCED_STRATEGIES: CatalogueStrategy[] = [
  { name: 'Bull Call Spread', outlook: 'bullish', access: 'Premium', profile: 'Defined-risk bullish strategy', explanation: 'Buy a lower-strike call and sell a higher-strike call to reduce upfront cost while capping maximum profit.', detailKind: 'bull-call-spread' },
  { name: 'Bear Put Spread', outlook: 'bearish', access: 'Premium', profile: 'Defined-risk bearish strategy', explanation: 'Buy a higher-strike put and sell a lower-strike put to reduce premium while capping maximum profit.', detailKind: 'bear-put-spread' },
  { name: 'Iron Condor', outlook: 'neutral', access: 'Premium', profile: 'Range-bound strategy', explanation: 'A multi-leg strategy designed for markets expected to remain within a price range.', detailKind: 'iron-condor' },
  { name: 'Butterfly', outlook: 'neutral', access: 'Premium', profile: 'Target-price strategy', explanation: 'A multi-leg strategy designed around a target expiry price with defined risk and reward.', detailKind: 'butterfly' },
]

export default function SimpleStrategyOverview({ onExplore }: { onExplore: (strategy: StrategyDetailKind) => void }) {
  const { tier } = useAccount()
  const [modal, dispatch] = useReducer(overviewModalReducer, null)
  const isFree = showsPremiumLink(tier)

  return <div className="simple-overview">
    <section className="overview-catalogue-lede" aria-labelledby="strategy-catalogue-title">
      <div><p className="eyebrow">STRATEGY CATALOGUE</p><h2 id="strategy-catalogue-title">Explore strategies for different market views.</h2><p>Start with a clear outlook, understand the trade-off, and choose what to explore next.</p></div>
      <aside className="overview-access-summary"><span className="eyebrow">YOUR ACCESS</span><strong>{isFree ? 'Free access' : 'Premium access'}</strong><small>{isFree ? 'Advanced strategies are visible below and ready to unlock.' : 'All catalogue strategies are available to explore.'}</small></aside>
    </section>
    <section className="overview-catalogue-group" aria-labelledby="free-strategies-title">
      <header className="overview-catalogue-heading"><div><p className="eyebrow">START HERE</p><h2 id="free-strategies-title">Free Strategies</h2><p>Simple directional strategies with defined premium risk.</p></div><span className="overview-section-count">2 strategies</span></header>
      <div className="overview-catalogue-grid overview-catalogue-grid--free">{FREE_STRATEGIES.map(strategy => <CatalogueCard key={strategy.name} strategy={strategy} locked={false} onExplore={onExplore} />)}</div>
    </section>
    <section className="overview-catalogue-group" aria-labelledby="advanced-strategies-title">
      <header className="overview-catalogue-heading"><div><p className="eyebrow">FOR MORE CONTROL</p><h2 id="advanced-strategies-title">Advanced Strategies</h2><p>Multi-leg structures for capped risk, range views, and target prices.</p></div><span className="overview-section-count">4 strategies</span></header>
      <div className="overview-catalogue-grid overview-catalogue-grid--advanced">{ADVANCED_STRATEGIES.map(strategy => <CatalogueCard key={strategy.name} strategy={strategy} locked={isFree} onUnlock={() => dispatch({ type: 'open', modal: 'premium' })} onExplore={onExplore} />)}</div>
    </section>
    <footer className="overview-info-strip"><NutIcon name="info" /><div><strong>Strategy Lab uses simulated trades with virtual USDC. No real funds are used in this environment.</strong><span>This environment is intended for strategy exploration and educational use.</span></div></footer>
    {modal === 'premium' && <PremiumUnlockModal onClose={() => dispatch({ type: 'close' })} />}
  </div>
}

function CatalogueCard({ strategy, locked, onUnlock, onExplore }: { strategy: CatalogueStrategy; locked: boolean; onUnlock?: () => void; onExplore: (strategy: StrategyDetailKind) => void }) {
  return <article className={`overview-catalogue-card overview-catalogue-card--${strategy.outlook}${locked ? ' is-locked' : ''}`}>
    <header className="overview-catalogue-card__top"><span className={`overview-outlook overview-outlook--${strategy.outlook}`}>{strategy.outlook[0].toUpperCase() + strategy.outlook.slice(1)}</span><span className={`overview-access-badge overview-access-badge--${strategy.access.toLowerCase()}`}>{locked && <span aria-hidden="true">🔒</span>}{strategy.access}</span></header>
    <div className="overview-catalogue-card__body"><h3>{strategy.name}</h3><strong>{strategy.profile}</strong><p>{strategy.explanation}</p>{strategy.risk && <ul>{strategy.risk.map(item => <li key={item}>{item}</li>)}</ul>}</div>
    <footer>{locked ? <button type="button" className="overview-unlock-action" onClick={onUnlock}><span aria-hidden="true">🔒</span> Unlock Premium <NutIcon name="arrow" /></button> : <button type="button" className="overview-explore-action" onClick={() => onExplore(strategy.detailKind)}>Explore <NutIcon name="arrow" /></button>}</footer>
  </article>
}

export function OverviewHero() { const [modal, dispatch] = useReducer(overviewModalReducer, null); return <><div className="strategy-lab__intro overview-hero-copy"><p className="eyebrow">STRATEGY LAB OVERVIEW</p><h1>Find your strategy.<br /><em>Trade with a plan.</em></h1><p>Explore approaches for different market views before testing ideas with virtual funds.</p></div><div className="strategy-lab__art" aria-hidden="true"><i /><i /><i /></div><section className="strategy-lab__safety overview-why-card"><NutIcon name="spark" /><div><h2>Catalogue before you trade</h2><p>Compare free and advanced strategy types here, then move to Paper Trading when you are ready to practise.</p><button type="button" className="overview-text-action" onClick={() => dispatch({ type: 'open', modal: 'about' })}>Learn more →</button></div></section>{modal === 'about' && <AboutStrategyLabModal onClose={() => dispatch({ type: 'close' })} />}</> }

function AboutStrategyLabModal({ onClose }: { onClose: () => void }) { return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal-panel overview-about-modal" role="dialog" aria-modal="true" aria-labelledby="about-strategy-lab-title" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">STRATEGY LAB</p><h2 id="about-strategy-lab-title">About Strategy Lab</h2></div><button type="button" className="overview-modal-close" aria-label="Close About Strategy Lab" onClick={onClose}>×</button></header><p>Strategy Lab is a simulated environment for exploring options strategies before trading with real funds.</p><div className="overview-modal-sections"><ModalSection title="Paper Trading" text="Practice with virtual USDC using available Thetanuts market data." /><ModalSection title="Saved Strategies" text="Save strategy ideas so you can review them later." /><ModalSection title="Compare" text="Compare supported strategies side by side." /><ModalSection title="Premium Strategies" text="Advanced structures such as spreads, butterflies, and condors are available to Premium users where supported." /></div><footer><button type="button" className="modal-cancel" onClick={onClose}>Close</button></footer></section></div> }
function ModalSection({ title, text }: { title: string; text: string }) { return <section><h3>{title}</h3><p>{text}</p></section> }
