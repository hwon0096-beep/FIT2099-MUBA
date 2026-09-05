import { breakevenPrice, maxLossTotal, moneyness, netPnlAtExpiry, type OptionType } from './payoff'
import { formatNumber, formatUsd } from './formatters'

export interface AssistantOptionContext {
  asset: string
  type: 'Call' | 'Put'
  strike: number
  expiry: string
  premium: number
  currentPrice?: number
}

export const EDUCATIONAL_QUESTIONS = [
  'What is an option?',
  'What is a Call?',
  'What is a Put?',
  'What is a strike price?',
  'What is an expiry date?',
  'What is the premium?',
  'What is a Call option?',
  'What is a Put option?',
  'Call vs Put',
  'What is break-even?',
  'What is maximum loss?',
  'What does ITM mean?',
  'What does ATM mean?',
  'What does OTM mean?',
  'What does ITM / ATM / OTM mean?',
  'What is paper trading?',
  'What strategy should a beginner learn first?',
  'What if BTC goes up 10%?',
  'What if BTC goes down 10%?',
  'What if the price stays exactly where it is?',
  'What if I expect a large price move?',
  'What if I expect very little movement?',
  'What happens if I buy a Call?',
  'What happens if I buy a Put?',
  'When does a Call make money?',
  'When does a Put make money?',
  'Explain Bull Call Spread',
  'Explain Bear Put Spread',
  'Explain Long Straddle',
  'Explain Butterfly Spread',
  'Explain Iron Condor',
  'Call or Bull Call Spread?',
  'Put or Bear Put Spread?',
  'Straddle or Iron Condor?',
  'Butterfly or Iron Condor?',
  'Which strategy has lower risk?',
  'Which strategies are bullish?',
  'Which strategies are bearish?',
  'Which strategies are neutral?',
  'What should I learn first?',
] as const

export const CONTEXTUAL_QUESTIONS = [
  'Explain this option',
  'When does this option profit?',
  'What is the maximum loss?',
  'What is the break-even?',
  'What happens if the underlying rises 10%?',
] as const

export const GUIDED_FALLBACK = "I'm currently a Strategy Lab assistant, so I'm best at questions about options, Calls, Puts, spreads, market outlook, risk, payoff, and Strategy Lab features. Try asking me something like 'What if BTC rises 10%?' or 'Call vs Bull Call Spread?'."
export const CONTEXT_UNAVAILABLE = "I don't have enough market data to calculate that scenario, but I can explain how the option would generally behave."
const FEATURED_QUESTIONS = [
  'What is an option?', 'What is a Call?', 'What is a Put?', 'What is a Call option?', 'What is a Put option?', 'What is break-even?',
  'What does ITM / ATM / OTM mean?', 'What is paper trading?', 'What if price rises 10%?',
  'I\'m bullish', 'I\'m bearish', 'Price stays flat', 'Call or Bull Call Spread?',
  'Put or Bear Put Spread?', 'Explain Bull Call Spread', 'Explain Bear Put Spread',
  'Explain Long Straddle', 'Explain Butterfly Spread', 'Explain Iron Condor',
] as const

export type AssistantTopic = 'bullish' | 'bearish' | 'neutral' | 'bull-call-spread' | 'bear-put-spread' | 'straddle' | 'butterfly' | 'iron-condor' | 'bullish-comparison' | 'bearish-comparison' | 'neutral-comparison'

export function assistantQuestions(option?: AssistantOptionContext): string[] {
  return option ? [...new Set([...CONTEXTUAL_QUESTIONS, ...FEATURED_QUESTIONS])] : [...FEATURED_QUESTIONS]
}

