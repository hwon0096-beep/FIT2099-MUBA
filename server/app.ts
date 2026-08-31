import express from 'express'
import { fetchBookOption, fetchRawOrders, loadThetanutsData } from './thetanuts.js'

// Builds the Express app without binding it to a port, so both the local dev
// entrypoint (index.ts, listening on 8787 behind Vite's proxy) and the
// production entrypoint (../start.ts, serving dist/ + the API on one port)
// share the exact same route definitions instead of duplicating them.
export function createApp() {
  const app = express()

  // No SDK/RPC calls here on purpose — this must answer even when Thetanuts
  // or the RPC provider is down, so deployment monitoring can tell the
  // process itself is alive from the dependencies it relies on.
  app.get('/healthz', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      uptimeSeconds: process.uptime(),
      rpcConfigured: Boolean(process.env.BASE_RPC_URL),
    })
  })

  app.get('/api/thetanuts', async (_request, response) => {
    console.info('[Thetanuts API] GET /api/thetanuts')

    try {
      const data = await loadThetanutsData()
      response.set('Cache-Control', 'no-store')
      response.status(data.errors.length === 3 ? 502 : 200).json(data)
    } catch (error) {
      console.error('[Thetanuts API] Unexpected endpoint failure', error)
      const message = error instanceof Error ? error.message : String(error)
      response.status(500).json({ errors: [`Thetanuts API request failed: ${message}`], fetchedAt: new Date().toISOString() })
    }
  })

  // FillFlow.tsx can't call client.api.fetchOrders() from the browser (Thetanuts'
  // API doesn't return Access-Control-Allow-Origin), so it fetches this instead.
  // Order objects carry bigint fields (price, expiry, nonce, strikes, ...) that
  // JSON.stringify can't handle by default, so bigints are marshalled as
  // { $bigint: "..." } — FillFlow.tsx's fetch reverses this on the way in.
  app.get('/api/fill/orders', async (_request, response) => {
    console.info('[Thetanuts API] GET /api/fill/orders')

    try {
      const orders = await fetchRawOrders()
      response.set('Cache-Control', 'no-store')
      response.type('application/json').send(JSON.stringify(orders, (_key, value) => (
        typeof value === 'bigint' ? { $bigint: value.toString() } : value
      )))
    } catch (error) {
      console.error('[Thetanuts API] /api/fill/orders failed', error)
      const message = error instanceof Error ? error.message : String(error)
      response.status(502).json({ error: `Thetanuts orders request failed: ${message}` })
    }
  })

  // PortfolioPage.tsx's positions table: strike(s)/expiry/type/status/entry price for one
  // already-deployed option contract, resolved server-side since client.api.getBookOption()
  // isn't reachable directly from the browser (see fetchBookOption()'s comment in thetanuts.ts).
  app.get('/api/portfolio/option/:address', async (request, response) => {
    console.info('[Thetanuts API] GET /api/portfolio/option/:address', request.params.address)

    try {
      const detail = await fetchBookOption(request.params.address)
      response.set('Cache-Control', 'no-store')
      response.json(detail)
    } catch (error) {
      console.error('[Thetanuts API] /api/portfolio/option failed', error)
      const message = error instanceof Error ? error.message : String(error)
      response.status(502).json({ error: `Option lookup failed: ${message}` })
    }
  })

  return app
}
