import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import * as accountContext from '../context/AccountContext'
import SimpleStrategyOverview, { overviewModalReducer, showsPremiumLink } from './SimpleStrategyOverview'

describe('Strategy Lab Overview interactions', () => {
  it.each(['normal', 'premium'] as const)('keeps both free Explore actions accessible for %s accounts', tier => {
    const account = vi.spyOn(accountContext, 'useAccount').mockReturnValue({ tier, login: async () => ({ ok: true }), continueAsNormal: () => {}, logout: () => {} })
    try {
      const html = renderToStaticMarkup(createElement(SimpleStrategyOverview, { onExplore: vi.fn() }))
      const cards = html.match(/<article\b.*?<\/article>/g) ?? []
      expect(cards).toHaveLength(6)
      for (const [index, name] of ['Long Call', 'Long Put'].entries()) {
        expect(cards[index]).toContain(name)
        expect(cards[index]).toContain('overview-explore-action')
        expect(cards[index]).not.toContain('is-locked')
      }
      for (const card of cards.slice(2)) {
        expect(card).toContain(tier === 'normal' ? 'overview-unlock-action' : 'overview-explore-action')
      }
    } finally {
      account.mockRestore()
    }
  })

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
