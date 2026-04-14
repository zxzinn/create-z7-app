import type { RouterClient } from '@orpc/server'
import type { Router } from 'api/client'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

export type { Router }
export type { RouterOutputs } from 'api/client'

function createClient(): RouterClient<Router> {
  const link = new RPCLink({
    url: `${window.location.origin}/rpc`,
  })
  return createORPCClient(link)
}

let clientInstance: RouterClient<Router> | null = null

export function getRpcClient() {
  if (!clientInstance) {
    clientInstance = createClient()
  }
  return clientInstance
}
