import type { OptionAnalysisContext } from './analysisContext'

export async function askAIAnalyst(context: OptionAnalysisContext, question: string): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ context, question }),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(readError(body) ?? 'The AI Analyst is temporarily unavailable. Please try again.')
  if (!body || typeof body !== 'object' || typeof (body as { answer?: unknown }).answer !== 'string') throw new Error('The AI Analyst returned an invalid response.')
  return (body as { answer: string }).answer
}

function readError(body: unknown): string | null {
  return body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : null
}
