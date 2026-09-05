import { describe, expect, it } from 'vitest'
import { answerAssistantQuestion, assistantQuestions, GUIDED_FALLBACK, topicForQuestion, type AssistantOptionContext } from './strategyAssistantResponses'

const option: AssistantOptionContext = { asset: 'BTC', type: 'Call', strike: 81000, expiry: 'Sep 11 UTC', premium: 640, currentPrice: 80000 }

describe('mock Strategy Assistant responses', () => {
  it('provides the supported educational topics without network-backed answers', () => {
    expect(assistantQuestions()).toContain('What is a Call option?')
    expect(answerAssistantQuestion('What is an option?')).toContain('contract')
    expect(answerAssistantQuestion('What is a strike price?')).toContain('strike price')
    expect(answerAssistantQuestion('What is an expiry date?')).toContain('expiry')
    expect(answerAssistantQuestion('What is the premium?')).toContain('premium')
    expect(answerAssistantQuestion('What is a Call option?')).toContain('right, but not the obligation')
    expect(answerAssistantQuestion('What is a Put?')).toContain('right, but not the obligation')
    expect(answerAssistantQuestion('What is paper trading?')).toContain('virtual USDC')
  })

  it('handles greetings, natural market outlooks, and beginner guidance', () => {
    expect(answerAssistantQuestion('Hi')).toContain('NUTSCOPE Strategy Assistant')
    expect(answerAssistantQuestion('I think BTC is going up')).toContain('Bullish')
    expect(answerAssistantQuestion('I think ETH will fall')).toContain('Bearish')
    expect(answerAssistantQuestion("I don't think ETH will move")).toContain('Neutral')
    expect(answerAssistantQuestion('What should a beginner learn first?')).toContain('Long Calls')
    expect(topicForQuestion('BTC might pump')).toBe('bullish')
    expect(topicForQuestion('What works when price goes down?')).toBe('bearish')
  })

  it('explains supported strategies and comparison trade-offs', () => {
    expect(answerAssistantQuestion('How does a Long Call work?')).toContain('Long Call')
    expect(answerAssistantQuestion('How does a Long Put work?')).toContain('Long Put')
    expect(answerAssistantQuestion('Explain Bull Call Spread')).toContain('two-leg')
    expect(answerAssistantQuestion('Explain Bear Put Spread')).toContain('two-leg')
    expect(answerAssistantQuestion('Explain Long Straddle')).toContain('two-leg')
    expect(answerAssistantQuestion('Explain Butterfly Spread')).toContain('multi-leg')
    expect(answerAssistantQuestion('Explain Iron Condor')).toContain('four-leg')
    expect(answerAssistantQuestion('Call or Bull Call Spread?')).toContain('different cost')
    expect(answerAssistantQuestion('Put or Bear Put Spread?')).toContain('Long Put')
    expect(answerAssistantQuestion('Straddle or Iron Condor?')).toContain('Long Straddle')
  })

  it('handles generic what-if, risk, break-even, and moneyness questions safely', () => {
    expect(answerAssistantQuestion('What if BTC goes up 10%?')).toContain('selected paper option')
    expect(answerAssistantQuestion('What if BTC goes down 10%?')).toContain('selected paper option')
    expect(answerAssistantQuestion('What if the price stays exactly where it is?')).toContain('selected option')
    expect(answerAssistantQuestion('What if the price reaches my strike?')).toContain('intrinsic value')
    expect(answerAssistantQuestion('What if the option expires OTM?')).toContain('out of the money')
    expect(answerAssistantQuestion('What if the option expires today?')).toContain('settlement price')
    expect(answerAssistantQuestion('What if I buy two contracts instead of one?')).toContain('doubles')
    expect(answerAssistantQuestion('What is risk?')).toContain('maximum loss')
    expect(answerAssistantQuestion('What does ITM mean?')).toContain('intrinsic value')
    expect(answerAssistantQuestion('What is break-even?')).toContain('strike plus premium')
  })

  it('keeps contextual option answers deterministic and uses payoff utilities', () => {
    expect(answerAssistantQuestion('What is the break-even?', option)).toContain('$81,640.00')
    expect(answerAssistantQuestion('What is the maximum loss?', option)).toContain('640')
    expect(answerAssistantQuestion('What happens if the underlying rises 10%?', option)).toContain('$6,360.00')
    expect(answerAssistantQuestion('What happens if it falls 10%?', option)).toContain('-$640.00')
    expect(answerAssistantQuestion('What if the price stays flat?', option)).toContain('-$640.00')
    expect(answerAssistantQuestion('Is this option ITM?', option)).toContain('OTM')
  })

  it('returns the guided fallback for unsupported typed questions', () => {
    expect(answerAssistantQuestion('Tell me a secret trading tip')).toBe(GUIDED_FALLBACK)
  })

  it('offers contextual questions only when a paper option is selected', () => {
    expect(assistantQuestions(option)).toContain('Explain this option')
    expect(assistantQuestions()).not.toContain('Explain this option')
  })
})
