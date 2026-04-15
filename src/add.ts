import * as fs from 'node:fs'
import * as path from 'node:path'

export interface Feature {
  name: string
  description: string
}

export const ADDABLE_FEATURES: Feature[] = [
  { name: 'postgres', description: 'PostgreSQL + Drizzle ORM' },
  { name: 'rabbitmq', description: 'RabbitMQ + worker template (rabbitmq-client)' },
  { name: 's3', description: 'S3-compatible storage (SeaweedFS / MinIO)' },
]

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function writeJson(filePath: string, data: any): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function addDeps(pkgPath: string, deps: Record<string, string>, dev = false): void {
  if (!fs.existsSync(pkgPath)) return
  const pkg = readJson(pkgPath)
  const key = dev ? 'devDependencies' : 'dependencies'
  pkg[key] = { ...pkg[key], ...deps }
  pkg[key] = Object.fromEntries(Object.entries(pkg[key] as Record<string, string>).sort(([a], [b]) => a.localeCompare(b)))
  writeJson(pkgPath, pkg)
}

function appendEnv(envPath: string, lines: string[]): void {
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''
  const toAdd = lines.filter((line) => {
    const key = line.split('=')[0]
    return key && !existing.includes(key)
  })
  if (toAdd.length > 0) {
    const content = existing.endsWith('\n') ? existing : `${existing}\n`
    fs.writeFileSync(envPath, `${content}\n${toAdd.join('\n')}\n`)
  }
}

function addEnvToConfig(fields: string[]): void {
  const configPath = 'apps/api/src/config.ts'
  if (!fs.existsSync(configPath)) return
  let content = fs.readFileSync(configPath, 'utf-8')
  for (const field of fields) {
    if (!content.includes(field.split(':')[0]!.trim())) {
      content = content.replace(
        /(\n)(  NODE_ENV:)/,
        `\n  ${field}\n$2`,
      )
    }
  }
  fs.writeFileSync(configPath, content)
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function writeIfNotExists(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.log(`  Skipping ${path.relative(process.cwd(), filePath)} (already exists)`)
    return
  }
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content)
}

function detectScope(): string {
  const pkgs = ['packages/db/package.json', 'packages/shared/package.json']
  for (const p of pkgs) {
    if (fs.existsSync(p)) {
      const pkg = readJson(p)
      const name = pkg.name as string
      if (name?.startsWith('@')) {
        return name.split('/')[0]!
      }
    }
  }
  return '@app'
}

export async function addFeature(name: string): Promise<void> {
  const scope = detectScope()

  switch (name) {
    case 'postgres':
      return addPostgres(scope)
    case 'redis':
      return addRedis()
    case 'rabbitmq':
      return addRabbitmq(scope)
    case 's3':
      return addS3(scope)
    case 'websocket':
      return addWebSocket()
    default:
      throw new Error(`Unknown feature: ${name}`)
  }
}

function addPostgres(scope: string): void {
  ensureDir('packages/db/src')

  writeIfNotExists('packages/db/package.json', `${JSON.stringify({
    name: `${scope}/db`,
    type: 'module',
    version: '0.0.0',
    private: true,
    exports: { '.': './src/index.ts', './schema': './src/schema.ts' },
    dependencies: { 'drizzle-orm': '^0.45.1', 'postgres': '^3.4.8' },
    devDependencies: { '@types/node': '^22.15.0', 'drizzle-kit': '^0.31.8' },
  }, null, 2)}\n`)

  writeIfNotExists('packages/db/src/schema.ts', `import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
`)

  writeIfNotExists('packages/db/src/index.ts', `export * from './schema'\n`)

  writeIfNotExists('packages/db/drizzle.config.ts', `import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  schema: path.resolve(__dirname, 'src/schema.ts'),
  out: path.resolve(__dirname, 'migrations'),
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
`)

  writeIfNotExists('packages/db/tsconfig.json', `${JSON.stringify({
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*.ts', 'drizzle.config.ts'],
  }, null, 2)}\n`)

  writeIfNotExists('apps/api/src/utils/db.ts', `import * as schema from '${scope}/db/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config'
import { logger } from './logger'

const client = postgres(env.DATABASE_URL)
export const db = drizzle(client, { schema })

// Verify connection on startup
db.execute(sql\`SELECT 1\`)
  .then(() => logger.info(\`PostgreSQL connected to \${env.DATABASE_URL.replace(/\\/\\/.*@/, '//***@')}\`))
  .catch((err) => {
    logger.fatal({ err }, 'PostgreSQL connection failed')
    process.exit(1)
  })
`)

  addDeps('apps/api/package.json', {
    [`${scope}/db`]: 'workspace:*',
    'drizzle-orm': '^0.45.1',
    'postgres': '^3.4.8',
  })

  addDeps('package.json', { 'drizzle-kit': '^0.31.8' }, true)

  // Add db scripts to root package.json
  if (fs.existsSync('package.json')) {
    const pkg = readJson('package.json')
    pkg.scripts = pkg.scripts || {}
    if (!pkg.scripts['db:generate']) {
      pkg.scripts['db:generate'] = 'drizzle-kit generate --config packages/db/drizzle.config.ts'
      pkg.scripts['db:migrate'] = 'drizzle-kit migrate --config packages/db/drizzle.config.ts'
      pkg.scripts['db:push'] = 'drizzle-kit push --config packages/db/drizzle.config.ts'
      pkg.scripts['db:studio'] = 'drizzle-kit studio --config packages/db/drizzle.config.ts'
      writeJson('package.json', pkg)
    }
  }

  addEnvToConfig(["DATABASE_URL: z.string().url(),"])

  appendEnv('.env', ['DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp'])
  appendEnv('.env.example', ['DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp'])
}

