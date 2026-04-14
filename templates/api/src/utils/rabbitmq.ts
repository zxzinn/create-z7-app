import { Connection } from 'rabbitmq-client'
import { env } from '../config'
import { logger } from './logger'

export const rabbit = new Connection(env.RABBITMQ_URL)

rabbit.on('connection', () => {
  logger.info('RabbitMQ connected')
})

rabbit.on('error', (err) => {
  logger.error({ err }, 'RabbitMQ connection error')
})

// Graceful shutdown
process.on('SIGINT', async () => {
  await rabbit.close()
})
process.on('SIGTERM', async () => {
  await rabbit.close()
})
