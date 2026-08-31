import { defineConfig } from 'vitest/config'

// Deliberately its own config rather than extending vite.config.ts: the
// server/ tests are plain Node/TS (no React, no dev proxy), so this stays
// decoupled from the frontend build config the same way tsconfig.server.json
// is kept separate from tsconfig.app.json.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
})