function addRedis(): void {
  writeIfNotExists('apps/api/src/utils/redis.ts', `import Redis from 'ioredis'
import { env } from '../config'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

export const redisSubscriber = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})
`)

  addDeps('apps/api/package.json', { ioredis: '^5.9.1' })

  addEnvToConfig(["REDIS_URL: z.string().url(),"])

  appendEnv('.env', ['REDIS_URL=redis://localhost:6379'])
  appendEnv('.env.example', ['REDIS_URL=redis://localhost:6379'])
}

function addRabbitmq(scope: string): void {
  writeIfNotExists('apps/api/src/utils/rabbitmq.ts', `import { Connection } from 'rabbitmq-client'
import { env } from '../config'
import { logger } from './logger'

export const rabbit = new Connection(env.RABBITMQ_URL)

rabbit.on('connection', () => {
  logger.info(\`RabbitMQ connected to \${env.RABBITMQ_URL.replace(/\\/\\/.*@/, '//***@')}\`)
})

rabbit.on('error', (err) => {
  logger.error({ err }, 'RabbitMQ connection error')
})

process.on('SIGINT', async () => {
  await rabbit.close()
})
process.on('SIGTERM', async () => {
  await rabbit.close()
})
`)

  addDeps('apps/api/package.json', { 'rabbitmq-client': '^5.0.0' })

  ensureDir('workers')

  writeIfNotExists('workers/package.json', `${JSON.stringify({
    name: 'workers',
    type: 'module',
    version: '0.0.0',
    private: true,
    scripts: {
      dev: 'tsx watch --env-file=../.env example.worker.ts',
      start: 'tsx example.worker.ts',
    },
    dependencies: {
      [`${scope}/db`]: 'workspace:*',
      [`${scope}/shared`]: 'workspace:*',
      '@sentry/node': '^9.27.0',
      'drizzle-orm': '^0.45.1',
      'ioredis': '^5.9.1',
      'pino': '^9.6.0',
      'pino-pretty': '^13.1.3',
      'postgres': '^3.4.8',
      'rabbitmq-client': '^5.0.0',
    },
    devDependencies: {
      tsx: '^4.21.0',
      typescript: '^5.8.3',
    },
  }, null, 2)}\n`)

  writeIfNotExists('workers/example.worker.ts', `import * as Sentry from '@sentry/node'
import * as schema from '${scope}/db/schema'
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

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 1.0 })
}

const QUEUE_NAME = 'example-jobs'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

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

const consumer = rabbit.createConsumer({
  queue: QUEUE_NAME,
  queueOptions: { durable: true },
  concurrency: 1,
}, async (msg) => {
  const job = msg.body as ExampleJob
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
})

consumer.on('error', (err) => {
  logger.error({ err }, 'Consumer error')
})

logger.info({ queue: QUEUE_NAME }, 'Worker ready, waiting for messages')

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    logger.info(\`Received \${signal}, shutting down\`)
    await consumer.close()
    await rabbit.close()
    process.exit(0)
  })
}
`)

  writeIfNotExists('workers/tsconfig.json', `${JSON.stringify({
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['./**/*.ts'],
  }, null, 2)}\n`)

  addEnvToConfig(["RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),"])

  appendEnv('.env', ['RABBITMQ_URL=amqp://guest:guest@localhost:5672'])
  appendEnv('.env.example', ['RABBITMQ_URL=amqp://guest:guest@localhost:5672'])
}

