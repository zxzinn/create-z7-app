import Redis from 'ioredis'
import { env } from '../config'
import { logger } from './logger'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

export const redisSubscriber = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

redis.ping()
  .then(() => logger.info(`Redis connected to ${env.REDIS_URL}`))
  .catch((err) => {
    logger.fatal({ err }, 'Redis connection failed')
    process.exit(1)
  })
