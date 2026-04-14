import * as schema from '{{scope}}/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../utils/db'
import { pub } from '../index'

export const userRouter = {
  list: pub
    .handler(async () => {
      return db.query.users.findMany()
    }),

  get: pub
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      return db.query.users.findFirst({
        where: eq(schema.users.id, input.id),
      })
    }),

  create: pub
    .input(z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
    }))
    .handler(async ({ input }) => {
      const [user] = await db.insert(schema.users).values(input).returning()
      return user
    }),
}