function addS3(scope: string): void {
  ensureDir('packages/shared/src')

  writeIfNotExists('packages/shared/src/s3.ts', `import type { Buffer } from 'node:buffer'
import { extname } from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
}

export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
})

export const S3_BUCKET = process.env.S3_BUCKET || 'app'

export async function uploadFile(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: key, Body: body,
    ContentType: contentType || getMimeType(key),
  }))
}

export async function getFile(key: string) {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
  return {
    body: response.Body as NodeJS.ReadableStream,
    contentLength: response.ContentLength || 0,
    contentType: response.ContentType || getMimeType(key),
  }
}

export async function getFileRange(key: string, range: string) {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key, Range: range }))
  return {
    body: response.Body as NodeJS.ReadableStream,
    contentLength: response.ContentLength || 0,
    contentRange: response.ContentRange || '',
    contentType: response.ContentType || getMimeType(key),
  }
}

export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
}

export async function headFile(key: string) {
  const response = await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }))
  return { contentLength: response.ContentLength || 0, contentType: response.ContentType || getMimeType(key) }
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await headFile(key)
    return true
  }
  catch {
    return false
  }
}
`)

  if (fs.existsSync('packages/shared/package.json')) {
    const pkg = readJson('packages/shared/package.json')
    if (!pkg.exports) pkg.exports = {}
    if (!pkg.exports['./s3']) {
      pkg.exports['./s3'] = './src/s3.ts'
      writeJson('packages/shared/package.json', pkg)
    }
    addDeps('packages/shared/package.json', { '@aws-sdk/client-s3': '^3.1023.0' })
  }

  writeIfNotExists('apps/api/src/routes/storage.ts', `import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { getFile, getFileRange, getMimeType } from '${scope}/shared/s3'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'

function toWebStream(body: NodeJS.ReadableStream): ReadableStream {
  return Readable.toWeb(body as Readable) as unknown as ReadableStream
}

const storage = new Hono()

storage.get('/*', async (c) => {
  const pathParam = c.req.path.replace('/api/storage/', '')
  if (!pathParam) return c.text('Path is required', 400)

  const normalizedPath = pathParam.replace(/\\.\\./g, '').replace(/\\/+/g, '/')
  const ext = extname(normalizedPath).toLowerCase()
  const contentType = getMimeType(normalizedPath)
  const isVideo = ext === '.mp4' || ext === '.webm'

  try {
    const rangeHeader = c.req.header('range')
    if (isVideo && rangeHeader) {
      const result = await getFileRange(normalizedPath, rangeHeader)
      return stream(c, async (s) => {
        c.status(206)
        c.header('Content-Type', contentType)
        c.header('Content-Range', result.contentRange)
        c.header('Accept-Ranges', 'bytes')
        c.header('Content-Length', result.contentLength.toString())
        c.header('Cache-Control', 'public, max-age=31536000, immutable')
        await s.pipe(toWebStream(result.body))
      })
    }
    const result = await getFile(normalizedPath)
    return stream(c, async (s) => {
      c.header('Content-Type', contentType)
      c.header('Content-Length', result.contentLength.toString())
      c.header('Cache-Control', 'public, max-age=31536000, immutable')
      if (isVideo) c.header('Accept-Ranges', 'bytes')
      await s.pipe(toWebStream(result.body))
    })
  }
  catch (err: unknown) {
    const code = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (code === 404 || (err as { name?: string }).name === 'NoSuchKey') {
      return c.text('File not found', 404)
    }
    throw err
  }
})

export { storage }
`)

  addDeps('apps/api/package.json', {
    '@aws-sdk/client-s3': '^3.1023.0',
    [`${scope}/shared`]: 'workspace:*',
  })

  addEnvToConfig([
    "S3_ENDPOINT: z.string().url(),",
    "S3_BUCKET: z.string(),",
    "S3_ACCESS_KEY: z.string(),",
    "S3_SECRET_KEY: z.string(),",
    "S3_REGION: z.string().default('us-east-1'),",
  ])

  appendEnv('.env', [
    'S3_ENDPOINT=http://localhost:8333',
    'S3_BUCKET=app',
    'S3_ACCESS_KEY=admin',
    'S3_SECRET_KEY=admin',
    'S3_REGION=us-east-1',
  ])
  appendEnv('.env.example', [
    'S3_ENDPOINT=http://localhost:8333',
    'S3_BUCKET=app',
    'S3_ACCESS_KEY=admin',
    'S3_SECRET_KEY=admin',
    'S3_REGION=us-east-1',
  ])
}

function addWebSocket(): void {
  // WebSocket requires redis
  if (!fs.existsSync('apps/api/src/utils/redis.ts')) {
    console.log('  WebSocket requires Redis. Adding Redis first...')
    addRedis()
  }

  writeIfNotExists('apps/api/src/routes/ws.ts', `import type { Hono } from 'hono'
import type { WSContext } from 'hono/ws'
import { createNodeWebSocket } from '@hono/node-ws'
import { redisSubscriber } from '../utils/redis'

const WS_CHANNEL = 'ws:events'
const peers = new Set<WSContext>()

let isSubscribed = false

async function setupRedisSubscription() {
  if (isSubscribed) return
  isSubscribed = true

  await redisSubscriber.subscribe(WS_CHANNEL)
  redisSubscriber.on('message', (channel, message) => {
    if (channel === WS_CHANNEL) {
      for (const peer of peers) {
        peer.send(message)
      }
    }
  })
}

export function setupWebSocket(app: Hono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app: app as any })

  app.get('/_ws', upgradeWebSocket(() => ({
    async onOpen(_event, ws) {
      peers.add(ws)
      await setupRedisSubscription()
      ws.send(JSON.stringify({ type: 'connected', peersCount: peers.size }))
    },
    onMessage(event, ws) {
      const data = typeof event.data === 'string' ? event.data : ''
      if (data === 'ping') ws.send('pong')
    },
    onClose(_event, ws) {
      peers.delete(ws)
    },
    onError(_event, ws) {
      peers.delete(ws)
    },
  })))

  return { injectWebSocket }
}
`)

  addDeps('apps/api/package.json', { '@hono/node-ws': '^1.1.1' })
}
