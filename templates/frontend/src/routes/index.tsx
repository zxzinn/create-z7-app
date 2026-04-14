import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getRpcClient } from '~/lib/rpc'

const PROJECT_NAME = '{{projectName}}'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    getRpcClient().user.hello({ name: 'Z7' }).then(res => setMessage(res.message))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          {PROJECT_NAME}
        </h1>
        <p className="text-gray-500 mb-8">
          Powered by Z7 — Hono + React + oRPC + Drizzle
        </p>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <p className="text-lg">{message || 'Loading...'}</p>
        </div>
      </div>
    </div>
  )
}
