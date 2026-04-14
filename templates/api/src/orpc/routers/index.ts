import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { userRouter } from './user'

export const router = {
  user: userRouter,
}

export type Router = typeof router
export type RouterInputs = InferRouterInputs<Router>
export type RouterOutputs = InferRouterOutputs<Router>
