import { useEffect, useState } from 'react'
import { askAIAnalyst } from '../lib/aiAnalyst'
import type { OptionAnalysisContext } from '../lib/analysisContext'
import { useAccount } from '../context/AccountContext'
import PremiumUnlockModal from './PremiumUnlockModal'

export const QUICK_QUESTIONS = ['Explain this option', 'When do I profit?', 'What is my downside?', 'What happens if price +10%?'] as const

export default function AIAnalyst({ context }: { context: OptionAnalysisContext }) {
  const { tier } = useAccount()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [showUnlock, setShowUnlock] = useState(false)

  useEffect(() => { setQuestion(''); setAnswer(null); setError(null); setSending(false) }, [context.orderId])

  const submit = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || sending) return
    setSending(true); setError(null)
    try { setAnswer(await askAIAnalyst(context, trimmed)); setQuestion('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The AI Analyst is temporarily unavailable.') }
    finally { setSending(false) }
  }

  if (context.strategyType === 'UNSUPPORTED') return <section className="analyze-card ai-analyst"><h2>AI Analyst</h2><p className="analyze-notice">AI analysis is unavailable because this order does not have safely supported deterministic payoff data.</p></section>

  return <section className="analyze-card ai-analyst" aria-labelledby="ai-analyst-heading">
    <header><div><p className="analyze-kicker">EDUCATIONAL · READ-ONLY</p><h2 id="ai-analyst-heading">AI Analyst</h2></div></header>
    <p>Ask about the selected option. Answers use the verified figures shown above and are educational, not financial advice.</p>
    {tier === 'premium' ? <>
      <div className="ai-quick-questions" aria-label="Quick questions">{QUICK_QUESTIONS.map(item => <button type="button" key={item} disabled={sending} onClick={() => void submit(item)}>{item}</button>)}</div>
      <form onSubmit={event => { event.preventDefault(); void submit(question) }}><label htmlFor="ai-question">Ask about this option</label><div><input id="ai-question" maxLength={500} value={question} disabled={sending} onChange={event => setQuestion(event.target.value)} placeholder="Ask about this option…" /><button type="submit" disabled={sending || !question.trim()}>{sending ? 'Analyzing…' : 'Ask'}</button></div></form>
      {answer && <div className="ai-answer" aria-live="polite"><strong>Analyst response</strong><p>{answer}</p></div>}
      {error && <p className="analyze-notice" role="alert">{error}</p>}
    </> : <div className="ai-analyst-locked"><p className="analyze-notice">🔒 Premium feature. Unlock Premium to ask the AI Analyst about this option.</p><button type="button" className="modal-primary" onClick={() => setShowUnlock(true)}>Unlock Premium</button></div>}
    {showUnlock && <PremiumUnlockModal onClose={() => setShowUnlock(false)} />}
  </section>
}
