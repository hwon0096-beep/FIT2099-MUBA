import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type AccountTier = 'normal' | 'premium'
export type LoginResult = { ok: true } | { ok: false; reason: 'invalid' | 'unavailable' }
interface AccountValue { tier: AccountTier | null; login: (password: string) => Promise<LoginResult>; continueAsNormal: () => void; logout: () => void }
const AccountContext = createContext<AccountValue | null>(null)
export function AccountProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<AccountTier | null>(null)
  const value = useMemo<AccountValue>(() => ({ tier, continueAsNormal: () => setTier('normal'), logout: () => setTier(null), login: async (password) => {
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const body: unknown = await response.json()
      if (response.ok && typeof body === 'object' && body !== null && (body as { tier?: unknown }).tier === 'premium') { setTier('premium'); return { ok: true } }
      // The server only returns 401 for a genuinely wrong password (see server/login.ts);
      // any other non-ok status (503 when PREMIUM_PASSWORD isn't configured, etc.) means
      // Premium itself is unavailable right now, not that the password was wrong.
      return { ok: false, reason: response.status === 401 ? 'invalid' : 'unavailable' }
    } catch { /* a network failure means access is unavailable, never that the password was wrong */ }
    return { ok: false, reason: 'unavailable' }
  } }), [tier])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
export function useAccount(): AccountValue { const value = useContext(AccountContext); if (!value) throw new Error('useAccount() must be used inside AccountProvider.'); return value }
