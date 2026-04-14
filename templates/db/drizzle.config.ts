import path from 'node:path'
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
