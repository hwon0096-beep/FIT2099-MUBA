import type { AccountTier } from '../context/AccountContext'
export const strategyTemplates = [
  { id: 'LONG_CALL', name: 'Long Call', outlook: 'Bullish', legs: 1, premium: false, description: 'Defined loss with unlimited upside.' },
  { id: 'LONG_PUT', name: 'Long Put', outlook: 'Bearish', legs: 1, premium: false, description: 'Defined loss with downside protection.' },
  { id: 'BULL_CALL_SPREAD', name: 'Bull Call Spread', outlook: 'Bullish', legs: 2, premium: true, description: 'Defined loss and defined reward.' },
  { id: 'BEAR_PUT_SPREAD', name: 'Bear Put Spread', outlook: 'Bearish', legs: 2, premium: true, description: 'Defined-risk bearish position.' },
  { id: 'LONG_STRADDLE', name: 'Long Straddle', outlook: 'Big Move', legs: 2, premium: true, description: 'Benefits from a large move either way.' },
  { id: 'BUTTERFLY', name: 'Butterfly Spread', outlook: 'Neutral', legs: 3, premium: true, description: 'Defined-risk range strategy.' },
  { id: 'IRON_CONDOR', name: 'Iron Condor', outlook: 'Income', legs: 4, premium: true, description: 'Defined-risk neutral income strategy.' },
] as const
export function canAccessStrategy(tier: AccountTier | null, id: string): boolean { return tier === 'premium' || id === 'LONG_CALL' || id === 'LONG_PUT' }
