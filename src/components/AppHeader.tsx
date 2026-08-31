import { NavLink, useNavigate } from 'react-router-dom'
import '../styles/app-header.css'

const links = [
  { label: 'Discover', to: '/' },
  { label: 'Markets', to: '/markets' },
  { label: 'Analyze', to: '/analyze' },
  { label: 'Trade', to: '/trade' },
]

export default function AppHeader() {
  const navigate = useNavigate()
  return <header className="app-header">
    <NavLink to="/" className="app-brand" aria-label="Nutscope home"><span className="app-brand-mark">◇</span><span><strong>NUTSCOPE</strong><small>Powered by <b>Thetanuts</b> on Base</small></span></NavLink>
    <nav className="app-navigation" aria-label="Primary navigation">
      {links.map((link) => <NavLink key={link.to} to={link.to} end={link.to === '/'}>{link.label}</NavLink>)}
      <span className="nav-coming-soon">Portfolio</span>
    </nav>
    <button type="button" className="app-wallet-button" onClick={() => navigate('/trade')}><span>▣</span>Connect Wallet</button>
  </header>
}
