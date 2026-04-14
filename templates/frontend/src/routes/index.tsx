import type { RouterOutputs } from '~/lib/rpc'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getRpcClient } from '~/lib/rpc'

type User = RouterOutputs['user']['list'][number]

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    getRpcClient().user.list().then(setUsers)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          {{projectName}}
        </h1>
        <p className="text-gray-500 mb-8">
          Powered by Z7 — Hono + React + oRPC + Drizzle
        </p>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Users</h2>
          {users.length > 0
            ? (
                <ul className="space-y-2">
                  {users.map(user => (
                    <li key={user.id} className="flex items-center gap-3">
                      <span className="font-medium">{user.name || 'Anonymous'}</span>
                      <span className="text-sm text-gray-400">{user.email}</span>
                    </li>
                  ))}
                </ul>
              )
            : (
                <p className="text-gray-400">No users yet.</p>
              )}
        </div>
      </div>
    </div>
  )
}
