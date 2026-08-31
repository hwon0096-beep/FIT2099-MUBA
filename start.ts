import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createApp } from './server/app.js'

// Production/deployment entrypoint: one process, one port, serving the built
// frontend (dist/, from `npm run build`) and the API routes together. Local
// dev keeps using `npm run dev` (Vite on 5173 proxying to server/index.ts on
// 8787) — this file is never used there.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const port = Number(process.env.PORT) || 8080

const app = createApp()

app.use(express.static(distDir))

app.use((request, response) => {
  if (request.method !== 'GET' || request.path.startsWith('/api') || request.path === '/healthz') {
    response.status(404).json({ error: 'Not found' })
    return
  }
  response.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, () => {
  console.info(`[Thetanuts] Serving dist/ and the API on http://localhost:${port}`)
})
