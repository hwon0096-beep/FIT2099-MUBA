import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import { createApp } from './app.js'
import { loginErrorHandler } from './login.js'

describe('premium login', () => {
  beforeEach(() => { vi.stubEnv('PREMIUM_PASSWORD', 'test-password') })
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

  async function request(body: string, app = createApp(), path = '/api/login') {
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      })
      expect(response.headers.get('content-type')).toContain('application/json')
      return { status: response.status, body: await response.json() }
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }

  it('accepts the configured password without returning it and rejects the demo code', async () => {
    expect(await request(JSON.stringify({ password: 'test-password' }))).toEqual({ status: 200, body: { tier: 'premium' } })
    expect(await request(JSON.stringify({ password: 'NUTSCOPE2026' }))).toEqual({ status: 401, body: { error: 'Invalid premium password' } })
  })

  it.each([undefined, ''])('uses demo access when the override is %s', async value => {
    vi.stubEnv('PREMIUM_PASSWORD', value)
    expect(await request(JSON.stringify({ password: 'NUTSCOPE2026' }))).toEqual({ status: 200, body: { tier: 'premium' } })
    expect(await request(JSON.stringify({ password: 'wrong' }))).toEqual({ status: 401, body: { error: 'Invalid premium password' } })
  })

  it.each(['{}', '{"password":123}', '', '{"password":', 'null'])('returns JSON for malformed input: %s', async body => {
    expect(await request(body)).toEqual({ status: 400, body: { error: 'Malformed login request' } })
  })

  it('returns JSON with 413 for oversized requests', async () => {
    expect(await request(JSON.stringify({ password: 'x'.repeat(3000) }))).toEqual({ status: 413, body: { error: 'Login request is too large' } })
  })

  it('returns JSON with 500 and logs unexpected failures without exposing submitted credentials', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = express().post('/api/login', () => {
      throw Object.assign(new Error('private detail'), { body: 'submitted-password' })
    }, loginErrorHandler)
    expect(await request('{}', app)).toEqual({ status: 500, body: { error: 'Premium access is temporarily unavailable' } })
    expect(log).toHaveBeenCalled()
    expect(JSON.stringify(log.mock.calls)).not.toContain('submitted-password')
  })

  it('starts without optional environment variables and isolates missing Gemini to AI', async () => {
    for (const name of ['PREMIUM_PASSWORD', 'GEMINI_API_KEY', 'BASE_RPC_URL']) vi.stubEnv(name, undefined)
    const app = createApp()
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const health = await fetch(`http://127.0.0.1:${port}/healthz`)
      expect(health.status).toBe(200)
      expect(await health.json()).toMatchObject({ status: 'ok', rpcConfigured: false })
      const ai = await request(JSON.stringify({ question: 'Explain this option', context: { orderId: 'demo', asset: 'ETH', strategyType: 'CALL' } }), app, '/api/chat')
      expect(ai.status).toBe(503)
      expect(ai.body.error).toContain('deterministic option analysis remains available')
      expect(await request(JSON.stringify({ password: 'NUTSCOPE2026' }), app)).toEqual({ status: 200, body: { tier: 'premium' } })
      expect((await fetch(`http://127.0.0.1:${port}/healthz`)).status).toBe(200)
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
