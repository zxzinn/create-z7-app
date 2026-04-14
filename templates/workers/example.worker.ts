import 'dotenv/config'
import * as schema from '{{scope}}/db/schema'
import * as Sentry from '@sentry/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import pino from 'pino'
import postgres from 'postgres'
import { Connection } from 'rabbitmq-client'

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})

// Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  })
}

const QUEUE_NAME = 'example-jobs'

// Database (worker has its own connection)
const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

// RabbitMQ (auto-reconnect built in)
const rabbit = new Connection(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672')

rabbit.on('connection', () => {
  logger.info('RabbitMQ connected')
})

rabbit.on('error', (err) => {
  logger.error({ err }, 'RabbitMQ connection error')
})

interface ExampleJob {
  userId: string
  action: string
}

async function processJob(job: ExampleJob): Promise<void> {
  logger.info({ job }, 'Processing job')

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, job.userId),
  })

  if (user) {
    logger.info({ userId: user.id, action: job.action }, 'Job completed')
  }
  else {
    logger.warn({ userId: job.userId }, 'User not found')
  }
}

// Consumer with auto-reconnect and prefetch
const consumer = rabbit.createConsumer({
  queue: QUEUE_NAME,
  queueOptions: { durable: true },
  concurrency: 1,
}, async (msg) => {
  const job = msg.body as ExampleJob
  await processJob(job)
})

consumer.on('error', (err) => {
  logger.error({ err }, 'Consumer error')
})

logger.info({ queue: QUEUE_NAME }, 'Worker ready, waiting for messages')

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down`)
    await consumer.close()
    await rabbit.close()
    process.exit(0)
  })
}
