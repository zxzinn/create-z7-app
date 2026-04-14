import type { Context as HonoContext } from 'hono'
import { os } from '@orpc/server'

export interface Context {
  c: HonoContext
}

export const pub = os.$context<Context>()
