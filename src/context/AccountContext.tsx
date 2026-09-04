import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type AccountTier = 'normal' | 'premium'
interface AccountValue { tier: AccountTier | null; login: (password: string) => Promise<boolean>; continueAsNormal: () => void; logout: () => void }
const AccountContext = createContext<AccountValue | null>(null)
export function AccountProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<AccountTier | null>(null)
  const value = useMemo<AccountValue>(() => ({ tier, continueAsNormal: () => setTier('normal'), logout: () => setTier(null), login: async (password) => {
    try { const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const body: unknown = await response.json(); if (response.ok && typeof body === 'object' && body !== null && (body as { tier?: unknown }).tier === 'premium') { setTier('premium'); return true } } catch { /* access is never granted on a request failure */ }
    return false
  } }), [tier])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
export function useAccount(): AccountValue { const value = useContext(AccountContext); if (!value) throw new Error('useAccount() must be used inside AccountProvider.'); return value }