export function topicForQuestion(question: string): AssistantTopic | undefined {
  const normalized = question.toLowerCase()
  if (normalized.includes('call or bull call') || normalized.includes('spread instead of a call')) return 'bullish-comparison'
  if (normalized.includes('put or bear put') || normalized.includes('spread instead of a put')) return 'bearish-comparison'
  if (normalized.includes('straddle or iron condor') || normalized.includes('butterfly or iron condor')) return 'neutral-comparison'
  if (normalized.includes('bull call spread')) return 'bull-call-spread'
  if (normalized.includes('bear put spread')) return 'bear-put-spread'
  if (normalized.includes('straddle')) return 'straddle'
  if (normalized.includes('butterfly')) return 'butterfly'
  if (normalized.includes('iron condor')) return 'iron-condor'
  if (/(which strategy|what should i use|what's better|what is better|which one)/.test(normalized) && /(bullish|going up|go up|goes up|rising|rise|increase|pump|higher)/.test(normalized)) return 'bullish-comparison'
  if (/(which strategy|what should i use|what's better|what is better|which one)/.test(normalized) && /(bearish|going down|go down|goes down|fall|falling|decrease|crash|lower)/.test(normalized)) return 'bearish-comparison'
  if (/(bullish|going up|go up|goes up|rising|rise|increase|pump|higher)/.test(normalized)) return 'bullish'
  if (/(bearish|going down|go down|goes down|fall|falling|decrease|crash|lower)/.test(normalized)) return 'bearish'
  if (/(neutral|flat|sideways|stay the same|stays the same|little movement|won't move|doesn't move|do not move|don.t.*move|will not move|not move)/.test(normalized)) return 'neutral'
  return undefined
}

function optionType(option: AssistantOptionContext): OptionType { return option.type === 'Call' ? 'CALL' : 'PUT' }
function hasSafePremium(option: AssistantOptionContext): boolean { return Number.isFinite(option.premium) && option.premium >= 0 }
function hasSafeSpot(option: AssistantOptionContext): option is AssistantOptionContext & { currentPrice: number } { return option.currentPrice !== undefined && Number.isFinite(option.currentPrice) && option.currentPrice >= 0 }

function contextualAnswer(question: string, option: AssistantOptionContext): string | undefined {
  const normalized = question.toLowerCase()
  const type = optionType(option)
  const unavailable = CONTEXT_UNAVAILABLE
  if (normalized.includes('explain this option') || normalized.includes('choose this') || normalized.includes('risk of this option')) return `This is a long ${option.type.toLowerCase()} on ${option.asset} with a ${formatUsd(option.strike)} strike, expiring ${option.expiry}. The buyer pays the quoted premium for the right to ${type === 'CALL' ? 'buy' : 'sell'} at expiry; the premium is the defined risk for this long option.`
  if (normalized.includes('when does this option profit') || normalized.includes('break-even') || normalized.includes('when would this option profit')) {
    return hasSafePremium(option) ? `At expiry, this long ${option.type.toLowerCase()} begins making a net profit ${type === 'CALL' ? 'above' : 'below'} ${formatUsd(breakevenPrice(type, option.strike, option.premium))}.` : unavailable
  }
  if (normalized.includes('maximum loss') || normalized.includes('more than my premium')) return hasSafePremium(option) ? `The maximum loss is the premium paid: ${formatNumber(maxLossTotal(option.premium, 1), 6)} USDC for one contract. A long option cannot lose more than that premium at expiry.` : unavailable
  if (normalized.includes('rises 10%') || normalized.includes('goes up 10%') || normalized.includes('price +10%')) return scenarioAnswer(option, 10, unavailable)
  if (normalized.includes('falls 10%') || normalized.includes('goes down 10%') || normalized.includes('price -10%')) return scenarioAnswer(option, -10, unavailable)
  if (normalized.includes('stays here') || normalized.includes('stays exactly') || normalized.includes('stays flat') || normalized.includes('reaches my strike') || normalized.includes('price reaches')) {
    if (!hasSafePremium(option) || !hasSafeSpot(option)) return unavailable
    const expiryPrice = normalized.includes('strike') ? option.strike : option.currentPrice
    const pnl = netPnlAtExpiry({ optionType: type, strike: option.strike, premium: option.premium, positionSize: 1, currentPrice: option.currentPrice }, expiryPrice)
    return `If ${option.asset} settles at ${formatUsd(expiryPrice)} at expiry, the estimated P&L is ${pnl >= 0 ? '+' : ''}${formatUsd(pnl)} for one contract, based on the quoted premium.`
  }
  if (normalized.includes('above my') || normalized.includes('above the strike') || normalized.includes('below my') || normalized.includes('below the strike')) return `Moving ${normalized.includes('above') ? 'above' : 'below'} the strike changes the option's intrinsic value. It does not automatically mean the trade is profitable: a long position generally needs to pass its ${type === 'CALL' ? 'strike plus' : 'strike minus'} premium break-even at expiry.`
  if (normalized.includes('expires otm')) return `If this option expires out of the money, it has no intrinsic value at expiry and the long position loses the premium paid.`
  if (normalized.includes('expires itm')) return `If this option expires in the money, it has intrinsic value at expiry. Net profit still depends on whether that value exceeds the premium paid.`
  if (normalized.includes('expires today') || normalized.includes('at expiry')) return `At expiry, only the underlying settlement price determines intrinsic value. A long ${option.type.toLowerCase()} is profitable only after its premium-adjusted break-even.`
  if (normalized.includes('itm') || normalized.includes('atm') || normalized.includes('otm')) {
    if (!hasSafeSpot(option)) return unavailable
    return `${option.asset} is currently ${moneyness(type, option.strike, option.currentPrice)} for this ${option.type.toLowerCase()}. The label compares the live spot with the strike and can change as the market moves.`
  }
  if (normalized.includes('two contracts') || normalized.includes('buy two')) return hasSafePremium(option) ? `Buying two contracts doubles the premium at risk to ${formatNumber(maxLossTotal(option.premium, 2), 6)} USDC and doubles any expiry P&L, assuming the same quoted premium per contract.` : unavailable
  return undefined
}

function scenarioAnswer(option: AssistantOptionContext, changePercent: number, unavailable: string): string {
  if (!hasSafePremium(option) || !hasSafeSpot(option)) return unavailable
  const expiryPrice = option.currentPrice * (1 + changePercent / 100)
  const pnl = netPnlAtExpiry({ optionType: optionType(option), strike: option.strike, premium: option.premium, positionSize: 1, currentPrice: option.currentPrice }, expiryPrice)
  return `If ${option.asset} settles ${Math.abs(changePercent)}% ${changePercent > 0 ? 'higher' : 'lower'} at expiry (${formatUsd(expiryPrice)}), the estimated expiry P&L is ${pnl >= 0 ? '+' : ''}${formatUsd(pnl)} for one contract, based on the quoted premium.`
}

export function answerAssistantQuestion(question: string, option?: AssistantOptionContext, previousTopic?: AssistantTopic): string {
  if (option) {
    const contextual = contextualAnswer(question, option)
    if (contextual) return contextual
  }
  const normalized = question.toLowerCase()
  if (/^(hi|hello|hey)\b/.test(normalized)) return "Hi! I'm the NUTSCOPE Strategy Assistant. I can explain options, Calls, Puts, spreads, strategy risks, market-outlook scenarios, and Strategy Lab features. I'm educational only and don't provide personalized financial advice."
  if (normalized.includes('thanks') || normalized.includes('thank you')) return "You're welcome. Ask me about an option, strategy, risk, or market outlook whenever you're ready."
  if (normalized.includes('who are you') || normalized.includes('what can you do') || normalized.includes('help me') || normalized.includes('where should i start') || normalized.includes("i'm new") || normalized.includes('confused')) return "I'm the NUTSCOPE Strategy Assistant. Start with what an option, Call, Put, premium, or break-even means, then explore strategy trade-offs. I'm an educational assistant and don't provide personalized financial advice."
  if (previousTopic === 'bull-call-spread' && /(down|fall|crash|lower)/.test(normalized)) return 'A Bull Call Spread is designed for a bullish outlook, so a move down generally works against its expiry payoff. Its loss remains capped at the net debit when the structure is supported.'
  if (previousTopic === 'bear-put-spread' && /(up|rise|pump|higher)/.test(normalized)) return 'A Bear Put Spread is designed for a bearish outlook, so a move up generally works against its expiry payoff. Its loss remains capped at the net debit when the structure is supported.'
  if (previousTopic?.endsWith('comparison') && /(which one|cost|cheaper|lower)/.test(normalized)) return previousTopic === 'bullish-comparison' ? 'A Bull Call Spread may require less upfront debit than a Long Call because it sells a higher-strike Call, but that also caps the maximum profit. The exact cost depends on the selected market orders.' : 'The lower-cost choice depends on the selected premiums and structure. A spread can reduce upfront debit by selling another option, but it also caps the payoff compared with the standalone option.'
  if (/(what if|goes up|goes down|rises|falls|increase|decrease|pump|crash)/.test(normalized) && /\d+\s*%/.test(normalized)) return option ? CONTEXT_UNAVAILABLE : 'A specific scenario P&L requires a selected paper option with a live spot and quoted premium. Select an option first and I can calculate the deterministic expiry outcome.'
  if (normalized.includes('large price move') || normalized.includes('large move') || normalized.includes('very little movement') || normalized.includes('little movement')) return normalized.includes('large') ? 'A Long Straddle combines a long Call and a long Put and is generally used when a large move in either direction is expected. The trade-off is paying both premiums, with loss capped at that combined debit.' : 'A Butterfly or Iron Condor is generally associated with a range-bound outlook and limited movement. Both have defined-risk structures, but their exact payoff depends on their strikes and premiums.'
  if (normalized.includes('call or bull call') || normalized.includes('spread instead of a call')) return 'A Long Call is simpler and keeps unlimited upside potential, but you pay the full option premium. A Bull Call Spread buys a lower-strike Call and sells a higher-strike Call, which can reduce the upfront debit while capping maximum profit. Both express a bullish outlook with different cost and payoff trade-offs.'
  if (normalized.includes('put or bear put') || normalized.includes('spread instead of a put')) return 'A Long Put is a simpler bearish position with upside as the underlying falls toward zero, while a Bear Put Spread buys a higher-strike Put and sells a lower-strike Put. The spread can reduce upfront debit but caps maximum profit. Both have defined premium risk.'
  if (normalized.includes('straddle or iron condor')) return 'A Long Straddle is designed for a large move in either direction and pays two option premiums. An Iron Condor is generally designed for a range-bound market with defined risk and reward. Their outlooks and payoff trade-offs are different rather than one being universally better.'
  if (normalized.includes('butterfly or iron condor')) return 'Both are defined-risk, range-oriented structures. A Butterfly concentrates its payoff near a middle strike, while an Iron Condor typically offers a wider profitable range with capped reward. Exact outcomes depend on the selected strikes and premiums.'
  if (normalized.includes('lower risk') || normalized.includes('less risk')) return 'Risk depends on the structure, premium, quantity, and strikes. Long Calls and Puts cap loss at premium; spreads, Butterflies, and Iron Condors can also cap loss but add multi-leg trade-offs. Compare the documented maximum loss rather than assuming one structure is always safer.'
  if (normalized.includes('what is an option')) return 'An option is a contract that gives its buyer a right, not an obligation, to buy or sell an underlying at a strike price by expiry. The buyer pays a premium and the payoff depends on the underlying at expiry.'
  if (normalized.includes('strike price')) return 'The strike price is the agreed level at which a Call buyer can buy or a Put buyer can sell the underlying at expiry. It is one of the main inputs to an option payoff.'
  if (normalized.includes('expiry date') || normalized.includes('expiration date')) return 'The expiry date is when the option settles. At expiry, intrinsic value is determined by the underlying settlement price relative to the strike.'
  if (normalized.includes('premium')) return 'The premium is the amount paid to open a long option, quoted per contract in the selected market data. It is the buyer\'s upfront cost and maximum loss for a long option.'
  if (normalized.includes('paper trading')) return 'Paper trading simulates orders with virtual USDC. It lets you explore live market data and strategy outcomes without signing transactions or risking real funds.'
  if (normalized.includes('beginner') || normalized.includes('learn first') || normalized.includes('what should i learn')) return 'A beginner can start by learning Long Calls and Long Puts, then compare how premium, strike, expiry, and break-even shape their defined-risk payoffs. Strategy Lab is a simulated educational environment.'
  if (normalized.includes('what happens if i buy a call') || normalized.includes('when does a call make money') || normalized.includes('call expires below')) return 'A Long Call benefits from the underlying rising. At expiry, it has positive net P&L only when intrinsic value exceeds the premium; if it expires below the strike, it expires worthless and the premium is lost.'
  if (normalized.includes('what happens if i buy a put') || normalized.includes('when does a put make money') || normalized.includes('put expires above')) return 'A Long Put benefits from the underlying falling. At expiry, it has positive net P&L only when intrinsic value exceeds the premium; if it expires above the strike, it expires worthless and the premium is lost.'
  if (normalized.includes('long call')) return 'A Long Call is a single-leg bullish position: buy a Call and pay a premium. It can profit at expiry above strike plus premium; loss is capped at the premium, while upside is uncapped in the expiry model.'
  if (normalized.includes('long put')) return 'A Long Put is a single-leg bearish position: buy a Put and pay a premium. It can profit at expiry below strike minus premium; loss is capped at the premium, while reward is limited by the underlying reaching zero.'
  if (normalized.includes('call') && normalized.includes('put') && !normalized.includes('spread')) return 'A Call gives the buyer the right to buy at the strike and generally benefits from a rise. A Put gives the buyer the right to sell at the strike and generally benefits from a fall. Both long positions have the premium at risk.'
  if (normalized.includes('what if the price stays') || normalized.includes('stay flat')) return option ? CONTEXT_UNAVAILABLE : 'If the underlying stays flat, a long option may still lose value because the premium must be recovered. A precise expiry P&L requires a selected option and live spot.'
  if (normalized.includes('reaches my strike') || normalized.includes('above my strike') || normalized.includes('below my strike')) return 'Reaching or crossing the strike gives a long option intrinsic value in the relevant direction. It does not automatically mean a profit because the premium still has to be recovered at expiry.'
  if (normalized.includes('expires otm')) return 'If an option expires out of the money, it has no intrinsic value at expiry and a long buyer generally loses the premium paid.'
  if (normalized.includes('expires itm')) return 'If an option expires in the money, it has intrinsic value at expiry. Net profit still depends on whether that value exceeds the premium paid.'
  if (normalized.includes('expires today')) return 'If an option expires today, its outcome is determined by the underlying settlement price relative to the strike. A precise P&L still requires the selected option data.'
  if (normalized.includes('two contracts') || normalized.includes('buy two')) return 'Buying two contracts doubles the premium at risk and doubles the expiry payoff compared with one contract, assuming the same premium per contract.'
  if (normalized.includes('bullish') || topicForQuestion(question) === 'bullish') return 'Bullish strategies generally benefit from the underlying rising. A Long Call keeps uncapped upside with premium risk, while a Bull Call Spread caps both loss and reward. The appropriate comparison depends on the desired cost and payoff trade-off, not a universal recommendation.'
  if (normalized.includes('bearish') || topicForQuestion(question) === 'bearish') return 'Bearish strategies generally benefit from the underlying falling. A Long Put has a defined premium loss and potential gain toward zero, while a Bear Put Spread caps both loss and reward. Compare their documented payoff characteristics for your market view.'
  if (normalized.includes('neutral') || topicForQuestion(question) === 'neutral') return 'Neutral strategies are generally designed for a range-bound market. A Butterfly concentrates risk and reward around a middle strike, while an Iron Condor uses two spreads with capped outcomes where supported.'
  if (normalized.includes('call vs put')) return 'A call gives the buyer the right to buy at the strike; a put gives the buyer the right to sell. Long calls generally benefit from a rise, while long puts generally benefit from a fall, with the premium paid at risk.'
  if (normalized.includes('call option') || /what is a call\b/.test(normalized)) return 'A call gives the buyer the right, but not the obligation, to buy the underlying at the strike price at expiry. A long call has a defined premium risk and benefits from an upward move.'
  if (normalized.includes('put option') || /what is a put\b/.test(normalized)) return 'A put gives the buyer the right, but not the obligation, to sell the underlying at the strike price at expiry. A long put has a defined premium risk and benefits from a downward move.'
  if (normalized.includes('break-even')) return 'For a long call, break-even is strike plus premium. For a long put, it is strike minus premium. Net P&L is positive beyond that level at expiry.'
  if (normalized.includes('maximum loss') || normalized.includes('risk') || normalized.includes('loss')) return 'For a long option, maximum loss is capped at the premium paid. A spread can also have a defined loss, depending on its net debit. Always check the documented maximum loss for the exact structure.'
  if (normalized.includes('itm') || normalized.includes('atm') || normalized.includes('otm')) return 'ITM means the option has intrinsic value, ATM means the underlying is near the strike, and OTM means it has no intrinsic value at that moment. These labels can change as the underlying moves.'
  if (normalized.includes('bull call spread')) return 'A Bull Call Spread is a two-leg, moderately bullish strategy: buy a lower-strike Call and sell a higher-strike Call with the same expiry. Profit is generally capped at the strike width minus the net debit; loss is capped at the debit paid. It trades lower upfront cost for capped reward.'
  if (normalized.includes('bear put spread')) return 'A Bear Put Spread is a two-leg, moderately bearish strategy: buy a higher-strike Put and sell a lower-strike Put with the same expiry. Profit and loss are both defined by the strikes and net debit. The trade-off is capped reward in exchange for a potentially smaller upfront debit.'
  if (normalized.includes('long straddle') || normalized.includes('straddle')) return 'A Long Straddle is a two-leg strategy that buys a Call and a Put at the same strike and expiry. It is generally used when a large move in either direction is expected. Loss is capped at the combined premium; profit depends on moving beyond either premium-adjusted break-even.'
  if (normalized.includes('butterfly')) return 'A Butterfly is a multi-leg, generally neutral strategy using three strikes: buy the outside options and sell two at the middle strike. It seeks a range-bound expiry near the middle strike, with defined maximum loss and capped reward when properly constructed.'
  if (normalized.includes('iron condor')) return 'An Iron Condor is a four-leg, generally neutral strategy combining a Put Spread and a Call Spread. It is designed for a range-bound outcome with defined maximum loss and capped reward. Exact break-evens depend on its strikes and net premium.'
  if (normalized.includes('bullish')) return 'Bullish strategies generally benefit from the underlying rising. Examples include a long call and a bull call spread.'
  if (normalized.includes('bearish')) return 'Bearish strategies generally benefit from the underlying falling. Examples include a long put and a bear put spread.'
  if (normalized.includes('neutral')) return 'Neutral strategies are designed for a range-bound view. Examples include a butterfly and, where supported, an iron condor.'
  return GUIDED_FALLBACK
}
