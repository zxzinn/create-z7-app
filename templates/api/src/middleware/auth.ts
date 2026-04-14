import type { Context } from 'hono'

export interface AuthUser {
  id: string
  email?: string
}

/**
 * Get the authenticated user from the request.
 * Replace this with your auth provider (Firebase, Better Auth, Clerk, etc.)
 */
export async function getCurrentUser(_c: Context): Promise<AuthUser | null> {
  // TODO: Implement your auth logic here
  // Example with Bearer token:
  //
  // const token = c.req.header('authorization')?.replace('Bearer ', '')
  // if (!token) return null
  // const decoded = await verifyToken(token)
  // return { id: decoded.sub, email: decoded.email }

  return null
}
