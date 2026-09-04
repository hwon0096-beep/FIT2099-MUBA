import { useAccount } from '../context/AccountContext'
import '../styles/account-gate.css'
export default function AccountBadge() { const { tier, logout } = useAccount(); return <aside className="account-badge"><strong>{tier === 'premium' ? 'Premium' : 'Free'}</strong><button type="button" onClick={logout}>Logout</button></aside> }
