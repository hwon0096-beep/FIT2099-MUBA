import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import express from 'express'
import { createAIAnalystHandler, requestAnalystAnswer, validateAnalystRequest } from './aiAnalyst.js'

const valid = { question: 'Explain this option', context: { orderId: 'one', asset: 'ETH', strategyType: 'LONG_CALL', breakEven: 105 } }

describe('AI Analyst server', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rejects malformed requests and oversized questions', () => {
    expect(validateAnalystRequest({})).toBeNull()
    expect(validateAnalystRequest({ ...valid, question: 'x'.repeat(501) })).toBeNull()
    expect(validateAnalystRequest(valid)).toEqual(valid)
  })

  it('sends server-controlled instructions and extracts the provider answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'The maximum loss is ' }, { text: '$5.' }] } }] }) })
    vi.stubGlobal('fetch', fetchMock)
    await expect(requestAnalystAnswer(valid, 'server-secret')).resolves.toBe('The maximum loss is $5.')
    const request = fetchMock.mock.calls[0][1]
    expect(request.headers['x-goog-api-key']).toBe('server-secret')
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3.1-flash-lite:generateContent')
    expect(JSON.parse(request.body).systemInstruction.parts[0].text).toContain('educational options analyst')
  })

  it('returns a safe response when the provider fails', async () => {
    const app = express().use(express.json()).post('/api/chat', createAIAnalystHandler(async () => { throw new Error('secret internal detail') }))
    const server: Server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) })
    const body = await response.json()
    await new Promise<void>(resolve => server.close(() => resolve()))
    expect(response.status).toBe(503)
    expect(body.error).toContain('temporarily unavailable')
    expect(body.error).not.toContain('secret internal detail')
  })
})
