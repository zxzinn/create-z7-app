import type { Hono } from 'hono'
import type { WSContext } from 'hono/ws'
import { createNodeWebSocket } from '@hono/node-ws'
import { redisSubscriber } from '../utils/redis'

const WS_CHANNEL = 'ws:events'
const peers = new Set<WSContext>()

let isSubscribed = false

async function setupRedisSubscription() {
  if (isSubscribed)
    return
  isSubscribed = true

  await redisSubscriber.subscribe(WS_CHANNEL)
  redisSubscriber.on('message', (channel, message) => {
    if (channel === WS_CHANNEL) {
      for (const peer of peers) {
        peer.send(message)
      }
    }
  })
}

export function setupWebSocket(app: Hono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app: app as any })

  app.get('/_ws', upgradeWebSocket(() => ({
    async onOpen(_event, ws) {
      peers.add(ws)
      await setupRedisSubscription()
      ws.send(JSON.stringify({ type: 'connected', peersCount: peers.size }))
    },
    onMessage(event, ws) {
      const data = typeof event.data === 'string' ? event.data : ''
      if (data === 'ping')
        ws.send('pong')
    },
    onClose(_event, ws) {
      peers.delete(ws)
    },
    onError(_event, ws) {
      peers.delete(ws)
    },
  })))

  return { injectWebSocket }
}
