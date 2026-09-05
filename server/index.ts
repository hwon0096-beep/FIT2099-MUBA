import 'dotenv/config'
import { createApp } from './app.js'

const port = 8787

createApp().listen(port, '127.0.0.1', () => {
  console.info(`[Thetanuts API] Listening on http://127.0.0.1:${port}`)
})
