import { z } from 'zod'
import { pub } from '../index'

export const userRouter = {
  // Replace with your own handlers
  // After running `z7 add postgres`, you can use the db client here
  hello: pub
    .input(z.object({ name: z.string().optional() }))
    .handler(async ({ input }) => {
      return { message: `Hello, ${input.name || 'world'}!` }
    }),
}
