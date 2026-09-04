import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './AppRouter'
import { AccountProvider, useAccount } from './context/AccountContext'
import LoginGate from './components/LoginGate'
import AccountBadge from './components/AccountBadge'
import './index.css'
import './styles/icon-system.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider><AccountEntry /></AccountProvider>
  </StrictMode>,
)
function AccountEntry() { const { tier } = useAccount(); return tier === null ? <LoginGate /> : <><AppRouter /><AccountBadge /></> }
