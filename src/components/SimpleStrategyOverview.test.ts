import { describe, expect, it } from 'vitest'
import { overviewModalReducer, showsPremiumLink } from './SimpleStrategyOverview'

describe('Strategy Lab Overview interactions', () => {
  it('opens the About Strategy Lab modal and can close it', () => {
    const open = overviewModalReducer(null, { type: 'open', modal: 'about' })
    expect(open).toBe('about')
    expect(overviewModalReducer(open, { type: 'close' })).toBeNull()
  })

  it('opens the existing Premium unlock flow for a free user', () => {
    expect(showsPremiumLink('normal')).toBe(true)
    expect(overviewModalReducer(null, { type: 'open', modal: 'premium' })).toBe('premium')
  })

  it('updates the account-card action when the account becomes premium', () => {
    expect(showsPremiumLink('normal')).toBe(true)
    expect(showsPremiumLink('premium')).toBe(false)
  })
})
