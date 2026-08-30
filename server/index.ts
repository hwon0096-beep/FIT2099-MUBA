import express from 'express'
import { loadThetanutsData } from './thetanuts.js'

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

app.listen(port, '127.0.0.1', () => {
  console.info(`[Thetanuts API] Listening on http://127.0.0.1:${port}`)
})
