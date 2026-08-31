import express from 'express'
import { fetchRawOrders, loadThetanutsData } from './thetanuts.js'

const app = express()
const port = 8787

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

app.listen(port, '127.0.0.1', () => {
  console.info(`[Thetanuts API] Listening on http://127.0.0.1:${port}`)
})
