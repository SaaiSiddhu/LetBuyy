/**
 * LCIS API server entry point.
 * Start with: tsx src/server.ts
 * Port: LCIS_API_PORT env (default 7100).
 */
import { serve } from '@hono/node-server'
import { createLogger } from '@letbuyy/lcis-core'
import { createApp } from './app'

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env['LCIS_API_PORT'] ?? 7100)
  const app = createApp()
  const log = createLogger('lcis-api-server')

  serve(
    { fetch: app.fetch, port },
    () => {
      log.info('started', { port, env: process.env['NODE_ENV'] ?? 'development' })
    },
  )
}
