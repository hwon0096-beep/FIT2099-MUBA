import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { askAIAnalyst } from './aiAnalyst'
import type { OptionAnalysisContext } from './analysisContext'

const context = { orderId: 'one', asset: 'ETH', strategyType: 'LONG_CALL' } as OptionAnalysisContext

describe('AI Analyst client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('submits quick and custom questions with the selected context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answer: 'Educational answer' }) })
    vi.stubGlobal('fetch', fetchMock)
    await expect(askAIAnalyst(context, 'Explain this option')).resolves.toBe('Educational answer')
    await askAIAnalyst(context, 'What happens at expiry?')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ context, question: 'Explain this option' })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).question).toBe('What happens at expiry?')
  })

  it('turns provider failure into a safe UI-facing error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'The AI Analyst is temporarily unavailable.' }) }))
    await expect(askAIAnalyst(context, 'Explain this option')).rejects.toThrow('temporarily unavailable')
  })

  it('does not place the server API secret name in frontend runtime code', () => {
    expect(readFileSync(new URL('./aiAnalyst.ts', import.meta.url), 'utf8')).not.toContain('GEMINI_API_KEY')
  })
})
