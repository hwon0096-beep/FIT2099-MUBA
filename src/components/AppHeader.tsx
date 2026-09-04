import { NavLink, useNavigate } from 'react-router-dom'
import { truncateAddress, useWallet } from '../lib/WalletContext'
import { NutIcon, ProductMark } from './VisualSystem'
import '../styles/app-header.css'

const links = [{ label: 'Discover', to: '/' }, { label: 'Markets', to: '/markets' }, { label: 'Analyze', to: '/analyze' }, { label: 'Trade', to: '/trade' }, { label: 'Portfolio', to: '/portfolio' }]
export default function AppHeader() {
  const navigate = useNavigate(), { connection, connectWallet } = useWallet()
  const handleClick = () => { if (connection.status === 'no-wallet') { window.open('https://metamask.io', '_blank', 'noreferrer'); return } if (connection.status === 'connected') { navigate('/portfolio'); return } void connectWallet() }
  const label = connection.status === 'no-wallet' ? 'Install MetaMask' : connection.status === 'connecting' ? 'Connecting…' : connection.status === 'connected' ? truncateAddress(connection.address) : 'Connect Wallet'
  return <header className="app-header"><NavLink to="/" className="app-brand" aria-label="Nutscope home"><ProductMark className="app-brand-mark" /><span><strong>NUTSCOPE</strong><small>Powered by <b>Thetanuts</b> on Base</small></span></NavLink><nav className="app-navigation" aria-label="Primary navigation">{links.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'}>{link.label}</NavLink>)}</nav><button type="button" className="app-wallet-button" disabled={connection.status === 'connecting'} onClick={handleClick}><NutIcon name="wallet" />{label}</button></header>
}
