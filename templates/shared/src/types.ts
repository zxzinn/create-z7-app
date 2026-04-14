import type { users } from '{{scope}}/db/schema'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
