import { serve } from '@hono/node-server'
import * as Sentry from '@sentry/node'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './config'
import { rpc } from './routes/rpc'
import { storage } from './routes/storage'
import { setupWebSocket } from './routes/ws'
import { logger } from './utils/logger'

// Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  })
}

const app = new Hono()

app.use('/*', cors())

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/rpc', rpc)
app.route('/api/storage', storage)

const { injectWebSocket } = setupWebSocket(app)

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
})

injectWebSocket(server)

logger.info(`API server running on port ${env.PORT}`)
