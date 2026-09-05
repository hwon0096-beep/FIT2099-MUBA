import { useEffect, useRef, useState } from 'react'
import { useAccount } from '../context/AccountContext'
import { answerAssistantQuestion, assistantQuestions, topicForQuestion, type AssistantOptionContext, type AssistantTopic } from '../lib/strategyAssistantResponses'
import PremiumUnlockModal from './PremiumUnlockModal'
import { NutIcon } from './VisualSystem'
import '../styles/strategy-assistant.css'

interface Message { id: number; role: 'assistant' | 'user'; text: string }

const WELCOME = 'Hi! I can help you understand options and strategies in Strategy Lab. What would you like to learn?'

export default function StrategyAssistant({ selectedOption }: { selectedOption?: AssistantOptionContext }) {
  const { tier } = useAccount()
  const [open, setOpen] = useState(false)
  const [showUnlock, setShowUnlock] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [previousTopic, setPreviousTopic] = useState<AssistantTopic>()
  const bottomRef = useRef<HTMLDivElement>(null)
  const questions = assistantQuestions(selectedOption)

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])
  useEffect(() => { if (open && tier === 'premium' && messages.length === 0) setMessages([{ id: 0, role: 'assistant', text: WELCOME }]) }, [open, tier, messages.length])

  const openAssistant = () => {
    setOpen(true)
  }
  const ask = (question: string) => {
    if (tier !== 'premium') return
    const nextTopic = topicForQuestion(question)
    setMessages((existing) => [...existing, { id: existing.length, role: 'user', text: question }, { id: existing.length + 1, role: 'assistant', text: answerAssistantQuestion(question, selectedOption, previousTopic) }])
    if (nextTopic) setPreviousTopic(nextTopic)
    setInput('')
  }
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const question = input.trim(); if (question) ask(question) }

  return <>
    {!open && <button type="button" className="strategy-assistant-launcher" aria-label="Open AI Strategy Assistant" onClick={openAssistant}><NutIcon name="spark" /><span>AI Strategy Assistant</span></button>}
    {open && <aside className="strategy-assistant" aria-label="AI Strategy Assistant" aria-live="polite">
      <header><div><strong>NUTSCOPE AI Analyst</strong><span>Options Strategy Assistant · Guided</span></div><button type="button" aria-label="Close AI Strategy Assistant" onClick={() => setOpen(false)}>×</button></header>
      {tier !== 'premium' ? <div className="strategy-assistant-locked"><NutIcon name="shield" /><p className="eyebrow">PREMIUM FEATURE</p><h2>AI Strategy Assistant</h2><p>Get explanations of options, strategies, payoff and risk using the NUTSCOPE Strategy Assistant.</p><button type="button" className="modal-primary" onClick={() => setShowUnlock(true)}>Unlock Premium</button></div> : <>
        {selectedOption && <div className="strategy-assistant-context"><small>Currently viewing:</small><strong>{selectedOption.asset} ${selectedOption.strike.toLocaleString()} {selectedOption.type} · {selectedOption.expiry}</strong></div>}
        <div className="strategy-assistant-messages">{messages.map((message) => <div className={`strategy-assistant-message ${message.role}`} key={message.id}>{message.text}</div>)}<div ref={bottomRef} /></div>
        <div className="strategy-assistant-questions"><small>Suggested questions</small>{questions.map((question) => <button type="button" key={question} onClick={() => ask(question)}>{question}</button>)}</div>
        <form className="strategy-assistant-input" onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about options…" aria-label="Ask about options" /><button type="submit" aria-label="Send question" disabled={!input.trim()}>Send</button></form>
        <small className="strategy-assistant-disclaimer">Mock AI · Educational, read-only guidance</small>
      </>}
    </aside>}
    {showUnlock && <PremiumUnlockModal onClose={() => setShowUnlock(false)} />}
  </>
}
