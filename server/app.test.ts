import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { createApp } from './app.js'
import type { ThetanutsApiResponse } from './thetanuts.js'

const { loadThetanutsData } = vi.hoisted(() => ({ loadThetanutsData: vi.fn() }))

vi.mock('./thetanuts.js', () => ({
  loadThetanutsData,
  fetchFillOrders: vi.fn(),
  fetchBookOption: vi.fn(),
}))

// Route tests only care about errors[]/status handling, not the exact shape of a
// successful payload, so protocolStats is accepted loosely here rather than
// filling in every field of the SDK's real TimeWindowStats type.
function baseResponse(overrides: Record<string, unknown>): ThetanutsApiResponse {
  return { errors: [], fetchedAt: new Date().toISOString(), ...overrides } as ThetanutsApiResponse
}

describe('GET /api/thetanuts', () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    loadThetanutsData.mockReset()
    server = createApp().listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const { port } = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('returns 200 with the successful sources plus the error list when only one source fails', async () => {
    loadThetanutsData.mockResolvedValue(baseResponse({
      orders: [],
      protocolStats: { stats: { totalVolumeUsd: '0', totalPremiumUsd: '0', totalPositions: 0, '24h': { positions: 0 } } },
      errors: ['Live market data could not be loaded: market down'],
    }))

    const response = await fetch(`${baseUrl}/api/thetanuts`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.orders).toEqual([])
    expect(body.marketData).toBeUndefined()
    expect(body.errors).toEqual(['Live market data could not be loaded: market down'])
  })

  it('still returns 200 when two of the three sources fail (only all three trips 502)', async () => {
    loadThetanutsData.mockResolvedValue(baseResponse({
      orders: [],
      errors: [
        'Live market data could not be loaded: down',
        'Live OptionBook protocol statistics could not be loaded: down',
      ],
    }))

    const response = await fetch(`${baseUrl}/api/thetanuts`)
    expect(response.status).toBe(200)
  })

  it('returns 502 when all three sources fail', async () => {
    loadThetanutsData.mockResolvedValue(baseResponse({
      errors: [
        'Live OptionBook orders could not be loaded: down',
        'Live market data could not be loaded: down',
        'Live OptionBook protocol statistics could not be loaded: down',
      ],
    }))

    const response = await fetch(`${baseUrl}/api/thetanuts`)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.errors).toHaveLength(3)
  })

  it('returns 500 and surfaces the real error message if loadThetanutsData itself throws', async () => {
    loadThetanutsData.mockRejectedValue(new Error('unexpected crash'))

    const response = await fetch(`${baseUrl}/api/thetanuts`)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.errors[0]).toContain('unexpected crash')
  })
})
