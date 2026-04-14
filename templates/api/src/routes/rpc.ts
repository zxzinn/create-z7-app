import { RPCHandler } from '@orpc/server/fetch'
import { Hono } from 'hono'
import { router } from '../orpc/routers'

const rpc = new Hono()
const handler = new RPCHandler(router)

rpc.all('/*', async (c) => {
  const { response } = await handler.handle(c.req.raw, {
    prefix: '/rpc',
    context: { c },
  })

  if (response)
    return response
  return c.text('Not found', 404)
})

export { rpc }
