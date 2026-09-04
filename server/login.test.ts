import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import { loginHandler } from './login.js'

describe('premium login', () => {
  const original = process.env.PREMIUM_PASSWORD
  beforeEach(() => { process.env.PREMIUM_PASSWORD = 'test-password' })
  afterEach(() => { if (original === undefined) delete process.env.PREMIUM_PASSWORD; else process.env.PREMIUM_PASSWORD = original })
  async function request(body: unknown) { const app = express().use(express.json()).post('/login', loginHandler); const server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve)); const port = (server.address() as { port: number }).port; const response = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await new Promise<void>(resolve => server.close(() => resolve())); return response }
  it('accepts the configured password without returning it', async () => { const response = await request({ password: 'test-password' }); expect(response.status).toBe(200); expect(await response.json()).toEqual({ tier: 'premium' }) })
  it('rejects invalid and malformed requests', async () => { expect((await request({ password: 'wrong' })).status).toBe(401); expect((await request({})).status).toBe(400) })
  it('returns a safe unavailable response without configuration', async () => { delete process.env.PREMIUM_PASSWORD; expect((await request({ password: 'anything' })).status).toBe(503) })
})
